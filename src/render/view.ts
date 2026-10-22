import { FAMILY_COLOR, TECH } from "../data/techniques";
import { DT, TUNING } from "../data/tuning";
import { audio } from "../audio/audio";
import { isAlive } from "../sim/combat";
import { slotDelayTicks } from "../sim/trail";
import type { Enemy, Family, Fx as SimFx } from "../sim/types";
import type { World } from "../sim/world";
import { Scene } from "./background";
import { drawEnemyShape, enemyHeight, eyeOut, SLATE_RIM } from "./enemyArt";
import { drawInkFigure, drawSilhouette, headOf, rigFor, TECH_PROP, type ExtraPose, type FigureLook, type Outfit } from "./figure";
import { drawGlow, FAM_RGB, Fx, glowSprite } from "./fx";

const FIG = 1.12; // figure scale in world units
const VOID = "#06050c";
const VOID_RIM = "rgba(140,120,240,0.75)";

/** Family nebula textures: echoes are made of starlight in their family's colour. */
const texCache = new Map<string, HTMLCanvasElement>();
function famTex(rgb: string): HTMLCanvasElement {
  let c = texCache.get(rgb);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = 680;
  c.height = 560;
  const g = c.getContext("2d")!;
  const [r, gg, b] = rgb.split(",").map(Number) as [number, number, number];
  g.fillStyle = `rgb(${r * 0.1 | 0},${gg * 0.1 | 0},${b * 0.14 | 0})`;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "lighter";
  let seed = r * 7 + gg * 13 + b;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tints = [rgb, `${r * 0.55 | 0},${gg * 0.55 | 0},${b * 0.7 | 0}`, `${(r * 0.5 + 60) | 0},${(gg * 0.3 + 20) | 0},${(b * 0.6 + 90) | 0}`];
  for (let i = 0; i < 26; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, rad = 40 + rnd() * 220;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${tints[i % 3]},${0.22 + rnd() * 0.3})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 1400; i++) {
    const s = rnd() ** 5 * 3.2 + 0.7;
    g.fillStyle = `rgba(255,255,255,${0.55 + rnd() * 0.45})`;
    g.fillRect(rnd() * c.width, rnd() * c.height, s, s);
  }
  texCache.set(rgb, c);
  return c;
}
const SCR_W = 300, SCR_H = 240, SCR_OX = 150, SCR_OY = 190;

export interface ViewHooks {
  onTrigger?(slot: number, family: Family): void;
  onChain?(links: number): void;
  onSync?(): void;
  onHurt?(dmg: number): void;
  onBoss?(text: string): void;
  onTutorial?(kind: "link" | "sync"): void;
  onParry?(): void;
}

export interface ViewSettings {
  reducedFlash: boolean;
  reducedShake: boolean;
  numbers: boolean;
}

interface Arc { from: number; to: number; rgb: string; age: number; dropped: boolean }
interface Phantom { x: number; y: number; pose: ExtraPose; rgb: string; age: number; life: number; inverse: boolean; scale: number }
interface EnemyAnim { last: Enemy["state"]; atk: number; seen: number }

const TECH_POSE: Record<string, ExtraPose> = {
  guard: "parry", read: "lunge", needle: "thrust", pinpoint: "thrust", sunder: "heavy", executioner: "heavy", lastlight: "cast", riposte: "lunge",
  launcher: "uppercut", juggler: "strike", slam: "spike", flurry: "strike", pursuit: "lunge", shockline: "spike", tempo: "cast", overdrive: "cast",
  mirror: "cast", amplifier: "cast", prism: "cast", inverse: "cast", doppel: "cast", bell: "cast", harvest: "cast", burning: "cast",
};
const PHANTOM_AT_TARGET = new Set(["read", "pinpoint", "sunder", "executioner", "riposte", "launcher", "juggler", "slam", "flurry", "pursuit"]);

export class FightView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scratch: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;
  private S = 1;
  /** scratch (echo) resolution scale */
  private SS = 1;
  W = 1280;
  H = 720;
  groundY = 510;
  /** World zoom about the ground line: bigger characters, same sim. */
  zoom = 1.3;
  world: World | null = null;
  scene: Scene;
  fx = new Fx();
  hooks: ViewHooks = {};
  settings: ViewSettings = { reducedFlash: false, reducedShake: false, numbers: true };
  speed = 1;
  paused = false;
  attract = false;
  /** Hero attire (settings). */
  outfit: Outfit = "cloak";
  tutorial = false;
  /** Sync command ticks issued this fight (for the run's choice log). */
  syncTicks: number[] = [];

  private families: (Family | "ink")[] = ["ink"];
  private techs: string[] = [];
  private arcs: Arc[] = [];
  private phantoms: Phantom[] = [];
  private slotFlash: number[] = [];
  private slotPose: { pose: ExtraPose; t: number }[] = [];
  private ghostFlash: number[] = [];
  private chainShow = { n: 0, t: 9, rgb: FAM_RGB.bone! };
  private lastBig = -1;
  private trauma = 0;
  private hitstop = 0;
  private hitstopCd = 0;
  private slowmo = 1;
  private slowmoT = 0;
  private syncFreeze = 0;
  private syncGlow = 0;
  private invertT = 0;
  private flash = 0;
  private hurtV = 0;
  private acc = 0;
  private camX = 0;
  private time = 0;
  private anim = new Map<number, EnemyAnim>();
  private vignette: CanvasGradient | null = null;
  private tutorialLinkShown = false;
  private bannerText = "";
  private bannerT = 9;
  private lastFrame = 0;
  /** Adaptive quality: afterimages and ambient particles drop out if frames get expensive. */
  private costEma = 0;
  lowQuality = false;
  /** dev/capture: never drop quality */
  lockQuality = false;
  /** Opening fall: he kneels in the dark, the screen inverts, the first echo rises. */
  introT = 0;
  private echoMul = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.scratch = document.createElement("canvas");
    this.sctx = this.scratch.getContext("2d")!;
    this.scene = new Scene(1);
    this.resize();
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    const aspect = cw / ch;
    if (aspect >= 1.5) {
      this.H = 720;
      this.W = 720 * aspect;
    } else if (aspect >= 1) {
      this.W = 1100;
      this.H = 1100 / aspect;
    } else {
      // portrait phone: a tighter frame so the trail reads at thumb distance
      this.W = 840;
      this.H = 840 / aspect;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = cw / this.W;
    this.S = Math.min(scale * dpr, 2.6);
    this.canvas.width = Math.round(this.W * this.S);
    this.canvas.height = Math.round(this.H * this.S);
    this.groundY = this.H - (aspect >= 1.5 ? 190 : aspect >= 1 ? Math.min(240, this.H * 0.28) : 130);
    this.zoom = aspect >= 1.5 ? 1.5 : aspect >= 1 ? 1.28 : 1.45;
    this.SS = Math.min(2, this.S * this.zoom);
    this.scratch.width = Math.ceil(SCR_W * this.SS);
    this.scratch.height = Math.ceil(SCR_H * this.SS);
    this.vignette = null;
  }

  setWorld(w: World, act: number): void {
    this.world = w;
    let h = 0;
    for (const ch of String(w.cfg.seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    this.scene = new Scene(act, h % 997);
    this.techs = w.cfg.trail.map((s) => s.tech);
    this.families = ["ink", ...this.techs.map((t) => TECH[t]?.family ?? "precision")];
    this.slotFlash = new Array(this.families.length + 4).fill(0);
    this.slotPose = this.families.map(() => ({ pose: "idle" as ExtraPose, t: 9 }));
    this.ghostFlash = new Array(8).fill(0);
    this.arcs = [];
    this.phantoms = [];
    this.fx = new Fx();
    this.anim.clear();
    this.camX = w.fighter.x - (this.W / this.zoom) * 0.34;
    this.acc = 0;
    this.hitstop = 0;
    this.syncFreeze = 0;
    this.slowmo = 1;
    this.syncTicks = [];
    this.introT = 0;
    this.chainShow = { n: 0, t: 9, rgb: FAM_RGB.bone! };
    this.bannerT = 9;
    this.lastBig = -1;
  }

  /** Begin the 0.4s Sync Break freeze. The sim resolves the strike when the freeze ends. */
  requestSync(): boolean {
    const w = this.world;
    if (!w || this.syncFreeze > 0 || w.outcome !== "running" || !w.chargeFull || !w.front() || this.paused) return false;
    this.syncFreeze = TUNING.syncFreeze;
    if (!this.attract) audio.syncCharge();
    this.hooks.onSync?.();
    return true;
  }

  get syncing(): boolean {
    return this.syncFreeze > 0;
  }

  banner(text: string): void {
    this.bannerText = text;
    this.bannerT = 0;
  }

  /** Advance presentation by real dt and render. */
  frame(now: number): void {
    const realDt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;
    this.time += realDt;
    const w = this.world;
    if (w && !this.paused) {
      if (this.slowmoT > 0) {
        this.slowmoT -= realDt;
        if (this.slowmoT <= 0) this.slowmo = 1;
      }
      if (w.outcome === "lost") this.slowmo = 0.3;
      if (this.introT > 0) {
        const prev = this.introT;
        this.introT -= realDt;
        if (prev > 0.9 && this.introT <= 0.9) {
          this.flash = this.settings.reducedFlash ? 0.2 : 0.7;
          this.invertT = this.settings.reducedFlash ? 0 : 0.14;
          this.shake(0.5);
          audio.syncBurst();
        }
      } else if (this.syncFreeze > 0) {
        this.syncFreeze -= realDt;
        this.syncGlow = Math.min(1, this.syncGlow + realDt * 4);
        if (this.syncFreeze <= 0) {
          this.syncTicks.push(w.tick + 1);
          w.step([{ type: "sync" }]);
          this.drain();
        }
      } else if (this.hitstop > 0) {
        this.hitstop -= realDt;
      } else {
        this.syncGlow = Math.max(0, this.syncGlow - realDt * 2.5);
        this.acc += realDt * this.speed * this.slowmo;
        let n = 0;
        while (this.acc >= DT && n < 8) {
          w.step([]);
          this.drain();
          this.acc -= DT;
          n++;
          if (this.hitstop > 0 || this.syncFreeze > 0) { this.acc = 0; break; }
        }
      }
      if (this.attract) this.attractTick(w);
    }
    const fxDt = this.paused ? 0 : realDt * (this.hitstop > 0 ? 0.12 : 1) * (this.syncFreeze > 0 ? 0.1 : 1) * Math.min(1.5, this.speed * this.slowmo);
    this.fx.update(fxDt);
    this.hitstopCd = Math.max(0, this.hitstopCd - realDt);
    for (const a of this.arcs) a.age += fxDt;
    this.arcs = this.arcs.filter((a) => a.age < 0.42);
    for (const p of this.phantoms) p.age += fxDt;
    this.phantoms = this.phantoms.filter((p) => p.age < p.life);
    for (let i = 0; i < this.slotFlash.length; i++) this.slotFlash[i] = Math.max(0, this.slotFlash[i]! - fxDt * 3.2);
    for (let i = 0; i < this.ghostFlash.length; i++) this.ghostFlash[i] = Math.max(0, this.ghostFlash[i]! - fxDt * 3);
    for (const s of this.slotPose) s.t += fxDt;
    this.chainShow.t += fxDt;
    this.bannerT += realDt;
    this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    this.flash = Math.max(0, this.flash - realDt * 4);
    this.invertT = Math.max(0, this.invertT - realDt);
    this.hurtV = Math.max(0, this.hurtV - realDt * 2.2);
    const t0 = performance.now();
    this.render();
    const cost = performance.now() - t0;
    this.costEma = this.costEma * 0.95 + cost * 0.05;
    if (this.lockQuality) this.lowQuality = false;
    else if (!this.lowQuality && this.costEma > 11) this.lowQuality = true;
    else if (this.lowQuality && this.costEma < 5) this.lowQuality = false;
  }

  private addHitstop(s: number): void {
    if (this.attract || this.hitstopCd > 0) return;
    this.hitstop = Math.max(this.hitstop, s / Math.max(1, this.speed * 0.75));
    this.hitstopCd = s + 0.1;
  }

  private shake(a: number): void {
    this.trauma = Math.min(1, this.trauma + a * (this.settings.reducedShake ? 0.25 : 1));
  }

  // ───── sim → presentation
  private laneY(lane: number): number {
    return this.groundY + (lane - 0.5) * 16;
  }

  private slotX(j: number): number {
    const w = this.world!;
    if (j <= 0) return w.fighter.x;
    const x = w.echoX(j);
    if (this.syncGlow > 0) {
      const target = w.fighter.x - 16 - j * 9;
      const k = this.syncGlow * this.syncGlow * (3 - 2 * this.syncGlow);
      return x + (target - x) * k;
    }
    return x;
  }

  private slotY(j: number): number {
    if (j <= 0 || this.syncGlow <= 0) return this.groundY;
    const k = this.syncGlow;
    return this.groundY - Math.sin(j * 1.3) * 14 * k - j * 3 * k;
  }

  private rgbOf(j: number): string {
    const f = this.families[j] ?? "ink";
    return FAM_RGB[f]!;
  }

  private drain(): void {
    const w = this.world!;
    for (const f of w.fx) this.handle(f);
    w.fx.length = 0;
  }

  private handle(f: SimFx): void {
    const w = this.world!;
    const sfx = !this.attract;
    switch (f.k) {
      case "arc": {
        this.arcs.push({ from: f.from, to: f.to, rgb: f.dropped ? "120,120,130" : FAM_RGB[f.family]!, age: 0, dropped: !!f.dropped });
        if (this.tutorial && !this.tutorialLinkShown && !f.dropped && f.from === 0) {
          this.tutorialLinkShown = true;
          this.slowmo = 0.22;
          this.slowmoT = 1.4;
          this.hooks.onTutorial?.("link");
        }
        break;
      }
      case "trigger": {
        this.slotFlash[f.slot] = 1;
        const sp = this.slotPose[f.slot];
        const pose = TECH_POSE[f.tech] ?? "strike";
        if (sp) { sp.pose = pose; sp.t = 0; }
        const tgt = f.targetId >= 0 ? w.enemyById(f.targetId) : undefined;
        const rgb = FAM_RGB[f.family]!;
        if (tgt && PHANTOM_AT_TARGET.has(f.tech)) {
          const ty = this.laneY(tgt.lane) - tgt.z * (f.tech === "juggler" ? 0.6 : 0);
          const dx = f.tech === "riposte" || f.tech === "pursuit" ? 26 : -34;
          this.phantoms.push({ x: tgt.x + dx, y: ty, pose: f.tech === "juggler" ? "strike" : pose, rgb, age: 0, life: 0.32, inverse: false, scale: FIG * 0.96 });
          const ex = this.slotX(f.slot);
          this.fx.add({ k: "streak", x: ex, y: this.groundY - 50, x1: tgt.x - 20, y1: ty - 50, rgb, size: 2, max: 0.18 });
        }
        if (f.tech === "launcher" && tgt) { this.fx.dust(tgt.x, this.laneY(tgt.lane), 4); if (sfx) audio.launch(); }
        if (f.tech === "slam" && tgt) { this.fx.dust(tgt.x, this.laneY(tgt.lane), 8); this.fx.ring(tgt.x, this.laneY(tgt.lane), 90, rgb, 0.4, 4); this.shake(0.22); if (sfx) audio.slam(); }
        if (f.tech === "guard") { this.fx.ring(w.fighter.x + 24, this.groundY - 50, 46, rgb, 0.35, 4); }
        if (f.tech === "amplifier") { const ex = this.slotX(f.slot); this.fx.ring(ex, this.groundY - 50, 34, rgb, 0.4, 2); this.fx.ring(ex, this.groundY - 50, 54, rgb, 0.5, 1.5); }
        if (f.tech === "mirror" || f.tech === "tempo") { const ex = this.slotX(f.slot); this.fx.ring(ex, this.groundY - 50, 40, rgb, 0.3, 2); }
        if (f.tech === "overdrive") { this.fx.add({ k: "glint", x: w.fighter.x, y: this.groundY - 50, size: 40, rgb, max: 0.3 }); }
        if (f.tech === "lastlight") { this.fx.add({ k: "glint", x: w.fighter.x + 30, y: this.groundY - 70, size: 30, rgb, max: 0.5 }); }
        if (f.tech === "harvest" && tgt) { this.fx.add({ k: "streak", x: tgt.x, y: this.laneY(tgt.lane) - 40, x1: w.fighter.x, y1: this.groundY - 60, rgb, size: 3, max: 0.3 }); }
        if (f.tech === "inverse" && tgt) { this.phantoms.push({ x: tgt.x, y: this.laneY(tgt.lane) - tgt.z, pose: "cast", rgb, age: 0, life: 0.22, inverse: true, scale: FIG }); }
        if (f.tech === "doppel") { this.fx.ring(this.slotX(this.techs.length + 1), this.groundY - 40, 30, rgb, 0.35, 2); }
        if (f.tech === "bell" && sfx) audio.bell();
        this.hooks.onTrigger?.(f.slot, f.family as Family);
        break;
      }
      case "note":
        if (sfx) audio.note(f.links, (this.families[f.slot] ?? "precision") as Family);
        break;
      case "chain": {
        if (f.links >= this.chainShow.n || this.chainShow.t > 0.5) {
          this.chainShow = { n: f.links, t: 0, rgb: this.chainShow.t > 0.5 ? FAM_RGB.bone! : this.chainShow.rgb };
        }
        const j = Math.min(this.families.length - 1, f.links);
        this.chainShow.rgb = this.rgbOf(j);
        if (f.links >= 5 && this.lastBig !== w.tick) {
          this.lastBig = w.tick;
          this.addHitstop(TUNING.hitstop.chain5);
          this.shake(0.12 + f.links * 0.04);
          if (sfx) audio.chainBig(f.links);
        }
        this.hooks.onChain?.(f.links);
        break;
      }
      case "hit": {
        const y = this.laneY(f.lane) - f.z - 36;
        const rgb = FAM_RGB[f.family]!;
        if (f.blocked) {
          this.fx.sparks(f.x - 10, y, "150,160,180", 3, 160, 1.5);
          if (sfx) audio.hit(false, true);
          if (this.settings.numbers && f.dmg === 0) this.fx.num(f.x, y - 20, "×", "150,160,180");
          break;
        }
        this.fx.sparks(f.x + 4, y, rgb, f.crit ? 9 : 4, f.crit ? 340 : 230);
        this.fx.add({ k: "glint", x: f.x + 4, y, size: f.crit ? 34 : 18, rgb, max: 0.16 });
        if (f.crit) {
          this.fx.add({ k: "star", x: f.x + 4, y, size: 7, rgb: FAM_RGB.gold!, max: 0.22, rot: Math.random() });
          this.addHitstop(TUNING.hitstop.crit);
          this.shake(0.06);
        } else if (f.family === "ink") this.addHitstop(TUNING.hitstop.hit);
        // Numbers stay quiet: crits and the fighter's own strikes only. The chain counter is the loud number.
        if (this.settings.numbers && f.dmg >= 1 && (f.crit || f.family === "ink")) this.fx.num(f.x + 12, y - 22 - Math.random() * 14, String(Math.round(f.dmg)), f.crit ? FAM_RGB.gold! : "239,233,220", f.crit);
        if (sfx) audio.hit(f.crit);
        break;
      }
      case "parry":
        this.fx.ring(f.x + 6, this.groundY - 52, 70, FAM_RGB.precision!, 0.45, 5);
        this.fx.sparks(f.x + 10, this.groundY - 56, "255,255,255", 10, 300);
        this.fx.add({ k: "glint", x: f.x + 10, y: this.groundY - 56, size: 70, rgb: "255,236,180", max: 0.3 });
        this.addHitstop(TUNING.hitstop.crit);
        if (sfx) audio.parry();
        this.hooks.onParry?.();
        break;
      case "clang":
        this.fx.sparks(f.x + 6, this.groundY - 60 - f.z, "255,255,255", 7, 380, 1.6);
        this.fx.ring(f.x + 6, this.groundY - 60 - f.z, 26, "220,220,230", 0.18, 2);
        if (sfx) audio.clang();
        break;
      case "kill": {
        const y = this.laneY(f.lane) - f.z;
        const big = f.kind === "bulwark" || f.kind === "duplicate" || f.kind === "original";
        this.fx.shards(f.x + 14, y - 30, big ? 18 : 10);
        this.fx.shards(f.x + 14, y - 30, 4, "122,131,148");
        this.fx.dust(f.x + 14, y, 4);
        this.shake(big ? 0.25 : 0.06);
        if (sfx) audio.kill();
        break;
      }
      case "sync":
        this.flash = this.settings.reducedFlash ? 0.15 : 0.6;
        this.invertT = this.settings.reducedFlash ? 0 : 0.1;
        this.shake(0.7);
        this.chainShow = { n: f.slots, t: 0, rgb: "255,255,255" };
        this.fx.add({ k: "text", x: w.fighter.x + 170, y: this.groundY - 250, text: "RESOUND", size: 34, rgb: "255,255,255", max: 1.1, add: false });
        for (let j = 0; j <= f.slots; j++) this.slotFlash[j] = 1;
        if (sfx) audio.syncBurst();
        break;
      case "hurt":
        this.hurtV = Math.min(1, this.hurtV + 0.5 + f.dmg / 20);
        this.shake(0.18 + f.dmg / 40);
        this.fx.sparks(w.fighter.x + 8, this.groundY - 50, FAM_RGB.hurt!, 6, 220);
        if (this.settings.numbers) this.fx.num(w.fighter.x, this.groundY - 110, `-${Math.max(1, Math.round(f.dmg))}`, FAM_RGB.hurt!);
        if (sfx) audio.hurt();
        this.hooks.onHurt?.(f.dmg);
        break;
      case "beam": {
        const rgb = FAM_RGB[f.family]!;
        this.fx.add({ k: "beam", x: f.x0, y: this.groundY - 56, x1: f.x1, y1: this.groundY - 40 - f.z, rgb, size: 4, max: 0.2 });
        break;
      }
      case "wave":
        this.fx.add({ k: "wave", x: f.x, y: this.groundY + 6, rgb: FAM_RGB[f.family]!, max: 0.55 });
        this.shake(0.15);
        if (sfx) audio.wave();
        break;
      case "pulse":
        this.fx.ring(f.x, this.groundY - 30, f.r * 1.1, FAM_RGB[f.family]!, 0.45, 4);
        this.fx.add({ k: "glint", x: f.x, y: this.groundY - 40, size: f.r * 0.6, rgb: FAM_RGB[f.family]!, max: 0.3 });
        break;
      case "boss": {
        const t = f.text === "phase" ? "SHIFT" : f.text === "stagger" ? "BROKEN" : "TURNED";
        this.banner(t);
        if (sfx) audio.boss(f.text);
        this.shake(f.text === "stagger" ? 0.4 : 0.25);
        this.hooks.onBoss?.(f.text);
        break;
      }
      case "doppel":
        this.slotFlash[f.slot] = 1;
        break;
      case "mimic": {
        const e = w.enemyById(f.id);
        if (e) this.fx.ring(e.x, this.laneY(e.lane) - 60, 36, FAM_RGB[TECH[f.tech]?.family ?? "resonance"]!, 0.4, 2);
        break;
      }
      case "heal":
        if (this.settings.numbers) this.fx.num(w.fighter.x - 10, this.groundY - 112, `+${Math.round(f.amount)}`, "180,255,200");
        if (sfx) audio.heal();
        break;
      case "ghost":
        this.ghostFlash[f.idx] = 1;
        break;
      default:
        break;
    }
  }

  private attractTick(w: World): void {
    if (w.aliveSorted().length < 3 && w.tick % 30 === 0) {
      const kinds: Enemy["kind"][] = ["husk", "husk", "bulwark", "lancer", "splitter"];
      for (let i = 0; i < 3; i++) w.spawn(kinds[(w.tick / 30 + i) % kinds.length | 0]!, { x: w.fighter.x + 560 + i * 60 });
    }
    if (w.chargeFull && w.aliveSorted().length >= 3 && this.syncFreeze <= 0) this.requestSync();
    if (w.log.length > 2000) w.log.length = 0;
    if (w.stats.codex.length > 200) w.stats.codex.length = 0;
    if (w.stats.killTimes.length > 500) w.stats.killTimes.length = 0;
  }

  // ───── drawing
  private render(): void {
    const ctx = this.ctx;
    const w = this.world;
    ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#07070a";
    ctx.fillRect(0, 0, this.W, this.H);
    if (!w) {
      this.scene.draw(ctx, this.time * 40, this.W, this.H, this.groundY, this.time);
      return;
    }
    const viewW = this.W / this.zoom;
    const targetCam = w.fighter.x - viewW * (viewW > 1100 ? 0.42 : viewW < 650 ? 0.52 : 0.38);
    this.camX += (targetCam - this.camX) * 0.12;
    const tr = this.trauma * this.trauma;
    const sx = (Math.sin(this.time * 61) + Math.sin(this.time * 37)) * 9 * tr;
    const sy = (Math.cos(this.time * 53) + Math.sin(this.time * 29)) * 7 * tr;
    ctx.save();
    ctx.translate(sx, sy);
    const camX = this.camX;

    const want = this.chainShow.t < 1.1 ? Math.min(1, this.chainShow.n / 7) : 0;
    this.scene.energy += (want - this.scene.energy) * 0.04;
    this.scene.draw(ctx, camX * this.zoom, this.W, this.H, this.groundY, this.time);

    if (this.syncGlow > 0) {
      ctx.fillStyle = `rgba(4,3,8,${0.5 * this.syncGlow})`;
      ctx.fillRect(-20, -20, this.W + 40, this.H + 40);
    }
    ctx.save();
    ctx.translate(0, this.groundY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(0, -this.groundY);

    // burn zones
    for (const z of w.zones) {
      const x0 = z.x0 - camX, x1 = z.x1 - camX;
      const g = ctx.createLinearGradient(0, this.groundY - 30, 0, this.groundY + 10);
      g.addColorStop(0, "rgba(63,240,255,0)");
      g.addColorStop(1, `rgba(63,240,255,${0.25 * Math.min(1, z.t)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x0, this.groundY - 30, x1 - x0, 40);
      if (Math.random() < 0.6) this.fx.add({ k: "flame", x: z.x0 + Math.random() * (z.x1 - z.x0), y: this.groundY + 4, size: 5 + Math.random() * 4, rgb: FAM_RGB.resonance!, max: 0.5 });
    }

    // shadows
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    const shadow = (x: number, y: number, r: number, z = 0) => {
      const k = Math.max(0.3, 1 - z / 200);
      ctx.beginPath();
      ctx.ellipse(x - camX, y + 2, r * k, r * 0.22 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    shadow(w.fighter.x, this.groundY, 22);
    const alive = w.enemies;
    for (const e of alive) if (e.state !== "dead") shadow(e.x + (e.isBoss ? 26 : 14 * e.size), this.laneY(e.lane), 20 * e.size, e.z);

    const back = alive.filter((e) => e.lane < 0.5).sort((a, b) => a.lane - b.lane);
    const front = alive.filter((e) => e.lane >= 0.5).sort((a, b) => a.lane - b.lane);
    for (const e of back) this.drawEnemy(e, camX);
    this.drawTrail(w, camX);
    for (const e of front) this.drawEnemy(e, camX);

    // projectiles
    for (const p of w.projectiles) {
      const x = p.x - camX, y = this.groundY - 44;
      ctx.strokeStyle = "rgba(239,233,220,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60, y - 3);
      ctx.stroke();
      ctx.strokeStyle = SLATE_RIM;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y - 1.5);
      ctx.stroke();
      ctx.fillStyle = "#efe9dc";
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 2, y - 4);
      ctx.lineTo(x + 2, y + 4);
      ctx.fill();
    }

    // phantom strikes
    for (const p of this.phantoms) {
      const k = p.age / p.life;
      const rig = rigFor(p.pose, p.age * 0.9 + 0.04);
      if (p.inverse) {
        this.blitFigure(rig, { form: "duelist", time: this.time }, "#ffffff", p.x - camX, p.y, (1 - k) * 0.9, "difference", p.scale * 1.4, false);
      } else {
        drawGlow(ctx, p.x - camX + 10, p.y - 50, 50, p.rgb, (1 - k) * 0.4);
        this.blitFigure(rig, { form: w.form.id, time: this.time, smearColor: `rgb(${p.rgb})` }, `rgb(${p.rgb})`, p.x - camX, p.y, (1 - k) * 0.85, "lighter", p.scale, false);
      }
    }

    this.drawArcs(w, camX);
    this.fx.draw(ctx, camX);
    this.drawChainCounter(w, camX);

    if (this.syncGlow > 0) this.drawSyncRays(w, camX);

    ctx.restore();
    this.reflect(camX);
    ctx.restore();

    // vignette + hurt
    if (!this.vignette) {
      const g = ctx.createRadialGradient(this.W / 2, this.H * 0.55, this.H * 0.35, this.W / 2, this.H * 0.55, this.W * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      this.vignette = g;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.W, this.H);
    if (this.hurtV > 0) {
      const g = ctx.createRadialGradient(this.W * 0.35, this.groundY - 60, 80, this.W * 0.35, this.groundY - 60, this.W * 0.7);
      g.addColorStop(0, "rgba(255,59,78,0)");
      g.addColorStop(1, `rgba(255,30,50,${0.35 * this.hurtV})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (w.outcome === "lost") {
      ctx.fillStyle = "rgba(10,6,10,0.35)";
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.invertT > 0) {
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalCompositeOperation = "source-over";
    }
    this.drawBanner();
  }

  /** Mirror floor: the world above the horizon, flipped and faded, then the floor glaze. */
  private reflect(camX: number): void {
    const c = this.ctx;
    const gyPx = Math.round(this.groundY * this.S);
    const hPx = Math.min(gyPx, Math.round(320 * this.S));
    const below = this.canvas.height - gyPx;
    c.save();
    c.setTransform(1, 0, 0, -1, 0, gyPx * 2 + Math.round(2 * this.S));
    c.globalAlpha = 0.2;
    c.drawImage(this.canvas, 0, gyPx - Math.min(hPx, below), this.canvas.width, Math.min(hPx, below), 0, gyPx - Math.min(hPx, below), this.canvas.width, Math.min(hPx, below));
    c.restore();
    this.scene.drawFloor(c, camX * this.zoom, this.W, this.H, this.groundY, this.time);
  }

  /** Draw a figure tinted into scratch, then composite. */
  private blitFigure(rig: ReturnType<typeof rigFor>, look: FigureLook, color: string, x: number, y: number, alpha: number, mode: GlobalCompositeOperation, scale: number, flip: boolean, tex?: HTMLCanvasElement, edge = 0): void {
    if (alpha <= 0.01) return;
    const s = this.sctx;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, this.scratch.width, this.scratch.height);
    s.setTransform(this.SS, 0, 0, this.SS, 0, 0);
    s.translate(SCR_OX, SCR_OY);
    s.scale(flip ? -scale : scale, scale);
    s.fillStyle = color;
    s.strokeStyle = color;
    drawSilhouette(s, rig, look);
    if (edge) {
      // keep only a thin leading rim
      s.globalCompositeOperation = "destination-out";
      s.translate(edge, edge * 0.8);
      drawSilhouette(s, rig, { ...look, smearColor: undefined });
      s.globalCompositeOperation = "source-over";
    }
    if (tex) {
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = "source-in";
      s.drawImage(tex, -((this.time * 14) % 60) - 10, -10);
      s.globalCompositeOperation = "source-over";
    }
    const ctx = this.ctx;
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = Math.min(1, alpha * this.echoMul);
    ctx.drawImage(this.scratch, x - SCR_OX, y - SCR_OY, SCR_W, SCR_H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawTrail(w: World, camX: number): void {
    const ctx = this.ctx;
    const n = this.techs.length;
    const delayMult = w.mods.delayMult;
    // doppel minis at the tail
    const dop = w.chain.activeDoppels();
    for (let d = dop - 1; d >= 0; d--) {
      const j = n + 1 + d;
      const smp = w.history.sample(slotDelayTicks(j, delayMult));
      const x = this.slotX(j) - camX;
      const rgb = this.rgbOf(n);
      const rig = rigFor(smp.pose, smp.poseT);
      drawGlow(ctx, x, this.groundY - 30, 34, rgb, 0.25 + this.slotFlash[j]! * 0.4);
      this.blitFigure(rig, { form: w.form.id, time: this.time - j * 0.1, speed: 60 }, `rgb(${rgb})`, x, this.groundY, 0.45 + this.slotFlash[j]! * 0.4, "lighter", FIG * 0.68, false);
    }
    this.echoMul = this.introT > 0.9 ? 0 : this.introT > 0 ? 1 - this.introT / 0.9 : 1;
    for (let j = n; j >= 1 && this.echoMul > 0; j--) {
      const tech = this.techs[j - 1]!;
      const rgb = this.rgbOf(j);
      const delay = slotDelayTicks(j, delayMult);
      const smp = w.history.sample(delay);
      const ov = this.slotPose[j]!;
      const useOv = ov.t < 0.38 && this.syncGlow <= 0;
      const pose: ExtraPose = this.syncGlow > 0 ? "parry" : useOv ? ov.pose : smp.pose;
      const pt = this.syncGlow > 0 ? 0.1 : useOv ? ov.t : smp.poseT;
      const x = this.slotX(j) - camX;
      const y = this.slotY(j);
      const fl = this.slotFlash[j]!;
      const inverse = tech === "inverse";
      const tex = famTex(rgb);
      const look: FigureLook = { form: w.form.id, time: this.time - j * 0.12, speed: 70, smearColor: `rgb(${rgb})`, outfit: "none", prop: TECH_PROP[tech] };
      // afterimages while moving
      if (!inverse && !this.lowQuality) {
        for (let k = 2; k >= 1; k--) {
          const s2 = w.history.sample(delay + k * 4);
          const ax = this.slotX(j) - camX - (smp.x - s2.x);
          if (Math.abs(ax - x) < 1.5) continue;
          this.blitFigure(rigFor(s2.pose, s2.poseT), { ...look, smearColor: undefined, time: this.time - j * 0.12 - k * 0.05 }, `rgb(${rgb})`, ax, y, 0.18 / k, "lighter", FIG, false, tex);
        }
      }
      // brush smear while striking
      if (useOv && !inverse) {
        const fade = 1 - ov.t / 0.38;
        for (let k = 4; k >= 1; k--) {
          this.blitFigure(rigFor(pose, Math.max(0, pt - k * 0.035)), { ...look, smearColor: undefined }, `rgb(${rgb})`, x - k * 8, y, (0.28 - k * 0.055) * fade, "lighter", FIG, false);
        }
      }
      drawGlow(ctx, x + 4, y - 50, 64 + fl * 30, rgb, 0.22 + fl * 0.5 + this.syncGlow * 0.4);
      const rig = rigFor(pose, pt);
      if (inverse) {
        this.blitFigure(rig, look, "#ffffff", x, y, 0.85 + fl * 0.15, "difference", FIG, false);
        drawGlow(ctx, x, y - 46, 40, rgb, 0.2 + fl * 0.4);
      } else {
        if (!this.lowQuality) {
          // soft halo + bright leading rim so the starlight body has an edge
          this.blitFigure(rig, { ...look, smearColor: undefined }, `rgb(${rgb})`, x, y, 0.16, "lighter", FIG * 1.05, false);
        }
        this.blitFigure(rig, look, `rgb(${rgb})`, x, y, 0.9 + fl * 0.1 + this.syncGlow * 0.2, "lighter", FIG * (1 + fl * 0.05), false, tex);
        this.blitFigure(rig, { ...look, smearColor: undefined }, "#ffffff", x, y, 0.55 + fl * 0.4, "lighter", FIG * (1 + fl * 0.05), false, undefined, 1.8);
        if (fl > 0.2) this.blitFigure(rig, { ...look, smearColor: undefined }, "#ffffff", x, y, (fl - 0.2) * 0.45, "lighter", FIG, false);
      }
      // stardust
      if (!this.paused && Math.random() < (this.lowQuality ? 0.35 : 0.9) + fl) {
        this.fx.add({ k: "mote", x: this.slotX(j) + (Math.random() - 0.5) * 30, y: y - 10 - Math.random() * 95, vx: -25 - Math.random() * 60, vy: -6 - Math.random() * 18, max: 0.6 + Math.random() * 0.9, size: 0.8 + Math.random() * 1.6, rgb });
      }
      // eyes
      const [hx, hy] = headOf(rig);
      drawGlow(ctx, x + (hx + 3) * FIG, y + (hy - 1) * FIG, 10 + fl * 10, rgb, 0.7 + fl * 0.3);
    }
    this.echoMul = 1;
    // the fighter
    const f = w.fighter;
    const fx = f.x - camX;
    const kneel = this.introT > 0.9;
    const pose = kneel ? "heavy" : this.syncGlow > 0 && this.syncFreeze > 0 ? "parry" : f.pose;
    const rig = rigFor(pose, kneel ? 0.22 : f.poseT);
    const hurt = f.hurtT > 0.15;
    // gait: dark afterimages + speed lines when he runs or dashes
    if (f.gait > 0 && !kneel) {
      const n = f.gait === 2 ? 4 : 2;
      for (let k = n; k >= 1; k--) {
        ctx.save();
        ctx.translate(fx - k * (f.gait === 2 ? 22 : 12), this.groundY);
        ctx.scale(FIG, FIG);
        ctx.globalAlpha = (f.gait === 2 ? 0.22 : 0.14) * (1 - k / (n + 1));
        ctx.fillStyle = ctx.strokeStyle = "#8a7cff";
        drawSilhouette(ctx, rigFor(pose, Math.max(0, f.poseT - k * 0.03)), { form: w.form.id, time: this.time - k * 0.03, speed: 140, outfit: this.outfit });
        ctx.restore();
      }
      if (!this.paused && Math.random() < (f.gait === 2 ? 0.9 : 0.35)) {
        this.fx.add({ k: "streak", x: f.x - 10, y: this.groundY - 15 - Math.random() * 90, x1: f.x + 50 + Math.random() * 40, y1: 0, rgb: "190,180,255", size: 1, max: 0.22 });
        const last = this.fx.ps[this.fx.ps.length - 1]!;
        last.y1 = last.y;
        last.vx = -500;
      }
      if (f.gait === 2 && !this.paused && Math.random() < 0.4) this.fx.dust(f.x - 10, this.groundY, 1, "160,150,230");
    }
    const hlook: FigureLook = { form: w.form.id, time: this.time, speed: f.gait === 2 ? 190 : f.gait === 1 ? 120 : f.pose === "walk" ? 70 : 10, outfit: this.outfit };
    ctx.save();
    ctx.translate(fx, this.groundY);
    ctx.scale(FIG, FIG);
    // brushed edge: a few jittered dark passes
    ctx.fillStyle = ctx.strokeStyle = "#000";
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.translate(-1.5 - k * 1.6 + Math.sin(this.time * 23 + k * 3) * 0.8, Math.cos(this.time * 19 + k) * 0.8);
      drawSilhouette(ctx, rig, hlook);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = ctx.strokeStyle = hurt ? "#ff3b4e" : "#b9b0ff";
    ctx.translate(-1.1, -1.3);
    drawSilhouette(ctx, rig, hlook);
    ctx.restore();
    ctx.fillStyle = ctx.strokeStyle = hurt ? "#2a0610" : "#05040a";
    drawSilhouette(ctx, rig, { ...hlook, smearColor: "rgba(210,200,255,0.9)" });
    ctx.restore();
    // eye slit + horizontal flare
    {
      const [hx, hy] = headOf(rig);
      const ex = fx + (hx + 3.5) * FIG, ey = this.groundY + (hy - 1) * FIG;
      const fw = 120 + this.syncGlow * 200;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const lg = ctx.createLinearGradient(ex - fw, 0, ex + fw, 0);
      lg.addColorStop(0, "rgba(200,180,255,0)");
      lg.addColorStop(0.5, "rgba(210,195,255,1)");
      lg.addColorStop(1, "rgba(200,180,255,0)");
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(this.time * 2.6) ** 2;
      ctx.fillStyle = lg;
      ctx.fillRect(ex - fw, ey - 0.6, fw * 2, 1.2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.fillRect(ex - 3, ey - 1, 6, 2);
      ctx.restore();
      drawGlow(ctx, ex, ey, 14, "210,200,255", 0.8);
    }
    if (!this.paused && Math.random() < 0.35) this.fx.add({ k: "mote", x: f.x + (Math.random() - 0.5) * 24, y: this.groundY - 10 - Math.random() * 90, vx: -20 - Math.random() * 30, vy: -8, max: 0.7, size: 1, rgb: "200,190,255" });
    if (f.overdrive > 0.05) drawGlow(ctx, fx, this.groundY - 40, 50, FAM_RGB.momentum!, f.overdrive * 0.6);
    if (f.guaranteedCrits > 0) drawGlow(ctx, fx + 30, this.groundY - 64, 22, FAM_RGB.precision!, 0.5 + Math.sin(this.time * 10) * 0.2);
    if (this.slotFlash[0]! > 0) drawGlow(ctx, fx + 30, this.groundY - 52, 46, "239,233,220", this.slotFlash[0]! * 0.35);
  }

  private headPoint(j: number, camX: number): [number, number] {
    return [this.slotX(j) - camX + 4, this.slotY(j) - 104];
  }

  private drawArcs(w: World, camX: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const a of this.arcs) {
      const [x0, y0] = this.headPoint(a.from, camX);
      const [x1, y1] = this.headPoint(a.to, camX);
      const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 26 - Math.abs(x1 - x0) * 0.12;
      const travel = 0.06 / Math.max(0.5, this.speed);
      const p = Math.min(1, a.age / travel);
      const fade = a.age < travel ? 1 : Math.max(0, 1 - (a.age - travel) / 0.32);
      if (a.dropped) {
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = `rgba(${a.rgb},${0.45 * fade})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(mx, my, x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      // partial quadratic up to p (De Casteljau)
      const qx = x0 + (mx - x0) * p, qy = y0 + (my - y0) * p;
      const rx = mx + (x1 - mx) * p, ry = my + (y1 - my) * p;
      const hx = qx + (rx - qx) * p, hy = qy + (ry - qy) * p;
      for (const [lw, al] of [[7, 0.18], [3, 0.55], [1.2, 1]] as const) {
        ctx.strokeStyle = `rgba(${a.rgb},${al * fade})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(qx, qy, hx, hy);
        ctx.stroke();
      }
      drawGlow(ctx, hx, hy, 18, a.rgb, fade);
      if (p >= 1) drawGlow(ctx, x1, y1 + 30, 30, a.rgb, fade * 0.6);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private drawChainCounter(w: World, camX: number): void {
    const c = this.chainShow;
    if (c.n < 2 || c.t > 1.1) return;
    const ctx = this.ctx;
    const n = this.techs.length;
    const cx = (w.fighter.x + this.slotX(Math.max(1, Math.ceil(n / 2)))) / 2 - camX;
    const cy = this.groundY - 168;
    const pop = 1 + Math.max(0, 0.35 - c.t) * (c.n >= 5 ? 2.2 : 1.2);
    const a = c.t < 0.8 ? 1 : 1 - (c.t - 0.8) / 0.3;
    const size = 26 + Math.min(6, c.n) * 5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    drawGlow(ctx, 0, -size * 0.35, size * 1.8, c.rgb, a * 0.35);
    ctx.font = `700 ${size}px Syncopate, system-ui, sans-serif`;
    ctx.fillStyle = `rgba(0,0,0,${a * 0.5})`;
    ctx.fillText(`×${c.n}`, 2, 2);
    ctx.fillStyle = `rgba(${c.rgb},${a})`;
    ctx.fillText(`×${c.n}`, 0, 0);
    ctx.font = `700 11px Syncopate, system-ui, sans-serif`;
    ctx.fillStyle = `rgba(239,233,220,${a * 0.85})`;
    ctx.fillText("C H A I N", 0, 18);
    ctx.restore();
  }

  private drawSyncRays(w: World, camX: number): void {
    const ctx = this.ctx;
    const cx = w.fighter.x - camX, cy = this.groundY - 50;
    const k = this.syncGlow;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + this.time * 0.6;
      const r0 = 600 * (1 - k) + 60, r1 = r0 + 120;
      ctx.strokeStyle = `rgba(239,233,220,${0.18 * k})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 220 * (1.4 - k), 130 * (1.4 - k), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  private drawBanner(): void {
    if (this.bannerT > 1.8) return;
    const ctx = this.ctx;
    const t = this.bannerT;
    const a = t < 0.15 ? t / 0.15 : t > 1.4 ? 1 - (t - 1.4) / 0.4 : 1;
    const y = this.H * 0.26;
    ctx.fillStyle = `rgba(4,3,8,${0.55 * a})`;
    ctx.fillRect(0, y - 34, this.W, 54);
    ctx.fillStyle = `rgba(239,233,220,${0.6 * a})`;
    ctx.fillRect(0, y - 34, this.W, 1);
    ctx.fillRect(0, y + 20, this.W, 1);
    ctx.font = "700 22px Syncopate, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(239,233,220,${a})`;
    const spread = (1 - Math.min(1, t * 3)) * 30;
    ctx.save();
    ctx.translate(this.W / 2, y);
    ctx.scale(1 + spread / 300, 1);
    ctx.fillText(this.bannerText, 0, 0);
    ctx.restore();
  }

  private drawEnemy(e: Enemy, camX: number): void {
    const ctx = this.ctx;
    const w = this.world!;
    let an = this.anim.get(e.id);
    if (!an) { an = { last: e.state, atk: 9, seen: this.time }; this.anim.set(e.id, an); }
    if (an.last === "windup" && e.state !== "windup" && e.state !== "dead") an.atk = 0;
    an.last = e.state;
    an.atk += 1 / 60;
    const dead = e.state === "dead";
    const alpha = dead ? Math.max(0, 1 - e.deadT / 0.5) : Math.min(1, e.spawnT * 4);
    if (alpha <= 0) return;
    let x = e.x - camX + (e.isBoss ? 26 : 14 * e.size);
    const y = this.laneY(e.lane) - e.z + (dead ? e.deadT * 30 : 0);
    if (e.staggerT > 0 || e.stunT > 0) x += Math.sin(this.time * 55) * 2.2;
    const lunge = an.atk < 0.25 ? Math.sin((an.atk / 0.25) * Math.PI) * 14 : 0;
    x -= lunge;
    const s = e.size;
    if (e.kind === "duplicate" || e.kind === "original") {
      this.drawBoss(e, x, y, an, alpha);
      return;
    }
    ctx.globalAlpha = alpha;
    if (e.elite) drawGlow(ctx, x, y - 40 * s, 70 * s, "220,210,255", 0.25 + Math.sin(this.time * 4) * 0.06);
    if (e.mimicTech && e.mimicT > 0) drawGlow(ctx, x, y - 66 * s, 34, FAM_RGB[TECH[e.mimicTech]?.family ?? "resonance"]!, 0.7);
    const walking = e.state === "walk" && Math.abs(e.x - w.fighter.x) > e.range + 6 ? 1 : 0.15;
    const rot = e.state === "air" ? Math.max(-0.9, Math.min(0.9, -e.vz / 900)) : 0;
    // rim pass
    ctx.save();
    ctx.translate(x - 1.4, y - 1.7);
    ctx.scale(-s, s);
    ctx.rotate(rot);
    drawEnemyShape(ctx, e, this.time + e.id, e.elite ? "#e4dcff" : VOID_RIM, walking);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-s, s);
    ctx.rotate(rot);
    drawEnemyShape(ctx, e, this.time + e.id, e.flashT > 0 ? flashColor(e.flashT / 0.12) : VOID, walking);
    ctx.restore();
    // eye glint
    if (eyeOut.ok && !dead) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const wind = e.state === "windup";
      const r = (wind ? 3.2 : 1.6) * this.S;
      ctx.fillStyle = wind ? "#ffffff" : "rgba(239,233,220,0.85)";
      ctx.beginPath();
      ctx.arc(eyeOut.x, eyeOut.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (wind) {
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(glowFor("255,255,255"), eyeOut.x - 16 * this.S, eyeOut.y - 16 * this.S, 32 * this.S, 32 * this.S);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (dead) return;
    const h = enemyHeight(e.kind) * s;
    // stun stars
    if (e.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "rgba(255,201,74,0.9)";
        ctx.fillRect(x + Math.cos(a) * 14 - 2, y - h - 8 + Math.sin(a) * 4 - 2, 4, 4);
      }
    }
    if (e.burnT > 0 && Math.random() < 0.3) this.fx.add({ k: "flame", x: e.x + (Math.random() - 0.5) * 20, y: y - Math.random() * h * 0.6, size: 4, rgb: FAM_RGB.resonance!, max: 0.4 });
    // hp bar
    if (e.hp < e.maxHp) {
      const bw = 34 * Math.max(0.8, s), bx = x - bw / 2, by = y - h - 12;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = e.elite ? "#d9d0ff" : "#efe9dc";
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
      for (let i = 0; i < e.breakStacks; i++) {
        ctx.fillStyle = FAMILY_COLOR.precision;
        ctx.fillRect(bx + i * 5, by - 5, 3, 3);
      }
    }
  }

  private drawBoss(e: Enemy, x: number, y: number, an: EnemyAnim, alpha: number): void {
    const ctx = this.ctx;
    const w = this.world!;
    const b = w.boss;
    const isDup = e.kind === "duplicate";
    const form = isDup ? w.form.id : "original";
    const moving = e.state === "walk" && e.x - w.fighter.x > e.range + 4;
    let pose: ExtraPose = moving ? "walk" : "idle";
    let pt = this.time;
    if (e.state === "windup") { pose = "strike"; pt = 0.05; }
    else if (an.atk < 0.4) { pose = "strike"; pt = 0.06 + an.atk; }
    if (e.staggerT > 0.1 || e.state === "air") { pose = "hurt"; pt = 0.08; }
    const rig = rigFor(pose, pt);
    // ghost line behind the boss
    if (b) {
      const count = isDup ? b.order.length : b.phase >= 1 ? 3 : 0;
      for (let k = count - 1; k >= 0; k--) {
        const gx = x + 50 * (k + 1);
        const tech = isDup ? w.cfg.trail[b.order[k]!]?.tech : undefined;
        const rgb = isDup ? desat(FAM_RGB[TECH[tech ?? ""]?.family ?? "resonance"]!) : FAM_RGB.gold!;
        const fl = this.ghostFlash[k] ?? 0;
        const grig = rigFor(fl > 0.3 ? "strike" : pose, fl > 0.3 ? 0.1 + (1 - fl) * 0.2 : pt - k * 0.1);
        drawGlow(ctx, gx, y - 46, 50, rgb, 0.12 + fl * 0.5);
        this.blitFigure(grig, { form, time: this.time - k * 0.1, speed: 30 }, `rgb(${rgb})`, gx, y, (0.32 + fl * 0.5) * alpha, "lighter", FIG * 1.1, true);
      }
    }
    const sc = FIG * 1.18;
    drawGlow(ctx, x, y - 54, 110, isDup ? "150,120,220" : "255,236,180", (isDup ? 0.3 : 0.45) * alpha);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(-sc, sc);
    const flash = e.flashT > 0.05;
    if (isDup) drawInkFigure(ctx, rig, { form, time: this.time, speed: 40, smearColor: "rgba(160,130,255,0.9)", outfit: this.outfit }, flash ? "#ffffff" : "#2c2838", "#a090ff");
    else drawInkFigure(ctx, rig, { form, time: this.time, speed: 40, smearColor: "rgba(255,236,180,0.95)", outfit: "cloak", prop: "halo" }, flash ? "#ffffff" : "#fff3d2", "#5a4520");
    ctx.restore();
    ctx.globalAlpha = 1;
    if (e.stunT > 0 || e.staggerT > 0.2) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "rgba(255,201,74,0.9)";
        ctx.fillRect(x + Math.cos(a) * 16 - 2, y - 128 + Math.sin(a) * 5 - 2, 4, 4);
      }
    }
  }

  /** Screen-space position of the fighter (CSS px relative to canvas) for anchoring DOM. */
  fighterScreen(): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const w = this.world;
    const lx = w ? w.fighter.x - this.camX : this.W * 0.36;
    const k = r.width / this.W;
    return { x: lx * k, y: (this.groundY - 120) * k };
  }

  /** For tests/dev: is anything alive? */
  aliveCount(): number {
    return this.world ? this.world.enemies.filter(isAlive).length : 0;
  }
}

/** Hit flash: a brief lift of the slate toward a cold grey, never a white-out. */
function flashColor(k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const c = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${c(6, 70)},${c(5, 60)},${c(12, 110)})`;
}

function desat(rgb: string): string {
  const [r, g, b] = rgb.split(",").map(Number) as [number, number, number];
  const l = (r + g + b) / 3;
  return [r, g, b].map((c) => Math.round(c * 0.45 + l * 0.35)).join(",");
}

function glowFor(rgb: string): HTMLCanvasElement {
  return glowSprite(rgb);
}
