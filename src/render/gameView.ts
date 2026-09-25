// Draws the duel: background, opponent creature, crosshair, hand-and-gun view,
// paint effects and HUD. Reads game state; never changes it.
import bgUrl from '../../art/exports/backgrounds/bg_alien-frontier.webp';
import sageUrl from '../../art/exports/creatures/creature_desert-sage_front.webp';
import sageZonesUrl from '../../art/exports/creatures/creature_desert-sage_front_hitzones.webp';
import fxImpactUrl from '../../art/exports/effects/fx_paint-yellow_impact.webp';
import fxMuzzleUrl from '../../art/exports/effects/fx_paint-yellow_muzzle-burst.webp';
import fxProjectileUrl from '../../art/exports/effects/fx_paint-yellow_projectile.webp';
import fxSplatAUrl from '../../art/exports/effects/fx_paint-yellow_splat-a.webp';
import fxSplatBUrl from '../../art/exports/effects/fx_paint-yellow_splat-b.webp';
import gunUrl from '../../art/exports/weapons/weapon_star-revolver_sage_pov.webp';
import { CREATURES } from '../game/creatures';
import { apparentTarget, CYLINDER, DAMAGE, drawTime, MAX_HP, OPPONENT_Y, parallax, SPRITE_PX_PER_UNIT } from '../game/duel';
import type { DuelState, HitZone, Vec2 } from '../game/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The screen is this many aim units wide (so 1 unit = 1 degree at sensitivity 1). */
const VIEW_WIDTH = 40;
/** Background image size and where its street (the opponent's feet) sits, as a fraction of its height. */
const BG = { w: 1290, h: 2796, streetFrac: 0.54, parallaxDist: 40 };
/** Sprite art for each creature slug. */
const SPRITES: Record<string, { url: string; zonesUrl: string; name: string; handPx: [number, number] }> = {
  'desert-sage': { url: sageUrl, zonesUrl: sageZonesUrl, name: 'SAGE', handPx: [300, 700] },
};
/** Where the paint leaves the gun, as a fraction of the gun image (from the art manifest). */
const MUZZLE = { x: 0.47, y: 0.13 };
/** Player paint flight time (ms); splats appear when it lands. */
const FLIGHT_MS = 110;
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
  /** Returns true if the log was copied. */
  onCopyLog: () => Promise<boolean> = async () => false;
  /** Draw the hit-zone overlay on the opponent (testing aid). */
  showZones = false;

  private svgEl: SVGSVGElement;
  private bgLayer: SVGGElement;
  private bgImage: SVGImageElement;
  private opponent: SVGGElement;
  private sprite: SVGImageElement;
  private zones: SVGImageElement;
  private maskImage: SVGImageElement;
  private splats: SVGGElement;
  private shadow: SVGEllipseElement;
  private cross: SVGGElement;
  private fxScene: HTMLElement;
  private fxScreen: HTMLElement;
  private gun: HTMLImageElement;
  private splatKey = '';
  private creature = '';
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
          <div class="grid" id="r-stats"></div>
          <button id="r-again">Again</button>
          <button class="secondary small-btn" id="r-log">Copy aim log</button>
        </div>
      </div>`;
    parent.appendChild(this.el);
    this.$ = (id: string) => this.el.querySelector<HTMLElement>('#' + id)!;
    this.fxScene = this.$('g-fx-scene');
    this.fxScreen = this.$('g-fx-screen');
    this.gun = img(gunUrl, 'vm', this.$('g-vmk'));

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

    this.bgLayer = svg('g', {}, this.svgEl);
    this.bgImage = svg('image', { href: bgUrl, preserveAspectRatio: 'none' }, this.bgLayer);

    this.opponent = svg('g', {}, this.svgEl);
    this.shadow = svg('ellipse', { rx: 205 / SPRITE_PX_PER_UNIT, ry: 35 / SPRITE_PX_PER_UNIT, fill: 'rgba(40, 10, 50, 0.35)' }, this.opponent);
    this.sprite = svg('image', {}, this.opponent);
    this.splats = svg('g', { mask: 'url(#creature-mask)' }, this.opponent);
    this.zones = svg('image', { opacity: 0.9 }, this.opponent);

    this.cross = svg('g', { class: 'cross' }, this.svgEl);
    for (const [color, width] of [['rgba(0,0,0,0.55)', 0.42], ['#fff', 0.18]] as const) {
      svg('circle', { r: 1.3, fill: 'none', stroke: color, 'stroke-width': width }, this.cross);
      for (const [x1, y1, x2, y2] of [[-2.4, 0, -0.6, 0], [0.6, 0, 2.4, 0], [0, -2.4, 0, -0.6], [0, 0.6, 0, 2.4]]) {
        svg('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width }, this.cross);
      }
    }
    svg('circle', { r: 0.18, fill: '#ffd23f', stroke: '#000', 'stroke-width': 0.06 }, this.cross);

    const cyl = this.$('g-cyl');
    for (let i = 0; i < CYLINDER; i++) cyl.appendChild(document.createElement('i'));

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
    this.$('r-log').addEventListener('click', () => {
      const btn = this.$('r-log');
      void this.onCopyLog().then((ok) => (btn.textContent = ok ? 'Aim log copied' : 'Copy failed'));
    });

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
    const w = Math.max(VIEW_WIDTH + 6, (viewH * BG.w) / BG.h);
    const h = (w * BG.h) / BG.w;
    const c = Object.values(CREATURES)[0];
    const feetSvgY = GameView.sy(OPPONENT_Y) + (c.baselineY - c.torsoPx[1]) / SPRITE_PX_PER_UNIT;
    let top = feetSvgY - BG.streetFrac * h;
    // Never leave a gap at the top or bottom of the screen.
    top = Math.min(-viewH / 2, Math.max(viewH / 2 - h, top));
    for (const [k, v] of Object.entries({ x: -w / 2, y: top, width: w, height: h })) this.bgImage.setAttribute(k, String(v));
  }

  /** Places the creature sprite (and its mask and zone overlay) in the opponent group. */
  private setCreature(slug: string) {
    if (slug === this.creature) return;
    this.creature = slug;
    const c = CREATURES[slug];
    const art = SPRITES[slug];
    const size = c.canvas / SPRITE_PX_PER_UNIT;
    const box = { x: -c.torsoPx[0] / SPRITE_PX_PER_UNIT, y: -c.torsoPx[1] / SPRITE_PX_PER_UNIT, width: size, height: size };
    for (const el of [this.sprite, this.maskImage, this.zones]) {
      for (const [k, v] of Object.entries(box)) el.setAttribute(k, String(v));
    }
    this.sprite.setAttribute('href', art.url);
    this.maskImage.setAttribute('href', art.url);
    this.zones.setAttribute('href', art.zonesUrl);
    this.shadow.setAttribute('cy', String((c.baselineY - c.torsoPx[1]) / SPRITE_PX_PER_UNIT - 0.1));
    this.$('g-bname').textContent = art.name;
  }

  /** Small detection readout under the health bars; null hides it. */
  setReadout(text: string | null) {
    const el = this.$('g-readout');
    el.classList.toggle('hidden', text == null);
    if (text != null && el.textContent !== text) el.textContent = text;
  }

  /** Gun kicks up on a shot. */
  kick() {
    this.restartAnim(this.$('g-vmk'), 'kick');
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

  /** Your shot: paint bursts from the muzzle, flies to the crosshair point and splats. */
  playerShot(zone: HitZone, aim: Vec2) {
    const r = this.gun.getBoundingClientRect();
    const from = { x: r.left + MUZZLE.x * r.width, y: r.top + MUZZLE.y * r.height };
    const to = this.aimToScreen(aim);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const w = window.innerWidth;
    // Muzzle burst, pointing along the shot.
    this.fx(this.fxScreen, fxMuzzleUrl, from, w * 0.3, [
      { opacity: 1, transform: `rotate(${angle}deg) scale(0.5)` },
      { opacity: 0, transform: `rotate(${angle}deg) scale(1.1)` },
    ], 180, { anchor: [0.14, 0.51] });
    // Paint blob flying away from you (shrinks with distance).
    this.fx(this.fxScene, fxProjectileUrl, from, w * 0.22, [
      { opacity: 1, transform: `translate(0, 0) rotate(${angle}deg) scale(1)` },
      { opacity: 1, transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(${angle}deg) scale(0.25)` },
    ], FLIGHT_MS);
    // Impact burst where it lands.
    this.fx(this.fxScene, fxImpactUrl, to, w * (zone ? 0.16 : 0.1), [
      { opacity: 1, transform: `rotate(${Math.random() * 360}deg) scale(0.3)` },
      { opacity: 1, transform: 'scale(1)', offset: 0.35 },
      { opacity: 0, transform: 'scale(1.15)' },
    ], 380, { delay: FLIGHT_MS });
    if (zone) this.floatText(`${ZONE_LABEL[zone]} ${DAMAGE[zone]}`, to, zone === 'face' ? 'crit' : '', FLIGHT_MS);
    else this.floatText('MISS', to, 'miss', FLIGHT_MS);
  }

  /** The bot's shot: teal paint flies from its hand toward you; a hit splats the screen. */
  botShot(s: DuelState, zone: HitZone) {
    const c = CREATURES[s.creature];
    const art = SPRITES[s.creature];
    const t = apparentTarget(s);
    const from = this.aimToScreen({
      x: t.x + (art.handPx[0] - c.torsoPx[0]) / SPRITE_PX_PER_UNIT,
      y: t.y - (art.handPx[1] - c.torsoPx[1]) / SPRITE_PX_PER_UNIT,
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
    this.setCreature(s.creature);
    const t = apparentTarget(s);
    // Small bob while the bot is walking.
    const bob = s.bot.vx !== 0 ? Math.abs(Math.sin(performance.now() / 110)) * 0.3 : 0;
    this.opponent.setAttribute('transform', `translate(${t.x} ${GameView.sy(t.y + bob)})`);
    this.bgLayer.setAttribute('transform', `translate(${parallax(s, BG.parallaxDist)} 0)`);
    this.zones.style.display = this.showZones ? '' : 'none';
    this.renderViewmodel(s, aim, aimVisible);
    this.cross.style.display = aimVisible ? '' : 'none';
    this.cross.setAttribute('transform', `translate(${aim.x} ${GameView.sy(aim.y)})`);
    this.svgEl.classList.toggle('dim', s.phase === 'holster' || s.phase === 'ready');
    this.renderSplats(s);

    (this.$('g-php') as HTMLElement).style.width = (s.player.hp / MAX_HP) * 100 + '%';
    (this.$('g-bhp') as HTMLElement).style.width = (s.bot.hp / MAX_HP) * 100 + '%';

    const cyl = this.$('g-cyl').children;
    for (let i = 0; i < cyl.length; i++) cyl[i].classList.toggle('spent', i >= s.player.rounds);

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
    } else if (s.phase === 'aim' && s.player.rounds === 0) {
      big = 'RELOAD';
      small = 'Flick the phone down and up, or tap Reload.';
    }
    this.$('g-big').textContent = big;
    this.$('g-small').textContent = small;
    this.$('g-msg').classList.toggle('alert', big === 'RELOAD' || big === 'DRAW!');

    const dt = drawTime(s);
    this.$('g-dtime').textContent = dt != null ? `Draw ${fmtSec(dt)}` : '';
    this.$('g-reload').classList.toggle('hidden', !(s.phase === 'aim' || s.phase === 'draw') || s.player.rounds === CYLINDER);

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
      const size = (h.zone === 'face' ? 218 : h.zone === 'torso' ? 180 : 140) / SPRITE_PX_PER_UNIT;
      const rot = (i * 137 + Math.round(h.x * 50)) % 360;
      const g = svg('g', { transform: `translate(${h.x} ${GameView.sy(h.y)}) rotate(${rot})` }, this.splats);
      svg('image', { href: i % 2 ? fxSplatBUrl : fxSplatAUrl, x: -size / 2, y: -size / 2, width: size, height: size }, g);
    });
  }

  /** Hand and gun: raised while aiming, lags slightly behind aim movement, tilts with sidestep. */
  private renderViewmodel(s: DuelState, aim: Vec2, visible: boolean) {
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
    wrap.style.transform = `translate(${this.sway.x.toFixed(1)}px, ${this.sway.y.toFixed(1)}px) rotate(${(s.player.lean * 5).toFixed(1)}deg)`;
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
    this.$('r-log').textContent = 'Copy aim log';

    const name = SPRITES[s.creature]?.name ?? 'OPPONENT';
    const cap = name.charAt(0) + name.slice(1).toLowerCase();
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
