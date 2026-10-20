/**
 * Procedural audio. Every sound is synthesized, so the game ships with zero audio assets.
 * Chains are melodies: each link plays one step up a minor pentatonic scale in the current act's key.
 */
type Family = "precision" | "momentum" | "resonance" | "ink";
export type MusicMode = "title" | "map" | "fight" | "boss" | "off";

const PENTA = [0, 3, 5, 7, 10];
const ROOTS = [146.83, 130.81, 164.81]; // D3, C3, E3 per act

function semis(degree: number): number {
  const o = Math.floor(degree / 5);
  return PENTA[((degree % 5) + 5) % 5]! + o * 12;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private verb!: ConvolverNode;
  private verbSend!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  private vol = { master: 0.8, music: 0.6, sfx: 0.8 };
  root = ROOTS[0]!;

  // music
  private mode: MusicMode = "off";
  private layers = 1;
  private nextStep = 0;
  private step = 0;
  private bpm = 112;
  private timer: number | null = null;
  private layerGains: GainNode[] = [];
  private delay!: DelayNode;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.6);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.35;
    this.verbSend.connect(this.verb).connect(this.master);
    this.delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(this.musicBus);
    const n = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    for (let i = 0; i < 6; i++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      this.layerGains.push(g);
    }
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  setAct(act: number): void {
    this.root = ROOTS[Math.max(0, Math.min(2, act - 1))]!;
  }

  private impulse(secs: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return b;
  }

  private gate(key: string, ms: number): boolean {
    if (!this.ctx) return false;
    const now = performance.now();
    const l = this.last.get(key) ?? 0;
    if (now - l < ms) return false;
    this.last.set(key, now);
    return true;
  }

  // ───── primitives
  private osc(type: OscillatorType, f: number, t: number, dur: number, gain: number, dest: AudioNode, attack = 0.002, fEnd?: number): OscillatorNode {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseHit(t: number, dur: number, gain: number, type: BiquadFilterType, f: number, dest: AudioNode, q = 1, fEnd?: number): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, t);
    if (fEnd) flt.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt).connect(g).connect(dest);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.05);
  }

  private tone(f: number, fam: Family, t: number, gain: number, dest: AudioNode): void {
    if (fam === "precision") {
      this.osc("sine", f, t, 0.9, gain, dest);
      this.osc("sine", f * 2.76, t, 0.35, gain * 0.35, dest);
      this.osc("sine", f * 5.4, t, 0.12, gain * 0.15, dest);
    } else if (fam === "momentum") {
      const ctx = this.ctx!;
      const flt = ctx.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.setValueAtTime(f * 8, t);
      flt.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
      flt.connect(dest);
      this.osc("sawtooth", f, t, 0.35, gain * 0.5, flt);
      this.osc("triangle", f * 2, t, 0.25, gain * 0.4, dest);
    } else if (fam === "resonance") {
      this.osc("sine", f, t, 1.3, gain * 0.8, dest, 0.01);
      this.osc("sine", f * 1.004, t, 1.3, gain * 0.6, dest, 0.01);
      this.osc("triangle", f * 2, t, 0.6, gain * 0.25, dest, 0.01);
    } else {
      this.osc("triangle", f, t, 0.4, gain * 0.6, dest);
    }
  }

  // ───── game sfx
  note(links: number, fam: Family): void {
    if (!this.ctx || !this.gate(`note${links}`, 35)) return;
    const t = this.ctx.currentTime;
    const f = this.root * 2 * 2 ** (semis(links - 1) / 12);
    this.tone(f, fam, t, 0.16, this.sfxBus);
    this.tone(f, fam, t, 0.08, this.verbSend);
  }

  hit(crit: boolean, blocked = false): void {
    if (!this.ctx || !this.gate(crit ? "crit" : "hit", crit ? 45 : 28)) return;
    const t = this.ctx.currentTime;
    if (blocked) {
      this.noiseHit(t, 0.06, 0.15, "bandpass", 900, this.sfxBus, 2);
      return;
    }
    this.noiseHit(t, 0.07, 0.35, "bandpass", 1900 + Math.random() * 600, this.sfxBus, 1.2);
    this.osc("sine", 150, t, 0.09, 0.4, this.sfxBus, 0.001, 55);
    if (crit) {
      this.noiseHit(t, 0.05, 0.25, "highpass", 5000, this.sfxBus);
      this.osc("square", 2600, t, 0.08, 0.05, this.sfxBus, 0.001, 1800);
    }
  }

  kill(): void {
    if (!this.ctx || !this.gate("kill", 40)) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.28, 0.3, "bandpass", 4000, this.sfxBus, 0.8, 600);
    for (let i = 0; i < 3; i++) this.osc("sine", 2200 + Math.random() * 3000, t + i * 0.015, 0.18, 0.04, this.verbSend);
    this.osc("sine", 90, t, 0.18, 0.35, this.sfxBus, 0.001, 40);
  }

  parry(): void {
    if (!this.ctx || !this.gate("parry", 60)) return;
    const t = this.ctx.currentTime;
    this.osc("sine", 1568, t, 1.1, 0.18, this.sfxBus);
    this.osc("sine", 2349, t, 0.8, 0.12, this.sfxBus);
    this.osc("sine", 3951, t, 0.3, 0.06, this.verbSend);
    this.noiseHit(t, 0.03, 0.3, "highpass", 6000, this.sfxBus);
  }

  clang(): void {
    if (!this.ctx || !this.gate("clang", 70)) return;
    const t = this.ctx.currentTime;
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 3;
    bp.connect(this.sfxBus);
    for (const r of [1, 1.47, 2.09, 2.71]) this.osc("square", 520 * r, t, 0.3, 0.06, bp);
    this.noiseHit(t, 0.04, 0.3, "highpass", 3000, this.sfxBus);
  }

  hurt(): void {
    if (!this.ctx || !this.gate("hurt", 90)) return;
    const t = this.ctx.currentTime;
    this.osc("sawtooth", 110, t, 0.22, 0.25, this.sfxBus, 0.002, 50);
    this.noiseHit(t, 0.18, 0.3, "lowpass", 900, this.sfxBus);
  }

  heal(): void {
    if (!this.ctx || !this.gate("heal", 200)) return;
    const t = this.ctx.currentTime;
    this.osc("sine", this.root * 4, t, 0.4, 0.06, this.verbSend, 0.02);
    this.osc("sine", this.root * 6, t + 0.06, 0.4, 0.05, this.verbSend, 0.02);
  }

  launch(): void {
    if (!this.ctx || !this.gate("launch", 60)) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.2, 0.18, "bandpass", 500, this.sfxBus, 2, 3000);
  }

  slam(): void {
    if (!this.ctx || !this.gate("slam", 80)) return;
    const t = this.ctx.currentTime;
    this.osc("sine", 120, t, 0.35, 0.55, this.sfxBus, 0.001, 35);
    this.noiseHit(t, 0.3, 0.35, "lowpass", 1400, this.sfxBus, 1, 200);
  }

  wave(): void {
    if (!this.ctx || !this.gate("wave", 120)) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.6, 0.3, "lowpass", 300, this.sfxBus, 4, 1200);
    this.osc("sine", 70, t, 0.5, 0.3, this.sfxBus, 0.01, 45);
  }

  bell(): void {
    if (!this.ctx || !this.gate("bell", 120)) return;
    const t = this.ctx.currentTime;
    this.tone(this.root * 2, "precision", t, 0.14, this.sfxBus);
    this.tone(this.root * 2, "precision", t, 0.12, this.verbSend);
  }

  syncCharge(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.42, 0.35, "bandpass", 200, this.sfxBus, 3, 6000);
    this.osc("sawtooth", this.root / 2, t, 0.42, 0.12, this.sfxBus, 0.35, this.root * 2);
  }

  syncBurst(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let d = 0; d < 6; d++) {
      const f = this.root * 2 * 2 ** (semis(d * 2) / 12);
      this.tone(f, d % 3 === 0 ? "precision" : d % 3 === 1 ? "resonance" : "momentum", t + d * 0.012, 0.12, this.sfxBus);
      this.tone(f, "resonance", t, 0.07, this.verbSend);
    }
    this.osc("sine", 55, t, 1.4, 0.7, this.sfxBus, 0.002, 30);
    this.noiseHit(t, 0.6, 0.5, "lowpass", 5000, this.sfxBus, 0.7, 300);
  }

  chainBig(links: number): void {
    if (!this.ctx || !this.gate("chainbig", 300)) return;
    const t = this.ctx.currentTime;
    this.osc("sine", 60, t, 0.5, 0.25 + links * 0.03, this.sfxBus, 0.002, 38);
  }

  boss(kind: "phase" | "stagger" | "reorder" | "intro"): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === "stagger") { this.clang(); this.osc("sine", 80, t, 0.6, 0.4, this.sfxBus, 0.002, 40); return; }
    this.osc("sawtooth", this.root / 2, t, 1.6, 0.18, this.sfxBus, 0.05, this.root / 4);
    this.osc("sine", this.root, t, 1.6, 0.2, this.verbSend, 0.05);
    this.noiseHit(t, 1.2, 0.2, "lowpass", 800, this.sfxBus, 1, 100);
  }

  ui(kind: "tick" | "confirm" | "back" | "deny" | "card" | "drop" | "unlock"): void {
    if (!this.ctx || !this.gate(`ui${kind}`, 40)) return;
    const t = this.ctx.currentTime;
    const b = this.sfxBus;
    switch (kind) {
      case "tick": this.osc("sine", 1320, t, 0.035, 0.05, b); break;
      case "card": this.noiseHit(t, 0.08, 0.08, "bandpass", 3000, b, 1.5, 1200); this.osc("sine", 880, t, 0.06, 0.04, b); break;
      case "confirm": this.tone(this.root * 4, "precision", t, 0.09, b); this.tone(this.root * 4 * 1.5, "precision", t + 0.07, 0.08, b); break;
      case "back": this.osc("sine", 660, t, 0.08, 0.06, b, 0.002, 440); break;
      case "deny": this.osc("square", 110, t, 0.12, 0.05, b); break;
      case "drop": this.osc("triangle", 520, t, 0.06, 0.08, b, 0.001, 780); break;
      case "unlock":
        for (let i = 0; i < 4; i++) this.tone(this.root * 4 * 2 ** (semis(i * 2) / 12), "resonance", t + i * 0.09, 0.08, b);
        break;
    }
  }

  victory(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 2, 4, 7].forEach((d, i) => {
      this.tone(this.root * 2 * 2 ** (semis(d) / 12), "precision", t + i * 0.11, 0.12, this.sfxBus);
      this.tone(this.root * 2 * 2 ** (semis(d) / 12), "resonance", t + i * 0.11, 0.06, this.verbSend);
    });
  }

  defeat(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [4, 3, 1, 0].forEach((d, i) => this.tone(this.root * 2 ** (semis(d) / 12), "resonance", t + i * 0.22, 0.12, this.sfxBus));
    this.osc("sine", 50, t, 2.5, 0.4, this.sfxBus, 0.05, 30);
  }

  // ───── adaptive music
  setMusic(mode: MusicMode, layers = 1): void {
    if (mode !== this.mode && this.ctx) {
      this.step = 0;
      this.nextStep = this.ctx.currentTime + 0.05;
    }
    this.mode = mode;
    this.layers = layers;
    this.bpm = mode === "fight" ? 112 : mode === "boss" ? 124 : mode === "map" ? 84 : 72;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = (i: number) => {
      if (mode === "off") return 0;
      if (mode === "title") return i === 4 || i === 5 ? 1 : 0;
      if (mode === "map") return i === 3 || i === 4 || i === 5 ? 1 : 0;
      if (mode === "boss") return i <= Math.min(5, layers + 1) ? 1 : 0;
      return i <= layers ? 1 : 0;
    };
    const level = [0.9, 0.35, 0.55, 0.3, 0.22, 0.3];
    this.layerGains.forEach((g, i) => g.gain.setTargetAtTime(on(i) * level[i]!, t, 0.6));
    this.delay.delayTime.setTargetAtTime((60 / this.bpm) * 0.75, t, 0.1);
  }

  private schedule(): void {
    if (!this.ctx || this.mode === "off") return;
    const ctx = this.ctx;
    if (this.nextStep < ctx.currentTime - 0.3) this.nextStep = ctx.currentTime + 0.05;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextStep < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextStep, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextStep += stepDur;
    }
  }

  private playStep(s: number, t: number, sd: number): void {
    const L = this.layerGains;
    const st = s % 16;
    const bar = Math.floor(s / 16);
    const r = this.root;
    // 0 kick
    if (L[0]!.gain.value > 0.01) {
      if (st === 0 || st === 6 || st === 8 || (st === 11 && bar % 2 === 1) || st === 14) this.osc("sine", 110, t, 0.22, 0.9, L[0]!, 0.002, 38);
    }
    // 1 hats
    if (L[1]!.gain.value > 0.01) {
      if (st % 2 === 0) this.noiseHit(t, st % 4 === 2 ? 0.06 : 0.025, 0.35, "highpass", 8000, L[1]!);
    }
    // 2 bass
    if (L[2]!.gain.value > 0.01) {
      const pat = [0, -1, -1, 0, -1, -1, 0, -1, 0, -1, -1, 3, -1, -1, 2, -1];
      const d = pat[st]!;
      if (d >= 0) {
        const deg = bar % 4 === 3 ? d + 3 : d;
        const ctx = this.ctx!;
        const flt = ctx.createBiquadFilter();
        flt.type = "lowpass";
        flt.frequency.setValueAtTime(900, t);
        flt.frequency.exponentialRampToValueAtTime(180, t + sd * 2);
        flt.connect(L[2]!);
        this.osc("sawtooth", (r / 2) * 2 ** (semis(deg) / 12), t, sd * 2.2, 0.5, flt);
      }
    }
    // 3 perc (rim + toms)
    if (L[3]!.gain.value > 0.01) {
      if (st === 4 || st === 12) this.noiseHit(t, 0.05, 0.6, "bandpass", 1800, L[3]!, 4);
      if (st === 7 || st === 10 || (st === 15 && bar % 2 === 0)) this.osc("sine", 240, t, 0.1, 0.4, L[3]!, 0.001, 140);
    }
    // 4 arp
    if (L[4]!.gain.value > 0.01) {
      const seq = [0, 2, 4, 7, 5, 4, 2, 4];
      if (st % 2 === 0) {
        const deg = seq[(st / 2 + bar * 3) % 8]! + (bar % 4 === 3 ? 1 : 0);
        const f = r * 2 * 2 ** (semis(deg) / 12);
        this.osc("triangle", f, t, sd * 3, 0.22, L[4]!, 0.004);
        this.osc("triangle", f, t, sd * 3, 0.1, this.delay, 0.004);
      }
    }
    // 5 pad
    if (L[5]!.gain.value > 0.01 && st === 0 && bar % 2 === 0) {
      const chord = bar % 4 === 0 ? [0, 2, 4, 6] : [-2, 1, 3, 5];
      const dur = sd * 32;
      for (const d of chord) {
        const f = r * 2 ** (semis(d) / 12);
        this.osc("sine", f, t, dur, 0.12, L[5]!, dur * 0.4);
        this.osc("sine", f * 1.006, t, dur, 0.08, this.verbSend, dur * 0.4);
      }
    }
  }
}

export const audio = new AudioEngine();
