// All game sounds are synthesized with Web Audio. No audio files.

interface AudioSessionLike {
  type: string;
}

export type AudioSessionStatus = 'playback' | 'unsupported' | 'failed';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
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
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
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

  /** Test beep: two short rising tones. */
  beep() {
    this.tone(660, 0.15, { type: 'square', gain: 0.35 });
    this.tone(990, 0.2, { type: 'square', gain: 0.35, delay: 0.18 });
  }
}
