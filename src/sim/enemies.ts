import { BOSSES } from "../data/bosses";
import { ACT_FAMILIES, ELITE, ENEMIES, TWIN_LANCER, type FightFamily, type FightPlan, type SpawnGroup } from "../data/enemies";
import { emittedTypes, receivesType } from "../data/techniques";
import { TUNING } from "../data/tuning";
import type { TrailSlot } from "./chain";
import { enemyAttack, isAlive, killEnemy } from "./combat";
import type { DeterministicRng } from "./rng";
import type { Enemy, EnemyKind } from "./types";
import type { World } from "./world";

const COST: Partial<Record<EnemyKind, number>> = { husk: 1, bulwark: 2.4, lancer: 1.5, splitter: 2, mimic: 2.6 };
const GRAVITY = 1300;

/** Build a fight's spawn schedule. Pure function of the rng stream → deterministic. */
export function planFight(rng: DeterministicRng, act: number, family: FightFamily, idxInAct: number, ascension: number, endlessDepth = 0): FightPlan {
  const allowed = ACT_FAMILIES[Math.min(2, act - 1)]!.filter((f) => f !== "mixed") as EnemyKind[];
  const pool: EnemyKind[] = act === 1 ? ["husk", "bulwark", "lancer"] : ["husk", "bulwark", "lancer", "splitter", "mimic"];
  let budget = 8 + idxInAct * 2.2 + (act - 1) * 2.5 + endlessDepth * 0.8;
  const opener = act === 1 && idxInAct === 0 && endlessDepth === 0;
  const theme: EnemyKind = opener ? "husk" : family === "mixed" ? rng.pick(allowed) : (family as EnemyKind);
  const groups: SpawnGroup[] = [];
  let at = 0;
  let wave = 0;
  const eliteWave = (act >= 2 && idxInAct >= 2) || (ascension >= 1 && idxInAct === 3) ? 2 : -1;
  while (budget > 0.5) {
    const size = Math.min(4, 2 + rng.int(0, 2));
    for (let i = 0; i < size && budget > 0.5; i++) {
      const kind: EnemyKind = opener || rng.chance(0.6) ? theme : rng.pick(family === "mixed" ? pool : (["husk", ...allowed] as EnemyKind[]));
      if (kind === "mimic" && act === 1) continue;
      const elite = wave === eliteWave && i === 0;
      groups.push({ at, kind, count: 1, elite });
      budget -= (COST[kind] ?? 1) * (elite ? 1.8 : 1);
    }
    wave++;
    at += 4.2 + rng.range(0, 1.6);
  }
  if (ascension >= 6 && act >= 2 && !groups.some((g) => g.kind === "mimic")) groups.push({ at: 6, kind: "mimic", count: 1 });
  return { family, groups };
}

export function elitePlan(act: number): FightPlan {
  if (act === 1) return TWIN_LANCER;
  return { family: "mixed", elite: true, groups: [{ at: 0, kind: "bulwark", count: 1, elite: true }, { at: 3, kind: "husk", count: 4 }, { at: 9, kind: "lancer", count: 2 }] };
}

export function bossPlan(id: "duplicate" | "original"): FightPlan {
  return { family: "mixed", boss: id, groups: BOSSES[id].escorts.map((e) => ({ at: e.at, kind: e.kind, count: e.count })) };
}

export interface BossRuntime {
  id: "duplicate" | "original";
  enemyId: number;
  phase: number;
  ghostT: number;
  order: number[]; // indices into the player's trail
  reorderT: number;
  staggerCd: number;
  ghostQueue: { at: number; idx: number; dmg: number }[];
}

/** Does slot a feed slot b? (the Duplicate reads your arrangement backwards) */
export function slotsLink(a: TrailSlot, b: TrailSlot): boolean {
  return emittedTypes(a.tech, ["HIT"]).some((t) => receivesType(b.tech, t));
}

export function updateEnemies(w: World, dt: number): void {
  const f = w.fighter;
  const asc = w.cfg.ascension;
  // Grounded, alive enemies ordered by distance: each queues behind the one ahead.
  const ground = w.enemies.filter((e) => isAlive(e)).sort((a, b) => a.x - b.x || a.id - b.id);
  let prev: Enemy | null = null;
  for (const e of ground) {
    const def = ENEMIES[e.kind];
    e.flashT = Math.max(0, e.flashT - dt);
    e.spawnT += dt;
    if (e.burnT > 0) e.burnT -= dt;

    // air physics
    if (e.z > 0 || e.vz > 0) {
      e.vz -= GRAVITY * dt;
      e.z += e.vz * dt;
      if (e.z <= 0) {
        e.z = 0;
        e.vz = 0;
        e.state = "walk";
        e.staggerT = Math.max(e.staggerT, 0.25);
      } else {
        e.state = "air";
      }
    }
    if (e.staggerT > 0) {
      e.staggerT -= dt;
      if (e.staggerT <= 0 && e.state === "stagger") e.state = "walk";
    }
    if (e.stunT > 0) e.stunT -= dt;

    if (e.mimicT > 0) {
      e.mimicT -= dt;
      if (e.mimicT <= 0) e.mimicTech = null;
    }
    if (def.mimic) {
      e.mimicCd -= dt;
      if (e.mimicCd <= 0) {
        const top = Object.entries(w.stats.techTriggers).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
        e.mimicCd = 9;
        if (top) {
          e.mimicTech = top[0];
          e.mimicT = 5;
          w.fx.push({ k: "mimic", id: e.id, tech: top[0] });
        }
      }
    }

    const disabled = e.state === "air" || e.staggerT > 0 || e.stunT > 0;
    const stopAt = f.x + Math.max(e.range, 30 * e.size);
    const minX = prev ? prev.x + TUNING.enemyGap * (e.size + prev.size) * 0.5 : -Infinity;
    const target = Math.max(stopAt, minX);
    if (!disabled && e.state !== "windup" && e.x > target) e.x = Math.max(target, e.x - e.speed * dt);
    if (e.state !== "air") prev = e;

    if (e.isBoss) {
      updateBoss(w, e, dt, disabled);
      continue;
    }
    if (disabled) continue;
    const inRange = e.x - f.x <= e.range + 2;
    if (e.state === "windup") {
      e.windupT -= dt;
      if (e.windupT <= 0) {
        e.state = "walk";
        e.attackT = e.attackEvery;
        if (def.ranged) {
          w.projectiles.push({ id: w.nextProjectile++, x: e.x - 10, vx: -380, dmg: e.dmg, ownerId: e.id, t: 0 });
        } else if (inRange) {
          enemyAttack(w, e, e.dmg);
        }
      }
    } else if (inRange) {
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.state = "windup";
        e.windupT = def.windup * (asc >= 2 && def.ranged ? 0.75 : 1);
      }
    }
  }

  // projectiles
  for (const p of w.projectiles) {
    p.x += p.vx * dt;
    p.t += dt;
  }
  const landed = w.projectiles.filter((p) => p.x <= f.x + 16);
  w.projectiles = w.projectiles.filter((p) => p.x > f.x + 16);
  for (const p of landed) {
    const owner = w.enemyById(p.ownerId);
    if (owner) enemyAttack(w, owner, p.dmg);
    else enemyAttack(w, { id: -1 } as Enemy, p.dmg);
  }

  // ghost strikes queued by bosses (each is a separate ENEMY_ATTACK so Guard Ghost can read them)
  if (w.boss && w.boss.ghostQueue.length) {
    const due = w.boss.ghostQueue.filter((g) => g.at <= w.nowMs);
    w.boss.ghostQueue = w.boss.ghostQueue.filter((g) => g.at > w.nowMs);
    const boss = w.enemyById(w.boss.enemyId);
    for (const g of due) {
      if (!boss || !isAlive(boss)) continue;
      w.fx.push({ k: "ghost", idx: g.idx });
      enemyAttack(w, boss, g.dmg);
    }
  }
}

function updateBoss(w: World, e: Enemy, dt: number, disabled: boolean): void {
  const b = w.boss;
  if (!b) return;
  const def = BOSSES[b.id];
  const f = w.fighter;
  const frac = e.hp / e.maxHp;
  const phaseAt = def.phaseAt.map((p, i) => (b.id === "original" && i === 1 && w.cfg.ascension >= 10 ? 0.35 : p));
  while (b.phase < phaseAt.length && frac <= phaseAt[b.phase]!) {
    b.phase++;
    w.fx.push({ k: "boss", text: "phase" });
  }
  b.staggerCd = Math.max(0, b.staggerCd - dt);

  // The Duplicate reorders its (reversed) copy of your trail in phase 2.
  if (b.id === "duplicate" && (b.phase >= 1 || w.cfg.ascension >= 5) && b.order.length > 1) {
    b.reorderT -= dt;
    if (b.reorderT <= 0) {
      b.reorderT = def.reorderEvery ?? 8;
      w.spawnRng.shuffle(b.order);
      w.fx.push({ k: "boss", text: "reorder" });
    }
  }
  if (disabled) return;
  const inRange = e.x - f.x <= e.range + 2;
  if (!inRange) return;

  // Basic strike
  if (e.state === "windup") {
    e.windupT -= dt;
    if (e.windupT <= 0) {
      e.state = "walk";
      e.attackT = e.attackEvery;
      enemyAttack(w, e, e.dmg);
    }
  } else {
    e.attackT -= dt;
    if (e.attackT <= 0) {
      e.state = "windup";
      e.windupT = ENEMIES[e.kind].windup;
    }
  }

  // Ghost chain
  b.ghostT -= dt;
  if (b.ghostT <= 0) {
    b.ghostT = def.ghostEvery;
    const actDmg = TUNING.actDmg[w.actIndex]! * (w.cfg.ascension >= 9 ? 1.2 : 1);
    let strikes = 0;
    if (b.id === "duplicate") {
      const trail = b.order.map((i) => w.cfg.trail[i]!).filter(Boolean);
      if (trail.length) {
        strikes = 1;
        for (let k = 1; k < trail.length; k++) {
          if (slotsLink(trail[k - 1]!, trail[k]!)) strikes++;
          else break;
        }
      }
    } else if (b.phase >= 1) {
      strikes = def.phase2Echoes ?? 3;
    }
    for (let i = 0; i < strikes; i++) b.ghostQueue.push({ at: w.nowMs + 60 * (i + 1), idx: i, dmg: def.ghostDmg * actDmg * (1 + 0.12 * i) });
  }
}

export function initBoss(w: World, id: "duplicate" | "original"): void {
  const def = BOSSES[id];
  const e = w.spawn(id, { x: w.fighter.x + 520, elite: false });
  e.isBoss = true;
  e.lane = 0.5;
  w.boss = {
    id,
    enemyId: e.id,
    phase: 0,
    ghostT: def.ghostEvery,
    order: w.cfg.trail.map((_, i) => i).reverse(),
    reorderT: def.reorderEvery ?? 8,
    staggerCd: 0,
    ghostQueue: [],
  };
}

export function killAllSilently(w: World): void {
  for (const e of w.enemies) if (isAlive(e)) killEnemy(w, e, true);
  w.projectiles = [];
}

export const ELITE_TRAITS = ELITE.traits;
