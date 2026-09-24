// Draws the duel: a placeholder western scene (SVG), crosshair and HUD.
// Reads game state; never changes it.
import { BODY, CYLINDER, MAX_HP, drawTime } from '../game/duel';
import type { DuelState, Vec2 } from '../game/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The screen is this many aim units wide (so 1 unit = 1 degree at sensitivity 1). */
const VIEW_WIDTH = 40;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.appendChild(el);
  return el;
}

const fmtSec = (ms: number | null) => (ms == null ? '--' : (ms / 1000).toFixed(2) + ' s');

export class GameView {
  readonly el: HTMLElement;
  onFire: (t: number) => void = () => {};
  onReload: () => void = () => {};
  onAgain: () => void = () => {};
  onMenu: () => void = () => {};
  /** Returns true if the log was copied. */
  onCopyLog: () => Promise<boolean> = async () => false;

  private svgEl: SVGSVGElement;
  private opponent: SVGGElement;
  private holes: SVGGElement;
  private cross: SVGGElement;
  private holeCount = -1;
  private $: (sel: string) => HTMLElement;
  private shownResult: string | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'game hidden';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hp"><span>YOU</span><div class="bar"><i id="g-php"></i></div></div>
        <div class="hp"><span>BOT</span><div class="bar"><i id="g-bhp"></i></div></div>
      </div>
      <div class="msg" id="g-msg"><div class="big" id="g-big"></div><div class="small" id="g-small"></div></div>
      <div class="hud-bottom">
        <div class="cyl" id="g-cyl"></div>
        <div class="dtime" id="g-dtime"></div>
        <button class="secondary reload-btn" id="g-reload">Reload</button>
      </div>
      <div class="flash hurt" id="g-hurt"></div>
      <div class="flash muzzle" id="g-muzzle"></div>
      <div class="result hidden" id="g-result">
        <div class="panel">
          <h1 id="r-title"></h1>
          <p class="sub" id="r-note"></p>
          <div class="grid" id="r-stats"></div>
          <button id="r-again">Again</button>
          <button class="secondary" id="r-menu">Menu</button>
          <button class="secondary small-btn" id="r-log">Copy aim log</button>
        </div>
      </div>`;
    parent.appendChild(this.el);
    this.$ = (id: string) => this.el.querySelector<HTMLElement>('#' + id)!;

    this.svgEl = svg('svg', { class: 'scene', preserveAspectRatio: 'xMidYMid slice' });
    this.el.prepend(this.svgEl);
    this.buildScene();
    this.opponent = this.buildOpponent();
    this.holes = svg('g', {}, this.svgEl);
    this.cross = svg('g', { class: 'cross' }, this.svgEl);
    svg('circle', { r: 1.3, fill: 'none', stroke: '#fff', 'stroke-width': 0.18 }, this.cross);
    svg('circle', { r: 0.15, fill: '#ff3b30' }, this.cross);
    for (const [x1, y1, x2, y2] of [[-2.4, 0, -0.6, 0], [0.6, 0, 2.4, 0], [0, -2.4, 0, -0.6], [0, 0.6, 0, 2.4]]) {
      svg('line', { x1, y1, x2, y2, stroke: '#fff', 'stroke-width': 0.18 }, this.cross);
    }

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
    this.$('r-log').addEventListener('click', () => {
      const btn = this.$('r-log');
      void this.onCopyLog().then((ok) => (btn.textContent = ok ? 'Aim log copied' : 'Copy failed'));
    });

    const resize = () => {
      const h = (VIEW_WIDTH * window.innerHeight) / Math.max(1, window.innerWidth);
      this.svgEl.setAttribute('viewBox', `${-VIEW_WIDTH / 2} ${-h / 2} ${VIEW_WIDTH} ${h}`);
    };
    window.addEventListener('resize', resize);
    resize();
  }

  show(visible: boolean) {
    this.el.classList.toggle('hidden', !visible);
  }

  /** SVG y grows downward; aim y grows upward. */
  private static sy(y: number) {
    return -y;
  }

  private buildScene() {
    const s = this.svgEl;
    const horizon = GameView.sy(-2);
    const defs = svg('defs', {}, s);
    const grad = svg('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#3d6fa8' }, grad);
    svg('stop', { offset: 1, 'stop-color': '#f2b76b' }, grad);
    svg('rect', { x: -40, y: -80, width: 80, height: 80 + horizon, fill: 'url(#sky)' }, s);
    svg('circle', { cx: 12, cy: -16, r: 3, fill: '#ffe39a' }, s);
    svg('polygon', { points: `-40,${horizon} -30,${horizon - 5} -22,${horizon - 5} -18,${horizon} -6,${horizon} -2,${horizon - 3} 6,${horizon - 3} 9,${horizon} 22,${horizon} 26,${horizon - 7} 34,${horizon - 7} 40,${horizon}`, fill: '#a0583a' }, s);
    svg('rect', { x: -40, y: horizon, width: 80, height: 80, fill: '#c89456' }, s);
    // Cacti and a fence post, just for depth.
    for (const [x, base, h] of [[-15, horizon + 6, 9], [16, horizon + 10, 12]]) {
      svg('rect', { x: x - 0.8, y: base - h, width: 1.6, height: h, rx: 0.8, fill: '#4f7a3a' }, s);
      svg('rect', { x: x - 3, y: base - h * 0.7, width: 1.2, height: h * 0.35, rx: 0.6, fill: '#4f7a3a' }, s);
      svg('rect', { x: x + 1.8, y: base - h * 0.8, width: 1.2, height: h * 0.3, rx: 0.6, fill: '#4f7a3a' }, s);
    }
  }

  private buildOpponent(): SVGGElement {
    const g = svg('g', {}, this.svgEl);
    const { headRadius: r, headAbove, torsoWidth: w, torsoHeight: h, legLength } = BODY;
    // Legs (not a hit zone).
    svg('rect', { x: -w / 2 + 0.3, y: h / 2, width: 1.7, height: legLength, fill: '#3b2f4a' }, g);
    svg('rect', { x: w / 2 - 2, y: h / 2, width: 1.7, height: legLength, fill: '#3b2f4a' }, g);
    // Gun arm.
    svg('rect', { x: w / 2 - 0.2, y: -h / 2 + 1.2, width: 3.2, height: 1.1, fill: '#7a4a2a' }, g);
    svg('rect', { x: w / 2 + 2.6, y: -h / 2 + 0.9, width: 1.4, height: 0.7, fill: '#222' }, g);
    // Torso (hit zone).
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: '#8a3b2a' }, g);
    // Head (hit zone) and hat.
    svg('circle', { cx: 0, cy: -headAbove, r, fill: '#e2b48a' }, g);
    svg('rect', { x: -2.8, y: -headAbove - r + 0.1, width: 5.6, height: 0.5, rx: 0.2, fill: '#2b1d12' }, g);
    svg('rect', { x: -1.5, y: -headAbove - r - 1.7, width: 3, height: 1.9, rx: 0.4, fill: '#2b1d12' }, g);
    return g;
  }

  flash(kind: 'hurt' | 'muzzle') {
    const el = this.$('g-' + kind);
    el.classList.remove('on');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('on');
  }

  render(s: DuelState, aim: Vec2, aimVisible: boolean) {
    this.opponent.setAttribute('transform', `translate(${s.target.x} ${GameView.sy(s.target.y)})`);
    this.cross.style.display = aimVisible ? '' : 'none';
    this.cross.setAttribute('transform', `translate(${aim.x} ${GameView.sy(aim.y)})`);
    this.svgEl.classList.toggle('dim', s.phase === 'holster' || s.phase === 'ready');

    if (s.holes.length !== this.holeCount) {
      this.holeCount = s.holes.length;
      this.holes.replaceChildren();
      for (const h of s.holes) {
        svg('circle', { cx: h.x, cy: GameView.sy(h.y), r: 0.35, fill: h.zone ? '#200' : '#333', stroke: h.zone ? '#ff5b4a' : '#eee', 'stroke-width': 0.08 }, this.holes);
      }
    }

    (this.$('g-php') as HTMLElement).style.width = (s.player.hp / MAX_HP) * 100 + '%';
    (this.$('g-bhp') as HTMLElement).style.width = (s.bot.hp / MAX_HP) * 100 + '%';

    const cyl = this.$('g-cyl').children;
    for (let i = 0; i < cyl.length; i++) cyl[i].classList.toggle('spent', i >= s.player.rounds);

    let big = '';
    let small = '';
    if (s.phase === 'holster') {
      big = 'HOLSTER YOUR WEAPON';
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

  private renderResult(s: DuelState) {
    const panel = this.$('g-result');
    const key = s.phase === 'over' ? `${s.startedAt}` : null;
    if (key === this.shownResult) return;
    this.shownResult = key;
    panel.classList.toggle('hidden', key == null);
    if (key == null) return;
    this.$('r-log').textContent = 'Copy aim log';

    const titles = { victory: 'VICTORY', defeat: 'DEFEAT', foul: 'FOUL' } as const;
    const notes = {
      victory: 'The bot is down.',
      defeat: 'The bot got you.',
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
      ['Headshots', String(p.headshots)],
      ['Your health', `${p.hp} / ${MAX_HP}`],
      ['Bot shots / hits', `${s.bot.shots} / ${s.bot.hits}`],
    ];
    this.$('r-stats').innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('');
  }
}
