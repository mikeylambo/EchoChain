import { TECH, type TechniqueDef } from "../data/techniques";
import { TUNING } from "../data/tuning";
import type { ActionCtx } from "./action";
import { applyDamage, dealHit, isAlive, launch, stagger, type DamageSource } from "./combat";
import type { ChainEvent, ChainEventType, Enemy, Packet, Receive, WorldEventType } from "./types";
import type { World } from "./world";

export interface TrailSlot {
  tech: string;
  rank: 1 | 2 | 3;
}

interface SlotState {
  tech: TechniqueDef;
  rank: 1 | 2 | 3;
  cdUntil: number;
  triggers: number;
  state: Record<string, number>;
  mirrorState: Record<string, number>;
  lastInput: ChainEvent[];
  lastPower: number;
  lastTriggerMs: number;
}

interface ChainRec {
  links: number;
  path: string[];
  lastAt: number;
  taxed: boolean;
  staggered: boolean;
  sync: boolean;
}

interface PacketCtx {
  chainId: number;
  links: number; // links before this trigger
  amp: number;
  path: string[];
  sync: boolean;
}

const MIRROR_DEPTH = 4;

export function matches(receives: readonly Receive[], type: ChainEventType): boolean {
  return receives.includes("ANY") || receives.includes(type);
}

/**
 * The chain engine. Owns the one law: an echo only listens to the slot directly ahead (i − 1) plus world events,
 * and events only flow downstream. Techniques cannot route events; they only fill an outgoing list.
 */
export class ChainEngine {
  slots: (SlotState | null)[] = [null];
  queue: Packet[] = [];
  chains = new Map<number, ChainRec>();
  doppels: { until: number }[] = [];
  private nextChain = 1;
  private intercepted = false;
  private tickListeners: number[] = [];

  constructor(private readonly w: World) {}

  setTrail(trail: readonly TrailSlot[]): void {
    this.slots = [null];
    for (const s of trail) {
      const tech = TECH[s.tech];
      if (!tech) continue;
      this.slots.push({ tech, rank: s.rank, cdUntil: 0, triggers: 0, state: {}, mirrorState: {}, lastInput: [], lastPower: 1, lastTriggerMs: -1e9 });
    }
    this.tickListeners = [];
    for (let j = 1; j < this.slots.length; j++) if (this.slots[j]!.tech.receives.includes("TICK")) this.tickListeners.push(j);
  }

  /** Number of echoes (excludes the fighter). */
  get length(): number {
    return this.slots.length - 1;
  }

  slot(j: number): SlotState | null {
    return this.slots[j] ?? null;
  }

  newChain(sync = false): number {
    const id = this.nextChain++;
    this.chains.set(id, { links: 0, path: [], lastAt: this.w.nowMs, taxed: false, staggered: false, sync });
    return id;
  }

  chainLinks(chainId: number): number {
    return this.chains.get(chainId)?.links ?? 0;
  }

  activeDoppels(): number {
    return this.doppels.filter((d) => d.until > this.w.nowMs).length;
  }

  /** Fighter (slot 0) emits. */
  fighterEmit(events: ChainEvent[], chainId: number): void {
    this.enqueue(0, events, { chainId, links: 0, amp: 1, path: [], sync: false });
  }

  /** Emit from an arbitrary slot as a fresh chain (burn ticks). Still only delivered to slot + 1. */
  slotEmit(slot: number, events: ChainEvent[]): void {
    if (slot < 1 || slot > this.length || !events.length) return;
    const chainId = this.newChain();
    const rec = this.chains.get(chainId)!;
    rec.links = 1;
    this.enqueue(slot, events, { chainId, links: 1, amp: 1, path: [this.slots[slot]!.tech.id], sync: false });
  }

  /** World events reach any listening echo regardless of position. Returns true if an attack was intercepted. */
  worldEvent(type: WorldEventType, targetId: number): boolean {
    this.w.log.push({ tick: this.w.tick, slot: -1, type, targetId, chainId: 0, links: 0 });
    if (type === "TICK") {
      for (const j of this.tickListeners) this.tryTrigger(j, [{ type: "HIT", targetId }], this.freshCtx());
      return false;
    }
    for (let j = 1; j <= this.length; j++) {
      const s = this.slots[j]!;
      if (!s.tech.receives.includes(type)) continue;
      if (this.w.nowMs < s.cdUntil) continue;
      this.intercepted = false;
      // World events carry the attacker as target. The event type is a placeholder for the technique input.
      this.trigger(j, [{ type: "HIT", targetId }], this.freshCtx());
      if (this.intercepted) return true;
    }
    return false;
  }

  private freshCtx(): PacketCtx {
    return { chainId: this.newChain(), links: 0, amp: 1, path: [], sync: false };
  }

  update(): void {
    const now = this.w.nowMs;
    if (this.tickListeners.length) this.worldEvent("TICK", -1);
    if (this.queue.length) {
      // Deliver in deterministic order: deliverAt then fromSlot then insertion.
      const due: Packet[] = [];
      const keep: Packet[] = [];
      for (const p of this.queue) (p.deliverAt <= now ? due : keep).push(p);
      this.queue = keep;
      for (const p of due) this.deliver(p);
    }
    // Finalize chains that have gone quiet.
    for (const [id, rec] of this.chains) {
      if (now - rec.lastAt < 400) continue;
      if (this.queue.some((p) => p.chainId === id)) continue;
      if (rec.links >= 4) this.w.stats.codex.push({ path: rec.path.slice(), links: rec.links });
      this.chains.delete(id);
    }
  }

  private deliver(p: Packet): void {
    const j = p.fromSlot + 1; // the law: only the next slot
    if (j > this.length) return;
    const s = this.slots[j]!;
    const matched = p.events.filter((e) => matches(s.tech.receives, e.type));
    if (!matched.length) return;
    if (this.w.nowMs < s.cdUntil && !p.sync) {
      this.w.fx.push({ k: "arc", from: p.fromSlot, to: j, family: s.tech.family, dropped: true });
      if (this.w.mods.overflow) this.w.addCharge(matched.length);
      this.w.stats.dropped++;
      return;
    }
    this.trigger(j, matched, { chainId: p.chainId, links: p.links, amp: p.amp, path: p.path, sync: !!p.sync });
  }

  private tryTrigger(j: number, matched: ChainEvent[], pc: PacketCtx): void {
    const s = this.slots[j];
    if (!s || this.w.nowMs < s.cdUntil) return;
    this.trigger(j, matched, pc);
  }

  private cooldownFor(s: SlotState): number {
    const base = s.rank === 3 && s.tech.rank3Cooldown !== undefined ? s.tech.rank3Cooldown : (s.tech.cooldown ?? TUNING.echoCooldown);
    return base * this.w.mods.cdMult;
  }

  slotPower(j: number, rank: 1 | 2 | 3, amp: number): number {
    let p = TUNING.rankMult[rank - 1]! * amp;
    if (j === 1) p *= this.w.mods.firstLight;
    if (j === this.length) p *= this.w.mods.tailwind;
    return p;
  }

  /**
   * Fire slot j. Returns the outgoing events and amp (used by Sync Break to resolve instantly).
   * Normal triggers enqueue their output for slot j + 1 after the 60ms link beat.
   */
  trigger(j: number, matched: ChainEvent[], pc: PacketCtx, immediate = false): { events: ChainEvent[]; amp: number } {
    const s = this.slots[j]!;
    const w = this.w;
    if (!pc.sync) s.cdUntil = w.nowMs + this.cooldownFor(s) * 1000;
    const links = pc.links + 1;
    if (links > this.length) w.stats.violations++;
    const power = this.slotPower(j, s.rank, pc.amp);
    const out: ChainEvent[] = [];
    const amp = { v: 1 };
    const src: DamageSource = { slot: j, tech: s.tech.id, family: s.tech.family, chainId: pc.chainId, links, sync: pc.sync };

    // Record chain progress before the action so The Original sees the current link count.
    this.recordLink(pc.chainId, links, [...pc.path, s.tech.id], pc.sync);

    const ctx = this.makeCtx(j, s.tech, s.rank, power, src, out, amp, s.state, 0);
    const input = matched.slice(0, TUNING.maxPacket);
    if (s.tech.scaling === "per-event") for (const ev of input) s.tech.act(ctx, [ev]);
    else s.tech.act(ctx, input);

    s.lastInput = input;
    s.lastPower = power;
    s.triggers++;
    s.lastTriggerMs = w.nowMs;
    w.stats.techTriggers[s.tech.id] = (w.stats.techTriggers[s.tech.id] ?? 0) + 1;
    w.fx.push({ k: "trigger", slot: j, family: s.tech.family, tech: s.tech.id, targetId: input[0]?.targetId ?? -1 });
    w.fx.push({ k: "note", slot: j, links });

    // Doppel minis copy the tail slot's action (they are not chain links and emit nothing downstream).
    if (j === this.length && this.activeDoppels() > 0) {
      for (let d = 0; d < this.activeDoppels(); d++) {
        const dctx = this.makeCtx(j, s.tech, s.rank, power * 0.5, { ...src, tech: s.tech.id }, [], { v: 1 }, s.mirrorState, 0);
        if (s.tech.scaling === "per-event") for (const ev of input) s.tech.act(dctx, [ev]);
        else s.tech.act(dctx, input);
        w.fx.push({ k: "doppel", slot: this.length + 1 + d });
      }
    }

    const events = out.slice(0, TUNING.maxPacket);
    if (!immediate && events.length) this.enqueue(j, events, { chainId: pc.chainId, links, amp: amp.v, path: [...pc.path, s.tech.id], sync: pc.sync });
    else if (immediate && events.length) this.countEmit(j, events, pc.chainId, links);
    return { events, amp: amp.v };
  }

  private recordLink(chainId: number, links: number, path: string[], sync: boolean): void {
    const w = this.w;
    let rec = this.chains.get(chainId);
    if (!rec) {
      rec = { links: 0, path: [], lastAt: w.nowMs, taxed: false, staggered: false, sync };
      this.chains.set(chainId, rec);
    }
    rec.lastAt = w.nowMs;
    if (links > rec.links) {
      rec.links = links;
      rec.path = path;
      if (links >= 2) w.fx.push({ k: "chain", links });
      if (links > w.stats.longestChain) w.stats.longestChain = links;
      w.stats.chainCounts[links] = (w.stats.chainCounts[links] ?? 0) + 1;
      if (links >= 5 && !rec.taxed) {
        if (w.mods.chainTax > 0) {
          rec.taxed = true;
          w.healFighter(w.mods.chainTax);
        }
        if (w.cfg.relics?.includes("vampiric_edge")) {
          rec.taxed = true;
          w.healFighter(4);
        }
      }
      if (links >= 4 && w.cfg.relics?.includes("resonant_prism")) {
        for (const enemy of w.aliveSorted()) {
          applyDamage(w, { slot: 0, tech: "resonant_prism", family: "resonance", chainId, links, sync: false }, enemy, 35, false);
        }
      }
      if (links >= TUNING.originalLinkRule) w.flushOriginal(chainId);
      if (links >= TUNING.originalStaggerChain && !rec.staggered) {
        rec.staggered = true;
        w.onLongChain();
      }
    }
  }

  private countEmit(slot: number, events: ChainEvent[], chainId: number, links: number): void {
    const w = this.w;
    w.addCharge(events.length);
    for (const e of events) {
      w.distinctTypes.add(e.type);
      w.log.push({ tick: w.tick, slot, type: e.type, targetId: e.targetId, chainId, links });
    }
  }

  private enqueue(slot: number, events: ChainEvent[], pc: PacketCtx): void {
    if (!events.length) return;
    this.countEmit(slot, events, pc.chainId, pc.links);
    const next = this.slots[slot + 1];
    if (!next) return; // tail: nowhere to go
    const willMatch = events.some((e) => matches(next.tech.receives, e.type));
    if (!willMatch) return;
    this.w.fx.push({ k: "arc", from: slot, to: slot + 1, family: slot === 0 ? "ink" : this.slots[slot]!.tech.family });
    this.queue.push({
      events: events.slice(0, TUNING.maxPacket),
      fromSlot: slot,
      chainId: pc.chainId,
      links: pc.links,
      amp: pc.amp,
      deliverAt: this.w.nowMs + TUNING.linkBeatMs,
      path: pc.path,
      sync: pc.sync,
    });
  }

  /** Sync Break: every echo fires at once; propagation resolves instantly; cooldowns ignored. */
  syncBreak(): void {
    const w = this.w;
    const chainId = this.newChain(true);
    w.fx.push({ k: "sync", slots: this.length });
    let prev = w.fighterStrike(true, chainId);
    this.countEmit(0, prev, chainId, 0);
    let prevAmp = 1;
    let path: string[] = [];
    for (let j = 1; j <= this.length; j++) {
      const s = this.slots[j]!;
      let matched = prev.filter((e) => matches(s.tech.receives, e.type));
      if (!matched.length) {
        const first = s.tech.receives.find((r) => r !== "ANY" && r !== "TICK" && r !== "ENEMY_ATTACK") as ChainEventType | undefined;
        const tgt = w.front();
        matched = [{ type: first ?? "HIT", targetId: tgt ? tgt.id : -1 }];
      }
      w.fx.push({ k: "arc", from: j - 1, to: j, family: j === 1 ? "ink" : this.slots[j - 1]!.tech.family });
      const res = this.trigger(j, matched, { chainId, links: j - 1, amp: prevAmp, path, sync: true }, true);
      path = [...path, s.tech.id];
      prev = res.events;
      prevAmp = res.amp;
    }
  }

  /** Builds the ActionCtx. Mirror uses the same builder with an overridden technique/rank. */
  private makeCtx(
    j: number,
    tech: TechniqueDef,
    rank: 1 | 2 | 3,
    power: number,
    src: DamageSource,
    out: ChainEvent[],
    amp: { v: number },
    state: Record<string, number>,
    depth: number,
  ): ActionCtx {
    const w = this.w;
    const engine = this;
    const push = (type: ChainEventType, targetId: number) => {
      if (out.length < TUNING.maxPacket) out.push({ type, targetId });
    };
    const ctx: ActionCtx = {
      slot: j,
      rank,
      power,
      base: w.baseDamage,
      rng: w.rng,
      family: tech.family,
      state,
      target(ev) {
        if (ev && ev.targetId >= 0) {
          const e = w.enemyById(ev.targetId);
          if (e && isAlive(e)) return e;
        }
        return w.front();
      },
      front: () => w.front(),
      lowest() {
        let best: Enemy | undefined;
        for (const e of w.enemies) if (isAlive(e) && (!best || e.hp < best.hp)) best = e;
        return best;
      },
      alive: () => w.aliveSorted(),
      after(e, n) {
        return w.aliveSorted().filter((o) => o !== e && o.x >= e.x).slice(0, n);
      },
      echoX: () => w.echoX(j),
      fighterX: () => w.fighter.x,
      distinctEventTypes: () => w.distinctTypes.size,
      hit(e, mult, opts) {
        const res = dealHit(w, src, e, mult, power, opts);
        if (res.killed) push("KILL", e.id);
        return res;
      },
      launch: (e) => launch(e),
      stagger: (e, secs) => stagger(w, e, secs),
      stun(e, secs) {
        e.stunT = Math.max(e.stunT, e.isBoss ? secs * 0.4 : secs);
        e.windupT = 0;
      },
      addBreak(e, n, cap) {
        e.breakStacks = Math.min(cap, e.breakStacks + n);
      },
      ignite(x0, x1, secs, dps) {
        w.zones.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), t: secs, dps: dps * power, slot: j, tickT: 0.5 });
      },
      addCharge: (fraction) => w.addCharge(fraction * TUNING.syncChargeMax, true),
      addOverdrive(pct, cap) {
        const f = w.fighter;
        f.overdriveCap = Math.max(f.overdriveCap, cap);
        f.overdrive = Math.min(f.overdriveCap, f.overdrive + pct * Math.min(2, power));
        f.overdriveT = 2;
      },
      grantCrits: (n) => {
        w.fighter.guaranteedCrits = Math.max(w.fighter.guaranteedCrits, n);
      },
      spawnDoppel(secs, max) {
        engine.doppels = engine.doppels.filter((d) => d.until > w.nowMs);
        if (engine.doppels.length < max) engine.doppels.push({ until: w.nowMs + secs * 1000 });
        else engine.doppels.sort((a, b) => a.until - b.until)[0]!.until = w.nowMs + secs * 1000;
      },
      intercept: () => {
        engine.intercepted = true;
      },
      pulseFx: (r) => w.fx.push({ k: "pulse", x: w.echoX(j), r, family: tech.family }),
      waveFx: () => w.fx.push({ k: "wave", x: w.fighter.x, family: tech.family }),
      beamFx: (e) => w.fx.push({ k: "beam", x0: w.echoX(j), x1: e.x, z: e.z, family: tech.family }),
      emit: push,
      passThrough(evs) {
        for (const e of evs) push(e.type, e.targetId);
      },
      setAmp(m) {
        amp.v = m;
      },
      mirror(mult) {
        if (depth >= MIRROR_DEPTH) return;
        for (let k = j - 1; k >= 0; k--) {
          if (k === 0) {
            const t = w.front();
            if (!t) return;
            const crit = w.consumeGuaranteedCrit() || w.rng.chance(w.form.crit);
            const res = ctx.hit(t, mult, { crit });
            push("HIT", t.id);
            if (res.crit) push("CRIT", t.id);
            if (w.form.emits.includes("STAGGER")) {
              stagger(w, t, 0.5);
              push("STAGGER", t.id);
            }
            return;
          }
          const s = engine.slots[k]!;
          if (s.tech.passive || s.tech.id === "mirror") continue;
          const p = TUNING.rankMult[s.rank - 1]! * mult * (power / TUNING.rankMult[rank - 1]!);
          const sub = engine.makeCtx(j, s.tech, s.rank, p, { ...src, tech: tech.id }, out, amp, engine.slots[j]?.mirrorState ?? {}, depth + 1);
          let input = s.lastInput;
          if (!input.length) {
            const first = s.tech.receives.find((r) => r !== "ANY" && r !== "TICK" && r !== "ENEMY_ATTACK") as ChainEventType | undefined;
            const t = w.front();
            input = [{ type: first ?? "HIT", targetId: t ? t.id : -1 }];
          }
          if (s.tech.scaling === "per-event") for (const ev of input) s.tech.act(sub, [ev]);
          else s.tech.act(sub, input);
          return;
        }
      },
    };
    return ctx;
  }
}
