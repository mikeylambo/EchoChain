import { ENEMIES } from "../data/enemies";
import { TUNING } from "../data/tuning";
import type { HitOpts, HitResult } from "./action";
import type { Enemy, Family } from "./types";
import type { World } from "./world";

export interface DamageSource {
  slot: number; // 0 fighter, 1..N echoes, -1 environment
  tech: string; // technique id or "fighter" / "burn" / "afterglow"
  family: Family | "ink";
  chainId: number;
  links: number;
  sync: boolean;
}

export function isAlive(e: Enemy): boolean {
  return e.state !== "dead" && e.hp > 0;
}

/** Resolve one hit. Returns what happened; the caller decides which events to emit. */
export function dealHit(w: World, src: DamageSource, e: Enemy, mult: number, power: number, opts: HitOpts = {}): HitResult {
  if (!isAlive(e)) return { dealt: 0, crit: false, killed: false };
  const crit = !!opts.crit || (opts.critChance !== undefined && w.rng.chance(opts.critChance));
  let dmg = w.baseDamage * mult * power * (crit ? TUNING.critMult : 1);
  dmg *= 1 + 0.1 * e.breakStacks;
  if (e.trait === "armored") dmg *= 0.7;
  let blocked = false;

  // Bulwark front shield: blocks unless Broken (3+ stacks shatter it), launched, or staggered.
  if (e.shield) {
    if (e.breakStacks >= 3) {
      e.shield = false;
      w.fx.push({ k: "clang", x: e.x, z: e.z });
    } else if (e.z <= 0 && e.staggerT <= 0 && e.stunT <= 0) {
      dmg *= 0.4;
      blocked = true;
    }
  }

  // Mimic copies your most-triggered technique: immune to it and reflects a sting.
  if (e.mimicTech && e.mimicT > 0 && e.mimicTech === src.tech) {
    w.fx.push({ k: "clang", x: e.x, z: e.z });
    damageFighter(w, 1.5 * TUNING.actDmg[w.actIndex]!);
    return { dealt: 0, crit: false, killed: false };
  }

  // The Original: only chains of 3+ links break through; final phase only Sync Break.
  if (e.kind === "original" && w.boss) {
    if (w.boss.phase >= 2 && !src.sync) {
      w.fx.push({ k: "clang", x: e.x, z: e.z });
      return { dealt: 0, crit, killed: false };
    }
    const links = src.sync ? 99 : w.chain.chainLinks(src.chainId);
    if (links < TUNING.originalLinkRule) {
      w.originalBuffer.push({ chainId: src.chainId, dmg, at: w.nowMs + TUNING.originalBufferMs, crit, tech: src.tech, family: src.family });
      w.fx.push({ k: "hit", x: e.x, z: e.z, lane: e.lane, dmg: 0, crit: false, family: src.family, blocked: true });
      return { dealt: 0, crit, killed: false };
    }
  }

  return applyDamage(w, src, e, dmg, crit, blocked);
}

export function applyDamage(w: World, src: DamageSource, e: Enemy, dmg: number, crit: boolean, blocked = false): HitResult {
  if (!isAlive(e)) return { dealt: 0, crit, killed: false };
  e.hp -= dmg;
  e.flashT = 0.12;
  w.stats.techDamage[src.tech] = (w.stats.techDamage[src.tech] ?? 0) + dmg;
  if (crit) w.stats.crits++;
  w.fx.push({ k: "hit", x: e.x, z: e.z, lane: e.lane, dmg, crit, family: src.family, blocked });
  if (w.mods.afterglow > 0 && src.slot >= 1 && src.tech !== "afterglow") {
    w.delayed.push({ at: w.nowMs + 500, enemyId: e.id, dmg: dmg * w.mods.afterglow, src: { ...src, tech: "afterglow" } });
  }
  let killed = false;
  if (e.hp <= 0) {
    killEnemy(w, e);
    killed = true;
  }
  return { dealt: dmg, crit, killed };
}

export function killEnemy(w: World, e: Enemy, silent = false): void {
  e.hp = 0;
  e.state = "dead";
  w.aliveCache = null;
  e.deadT = 0;
  e.z = Math.max(0, e.z);
  if (silent) return;
  w.stats.kills++;
  w.stats.killTimes.push(w.nowMs);
  if (e.kind === "splitling") w.stats.splitKillTimes.push(w.nowMs);
  w.fx.push({ k: "kill", x: e.x, z: e.z, lane: e.lane, kind: e.kind });
  const def = ENEMIES[e.kind];
  if ((def.splitInto || e.trait === "splitting") && !e.splitChild) {
    for (let i = 0; i < 2; i++) {
      const c = w.spawn("splitling", { x: e.x + (i === 0 ? -14 : 18), elite: false, splitChild: true });
      c.lane = Math.min(1, Math.max(0, e.lane + (i ? 0.15 : -0.15)));
    }
  }
}

export function damageFighter(w: World, amount: number): void {
  if (w.outcome !== "running" || amount <= 0) return;
  const f = w.fighter;
  f.hp -= amount;
  f.hurtT = 0.25;
  w.stats.damageTaken += amount;
  w.fx.push({ k: "hurt", dmg: amount });
  if (f.hp <= 0) {
    if (w.cfg.sandbox) f.hp = 1;
    else {
      f.hp = 0;
      w.outcome = "lost";
    }
  }
}

/** An enemy attack about to land. World event ENEMY_ATTACK goes to every listening echo first. */
export function enemyAttack(w: World, attacker: Enemy, dmg: number): void {
  const intercepted = w.chain.worldEvent("ENEMY_ATTACK", attacker.id);
  if (intercepted) {
    w.stats.parries++;
    w.fx.push({ k: "parry", x: w.fighter.x + 18 });
    return;
  }
  damageFighter(w, dmg);
}

export function launch(e: Enemy): void {
  if (!isAlive(e)) return;
  if (e.isBoss) {
    e.vz = Math.max(e.vz, 120); // bosses only hop
  } else if (e.z > 0) {
    e.vz = Math.max(e.vz, 300);
  } else {
    e.vz = 430;
  }
  e.z = Math.max(e.z, 1);
  e.state = "air";
  e.windupT = 0;
}

export function stagger(w: World, e: Enemy, secs: number): void {
  if (!isAlive(e)) return;
  const s = e.isBoss ? secs * 0.3 : secs;
  e.staggerT = Math.max(e.staggerT, s);
  if (e.z <= 0) e.state = "stagger";
  e.windupT = 0;
  w.stats.staggers++;
}
