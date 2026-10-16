/**
 * Procedural Web Audio Engine for Echo Chain.
 * Generates all SFX and atmospheric ambient drone procedurally in real-time.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volume = 0.7;
  private masterGain: GainNode | null = null;

  // Ambient drone nodes
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneRunning = false;

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
      this.updateMasterGain();
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private updateMasterGain(): void {
    if (this.masterGain && this.ctx) {
      const gainVal = this.muted ? 0 : this.volume * 0.45;
      this.masterGain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.updateMasterGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateMasterGain();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.updateMasterGain();
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get currentVolume(): number {
    return this.volume;
  }

  private ensureContext(): boolean {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return !!this.ctx && !this.muted;
  }

  // ─────────────────────────────────────────────────────────────
  // ATMOSPHERIC AMBIENT DRONE
  // ─────────────────────────────────────────────────────────────
  startAmbientDrone(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain || this.droneRunning) return;
    try {
      const t = this.ctx.currentTime;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.001, t);
      this.droneGain.gain.exponentialRampToValueAtTime(0.12, t + 2.0);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = "lowpass";
      this.droneFilter.frequency.setValueAtTime(160, t);

      // Low frequency drone oscillator 1 (55Hz = A1)
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = "sawtooth";
      this.droneOsc1.frequency.setValueAtTime(55, t);

      // Detuned oscillator 2 (55.4Hz) creates subtle binaural beating
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = "sine";
      this.droneOsc2.frequency.setValueAtTime(55.5, t);

      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc1.start(t);
      this.droneOsc2.start(t);
      this.droneRunning = true;
    } catch (e) {
      console.warn("Could not start ambient drone:", e);
    }
  }

  stopAmbientDrone(): void {
    if (!this.droneRunning || !this.ctx || !this.droneGain) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, t);
    this.droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    setTimeout(() => {
      try {
        this.droneOsc1?.stop();
        this.droneOsc2?.stop();
        this.droneOsc1?.disconnect();
        this.droneOsc2?.disconnect();
      } catch {}
      this.droneRunning = false;
    }, 850);
  }

  setBossIntensity(isBoss: boolean): void {
    if (!this.droneRunning || !this.ctx || !this.droneFilter || !this.droneGain) return;
    const t = this.ctx.currentTime;
    if (isBoss) {
      this.droneFilter.frequency.linearRampToValueAtTime(280, t + 1.0);
      this.droneGain.gain.linearRampToValueAtTime(0.18, t + 1.0);
    } else {
      this.droneFilter.frequency.linearRampToValueAtTime(160, t + 1.0);
      this.droneGain.gain.linearRampToValueAtTime(0.12, t + 1.0);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // COMBAT SFX
  // ─────────────────────────────────────────────────────────────

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

  /** Enemy windup warning / telegraph cue */
  telegraph(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(540, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.08);
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

  /** Radiant trophy unlock chime arpeggio */
  achievement(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const notes = [783.99, 1046.50, 1318.51, 1567.98]; // G5, C6, E6, G6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.45);
      }, i * 70);
    });
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

  /** Dramatic resonant brass swell and sub bass drop when boss encounter begins */
  bossIntro(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Sub rumble sweep
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 1.2);
    subGain.gain.setValueAtTime(0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 1.2);

    // Dissonant minor 2nd harmonic brass cluster (C3, C#3, G3)
    const chord = [130.81, 138.59, 196.00];
    for (const freq of chord) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.5);
    }
  }

  /** Alarming glissando siren burst and impact boom when boss changes phases */
  bossPhaseShift(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Siren alarm glissando
    const siren = this.ctx.createOscillator();
    const sirenGain = this.ctx.createGain();
    siren.type = "sawtooth";
    siren.frequency.setValueAtTime(280, t);
    siren.frequency.linearRampToValueAtTime(740, t + 0.25);
    siren.frequency.linearRampToValueAtTime(380, t + 0.55);
    sirenGain.gain.setValueAtTime(0.18, t);
    sirenGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    siren.connect(sirenGain);
    sirenGain.connect(this.masterGain);
    siren.start(t);
    siren.stop(t + 0.65);

    // Sub bass impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "triangle";
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.75);
    subGain.gain.setValueAtTime(0.45, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.75);
  }
}
