// Settings screen: sliders and toggles, a live detection readout,
// Reset to defaults and Copy settings.
import type { BotDifficulty, Settings } from '../settings/settings';

type NumKey = 'aimSensX' | 'aimSensY' | 'smoothing' | 'lookbackMs' | 'holsterSens' | 'drawSens' | 'reloadSens';

interface Slider {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  help: string;
}

const SLIDERS: Slider[] = [
  { key: 'aimSensX', label: 'Aim sensitivity: left / right', min: 0.5, max: 2, step: 0.1, fmt: (v) => v.toFixed(1) + 'x', help: 'How far the crosshair moves when you turn the phone left or right.' },
  { key: 'aimSensY', label: 'Aim sensitivity: up / down', min: 0.5, max: 2, step: 0.1, fmt: (v) => v.toFixed(1) + 'x', help: 'How far the crosshair moves when you tilt the phone up or down.' },
  { key: 'smoothing', label: 'Smoothing', min: 0, max: 10, step: 1, fmt: String, help: 'Higher is steadier but lags behind your hand. 0 is the raw sensor.' },
  { key: 'lookbackMs', label: 'Tap look-back', min: 0, max: 120, step: 10, fmt: (v) => v + ' ms', help: 'A shot uses where you were aiming this long before the tap, to cancel the thumb bump.' },
  { key: 'holsterSens', label: 'Holster sensitivity', min: 1, max: 10, step: 1, fmt: String, help: 'Higher counts as holstered sooner and at a looser angle. Lower makes a foul less likely.' },
  { key: 'drawSens', label: 'Draw sensitivity', min: 1, max: 10, step: 1, fmt: String, help: 'Higher counts the draw earlier in the raise (faster draw times).' },
  { key: 'reloadSens', label: 'Reload flick sensitivity', min: 1, max: 10, step: 1, fmt: String, help: 'For the quick down-up flick. Higher lets a gentler flick reload. Dipping the phone to point at the floor always reloads.' },
];

export type ReadoutRow = [label: string, value: string, ok?: boolean];

export class SettingsView {
  readonly el: HTMLElement;
  onChange: (s: Settings) => void = () => {};
  onReset: () => void = () => {};
  onCopy: () => Promise<boolean> = async () => false;
  onBack: () => void = () => {};
  /** Returns the backup code for all gunslingers. */
  onExport: () => string = () => '';
  /** Restores from a backup code; returns a message for the player. */
  onImport: (code: string) => string = () => '';
  private values: Settings;

  constructor(parent: HTMLElement, initial: Settings) {
    this.values = { ...initial };
    this.el = document.createElement('div');
    this.el.className = 'screen settings hidden';
    this.el.innerHTML = `
      <div class="settings-head">
        <div><h1>Settings</h1><p class="sub" id="st-who"></p></div>
        <button class="secondary small-btn" data-act="back">Back</button>
      </div>
      <div class="panel">
        <div class="setting"><div class="row"><span>Bot difficulty</span></div>
          <div class="seg" id="st-bot">
            <button data-bot="easy">Easy</button><button data-bot="normal">Normal</button><button data-bot="hard">Hard</button>
          </div>
          <p class="help">The bot strafes, dashes and plants to shoot (it's most accurate standing still). Easy: slow and steady. Normal: dashes often and may dodge if you hold your aim on it. Hard: fast, dashes a lot, fires quickest. Face hits are rare at every level.</p>
        </div>
      </div>
      <div class="panel"><h2>Live detection</h2><div class="grid" id="st-readout"></div></div>
      <div class="panel" id="st-sliders"></div>
      <div class="panel">
        <label class="toggle"><input type="checkbox" id="st-tilt"> Tilt to move (sidestep)</label>
        <p class="help">Tip the phone sideways, like canting a revolver, to step left or right. Moving makes the bot miss more.</p>
        <label class="toggle"><input type="checkbox" id="st-sound"> Sound</label>
        <label class="toggle"><input type="checkbox" id="st-readout-on"> Show detection readout during duels</label>
        <label class="toggle"><input type="checkbox" id="st-reloadbtn"> Show Reload button</label>
        <label class="toggle"><input type="checkbox" id="st-zones"> Show hit areas (testing)</label>
        <p class="help">Tints the opponent: red face (20), yellow body (9), blue arms, ears and legs (5), green tail (2). Grey (hat, braids, gun) is a miss.</p>
      </div>
      <div class="panel" id="st-logs"></div>
      <div class="panel backup">
        <h2>Back up gunslingers</h2>
        <p class="help">Copies a code with every gunslinger on this phone (names, picks, settings and records). Keep it in Notes; paste it here to restore, on this phone or another.</p>
        <div class="btn-row">
          <button class="secondary small-btn" id="st-export">Copy backup code</button>
          <button class="secondary small-btn" id="st-import">Restore from code</button>
        </div>
        <textarea class="field hidden" id="st-code" rows="3" spellcheck="false" autocomplete="off" placeholder="Paste a backup code, then tap Restore again"></textarea>
        <p class="help" id="st-backup-msg"></p>
      </div>
      <button data-act="copy">Copy settings</button>
      <button class="secondary" data-act="reset">Reset to defaults</button>
      <button class="secondary" data-act="back">Back</button>`;
    parent.appendChild(this.el);

    const sliders = this.el.querySelector('#st-sliders')!;
    for (const sl of SLIDERS) {
      const div = document.createElement('div');
      div.className = 'setting';
      div.innerHTML = `
        <div class="row"><span>${sl.label}</span><b id="st-v-${sl.key}"></b></div>
        <input type="range" id="st-${sl.key}" min="${sl.min}" max="${sl.max}" step="${sl.step}">
        <p class="help">${sl.help}</p>`;
      sliders.appendChild(div);
      const input = div.querySelector('input')!;
      input.addEventListener('input', () => {
        this.values[sl.key] = Number(input.value);
        this.refresh();
        this.onChange({ ...this.values });
      });
    }

    this.el.querySelectorAll<HTMLButtonElement>('#st-bot button').forEach((b) =>
      b.addEventListener('click', () => {
        this.values.bot = b.dataset.bot as BotDifficulty;
        this.refresh();
        this.onChange({ ...this.values });
      }),
    );
    const sound = this.el.querySelector<HTMLInputElement>('#st-sound')!;
    sound.addEventListener('change', () => {
      this.values.sound = sound.checked;
      this.onChange({ ...this.values });
    });
    const tilt = this.el.querySelector<HTMLInputElement>('#st-tilt')!;
    tilt.addEventListener('change', () => {
      this.values.tiltMove = tilt.checked;
      this.onChange({ ...this.values });
    });
    const reloadBtn = this.el.querySelector<HTMLInputElement>('#st-reloadbtn')!;
    reloadBtn.addEventListener('change', () => {
      this.values.showReloadButton = reloadBtn.checked;
      this.onChange({ ...this.values });
    });
    const zones = this.el.querySelector<HTMLInputElement>('#st-zones')!;
    zones.addEventListener('change', () => {
      this.values.showHitZones = zones.checked;
      this.onChange({ ...this.values });
    });
    const readoutOn = this.el.querySelector<HTMLInputElement>('#st-readout-on')!;
    readoutOn.addEventListener('change', () => {
      this.values.showReadout = readoutOn.checked;
      this.onChange({ ...this.values });
    });

    const code = this.el.querySelector<HTMLTextAreaElement>('#st-code')!;
    const backupMsg = this.el.querySelector('#st-backup-msg')!;
    this.el.querySelector('#st-export')!.addEventListener('click', async () => {
      code.value = this.onExport();
      code.classList.remove('hidden');
      let copied = false;
      try {
        await navigator.clipboard.writeText(code.value);
        copied = true;
      } catch {
        code.select();
      }
      backupMsg.textContent = copied ? 'Backup code copied. Paste it somewhere safe.' : 'Copy the code above and keep it somewhere safe.';
    });
    this.el.querySelector('#st-import')!.addEventListener('click', () => {
      if (code.classList.contains('hidden') || !code.value.trim()) {
        code.value = '';
        code.classList.remove('hidden');
        code.focus();
        backupMsg.textContent = 'Paste a backup code above, then tap Restore from code again.';
        return;
      }
      backupMsg.textContent = this.onImport(code.value);
    });

    this.el.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'back') this.onBack();
        if (act === 'reset') this.onReset();
        if (act === 'copy') {
          void this.onCopy().then((ok) => {
            b.textContent = ok ? 'Copied. Paste it to Claude.' : 'Copy failed';
            setTimeout(() => (b.textContent = 'Copy settings'), 2500);
          });
        }
      }),
    );
    this.refresh();
  }

  show(visible: boolean) {
    this.el.classList.toggle('hidden', !visible);
  }

  /** Whose settings these are. */
  setProfileName(name: string) {
    this.el.querySelector('#st-who')!.textContent = `For ${name}`;
  }

  setValues(s: Settings) {
    this.values = { ...s };
    this.refresh();
  }

  private refresh() {
    for (const sl of SLIDERS) {
      const v = this.values[sl.key];
      this.el.querySelector<HTMLInputElement>('#st-' + sl.key)!.value = String(v);
      this.el.querySelector('#st-v-' + sl.key)!.textContent = sl.fmt(v);
    }
    this.el.querySelectorAll<HTMLButtonElement>('#st-bot button').forEach((b) =>
      b.classList.toggle('on', b.dataset.bot === this.values.bot),
    );
    this.el.querySelector<HTMLInputElement>('#st-sound')!.checked = this.values.sound;
    this.el.querySelector<HTMLInputElement>('#st-tilt')!.checked = this.values.tiltMove;
    this.el.querySelector<HTMLInputElement>('#st-zones')!.checked = this.values.showHitZones;
    this.el.querySelector<HTMLInputElement>('#st-reloadbtn')!.checked = this.values.showReloadButton;
    this.el.querySelector<HTMLInputElement>('#st-readout-on')!.checked = this.values.showReadout;
  }

  setReadout(rows: ReadoutRow[]) {
    this.el.querySelector('#st-readout')!.innerHTML = rows
      .map(([k, v, ok]) => `<span class="k">${k}</span><span class="v${ok === true ? ' ok' : ok === false ? ' muted' : ''}">${v}</span>`)
      .join('');
  }
}
