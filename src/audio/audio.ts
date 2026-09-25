// All game sounds are synthesized with Web Audio. No audio files.

interface AudioSessionLike {
  type: string;
}

export type AudioSessionStatus = 'playback' | 'unsupported' | 'failed';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  sessionStatus: AudioSessionStatus = 'unsupported';

  /**
   * Must be called synchronously inside a tap handler. iOS only allows audio
   * to start from a user gesture.
   */
  unlock(): void {
    // Ask Safari to treat this page as media playback, so it can play with the
    // ringer switch on silent. Supported on newer iOS Safari only.
    const nav = navigator as Navigator & { audioSession?: AudioSessionLike };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
        this.sessionStatus = nav.audioSession.type === 'playback' ? 'playback' : 'failed';
      } catch {
        this.sessionStatus = 'failed';
      }
    }

    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      // A compressor lets loud sounds (DRAW, gunshots) be loud without distorting.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 6;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      // One second of white noise, reused for gunshots, clicks and impacts.
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
    // Play one silent sample; older iOS versions need this to fully unlock output.
    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }

  get state(): string {
    return this.ctx?.state ?? 'not started';
  }

  /** Plays a tone. `sweepTo` slides the pitch over the duration. */
  tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; sweepTo?: number; delay?: number } = {}) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
    const peak = opts.gain ?? 0.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Plays filtered white noise. `sweepTo` slides the filter frequency. */
  noise(
    dur: number,
    opts: { filter?: BiquadFilterType; freq?: number; sweepTo?: number; q?: number; gain?: number; delay?: number } = {},
  ) {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.filter ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 4000, t0);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
    f.Q.value = opts.q ?? 0.7;
    const g = this.ctx.createGain();
    const peak = opts.gain ?? 0.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  /** Test beep: two short rising tones. */
  beep() {
    this.tone(660, 0.15, { type: 'square', gain: 0.35 });
    this.tone(990, 0.2, { type: 'square', gain: 0.35, delay: 0.18 });
  }

  // ---- Game sounds. Each key moment has its own recognizable sound. ----

  /** Holstered and ready: hammer cocking (two clicks) and a soft low note. */
  ready() {
    this.noise(0.03, { filter: 'highpass', freq: 3000, gain: 0.5 });
    this.noise(0.04, { filter: 'bandpass', freq: 1800, q: 3, gain: 0.6, delay: 0.12 });
    this.tone(220, 0.35, { type: 'triangle', gain: 0.3, delay: 0.2 });
  }

  /** DRAW: loud, bright, unmistakable. Three fast rising blasts. */
  draw() {
    for (let i = 0; i < 3; i++) {
      const d = i * 0.09;
      this.tone(1047 * (1 + i * 0.25), 0.12, { type: 'sawtooth', gain: 0.9, delay: d });
      this.tone(1568 * (1 + i * 0.25), 0.12, { type: 'square', gain: 0.5, delay: d });
    }
    this.tone(2093, 0.45, { type: 'square', gain: 0.8, delay: 0.27 });
  }

  /** Raygun zap: a quick falling laser chirp. */
  zap() {
    this.tone(1400, 0.14, { type: 'sawtooth', sweepTo: 300, gain: 0.45 });
    this.tone(2100, 0.08, { type: 'square', sweepTo: 900, gain: 0.2 });
    this.noise(0.05, { filter: 'highpass', freq: 5000, gain: 0.25 });
  }

  /** Raygun overheated: a warning buzz. */
  overheat() {
    this.tone(180, 0.35, { type: 'square', gain: 0.4 });
    this.tone(190, 0.35, { type: 'sawtooth', gain: 0.25, delay: 0.02 });
    this.noise(0.4, { filter: 'bandpass', freq: 3000, q: 1, gain: 0.4 });
  }

  /** Raygun venting: a steam hiss. */
  vent() {
    this.noise(0.6, { filter: 'highpass', freq: 2500, sweepTo: 6000, gain: 0.55 });
  }

  /** Raygun ready again (vented or cooled). */
  ventDone() {
    this.tone(880, 0.08, { type: 'sine', gain: 0.35 });
    this.tone(1320, 0.12, { type: 'sine', gain: 0.35, delay: 0.08 });
  }

  /** Revolver settled after a kick: a soft hammer click. */
  cock() {
    this.noise(0.02, { filter: 'bandpass', freq: 2600, q: 3, gain: 0.35 });
    this.tone(1800, 0.025, { type: 'square', gain: 0.08 });
  }

  /** Last round fired: a hollow ring after the shot, so you know to reload. */
  lastRound() {
    this.tone(1320, 0.35, { type: 'triangle', gain: 0.35, delay: 0.12 });
    this.tone(990, 0.4, { type: 'sine', gain: 0.3, delay: 0.2 });
  }

  /** Scattergun blast: deeper and longer than the revolver, then a pump. */
  blast() {
    this.noise(0.32, { filter: 'lowpass', freq: 1800, sweepTo: 180, gain: 1 });
    this.tone(150, 0.26, { type: 'sine', sweepTo: 45, gain: 1 });
    this.noise(0.05, { filter: 'bandpass', freq: 1300, q: 2, gain: 0.6, delay: 0.26 });
    this.noise(0.05, { filter: 'bandpass', freq: 900, q: 2, gain: 0.7, delay: 0.36 });
  }

  /** Your paint blaster: a punchy pop and whoosh (not a gunshot). */
  shot() {
    this.noise(0.18, { filter: 'lowpass', freq: 2600, sweepTo: 300, gain: 0.8 });
    this.tone(260, 0.16, { type: 'sine', sweepTo: 80, gain: 0.9 });
    this.tone(700, 0.06, { type: 'triangle', sweepTo: 300, gain: 0.3 });
  }

  /** Paint hits the body: wet splat as it lands. */
  hit() {
    this.noise(0.2, { filter: 'bandpass', freq: 700, sweepTo: 250, q: 0.9, gain: 1, delay: 0.11 });
    this.tone(160, 0.12, { type: 'sine', sweepTo: 60, gain: 0.6, delay: 0.11 });
  }

  /** Face hit: splat plus a cartoon boing and bell. */
  headshot() {
    this.hit();
    this.tone(420, 0.3, { type: 'triangle', sweepTo: 900, gain: 0.5, delay: 0.14 });
    this.tone(1760, 0.45, { type: 'sine', gain: 0.4, delay: 0.2 });
  }

  /** Miss: a soft plip as the paint lands somewhere else. */
  miss() {
    this.tone(900, 0.12, { type: 'sine', sweepTo: 350, gain: 0.3, delay: 0.11 });
  }

  /** Dry fire on an empty cylinder: tiny metallic click. */
  empty() {
    this.noise(0.02, { filter: 'highpass', freq: 4000, gain: 0.6 });
    this.tone(2400, 0.03, { type: 'square', gain: 0.15 });
  }

  /** Reload starts: the cylinder swings open. */
  reloadOpen() {
    this.noise(0.05, { filter: 'bandpass', freq: 1500, q: 2, gain: 0.6 });
    this.tone(500, 0.05, { type: 'square', sweepTo: 350, gain: 0.15 });
  }

  /** One round goes in. */
  reloadRound() {
    this.noise(0.025, { filter: 'highpass', freq: 3200, gain: 0.55 });
    this.tone(1900, 0.03, { type: 'square', gain: 0.12 });
  }

  /** Cylinder snaps shut: ready to fire. */
  reloadClose() {
    this.noise(0.07, { filter: 'bandpass', freq: 1100, q: 2, gain: 0.85 });
    this.tone(650, 0.06, { type: 'square', gain: 0.22 });
  }

  /** The opponent starts reloading: quieter, distant clicks. */
  botReload() {
    for (let i = 0; i < 3; i++) this.noise(0.02, { filter: 'bandpass', freq: 2200, q: 2, gain: 0.25, delay: 0.1 + i * 0.12 });
  }

  /** The bot fires: a more distant, muffled paint pop. */
  botShot() {
    this.noise(0.2, { filter: 'lowpass', freq: 1400, sweepTo: 200, gain: 0.5 });
    this.tone(200, 0.14, { type: 'sine', sweepTo: 70, gain: 0.5 });
  }

  /** You got painted: a big close-up splat. */
  hurt() {
    this.noise(0.3, { filter: 'bandpass', freq: 500, sweepTo: 180, q: 0.8, gain: 1 });
    this.tone(120, 0.25, { type: 'sine', sweepTo: 45, gain: 0.9 });
  }

  /** False start: descending buzzer. */
  foul() {
    this.tone(400, 0.6, { type: 'sawtooth', sweepTo: 120, gain: 0.6 });
  }

  victory() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.5, delay: 0.5 + i * 0.12 }));
  }

  defeat() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', gain: 0.5, delay: 0.5 + i * 0.25 }));
  }
}
