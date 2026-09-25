// Start screen: title, alien and gun picker, Enable Motion, Start Duel.
import { ALIENS } from '../game/creatures';
import type { Loadout } from '../game/types';
import { WEAPONS } from '../game/weapons';
import { APP_VERSION } from '../settings/settings';
import { CREATURE_ART, GUN_ART } from './art';

export class StartView {
  readonly el: HTMLElement;
  onEnable: () => void = () => {};
  onStart: () => void = () => {};
  onSensorCheck: () => void = () => {};
  onSettings: () => void = () => {};
  onPick: (l: Loadout) => void = () => {};
  private loadout: Loadout;
  private enableBtn: HTMLButtonElement;
  private statusEl: HTMLElement;

  constructor(parent: HTMLElement, loadout: Loadout) {
    this.loadout = { ...loadout };
    this.el = document.createElement('div');
    this.el.className = 'screen';
    this.el.innerHTML = `
      <button class="secondary gear" id="s-settings" aria-label="Settings">&#9881; Settings</button>
      <h1 class="title">HIGH MOON</h1>
      <p class="sub">Beta &middot; v${APP_VERSION}</p>
      <div class="panel picker">
        <h2>Your alien</h2>
        <div class="picks" id="s-aliens">${ALIENS.map((a) => `
          <button class="pick" data-alien="${a.id}"><span class="face"><img src="${CREATURE_ART[a.id].url}" alt=""></span>${a.name}</button>`).join('')}
        </div>
        <h2>Your gun</h2>
        <div class="picks" id="s-guns">${Object.values(WEAPONS).filter((w) => GUN_ART[w.id]).map((w) => `
          <button class="pick" data-gun="${w.id}"><span class="gun"><img src="${GUN_ART[w.id].side}" alt=""></span>${w.name}<span class="note">${w.blurb}</span></button>`).join('')}
        </div>
        <p class="help">Aliens are looks only: every alien is just as easy to hit. Your opponent is a different alien each round.</p>
      </div>
      <button id="s-enable">Enable Motion</button>
      <button id="s-start">Start Duel</button>
      <p class="status" id="s-status"></p>
      <div class="panel how">
        <h2>How to play</h2>
        <ol>
          <li>Tap <b>Start Duel</b>, then hang the phone at your hip, top pointing at the floor. Hold still until you hear the ready click.</li>
          <li>Don't move until the loud <b>DRAW</b> sound. Moving early is a foul.</li>
          <li>Raise the phone upright, screen facing you, like aiming a revolver.</li>
          <li>Turn the phone to move the crosshair. Tap anywhere to fire paint. Face = 20, body = 9, arms and legs = 5, tail = 2 (everyone has 100). The hat doesn't count.</li>
          <li>Tip the phone sideways to sidestep left or right. A moving target is harder for the bot to hit.</li>
          <li>To reload, dip the phone to point at the floor, then raise it again. Rounds go in one at a time (a full cylinder takes about a second) and you can't fire until it's done. Watch for the opponent's RELOADING tag: that's your moment.</li>
          <li>Aim feel, detection and bot difficulty can be adjusted in <b>Settings</b>.</li>
        </ol>
      </div>
      <button class="secondary" id="s-sensors">Sensor check</button>`;
    parent.appendChild(this.el);
    this.enableBtn = this.el.querySelector('#s-enable')!;
    this.statusEl = this.el.querySelector('#s-status')!;
    this.enableBtn.addEventListener('click', () => this.onEnable());
    this.el.querySelector('#s-start')!.addEventListener('click', () => this.onStart());
    this.el.querySelector('#s-sensors')!.addEventListener('click', () => this.onSensorCheck());
    this.el.querySelector('#s-settings')!.addEventListener('click', () => this.onSettings());
    this.el.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.alien) this.loadout.creature = b.dataset.alien;
        if (b.dataset.gun) this.loadout.weapon = b.dataset.gun;
        this.refreshPicks();
        this.onPick({ ...this.loadout });
      }),
    );
    this.refreshPicks();
  }

  private refreshPicks() {
    this.el.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) =>
      b.classList.toggle('on', b.dataset.alien === this.loadout.creature || b.dataset.gun === this.loadout.weapon),
    );
  }

  show(visible: boolean) {
    this.el.classList.toggle('hidden', !visible);
  }

  setMotion(state: 'off' | 'asking' | 'on' | 'denied') {
    this.enableBtn.disabled = state === 'on' || state === 'asking';
    this.enableBtn.textContent = state === 'on' ? 'Motion enabled' : 'Enable Motion';
    const msg = {
      off: '',
      asking: 'Asking for motion access...',
      on: '',
      denied: 'Motion access is blocked. Open Sensor check below for how to turn it back on.',
    }[state];
    this.statusEl.textContent = msg;
    this.statusEl.className = 'status' + (state === 'denied' ? ' err' : '');
  }
}
