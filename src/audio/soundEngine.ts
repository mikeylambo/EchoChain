/**
 * Procedural Web Audio Engine for Echo Chain.
 * Generates all SFX procedurally in real-time without external audio files.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterGain: GainNode | null = null;

  // Pentatonic scale frequencies for ascending chain harmonics (C5, D5, E5, G5, A5, C6, D6, E6)
  private readonly chainScale = [
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50, // C6
    1174.66, // D6
    1318.51, // E6
  ];

  init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private ensureContext(): boolean {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return !!this.ctx && !this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Fighter ink slash whoosh */
  slash(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(200, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Impact hit with crunch / bass punch */
  hit(crit = false): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Body thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = crit ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(crit ? 240 : 160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + (crit ? 0.22 : 0.12));

    gain.gain.setValueAtTime(crit ? 0.45 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (crit ? 0.22 : 0.12));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + (crit ? 0.22 : 0.12));

    // High snap on crit
    if (crit) {
      const snap = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snap.type = "sine";
      snap.frequency.setValueAtTime(980, t);
      snap.frequency.exponentialRampToValueAtTime(300, t + 0.15);

      snapGain.gain.setValueAtTime(0.25, t);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      snap.connect(snapGain);
      snapGain.connect(this.masterGain);

      snap.start(t);
      snap.stop(t + 0.15);
    }
  }

  /** Metallic chime on parry */
  parry(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const freqs = [1200, 1850, 2400];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.35);
    }
  }

  /** Shatter crunch on enemy stagger */
  stagger(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.25);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Ascending pentatonic bell chime as chain propagates down the echoes!
   * Link 1 = C5, Link 2 = D5, Link 3 = E5, etc.
   */
  chainLink(linkIndex: number): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const idx = Math.max(0, Math.min(this.chainScale.length - 1, linkIndex - 1));
    const freq = this.chainScale[idx]!;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    // Dynamic presence based on chain depth
    const vol = Math.min(0.35, 0.15 + linkIndex * 0.03);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  /** Massive chord burst and bass rumble on Sync Break */
  syncBreak(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Harmonic power chord: C4, G4, C5, E5
    const chord = [261.63, 392.00, 523.25, 659.25];
    for (const f of chord) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.4);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.55);
    }

    // Low sub rumble
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(80, t);
    sub.frequency.exponentialRampToValueAtTime(35, t + 0.6);

    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    sub.connect(subGain);
    subGain.connect(this.masterGain);

    sub.start(t);
    sub.stop(t + 0.6);
  }

  /** UI click / button confirm */
  uiClick(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Victory flourish */
  victory(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
      }, i * 90);
    });
  }
}
