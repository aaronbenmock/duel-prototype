// Draws the duel: background, opponent creature, crosshair, hand-and-gun view,
// paint effects and HUD. Reads game state; never changes it.
import fxImpactUrl from '../../art/exports/effects/fx_paint-yellow_impact.webp';
import fxMuzzleUrl from '../../art/exports/effects/fx_paint-yellow_muzzle-burst.webp';
import fxProjectileUrl from '../../art/exports/effects/fx_paint-yellow_projectile.webp';
import fxSplatAUrl from '../../art/exports/effects/fx_paint-yellow_splat-a.webp';
import fxSplatBUrl from '../../art/exports/effects/fx_paint-yellow_splat-b.webp';
import { alienName, CREATURES } from '../game/creatures';
import { apparentTarget, currentSpread, drawTime, MAX_HP, OPPONENT_Y, PAINT_FLIGHT_MS, parallax, recoilOffset } from '../game/duel';
import { MAPS } from '../game/maps';
import { BUCKLE_FIT, CHARM_SIZE, CREATURE_ART, ITEM_ART, creatureUrl, GUN_ART, MAP_ART, PAINT_ART, paintCss, povUrl } from './art';
import { WEAPONS } from '../game/weapons';
import type { DuelState, HitZone, Pellet, Vec2 } from '../game/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The screen is this many aim units wide (so 1 unit = 1 degree at sensitivity 1). */
const VIEW_WIDTH = 40;
/** How far away the background is, for sidestep parallax. */
const BG_PARALLAX_DIST = 40;
/** Player paint flight time (ms); splats appear when it lands. */
const FLIGHT_MS = PAINT_FLIGHT_MS;
/** Bot paint flight time toward the camera (ms). */
export const BOT_FLIGHT_MS = 170;
/** The bot's paint is tinted so it's clearly different from yours (yellow shifted to teal). */
const BOT_TINT = 'hue-rotate(140deg) saturate(1.2)';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.appendChild(el);
  return el;
}

function img(src: string, cls: string, parent: HTMLElement): HTMLImageElement {
  const el = document.createElement('img');
  el.src = src;
  el.className = cls;
  el.alt = '';
  el.draggable = false;
  parent.appendChild(el);
  return el;
}

/** How long the results buttons ignore taps after the round ends. */
const RESULT_LOCK_MS = 1000;

const fmtSec = (ms: number | null) => (ms == null ? '--' : (ms / 1000).toFixed(2) + ' s');
const ZONE_LABEL: Record<Exclude<HitZone, null>, string> = { face: 'FACE!', torso: 'BODY', limb: 'LIMB', tail: 'TAIL' };

export class GameView {
  readonly el: HTMLElement;
  onFire: (t: number) => void = () => {};
  onReload: () => void = () => {};
  onAgain: () => void = () => {};
  onMenu: () => void = () => {};
  onSettings: () => void = () => {};
  /** Flags the round just played for Claude to look at; returns false if cancelled. */
  onFlag: () => Promise<boolean> = async () => false;
  onShareLog: () => void = () => {};
  /** Draw the hit-zone overlay on the opponent (testing aid). */
  showZones = false;
  /** Skins (looks only): yours for the first-person hand, the bot's for this round. */
  playerSkin = 'original';
  botSkin = 'original';
  /** The bot's belt buckle this round (item id), or null. */
  botBuckle: string | null = null;
  private buckle!: SVGImageElement;
  /** Picture of your gun charm, or '' for none. */
  charmUrl = '';
  private charm!: HTMLImageElement;
  /** Charm pendulum: swing angle (deg), its speed, and the gun's last rotation. */
  private charmSwing = 0;
  private charmVel = 0;
  private gunRot = 0;
  private swingAt = 0;
  private swingAcc = 0;
  /** Show the on-screen Reload button (off by default; dip or flick the phone instead). */
  showReloadButton = false;

  /** Your paint colour (CSS filter for the flying paint; SVG filter for splats on the opponent). */
  private paintFilter = '';
  private paintHue: SVGFEColorMatrixElement;
  private paintSat: SVGFEColorMatrixElement;
  private paintBright: SVGFEFuncRElement[] = [];
  private svgEl: SVGSVGElement;
  private bgLayer: SVGGElement;
  private bgImage: SVGImageElement;
  /** Map (background) currently shown. */
  private map = MAPS[0];
  private opponent: SVGGElement;
  private sprite: SVGImageElement;
  private zones: SVGImageElement;
  private maskImage: SVGImageElement;
  private splats: SVGGElement;
  private shadow: SVGEllipseElement;
  private cross: SVGGElement;
  /** Faint dot where the phone points: the crosshair glides back here after a kick. */
  private restDot: SVGCircleElement;
  /** Ring that pops when the gun has settled after a kick. */
  private readyRing: SVGCircleElement;
  private wasSettled = true;
  /** Called when the gun settles after a kick (for the ready click). */
  onSettled: (weapon: string) => void = () => {};
  /** Spread guns: circle showing where the blobs will land; shrinks as the choke tightens. */
  private spreadRing: SVGCircleElement;
  private botReloadTag: SVGTextElement;
  private cylSize = 0;
  private fxScene: HTMLElement;
  private fxScreen: HTMLElement;
  private gun: HTMLImageElement;
  private splatKey = '';
  private creature = '';
  private gunKey = '';
  private $: (sel: string) => HTMLElement;
  private shownResult: string | null = null;
  private unlockTimer: ReturnType<typeof setTimeout> | undefined;
  private prevAim: Vec2 | null = null;
  private sway = { x: 0, y: 0 };

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'game hidden';
    this.el.innerHTML = `
      <div class="fx-layer" id="g-fx-scene"></div>
      <div class="vm-wrap hidden" id="g-vm"><div class="vm-kick" id="g-vmk"></div></div>
      <div class="fx-layer" id="g-fx-screen"></div>
      <div class="hud-top">
        <div class="hp"><span>YOU</span><div class="bar"><i id="g-php"></i></div></div>
        <div class="hp"><span id="g-bname">OPPONENT</span><div class="bar"><i id="g-bhp"></i></div></div>
      </div>
      <div class="readout hidden" id="g-readout"></div>
      <div class="need-flash" id="g-need"></div>
      <div class="msg" id="g-msg"><div class="big" id="g-big"></div><div class="small" id="g-small"></div></div>
      <div class="hud-bottom">
        <div class="cyl" id="g-cyl"></div>
        <div class="dtime" id="g-dtime"></div>
        <button class="secondary reload-btn" id="g-reload">Reload</button>
      </div>
      <div class="result hidden" id="g-result">
        <div class="panel">
          <div class="result-links">
            <button class="link" id="r-menu">Menu</button>
            <button class="link" id="r-settings">Settings</button>
          </div>
          <h1 id="r-title"></h1>
          <p class="sub" id="r-note"></p>
          <div class="records hidden" id="r-records"></div>
          <div class="grid" id="r-stats"></div>
          <button id="r-again">Again</button>
          <div class="log-row">
            <button class="secondary small-btn" id="r-flag">Something felt off</button>
            <button class="secondary small-btn" id="r-share">Share log</button>
          </div>
          <p class="log-status" id="r-logstatus"></p>
        </div>
      </div>`;
    parent.appendChild(this.el);
    this.$ = (id: string) => this.el.querySelector<HTMLElement>('#' + id)!;
    this.fxScene = this.$('g-fx-scene');
    this.fxScreen = this.$('g-fx-screen');
    this.gun = img('', 'vm', this.$('g-vmk'));
    this.charm = img('', 'vm-charm hidden', this.$('g-vmk'));

    // ---- Scene (SVG in aim units: 1 unit = 1 degree, y up = negative SVG y) ----
    this.svgEl = svg('svg', { class: 'scene', preserveAspectRatio: 'xMidYMid slice' });
    this.el.prepend(this.svgEl);
    const defs = svg('defs', {}, this.svgEl);
    // Turns the creature image into a solid white silhouette, used as a mask so
    // paint splats only show on the creature itself.
    const white = svg('filter', { id: 'to-white' }, defs);
    svg('feColorMatrix', { type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0' }, white);
    const mask = svg('mask', { id: 'creature-mask', maskUnits: 'userSpaceOnUse', x: -50, y: -50, width: 100, height: 100 }, defs);
    this.maskImage = svg('image', { filter: 'url(#to-white)' }, mask);
    // Your paint colour for splats on the opponent (same shift as paintCss).
    const tint = svg('filter', { id: 'paint-tint', 'color-interpolation-filters': 'sRGB' }, defs);
    this.paintHue = svg('feColorMatrix', { type: 'hueRotate', values: '0' }, tint);
    this.paintSat = svg('feColorMatrix', { type: 'saturate', values: '1' }, tint);
    const bright = svg('feComponentTransfer', {}, tint);
    for (const fn of ['feFuncR', 'feFuncG', 'feFuncB'] as const) this.paintBright.push(svg(fn, { type: 'linear', slope: 1 }, bright) as SVGFEFuncRElement);

    this.bgLayer = svg('g', {}, this.svgEl);
    this.bgImage = svg('image', { href: MAP_ART[this.map].url, preserveAspectRatio: 'none' }, this.bgLayer);
    // Load every map up front so a new round never flashes an empty background.
    for (const m of Object.values(MAP_ART)) new Image().src = m.url;

    this.opponent = svg('g', {}, this.svgEl);
    this.shadow = svg('ellipse', { fill: 'rgba(40, 10, 50, 0.35)' }, this.opponent);
    this.sprite = svg('image', {}, this.opponent);
    this.buckle = svg('image', {}, this.opponent);
    this.splats = svg('g', { mask: 'url(#creature-mask)' }, this.opponent);
    this.zones = svg('image', { opacity: 0.9 }, this.opponent);
    // "RELOADING" tag over the opponent's hat while it reloads (animations later).
    this.botReloadTag = svg('text', { class: 'bot-reload', 'text-anchor': 'middle', 'font-size': 1.3 }, this.opponent);
    this.botReloadTag.textContent = 'RELOADING';

    this.restDot = svg('circle', { r: 0.4, class: 'rest-dot' }, this.svgEl);
    this.readyRing = svg('circle', { r: 1.3, class: 'ready-ring' }, this.svgEl);
    this.spreadRing = svg('circle', { class: 'spread-ring' }, this.svgEl);
    this.cross = svg('g', { class: 'cross' }, this.svgEl);
    for (const [color, width] of [['rgba(0,0,0,0.55)', 0.42], ['#fff', 0.18]] as const) {
      svg('circle', { r: 1.3, fill: 'none', stroke: color, 'stroke-width': width }, this.cross);
      for (const [x1, y1, x2, y2] of [[-2.4, 0, -0.6, 0], [0.6, 0, 2.4, 0], [0, -2.4, 0, -0.6], [0, 0.6, 0, 2.4]]) {
        svg('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width }, this.cross);
      }
    }
    svg('circle', { r: 0.18, fill: '#ffd23f', stroke: '#000', 'stroke-width': 0.06 }, this.cross);

    // Tap anywhere (except buttons) to shoot. pointerdown fires the instant the finger lands.
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button, .result')) return;
      e.preventDefault();
      this.onFire(e.timeStamp || performance.now());
    });
    this.$('g-reload').addEventListener('click', () => this.onReload());
    this.$('r-again').addEventListener('click', () => this.onAgain());
    this.$('r-menu').addEventListener('click', () => this.onMenu());
    this.$('r-settings').addEventListener('click', () => this.onSettings());
    this.$('r-flag').addEventListener('click', () => {
      const btn = this.$('r-flag');
      void this.onFlag().then((ok) => {
        if (ok) btn.textContent = 'Flagged for Claude';
      });
    });
    this.$('r-share').addEventListener('click', () => this.onShareLog());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  show(visible: boolean) {
    this.el.classList.toggle('hidden', !visible);
  }

  /** SVG y grows downward; aim y grows upward. */
  private static sy(y: number) {
    return -y;
  }

  private resize() {
    const viewH = (VIEW_WIDTH * window.innerHeight) / Math.max(1, window.innerWidth);
    this.svgEl.setAttribute('viewBox', `${-VIEW_WIDTH / 2} ${-viewH / 2} ${VIEW_WIDTH} ${viewH}`);
    // Cover the screen with the background, and pin its street to the opponent's feet.
    const bg = MAP_ART[this.map];
    const w = Math.max(VIEW_WIDTH + 6, (viewH * bg.w) / bg.h);
    const h = (w * bg.h) / bg.w;
    const c = Object.values(CREATURES)[0];
    const feetSvgY = GameView.sy(OPPONENT_Y) + (c.baselineY - c.torsoPx[1]) / c.pxPerUnit;
    let top = feetSvgY - bg.streetFrac * h;
    // Never leave a gap at the top or bottom of the screen.
    top = Math.min(-viewH / 2, Math.max(viewH / 2 - h, top));
    for (const [k, v] of Object.entries({ x: -w / 2, y: top, width: w, height: h })) this.bgImage.setAttribute(k, String(v));
  }

  /** Shows the round's background, placed so its street is under the opponent's feet. */
  private setMap(id: string) {
    if (id === this.map || !MAP_ART[id]) return;
    this.map = id;
    this.bgImage.setAttribute('href', MAP_ART[id].url);
    this.resize();
  }

  /** Places the creature sprite (and its mask and zone overlay) in the opponent group. */
  private setCreature(slug: string) {
    const key = slug + '|' + this.botSkin + '|' + this.botBuckle;
    if (key === this.creature) return;
    this.creature = key;
    const c = CREATURES[slug];
    const art = CREATURE_ART[slug];
    const k = c.pxPerUnit;
    const size = c.canvas / k;
    const box = { x: -c.torsoPx[0] / k, y: -c.torsoPx[1] / k, width: size, height: size };
    for (const el of [this.sprite, this.maskImage, this.zones]) {
      for (const [k, v] of Object.entries(box)) el.setAttribute(k, String(v));
    }
    // Skins keep the sprite's outline exactly, so the zone map and mask fit every skin.
    this.sprite.setAttribute('href', creatureUrl(slug, this.botSkin));
    // Buckle over the painted one (looks only: zones come from the sprite, and it sits on the torso).
    const fit = this.botBuckle ? BUCKLE_FIT[slug]?.[this.botBuckle] : undefined;
    this.buckle.style.display = fit ? '' : 'none';
    if (fit && this.botBuckle) {
      for (const [a, v] of Object.entries({ x: (fit.x - c.torsoPx[0]) / k, y: (fit.y - c.torsoPx[1]) / k, width: fit.size / k, height: fit.size / k })) {
        this.buckle.setAttribute(a, String(v));
      }
      this.buckle.setAttribute('href', ITEM_ART[this.botBuckle]);
    }
    this.botReloadTag.setAttribute('y', String((50 - c.torsoPx[1]) / k)); // just above the tallest hat (y 63)
    this.maskImage.setAttribute('href', art.url);
    this.zones.setAttribute('href', art.zonesUrl);
    this.shadow.setAttribute('cy', String((c.baselineY - c.torsoPx[1]) / k - 0.1));
    this.shadow.setAttribute('rx', String(205 / k));
    this.shadow.setAttribute('ry', String(35 / k));
    this.$('g-bname').textContent = alienName(slug).toUpperCase();
  }

  /** The player's hand-and-gun image, for their alien and gun. */
  private setGun(creature: string, weapon: string) {
    const key = creature + '|' + weapon + '|' + this.playerSkin + '|' + this.charmUrl;
    if (key === this.gunKey) return;
    this.gunKey = key;
    const art = GUN_ART[weapon];
    this.gun.src = povUrl(weapon, creature, this.playerSkin);
    this.charm.classList.toggle('hidden', !this.charmUrl);
    if (this.charmUrl) {
      this.charm.src = this.charmUrl;
      Object.assign(this.charm.style, { left: `${art.charm.x * 100}%`, top: `${art.charm.y * 100}%`, width: `${CHARM_SIZE * 100}%` });
    }
    this.$('g-vm').className = 'vm-wrap ' + art.cls + (this.$('g-vm').classList.contains('hidden') ? ' hidden' : '');
  }

  /** Small detection readout under the health bars; null hides it. */
  setReadout(text: string | null) {
    const el = this.$('g-readout');
    el.classList.toggle('hidden', text == null);
    if (text != null && el.textContent !== text) el.textContent = text;
  }

  /** Line under the log buttons on the results screen (saved / uploaded / waiting). */
  /** New personal records from the round just finished ("Fastest draw yet!"); empty hides the line. */
  setRecords(lines: string[]) {
    const el = this.$('r-records');
    el.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    el.classList.toggle('hidden', lines.length === 0);
  }

  setLogStatus(text: string) {
    this.$('r-logstatus').textContent = text;
  }

  /** Tapped a gun that can't fire: flash the screen edge and pulse the prompt. */
  needAction(text: 'RELOAD' | 'OVERHEATED') {
    this.$('g-big').textContent = text;
    this.restartClass(this.$('g-msg'), 'pulse');
    this.restartClass(this.$('g-need'), 'on');
    this.restartClass(this.$('g-cyl'), 'blink');
  }

  /** The last round just went: blink the ammo display. */
  lastRound() {
    this.restartClass(this.$('g-cyl'), 'blink');
  }

  private restartClass(el: HTMLElement, cls: string) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /** Gun kicks up on a shot. */
  kick() {
    this.restartAnim(this.$('g-vmk'), 'kick');
    this.charmVel += 7;
  }

  /** Gun dips down and back up on a reload. */
  reloadAnim() {
    this.restartAnim(this.$('g-vmk'), 'reloading');
  }

  private restartAnim(el: HTMLElement, cls: string) {
    el.classList.remove('kick', 'reloading');
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---- Paint effects (HTML overlays in screen pixels) ----

  private aimToScreen(p: Vec2): { x: number; y: number } {
    const k = window.innerWidth / VIEW_WIDTH;
    return { x: window.innerWidth / 2 + p.x * k, y: window.innerHeight / 2 - p.y * k };
  }

  /** A one-shot image effect centered on a point; removed when its animation ends. */
  private fx(
    layer: HTMLElement,
    src: string,
    at: { x: number; y: number },
    size: number,
    frames: Keyframe[],
    ms: number,
    opts: { anchor?: [number, number]; filter?: string; delay?: number } = {},
  ) {
    const el = img(src, 'fx', layer);
    const [ax, ay] = opts.anchor ?? [0.5, 0.5];
    Object.assign(el.style, {
      width: size + 'px',
      height: size + 'px',
      left: at.x - ax * size + 'px',
      top: at.y - ay * size + 'px',
      transformOrigin: `${ax * 100}% ${ay * 100}%`,
      filter: opts.filter ?? '',
      opacity: '0',
    });
    const anim = el.animate(frames, { duration: ms, delay: opts.delay ?? 0, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = () => el.remove();
  }

  private floatText(text: string, at: { x: number; y: number }, cls: string, delay: number) {
    const el = document.createElement('div');
    el.className = 'dmg ' + cls;
    el.textContent = text;
    Object.assign(el.style, { left: at.x + 'px', top: at.y + 'px', opacity: '0' });
    this.fxScreen.appendChild(el);
    const anim = el.animate(
      [
        { opacity: 1, transform: 'translate(-50%, -50%) scale(0.7)' },
        { opacity: 1, transform: 'translate(-50%, -120%) scale(1.1)', offset: 0.3 },
        { opacity: 0, transform: 'translate(-50%, -220%) scale(1)' },
      ],
      { duration: 800, delay, easing: 'ease-out', fill: 'forwards' },
    );
    anim.onfinish = () => el.remove();
  }

  /** Your paint colour (an id in PAINT_ART). */
  setPaint(id: string) {
    const p = PAINT_ART[id] ?? PAINT_ART.yellow;
    this.paintFilter = paintCss(id);
    this.paintHue.setAttribute('values', String(p.hue));
    this.paintSat.setAttribute('values', String(p.sat));
    for (const fn of this.paintBright) fn.setAttribute('slope', String(p.bright));
    this.splatKey = '';
  }

  /** Your paint colour, or the gun's own colour (raygun green) with the default yellow. */
  private shotTint(weapon: string): string {
    return this.paintFilter || (GUN_ART[weapon].tint ?? '');
  }

  /** Your shot: paint bursts from the muzzle, flies to the crosshair point and splats. */
  playerShot(zone: HitZone, aim: Vec2, damage: number, weapon: string, pellets: Pellet[], travelMs = 0, charged = false) {
    // Travelling bolts (raygun): a slower, tinted bolt; the result shows when it lands (boltHit).
    const bolt = travelMs > 0;
    const flight = bolt ? travelMs : FLIGHT_MS;
    const tint = this.shotTint(weapon);
    const r = this.gun.getBoundingClientRect();
    const muzzle = GUN_ART[weapon].muzzle;
    const from = { x: r.left + muzzle.x * r.width, y: r.top + muzzle.y * r.height };
    const to = this.aimToScreen(aim);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const w = window.innerWidth;
    const spread = pellets.length > 1;
    // Muzzle burst, pointing along the shot (bigger for a spread gun).
    this.fx(this.fxScreen, fxMuzzleUrl, from, w * (spread ? 0.45 : 0.3), [
      { opacity: 1, transform: `rotate(${angle}deg) scale(0.5)` },
      { opacity: 0, transform: `rotate(${angle}deg) scale(1.1)` },
    ], 180, { anchor: [0.14, 0.51], filter: tint });
    for (const p of pellets) {
      const at = this.aimToScreen(p);
      const a = (Math.atan2(at.y - from.y, at.x - from.x) * 180) / Math.PI;
      // Paint blob flying away from you (shrinks with distance).
      this.fx(this.fxScene, fxProjectileUrl, from, w * (spread ? 0.12 : 0.22) * (charged ? 1.3 : 1), [
        { opacity: 1, transform: `translate(0, 0) rotate(${a}deg) scale(1)` },
        { opacity: 1, transform: `translate(${at.x - from.x}px, ${at.y - from.y}px) rotate(${a}deg) scale(0.25)` },
      ], flight, { filter: tint + (charged ? ' brightness(1.5)' : '') });
      if (bolt) continue;
      // Impact burst where it lands.
      this.fx(this.fxScene, fxImpactUrl, at, w * (p.zone ? 0.16 : 0.1) * (spread ? 0.5 : 1), [
        { opacity: 1, transform: `rotate(${Math.random() * 360}deg) scale(0.3)` },
        { opacity: 1, transform: 'scale(1)', offset: 0.35 },
        { opacity: 0, transform: 'scale(1.15)' },
      ], 380, { delay: FLIGHT_MS, filter: this.paintFilter });
    }
    if (bolt) return;
    if (zone) this.floatText(`${ZONE_LABEL[zone]} ${damage}`, to, zone === 'face' ? 'crit' : '', FLIGHT_MS);
    else this.floatText('MISS', to, 'miss', FLIGHT_MS);
  }

  /** A travelling bolt landed: impact and result where it was aimed. */
  boltHit(zone: HitZone, aim: Vec2, damage: number, weapon: string) {
    const at = this.aimToScreen(aim);
    const w = window.innerWidth;
    this.fx(this.fxScene, fxImpactUrl, at, w * (zone ? 0.16 : 0.1), [
      { opacity: 1, transform: `rotate(${Math.random() * 360}deg) scale(0.3)` },
      { opacity: 1, transform: 'scale(1)', offset: 0.35 },
      { opacity: 0, transform: 'scale(1.15)' },
    ], 380, { filter: this.shotTint(weapon) });
    if (zone) this.floatText(`${ZONE_LABEL[zone]} ${damage}`, at, zone === 'face' ? 'crit' : '', 0);
    else this.floatText('MISS', at, 'miss', 0);
  }

  /** Timed vent result: a flash on the heat gauge. */
  ventResult(perfect: boolean) {
    this.restartClass(this.$('g-cyl'), perfect ? 'perfect' : 'jam');
  }

  /** The bot's shot: teal paint flies from its hand toward you; a hit splats the screen. */
  botShot(s: DuelState, zone: HitZone) {
    const c = CREATURES[s.creature];
    const art = CREATURE_ART[s.creature];
    const t = apparentTarget(s);
    const from = this.aimToScreen({
      x: t.x + (art.handPx[0] - c.torsoPx[0]) / c.pxPerUnit,
      y: t.y - (art.handPx[1] - c.torsoPx[1]) / c.pxPerUnit,
    });
    const W = window.innerWidth;
    const H = window.innerHeight;
    const to = zone
      ? { x: W * (0.25 + Math.random() * 0.5), y: H * (0.3 + Math.random() * 0.4) }
      : { x: Math.random() < 0.5 ? -W * 0.2 : W * 1.2, y: H * (0.2 + Math.random() * 0.6) };
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    this.fx(this.fxScreen, fxProjectileUrl, from, W * 0.12, [
      { opacity: 1, transform: `translate(0, 0) rotate(${angle}deg) scale(0.3)` },
      { opacity: 1, transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(${angle}deg) scale(${zone ? 3 : 2.2})` },
    ], BOT_FLIGHT_MS, { filter: BOT_TINT });
    if (!zone) return;
    // Paint splat on your screen that drips and fades.
    const size = W * (zone === 'face' ? 0.95 : 0.6);
    const rot = Math.random() * 360;
    this.fx(this.fxScreen, Math.random() < 0.5 ? fxSplatAUrl : fxSplatBUrl, to, size, [
      { opacity: 0.95, transform: `translateY(0) rotate(${rot}deg) scale(0.4)` },
      { opacity: 0.95, transform: `translateY(0) rotate(${rot}deg) scale(1)`, offset: 0.06 },
      { opacity: 0.9, transform: `translateY(${H * 0.04}px) rotate(${rot}deg) scale(1)`, offset: 0.7 },
      { opacity: 0, transform: `translateY(${H * 0.07}px) rotate(${rot}deg) scale(1)` },
    ], 2000, { filter: BOT_TINT, delay: BOT_FLIGHT_MS });
  }

  // ---- Per-frame drawing ----

  render(s: DuelState, aim: Vec2, aimVisible: boolean) {
    this.setMap(s.map);
    this.setCreature(s.creature);
    this.setGun(s.player.creature, s.player.weapon);
    const t = apparentTarget(s);
    // Small bob while the bot is walking.
    const bob = s.bot.vx !== 0 ? Math.abs(Math.sin(performance.now() / 110)) * 0.3 : 0;
    // Leans into the move, most visibly on a dash (pivoting at the feet).
    const c = CREATURES[s.creature];
    const lean = Math.max(-9, Math.min(9, s.bot.vx * 2.5));
    const feetY = (c.baselineY - c.torsoPx[1]) / c.pxPerUnit;
    this.opponent.setAttribute('transform', `translate(${t.x} ${GameView.sy(t.y + bob)}) rotate(${lean.toFixed(1)} 0 ${feetY.toFixed(2)})`);
    this.bgLayer.setAttribute('transform', `translate(${parallax(s, BG_PARALLAX_DIST)} 0)`);
    this.zones.style.display = this.showZones ? '' : 'none';
    // Recoil: the crosshair sits where the gun points (phone aim plus the kick still recovering).
    const def = WEAPONS[s.player.weapon].recoil;
    const kick = recoilOffset(s, performance.now());
    const kickSize = Math.hypot(kick.x, kick.y);
    const settled = !def || kickSize < def.settledAt;
    const cx = aim.x + kick.x;
    const cy = aim.y + kick.y;
    this.renderViewmodel(s, aim, aimVisible, kick);
    this.cross.style.display = aimVisible ? '' : 'none';
    // Kicked: ring grows and turns amber; it shrinks back as the gun recovers.
    const grow = 1 + Math.min(0.8, kickSize * 0.25);
    this.cross.setAttribute('transform', `translate(${cx} ${GameView.sy(cy)}) scale(${grow.toFixed(3)})`);
    this.cross.classList.toggle('kicked', !settled);
    this.restDot.style.display = aimVisible && !settled ? '' : 'none';
    this.restDot.setAttribute('cx', String(aim.x));
    this.restDot.setAttribute('cy', String(GameView.sy(aim.y)));
    if (settled && !this.wasSettled && aimVisible) {
      this.readyRing.setAttribute('cx', String(cx));
      this.readyRing.setAttribute('cy', String(GameView.sy(cy)));
      this.readyRing.classList.remove('pop');
      void this.readyRing.getBoundingClientRect();
      this.readyRing.classList.add('pop');
      this.onSettled(s.player.weapon);
    }
    this.wasSettled = settled;
    // Choke ring: the pattern's size right now; turns solid when fully tightened.
    const gunDef = WEAPONS[s.player.weapon];
    this.spreadRing.style.display = aimVisible && gunDef.choke ? '' : 'none';
    if (gunDef.choke) {
      const r = currentSpread(s);
      this.spreadRing.setAttribute('r', r.toFixed(3));
      this.spreadRing.setAttribute('cx', String(cx));
      this.spreadRing.setAttribute('cy', String(GameView.sy(cy)));
      this.spreadRing.classList.toggle('tight', r <= gunDef.choke.minSpread + 0.01);
    }
    this.svgEl.classList.toggle('dim', s.phase === 'holster' || s.phase === 'ready');
    this.renderSplats(s);

    (this.$('g-php') as HTMLElement).style.width = (s.player.hp / MAX_HP) * 100 + '%';
    (this.$('g-bhp') as HTMLElement).style.width = (s.bot.hp / MAX_HP) * 100 + '%';

    // Ammo dots, one per round of the current gun; they refill one by one while reloading.
    // Heat guns show a heat gauge instead.
    const gun = WEAPONS[s.player.weapon];
    const cylEl = this.$('g-cyl');
    const slots = gun.heat ? -1 : gun.capacity;
    if (this.cylSize !== slots) {
      this.cylSize = slots;
      cylEl.className = gun.heat ? 'cyl heat' : 'cyl';
      if (gun.heat) {
        // Heat gauge: fill, the timed-vent window, and the sweeping vent marker.
        const win = document.createElement('b');
        win.style.left = gun.heat.ventWindow[0] * 100 + '%';
        win.style.width = (gun.heat.ventWindow[1] - gun.heat.ventWindow[0]) * 100 + '%';
        cylEl.replaceChildren(document.createElement('i'), win, document.createElement('u'));
      } else {
        cylEl.replaceChildren(...Array.from({ length: gun.capacity }, () => document.createElement('i')));
      }
    }
    const cyl = cylEl.children;
    if (gun.heat) {
      (cyl[0] as HTMLElement).style.width = s.player.heat + '%';
      cylEl.classList.toggle('hot', s.player.overheated);
      const v = s.player.vent;
      cylEl.classList.toggle('venting', !!v && !v.tapped);
      cylEl.classList.toggle('charged', s.player.charged > 0);
      if (v) (cyl[2] as HTMLElement).style.left = Math.min(100, ((performance.now() - v.startAt) / v.durationMs) * 100) + '%';
    } else {
      for (let i = 0; i < cyl.length; i++) cyl[i].classList.toggle('spent', i >= s.player.rounds);
    }
    const reloading = s.player.reloadNextAt != null || s.player.venting;
    this.botReloadTag.style.display = s.bot.reloadUntil != null && (s.phase === 'draw' || s.phase === 'aim') ? '' : 'none';

    let big = '';
    let small = '';
    if (s.phase === 'holster') {
      big = 'HOLSTER YOUR BLASTER';
      small = 'Lower the phone to your hip, top pointing at the floor, and hold still.';
    } else if (s.phase === 'ready') {
      big = 'READY';
      small = 'Hold still. Draw when you hear the DRAW sound.';
    } else if (s.phase === 'draw') {
      big = 'DRAW!';
    } else if (s.phase === 'aim' && reloading) {
      small = gun.heat ? 'Venting...' : gun.reloadInterrupt && s.player.rounds > 0 ? 'Reloading... (tap to fire)' : 'Reloading...';
    } else if (s.phase === 'aim' && s.player.overheated) {
      big = 'OVERHEATED';
      small = 'Dip the phone to vent, or wait for it to cool.';
    } else if (s.phase === 'aim' && !gun.heat && s.player.rounds === 0) {
      big = 'RELOAD';
      small = 'Dip the phone to point at the floor, then raise it again.';
    }
    this.$('g-big').textContent = big;
    this.$('g-small').textContent = small;
    this.$('g-msg').classList.toggle('alert', big === 'RELOAD' || big === 'DRAW!' || big === 'OVERHEATED');

    const dt = drawTime(s);
    this.$('g-dtime').textContent = dt != null ? `Draw ${fmtSec(dt)}` : '';
    const full = gun.heat ? s.player.heat === 0 : s.player.rounds === gun.capacity;
    this.$('g-reload').classList.toggle('hidden', !this.showReloadButton || !(s.phase === 'aim' || s.phase === 'draw') || full || reloading);
    this.$('g-reload').textContent = gun.heat ? 'Vent' : 'Reload';

    this.renderResult(s);
  }

  /** Paint splats stuck to the opponent; each appears once its paint has landed. */
  private renderSplats(s: DuelState) {
    const now = performance.now();
    const landed = s.holes.filter((h) => h.zone && now >= h.t + FLIGHT_MS);
    const key = `${s.startedAt}:${landed.length}`;
    if (key === this.splatKey) return;
    this.splatKey = key;
    this.splats.replaceChildren();
    landed.forEach((h, i) => {
      // Splat size in sprite pixels, so it scales with the creature.
      const size = ((h.zone === 'face' ? 218 : h.zone === 'torso' ? 180 : 140) * h.size) / CREATURES[s.creature].pxPerUnit;
      const rot = (i * 137 + Math.round(h.x * 50)) % 360;
      const g = svg('g', { transform: `translate(${h.x} ${GameView.sy(h.y)}) rotate(${rot})` }, this.splats);
      const splat = svg('image', { href: i % 2 ? fxSplatBUrl : fxSplatAUrl, x: -size / 2, y: -size / 2, width: size, height: size }, g);
      if (this.paintFilter) splat.setAttribute('filter', 'url(#paint-tint)');
    });
  }

  /** Hand and gun: raised while aiming, lags slightly behind aim movement, tilts with sidestep. */
  /**
   * Turn (degrees, around the grip) that points the gun's grip-to-muzzle line at the screen center,
   * where the crosshair rests. Uses the untransformed layout box, so it doesn't feed back.
   */
  private barrelTurn(weapon: string, wrap: HTMLElement): number {
    const art = GUN_ART[weapon];
    if (!art.grip) return 0;
    const w = wrap.offsetWidth;
    const gx = window.innerWidth - w + art.grip.x * w;
    const gy = window.innerHeight - w + art.grip.y * w;
    const drawn = Math.atan2(art.muzzle.y - art.grip.y, art.muzzle.x - art.grip.x);
    const wanted = Math.atan2(window.innerHeight / 2 - gy, window.innerWidth / 2 - gx);
    return ((wanted - drawn) * 180) / Math.PI;
  }

  private renderViewmodel(s: DuelState, aim: Vec2, visible: boolean, kick: Vec2) {
    const wrap = this.$('g-vm');
    wrap.classList.toggle('hidden', !visible);
    if (!visible) {
      this.prevAim = null;
      return;
    }
    const d = this.prevAim ? { x: aim.x - this.prevAim.x, y: aim.y - this.prevAim.y } : { x: 0, y: 0 };
    this.prevAim = { ...aim };
    // Ease toward a small offset opposite to the movement, then settle back.
    this.sway.x += (Math.max(-30, Math.min(30, -d.x * 12)) - this.sway.x) * 0.2;
    this.sway.y += (Math.max(-30, Math.min(30, d.y * 12)) - this.sway.y) * 0.2;
    // The art is already drawn at an aiming angle; only add the sidestep tilt.
    // Guns whose picture points off to one side are turned about the grip so the barrel lines up with the crosshair.
    const grip = GUN_ART[s.player.weapon].grip;
    const turn = this.barrelTurn(s.player.weapon, wrap);
    wrap.style.transformOrigin = grip ? `${grip.x * 100}% ${grip.y * 100}%` : '';
    wrap.style.transform = `translate(${this.sway.x.toFixed(1)}px, ${this.sway.y.toFixed(1)}px) rotate(${(s.player.lean * 5 + turn).toFixed(1)}deg)`;
    // Recoil guns: the gun rises with the kick and eases back with the crosshair.
    const vmk = this.$('g-vmk');
    const recoil = !!WEAPONS[s.player.weapon].recoil;
    vmk.style.transform = recoil
      ? `translate(${(kick.x * 1.5).toFixed(2)}%, ${(-kick.y * 1.8).toFixed(2)}%) rotate(${(-kick.y * 3.5).toFixed(2)}deg)`
      : '';
    if (this.charmUrl) this.swingCharm(s.player.lean * 5 + turn + (recoil ? -kick.y * 3.5 : 0), d.x);
  }

  /**
   * The charm hangs straight down whatever the gun's angle, and swings like a pendulum when the gun turns,
   * moves or kicks (looks only).
   */
  private swingCharm(gunRot: number, aimDx: number) {
    this.charmVel += -(gunRot - this.gunRot) * 0.6 - aimDx * 0.8;
    this.gunRot = gunRot;
    // Fixed 60 Hz steps, so it swings the same on 60 and 120 Hz screens.
    const now = performance.now();
    this.swingAcc = Math.min(70, this.swingAcc + (now - this.swingAt));
    this.swingAt = now;
    for (; this.swingAcc >= 16.7; this.swingAcc -= 16.7) {
      this.charmVel = (this.charmVel - this.charmSwing * 0.06) * 0.93;
      this.charmSwing = Math.max(-35, Math.min(35, this.charmSwing + this.charmVel));
    }
    this.charm.style.transform = `translate(-50%, -7%) rotate(${(this.charmSwing - gunRot).toFixed(1)}deg)`;
  }

  private renderResult(s: DuelState) {
    const panel = this.$('g-result');
    const key = s.phase === 'over' ? `${s.startedAt}` : null;
    if (key === this.shownResult) return;
    this.shownResult = key;
    panel.classList.toggle('hidden', key == null);
    if (key == null) return;
    // Ignore taps on the buttons for a moment, so a late "shoot" tap
    // doesn't skip past the results.
    panel.classList.add('locked');
    clearTimeout(this.unlockTimer);
    this.unlockTimer = setTimeout(() => panel.classList.remove('locked'), RESULT_LOCK_MS);
    this.$('r-flag').textContent = 'Something felt off';

    const cap = alienName(s.creature);
    const titles = { victory: "YOU PAINTED 'EM!", defeat: 'YOU GOT PAINTED!', foul: 'FOUL' } as const;
    const notes = {
      victory: `${cap} is covered in paint.`,
      defeat: `${cap} painted you first.`,
      foul: 'You left the holster before the DRAW sound.',
    } as const;
    const r = s.result ?? 'foul';
    const title = this.$('r-title');
    title.textContent = titles[r];
    title.className = r === 'victory' ? 'ok' : 'err';
    this.$('r-note').textContent = notes[r];
    const p = s.player;
    const acc = p.shots ? Math.round((p.hits / p.shots) * 100) + '%' : '--';
    const rows: [string, string][] = [
      ['Draw time', fmtSec(drawTime(s))],
      ['Shots', String(p.shots)],
      ['Hits', String(p.hits)],
      ['Accuracy', acc],
      ['Face shots', String(p.headshots)],
      ['Your health', `${p.hp} / ${MAX_HP}`],
      [`${cap} shots / hits`, `${s.bot.shots} / ${s.bot.hits}`],
    ];
    this.$('r-stats').innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('');
  }
}
