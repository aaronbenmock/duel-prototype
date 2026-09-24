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

  /** Player's gunshot: sharp crack plus a low boom. */
  shot() {
    this.noise(0.28, { filter: 'lowpass', freq: 6000, sweepTo: 300, gain: 1 });
    this.tone(140, 0.25, { type: 'sine', sweepTo: 40, gain: 0.9 });
  }

  /** Bullet hits the body: dull thwack. */
  hit() {
    this.noise(0.12, { filter: 'bandpass', freq: 500, q: 1.5, gain: 0.9, delay: 0.07 });
    this.tone(180, 0.12, { type: 'triangle', sweepTo: 90, gain: 0.7, delay: 0.07 });
  }

  /** Headshot: thwack plus a bright bell. */
  headshot() {
    this.hit();
    this.tone(1760, 0.5, { type: 'sine', gain: 0.6, delay: 0.1 });
    this.tone(2637, 0.4, { type: 'sine', gain: 0.35, delay: 0.1 });
  }

  /** Miss: ricochet whine. */
  miss() {
    this.tone(2600, 0.4, { type: 'sine', sweepTo: 800, gain: 0.35, delay: 0.09 });
  }

  /** Dry fire on an empty cylinder: tiny metallic click. */
  empty() {
    this.noise(0.02, { filter: 'highpass', freq: 4000, gain: 0.6 });
    this.tone(2400, 0.03, { type: 'square', gain: 0.15 });
  }

  /** Reload: cylinder clicks followed by a closing clack. */
  reload() {
    for (let i = 0; i < 4; i++) this.noise(0.02, { filter: 'highpass', freq: 3500, gain: 0.4, delay: i * 0.05 });
    this.noise(0.06, { filter: 'bandpass', freq: 1200, q: 2, gain: 0.8, delay: 0.26 });
    this.tone(600, 0.05, { type: 'square', gain: 0.2, delay: 0.26 });
  }

  /** The bot fires: a more distant, muffled shot. */
  botShot() {
    this.noise(0.3, { filter: 'lowpass', freq: 1800, sweepTo: 200, gain: 0.55 });
  }

  /** You got hit: heavy thud and a harsh buzz. */
  hurt() {
    this.tone(90, 0.35, { type: 'sine', sweepTo: 40, gain: 1, delay: 0.05 });
    this.tone(110, 0.3, { type: 'sawtooth', gain: 0.35, delay: 0.05 });
    this.noise(0.15, { filter: 'lowpass', freq: 900, gain: 0.8, delay: 0.05 });
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
