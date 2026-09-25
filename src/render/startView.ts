// Start screen: title, Enable Motion, Start Duel.

export class StartView {
  readonly el: HTMLElement;
  onEnable: () => void = () => {};
  onStart: () => void = () => {};
  onSensorCheck: () => void = () => {};
  onSettings: () => void = () => {};
  private enableBtn: HTMLButtonElement;
  private statusEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'screen';
    this.el.innerHTML = `
      <button class="secondary gear" id="s-settings" aria-label="Settings">&#9881; Settings</button>
      <h1 class="title">HIGH MOON</h1>
      <p class="sub">Beta</p>
      <button id="s-enable">Enable Motion</button>
      <button id="s-start">Start Duel</button>
      <p class="status" id="s-status"></p>
      <div class="panel how">
        <h2>How to play</h2>
        <ol>
          <li>Tap <b>Start Duel</b>, then hang the phone at your hip, top pointing at the floor. Hold still until you hear the ready click.</li>
          <li>Don't move until the loud <b>DRAW</b> sound. Moving early is a foul.</li>
          <li>Raise the phone upright, screen facing you, like aiming a revolver.</li>
          <li>Turn the phone to move the crosshair. Tap anywhere to fire paint. Face = 100, body = 20, arms and legs = 10, tail = 5. The hat doesn't count.</li>
          <li>Tip the phone sideways to sidestep left or right. A moving target is harder for the bot to hit.</li>
          <li>After six shots, flick the phone down and up (or tap <b>Reload</b>).</li>
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
