import { ENEMIES, type FightPlan, type SpawnGroup } from "../data/enemies";
import { FORMS, type FormDef, type FormId } from "../data/forms";
import { BASE_MODS, type RunMods } from "../data/seals";
import { DT, MS_PER_TICK, TUNING } from "../data/tuning";
import { ChainEngine, type TrailSlot } from "./chain";
import { applyDamage, dealHit, isAlive, stagger, type DamageSource } from "./combat";
import { ELITE_TRAITS, initBoss, killAllSilently, updateEnemies, type BossRuntime } from "./enemies";
import { streamFor, type DeterministicRng } from "./rng";
import { slotDelayTicks, slotSpacing, TrailHistory } from "./trail";
import type { ChainEvent, Enemy, EnemyKind, EventLogEntry, FireZone, Fx, Pose, Projectile } from "./types";

export interface FightConfig {
  seed: string | number;
  form: FormId;
  trail: TrailSlot[];
  mods?: RunMods;
  act: number; // 1..3
  plan: FightPlan;
  hp: number;
  maxHp: number;
  ascension: number;
  endlessScale?: number;
  sandbox?: boolean;
  startCharge?: number;
}

export interface Fighter {
  x: number;
  hp: number;
  maxHp: number;
  pose: Pose;
  poseT: number;
  strikeT: number;
  guaranteedCrits: number;
  overdrive: number;
  overdriveCap: number;
  overdriveT: number;
  hurtT: number;
}

export interface FightStats {
  kills: number;
  parries: number;
  crits: number;
  staggers: number;
  dropped: number;
  violations: number;
  syncs: number;
  longestChain: number;
  chainCounts: Record<number, number>;
  techDamage: Record<string, number>;
  techTriggers: Record<string, number>;
  killTimes: number[];
  splitKillTimes: number[];
  damageTaken: number;
  codex: { path: string[]; links: number }[];
  durationMs: number;
}

export type Command = { type: "sync" };

function emptyStats(): FightStats {
  return {
    kills: 0, parries: 0, crits: 0, staggers: 0, dropped: 0, violations: 0, syncs: 0, longestChain: 0,
    chainCounts: {}, techDamage: {}, techTriggers: {}, killTimes: [], splitKillTimes: [], damageTaken: 0, codex: [], durationMs: 0,
  };
}

/** One fight. Fixed 60Hz step, seeded, no wall-clock or render reads. */
export class World {
  readonly cfg: FightConfig;
  readonly mods: RunMods;
  readonly form: FormDef;
  readonly actIndex: number;
  readonly rng: DeterministicRng;
  readonly spawnRng: DeterministicRng;
  tick = 0;
  nowMs = 0;
  fighter: Fighter;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  nextProjectile = 1;
  zones: FireZone[] = [];
  delayed: { at: number; enemyId: number; dmg: number; src: DamageSource }[] = [];
  history = new TrailHistory();
  chain: ChainEngine;
  fx: Fx[] = [];
  log: EventLogEntry[] = [];
  charge = 0;
  stats: FightStats = emptyStats();
  outcome: "running" | "won" | "lost" = "running";
  boss: BossRuntime | null = null;
  distinctTypes = new Set<string>();
  originalBuffer: { chainId: number; dmg: number; at: number; crit: boolean; tech: string; family: DamageSource["family"] }[] = [];
  private spawnQueue: SpawnGroup[];
  private fightT = 0;
  private endT = 0;
  private nextId = 1;
  private pendingSync = false;
  aliveCache: Enemy[] | null = null;

  constructor(cfg: FightConfig) {
    this.cfg = cfg;
    this.mods = cfg.mods ?? BASE_MODS;
    this.form = FORMS[cfg.form];
    this.actIndex = Math.max(0, Math.min(2, cfg.act - 1));
    this.rng = streamFor(cfg.seed, "combat");
    this.spawnRng = streamFor(cfg.seed, "spawn");
    this.fighter = {
      x: 0, hp: cfg.hp, maxHp: cfg.maxHp, pose: "walk", poseT: 0, strikeT: 0.3,
      guaranteedCrits: 0, overdrive: 0, overdriveCap: 0.4, overdriveT: 0, hurtT: 0,
    };
    this.charge = cfg.startCharge ?? 0;
    this.history.reset(0);
    this.chain = new ChainEngine(this);
    this.chain.setTrail(cfg.trail);
    this.spawnQueue = [...cfg.plan.groups].sort((a, b) => a.at - b.at);
    if (cfg.plan.boss) initBoss(this, cfg.plan.boss);
  }

  get baseDamage(): number {
    return this.form.dmg;
  }

  get chargeFull(): boolean {
    return this.charge >= TUNING.syncChargeMax;
  }

  // ───── queries
  enemyById(id: number): Enemy | undefined {
    for (const e of this.enemies) if (e.id === id) return e;
    return undefined;
  }

  aliveSorted(): Enemy[] {
    if (!this.aliveCache) this.aliveCache = this.enemies.filter(isAlive).sort((a, b) => a.x - b.x || a.id - b.id);
    return this.aliveCache;
  }

  front(): Enemy | undefined {
    return this.aliveSorted()[0];
  }

  echoX(slot: number): number {
    if (slot <= 0) return this.fighter.x;
    const s = this.history.sample(slotDelayTicks(slot, this.mods.delayMult));
    return s.x - slotSpacing(slot, this.mods.delayMult);
  }

  // ───── mutation helpers used by chain/combat
  spawn(kind: EnemyKind, o: { x?: number; elite?: boolean; splitChild?: boolean } = {}): Enemy {
    const def = ENEMIES[kind];
    const asc = this.cfg.ascension;
    const elite = !!o.elite;
    const hpMult = (def.kind === "duplicate" || def.kind === "original" ? 1 : TUNING.actHp[this.actIndex]!) * (elite ? 1.8 : 1) * (asc >= 8 ? 1.2 : 1) * (this.cfg.endlessScale ?? 1);
    const trait = elite ? this.spawnRng.pick(ELITE_TRAITS) : null;
    const hasted = trait === "hasted";
    const e: Enemy = {
      id: this.nextId++,
      kind,
      x: o.x ?? this.fighter.x + 600 + this.spawnRng.range(0, 60),
      z: 0, vz: 0,
      lane: this.spawnRng.range(0.15, 0.85),
      hp: def.hp * hpMult, maxHp: def.hp * hpMult,
      dmg: def.dmg * TUNING.actDmg[this.actIndex]! * (asc >= 9 ? 1.2 : 1),
      speed: def.speed * (hasted ? 1.4 : 1) * (asc >= 4 ? 1.15 : 1),
      range: def.range,
      attackEvery: def.attackEvery * (hasted ? 0.7 : 1) * (asc >= 2 && def.ranged ? 0.75 : 1),
      attackT: def.attackEvery * this.spawnRng.range(0.4, 1),
      windupT: 0,
      state: "walk",
      staggerT: 0, stunT: 0, airT: 0, breakStacks: 0,
      shield: !!def.shield,
      burnT: 0, burnDps: 0, burnSlot: 0,
      mimicTech: null, mimicT: 0, mimicCd: def.mimic ? 4 : 0,
      elite, trait,
      deadT: 0, flashT: 0,
      size: def.size * (elite ? 1.15 : 1),
      isBoss: false,
      spawnT: 0,
      splitChild: !!o.splitChild,
    };
    this.enemies.push(e);
    this.aliveCache = null;
    return e;
  }

  addCharge(n: number, raw = false): void {
    const mult = raw ? 1 : this.mods.chargeMult * (this.cfg.ascension >= 7 ? 0.8 : 1);
    this.charge = Math.min(TUNING.syncChargeMax, this.charge + n * mult);
  }

  healFighter(amount: number): void {
    const f = this.fighter;
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + amount);
    if (f.hp > before) this.fx.push({ k: "heal", amount: f.hp - before });
  }

  consumeGuaranteedCrit(): boolean {
    if (this.fighter.guaranteedCrits > 0) {
      this.fighter.guaranteedCrits--;
      return true;
    }
    return false;
  }

  /** A chain reached 3 links: buffered hits on The Original from that chain break through. */
  flushOriginal(chainId: number): void {
    if (!this.originalBuffer.length || !this.boss) return;
    const boss = this.enemyById(this.boss.enemyId);
    const mine = this.originalBuffer.filter((b) => b.chainId === chainId);
    if (!mine.length) return;
    this.originalBuffer = this.originalBuffer.filter((b) => b.chainId !== chainId);
    if (!boss || !isAlive(boss)) return;
    for (const b of mine) applyDamage(this, { slot: 1, tech: b.tech, family: b.family, chainId, links: 3, sync: false }, boss, b.dmg, b.crit);
  }

  onLongChain(): void {
    if (!this.boss || this.boss.id !== "original" || this.boss.staggerCd > 0) return;
    const boss = this.enemyById(this.boss.enemyId);
    if (!boss || !isAlive(boss)) return;
    boss.staggerT = Math.max(boss.staggerT, 1.5);
    boss.state = "stagger";
    boss.windupT = 0;
    this.boss.staggerCd = 4;
    this.fx.push({ k: "boss", text: "stagger" });
  }

  requestSync(): boolean {
    if (!this.chargeFull || this.outcome !== "running" || this.pendingSync || !this.front()) return false;
    this.pendingSync = true;
    return true;
  }

  /** Fighter strike; returns emitted events. Normal strikes enqueue to slot 1; Sync Break handles its own. */
  fighterStrike(sync: boolean, chainIdIn?: number): ChainEvent[] {
    const f = this.fighter;
    const t = this.front();
    f.pose = this.form.id === "brawler" ? "heavy" : "strike";
    f.poseT = 0;
    if (!t) return [];
    const chainId = chainIdIn ?? this.chain.newChain();
    const crit = this.consumeGuaranteedCrit() || this.rng.chance(this.form.crit);
    const src: DamageSource = { slot: 0, tech: "fighter", family: "ink", chainId, links: 0, sync };
    const res = dealHit(this, src, t, sync ? 2 : 1, 1, { crit });
    const events: ChainEvent[] = [{ type: "HIT", targetId: t.id }];
    if (res.crit) events.push({ type: "CRIT", targetId: t.id });
    if (this.form.emits.includes("STAGGER")) {
      stagger(this, t, 0.5);
      events.push({ type: "STAGGER", targetId: t.id });
    }
    if (res.killed) events.push({ type: "KILL", targetId: t.id });
    if (!sync) this.chain.fighterEmit(events, chainId);
    return events;
  }

  // ───── step
  step(cmds: readonly Command[] = []): void {
    if (this.outcome !== "running" && !this.cfg.sandbox) return;
    this.tick++;
    this.nowMs = this.tick * MS_PER_TICK;
    this.fightT += DT;
    this.stats.durationMs = this.nowMs;
    this.aliveCache = null;
    for (const c of cmds) if (c.type === "sync") this.requestSync();

    if (this.pendingSync) {
      this.pendingSync = false;
      this.charge = 0;
      this.stats.syncs++;
      this.chain.syncBreak();
      this.aliveCache = null;
    }

    // spawns
    while (this.spawnQueue.length && this.spawnQueue[0]!.at <= this.fightT) {
      const g = this.spawnQueue.shift()!;
      for (let i = 0; i < g.count; i++) this.spawn(g.kind, { elite: g.elite, x: this.fighter.x + 600 + i * 34 + this.spawnRng.range(0, 50) });
    }

    this.updateFighter();
    this.history.push({ x: this.fighter.x, pose: this.fighter.pose, poseT: this.fighter.poseT });
    updateEnemies(this, DT);
    this.aliveCache = null;
    this.updateZones();
    this.updateDelayed();
    this.chain.update();
    this.aliveCache = null;

    // The Original: buffered single hits that never joined a 3-link chain clang off.
    if (this.originalBuffer.length) {
      const expired = this.originalBuffer.filter((b) => b.at <= this.nowMs);
      if (expired.length) {
        this.originalBuffer = this.originalBuffer.filter((b) => b.at > this.nowMs);
        const boss = this.boss ? this.enemyById(this.boss.enemyId) : undefined;
        if (boss) this.fx.push({ k: "clang", x: boss.x, z: boss.z });
      }
    }

    // cleanup corpses after their fade
    for (const e of this.enemies) if (e.state === "dead") e.deadT += DT;
    if (this.enemies.some((e) => e.state === "dead" && e.deadT > 0.7)) this.enemies = this.enemies.filter((e) => !(e.state === "dead" && e.deadT > 0.7));

    this.checkOutcome();
  }

  private updateFighter(): void {
    const f = this.fighter;
    f.poseT += DT;
    if (f.hurtT > 0) f.hurtT -= DT;
    if (f.overdriveT > 0) {
      f.overdriveT -= DT;
      if (f.overdriveT <= 0) f.overdrive = 0;
    }
    const striking = (f.pose === "strike" || f.pose === "heavy") && f.poseT < 0.24;
    if (this.outcome === "won") {
      f.x += TUNING.marchSpeed * DT * 1.2;
      if (f.pose !== "walk") { f.pose = "walk"; f.poseT = 0; }
      return;
    }
    const t = this.front();
    const engaged = !!t && t.x - f.x <= TUNING.strikeRange + t.size * 10;
    f.strikeT = Math.max(0, f.strikeT - DT * (1 + f.overdrive));
    if (engaged) {
      if (f.strikeT <= 0) {
        this.fighterStrike(false);
        f.strikeT = this.form.interval;
      } else if (!striking) {
        const p: Pose = f.hurtT > 0 ? "hurt" : "idle";
        if (f.pose !== p) { f.pose = p; f.poseT = 0; }
      }
    } else if (!striking) {
      // March. Don't walk past an enemy that is closer than strike range.
      const limit = t ? t.x - (TUNING.strikeRange + t.size * 10) + 1 : Infinity;
      f.x = Math.min(limit, f.x + TUNING.marchSpeed * DT);
      if (f.pose !== "walk") { f.pose = "walk"; f.poseT = 0; }
    }
  }

  private updateZones(): void {
    if (!this.zones.length) return;
    for (const z of this.zones) {
      z.t -= DT;
      z.tickT -= DT;
      if (z.tickT <= 0) {
        z.tickT = 0.5;
        const events: ChainEvent[] = [];
        for (const e of this.aliveSorted()) {
          if (e.x < z.x0 || e.x > z.x1 || e.z > 20) continue;
          e.burnT = 0.6;
          const res = dealHit(this, { slot: z.slot, tech: "burning", family: "resonance", chainId: 0, links: 1, sync: false }, e, z.dps * 0.5, 1);
          if (res.dealt > 0) events.push({ type: "HIT", targetId: e.id });
        }
        this.aliveCache = null;
        if (events.length) this.chain.slotEmit(z.slot, events);
      }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  private updateDelayed(): void {
    if (!this.delayed.length) return;
    const due = this.delayed.filter((d) => d.at <= this.nowMs);
    if (!due.length) return;
    this.delayed = this.delayed.filter((d) => d.at > this.nowMs);
    for (const d of due) {
      const e = this.enemyById(d.enemyId);
      if (!e || !isAlive(e)) continue;
      if (e.kind === "original") continue; // afterglow never bypasses the chain rule
      applyDamage(this, d.src, e, d.dmg, false);
    }
    this.aliveCache = null;
  }

  private checkOutcome(): void {
    if (this.outcome !== "running" || this.cfg.sandbox) return;
    if (this.boss) {
      const b = this.enemyById(this.boss.enemyId);
      if (!b || !isAlive(b)) {
        killAllSilently(this);
        this.endT += DT;
        if (this.endT > 1.2) this.outcome = "won";
      }
      return;
    }
    if (!this.spawnQueue.length && !this.aliveSorted().length) {
      this.endT += DT;
      if (this.endT > 0.9) this.outcome = "won";
    }
  }
}
