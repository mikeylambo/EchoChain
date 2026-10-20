import type { ActionCtx } from "../sim/action";
import type { ChainEvent, ChainEventType, Family, Receive } from "../sim/types";

/** Emit spec for UI icons + link preview. "ANY"-style emits are resolved by the arrange preview. */
export type EmitSpec = ChainEventType | "COPIED" | "CONVERTED" | "PASSES";

export interface TechniqueDef {
  id: string;
  num: number;
  name: string;
  family: Family;
  receives: Receive[];
  emits: EmitSpec[];
  /** Seconds. Defaults to TUNING.echoCooldown. */
  cooldown?: number;
  rank3Cooldown?: number;
  /** per-event: action runs once per matching event in the packet. per-packet: once per trigger. */
  scaling: "per-event" | "per-packet";
  /** Passive techniques are transparent to Mirror. */
  passive?: boolean;
  starter: boolean;
  desc: string;
  rank3: string;
  act(ctx: ActionCtx, events: ChainEvent[]): void;
}

const r3 = (c: ActionCtx) => c.rank === 3;

export const TECHNIQUES: TechniqueDef[] = [
  // ───────────── Precision (gold)
  {
    id: "guard", num: 1, name: "Guard Ghost", family: "precision", receives: ["ENEMY_ATTACK"], emits: ["PARRY"],
    cooldown: 6, rank3Cooldown: 4, scaling: "per-packet", starter: true,
    desc: "Intercepts an attack on the fighter", rank3: "Cooldown 4s",
    act(c, evs) {
      c.intercept();
      c.emit("PARRY", evs[0]?.targetId ?? -1);
    },
  },
  {
    id: "read", num: 2, name: "Read", family: "precision", receives: ["PARRY"], emits: ["CRIT"],
    scaling: "per-event", starter: true, desc: "Counter for 300%", rank3: "Counter stuns 1s",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      c.hit(t, 3, { crit: true });
      if (r3(c)) c.stun(t, 1);
      c.emit("CRIT", t.id);
    },
  },
  {
    id: "needle", num: 3, name: "Needle", family: "precision", receives: ["HIT"], emits: ["HIT", "CRIT"],
    scaling: "per-event", starter: true, desc: "Strikes the lowest-HP enemy, 30% crit", rank3: "Always crits",
    act(c) {
      const t = c.lowest();
      if (!t) return;
      const res = c.hit(t, 0.8, r3(c) ? { crit: true } : { critChance: 0.3 });
      c.beamFx(t);
      c.emit(res.crit ? "CRIT" : "HIT", t.id);
    },
  },
  {
    id: "pinpoint", num: 4, name: "Pinpoint", family: "precision", receives: ["CRIT"], emits: ["CRIT"],
    scaling: "per-event", starter: false, desc: "Repeats the crit at 150%", rank3: "Repeats twice",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      const reps = r3(c) ? 2 : 1;
      for (let i = 0; i < reps; i++) {
        const tt = t.hp > 0 ? t : c.front();
        if (!tt) break;
        c.hit(tt, 1.5, { crit: true });
        c.emit("CRIT", tt.id);
      }
    },
  },
  {
    id: "sunder", num: 5, name: "Sunder", family: "precision", receives: ["HIT"], emits: ["HIT"],
    scaling: "per-event", starter: true, desc: "Applies Break (−10% armor, stacks 5)", rank3: "Stacks 8",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      c.addBreak(t, 1, r3(c) ? 8 : 5);
      c.hit(t, 0.5);
      c.emit("HIT", t.id);
    },
  },
  {
    id: "executioner", num: 6, name: "Executioner", family: "precision", receives: ["ANY"], emits: ["KILL"],
    scaling: "per-packet", starter: false, desc: "Executes a target under 15% HP", rank3: "Threshold 25%",
    act(c, evs) {
      const th = r3(c) ? 0.25 : 0.15;
      const pref = evs.map((e) => c.target(e)).find((e) => e && e.hp / e.maxHp < th && !e.isBoss);
      const t = pref ?? c.alive().find((e) => e.hp / e.maxHp < th && !e.isBoss);
      if (!t) {
        // Bosses take a heavy blow instead of an execute.
        const b = c.alive().find((e) => e.isBoss && e.hp / e.maxHp < th);
        if (b) c.hit(b, 4, { crit: true });
        return;
      }
      c.hit(t, 999, { crit: true });
    },
  },
  {
    id: "lastlight", num: 7, name: "Lastlight", family: "precision", receives: ["KILL"], emits: ["CRIT"],
    scaling: "per-packet", starter: false, desc: "Next fighter strike is a guaranteed crit", rank3: "Lasts 2 strikes",
    act(c, evs) {
      c.grantCrits(r3(c) ? 2 : 1);
      const t = c.front();
      if (t) c.hit(t, 0.6, { crit: true });
      c.emit("CRIT", t?.id ?? evs[0]?.targetId ?? -1);
    },
  },
  {
    id: "riposte", num: 8, name: "Riposte Line", family: "precision", receives: ["STAGGER"], emits: ["HIT", "CRIT"],
    scaling: "per-event", starter: false, desc: "Lunge through the staggered enemy", rank3: "Pierces 3",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      c.hit(t, 1.4, { crit: true });
      c.emit("HIT", t.id);
      c.emit("CRIT", t.id);
      for (const e of c.after(t, r3(c) ? 3 : 1)) c.hit(e, 0.8, { pierce: true });
    },
  },

  // ───────────── Momentum (crimson)
  {
    id: "launcher", num: 9, name: "Launcher", family: "momentum", receives: ["HIT"], emits: ["LAUNCH"],
    scaling: "per-event", starter: true, desc: "Pops target into the air", rank3: "Launches 2",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      const targets = [t, ...(r3(c) ? c.after(t, 1) : [])];
      for (const e of targets) {
        c.hit(e, 0.5);
        c.launch(e);
        c.emit("LAUNCH", e.id);
      }
    },
  },
  {
    id: "juggler", num: 10, name: "Juggler", family: "momentum", receives: ["LAUNCH"], emits: ["HIT", "LAUNCH"],
    scaling: "per-event", starter: true, desc: "Two air hits, keeps target airborne", rank3: "Three hits",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      const n = r3(c) ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const tt = t.hp > 0 ? t : c.front();
        if (!tt) break;
        c.hit(tt, 0.45);
        c.emit("HIT", tt.id);
      }
      if (t.hp > 0) {
        c.launch(t);
        c.emit("LAUNCH", t.id); // still airborne: the next echo can keep juggling
      }
    },
  },
  {
    id: "slam", num: 11, name: "Slam", family: "momentum", receives: ["LAUNCH"], emits: ["STAGGER"],
    scaling: "per-event", starter: true, desc: "Spikes target down, small AoE", rank3: "AoE doubles",
    act(c, [ev]) {
      const t = c.target(ev);
      if (!t) return;
      t.z = 0;
      t.vz = 0;
      c.hit(t, 1.2);
      c.stagger(t, 0.9);
      if (t.kind === "bulwark") t.shield = false;
      const r = r3(c) ? 140 : 70;
      for (const e of c.alive()) if (e !== t && Math.abs(e.x - t.x) < r) { c.hit(e, 0.5, { aoe: true }); c.stagger(e, 0.5); }
      c.pulseFx(r);
      c.emit("STAGGER", t.id);
    },
  },
  {
    id: "flurry", num: 12, name: "Flurry", family: "momentum", receives: ["HIT"], emits: ["HIT"],
    scaling: "per-event", starter: true, desc: "Three fast hits at 40%", rank3: "Five hits",
    act(c, [ev]) {
      const n = r3(c) ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const t = c.target(ev);
        if (!t) break;
        c.hit(t, 0.4);
        c.emit("HIT", t.id);
      }
    },
  },
  {
    id: "pursuit", num: 13, name: "Pursuit", family: "momentum", receives: ["KILL"], emits: ["HIT"],
    scaling: "per-event", starter: false, desc: "Dashes to the next enemy and strikes", rank3: "Chains to 2 enemies",
    act(c) {
      const list = c.alive().slice(0, r3(c) ? 2 : 1);
      for (const t of list) {
        c.hit(t, 1.3);
        c.emit("HIT", t.id);
      }
    },
  },
  {
    id: "shockline", num: 14, name: "Shockline", family: "momentum", receives: ["STAGGER"], emits: ["HIT"],
    scaling: "per-packet", starter: false, desc: "Ground wave down the lane", rank3: "Wave returns",
    act(c) {
      const passes = r3(c) ? 2 : 1;
      c.waveFx();
      for (let p = 0; p < passes; p++) {
        for (const e of c.alive()) {
          if (e.z > 30) continue; // a ground wave passes under airborne targets
          c.hit(e, 0.7, { aoe: true });
          c.emit("HIT", e.id);
        }
      }
    },
  },
  {
    id: "tempo", num: 15, name: "Tempo", family: "momentum", receives: ["ANY"], emits: ["PASSES", "HIT"],
    scaling: "per-packet", starter: false, desc: "Every 3rd event received, acts twice", rank3: "Every 2nd",
    act(c, evs) {
      c.state.n = (c.state.n ?? 0) + 1;
      const every = r3(c) ? 2 : 3;
      const twice = c.state.n % every === 0;
      const reps = twice ? 2 : 1;
      for (let i = 0; i < reps; i++) {
        const t = c.target(evs[0]);
        if (t) { c.hit(t, 0.6); c.emit("HIT", t.id); }
        c.passThrough(evs);
      }
    },
  },
  {
    id: "overdrive", num: 16, name: "Overdrive", family: "momentum", receives: ["ANY"], emits: ["HIT"],
    scaling: "per-packet", starter: false, desc: "+4% fighter attack speed per trigger", rank3: "Cap 60%",
    act(c, evs) {
      c.addOverdrive(0.04, r3(c) ? 0.6 : 0.4);
      const t = c.target(evs[0]);
      if (t) { c.hit(t, 0.5); c.emit("HIT", t.id); }
    },
  },

  // ───────────── Resonance (cyan)
  {
    id: "mirror", num: 17, name: "Mirror", family: "resonance", receives: ["ANY"], emits: ["COPIED"],
    scaling: "per-packet", starter: true, desc: "Copies the predecessor's last action at 70%", rank3: "100%",
    act(c) {
      // Rank sets the copy fraction: I 70%, II 85%, III 100% (spec).
      c.mirror(r3(c) ? 1 : c.rank === 2 ? 0.85 : 0.7);
    },
  },
  {
    id: "amplifier", num: 18, name: "Amplifier", family: "resonance", receives: ["ANY"], emits: ["PASSES"],
    scaling: "per-packet", passive: true, starter: true, desc: "No attack; the next echo's output +60%", rank3: "+100%",
    act(c, evs) {
      c.passThrough(evs);
      // Rank scales the boost itself: I +60%, II +90%, III +100% (spec).
      c.setAmp(c.rank === 3 ? 2 : c.rank === 2 ? 1.9 : 1.6);
    },
  },
  {
    id: "prism", num: 19, name: "Prism", family: "resonance", receives: ["HIT"], emits: ["HIT"],
    scaling: "per-event", starter: true, desc: "Splits into 3 beams at 35%", rank3: "5 beams",
    act(c, [ev]) {
      const n = r3(c) ? 5 : 3;
      const alive = c.alive();
      if (!alive.length) return;
      const first = c.target(ev);
      for (let i = 0; i < n; i++) {
        const t = i === 0 && first ? first : alive[i % alive.length]!;
        if (t.hp <= 0) continue;
        c.hit(t, 0.35);
        c.beamFx(t);
        c.emit("HIT", t.id);
      }
    },
  },
  {
    id: "inverse", num: 20, name: "Inverse", family: "resonance", receives: ["ANY"], emits: ["CONVERTED"],
    scaling: "per-event", starter: false, desc: "Converts HIT→LAUNCH→CRIT→PARRY→HIT", rank3: "Also strikes for 80%",
    act(c, [ev]) {
      if (!ev) return;
      const t = c.target(ev);
      const map: Partial<Record<ChainEventType, ChainEventType>> = { HIT: "LAUNCH", LAUNCH: "CRIT", CRIT: "PARRY", PARRY: "HIT" };
      const out = map[ev.type] ?? ev.type;
      if (t && out === "LAUNCH") c.launch(t);
      if (t && r3(c)) c.hit(t, 0.8);
      c.emit(out, t?.id ?? ev.targetId);
    },
  },
  {
    id: "doppel", num: 21, name: "Doppel", family: "resonance", receives: ["KILL"], emits: ["COPIED"],
    scaling: "per-packet", starter: false, desc: "Spawns a mini-echo at the tail, copying the last slot", rank3: "Max 3, 6s",
    act(c) {
      c.spawnDoppel(r3(c) ? 6 : 4, r3(c) ? 3 : 2);
    },
  },
  {
    id: "bell", num: 22, name: "Bell", family: "resonance", receives: ["ANY"], emits: ["HIT"],
    scaling: "per-packet", starter: true, desc: "Pulse AoE; scales with distinct event types this fight", rank3: "Pulse also staggers",
    act(c) {
      const k = Math.max(1, c.distinctEventTypes());
      const r = 160;
      const x = c.fighterX();
      c.pulseFx(r);
      for (const e of c.alive()) {
        if (e.x - x > r * 2) continue;
        c.hit(e, 0.18 * k, { aoe: true });
        if (r3(c)) c.stagger(e, 0.4);
        c.emit("HIT", e.id);
      }
    },
  },
  {
    id: "harvest", num: 23, name: "Harvest", family: "resonance", receives: ["KILL"], emits: ["KILL"],
    scaling: "per-event", starter: false, desc: "+8% Resound charge", rank3: "+15%",
    act(c, [ev]) {
      c.addCharge(r3(c) ? 0.15 : 0.08);
      c.emit("KILL", ev?.targetId ?? -1);
    },
  },
  {
    id: "burning", num: 24, name: "Burning Line", family: "resonance", receives: ["HIT"], emits: ["HIT"],
    scaling: "per-packet", starter: false, desc: "Ignites the trail's path; crossing enemies burn", rank3: "4s",
    act(c, evs) {
      const x0 = c.echoX();
      const t = c.target(evs[0]);
      const x1 = Math.max(c.fighterX() + 140, t ? t.x + 20 : 0);
      c.ignite(x0, x1, r3(c) ? 4 : 2, 0.6);
      if (t) c.emit("HIT", t.id);
    },
  },
];

export const TECH: Record<string, TechniqueDef> = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));
export const STARTER_TECHS = TECHNIQUES.filter((t) => t.starter).map((t) => t.id);

export const FAMILY_COLOR: Record<Family, string> = {
  precision: "#ffc94a",
  momentum: "#ff3b4e",
  resonance: "#3ff0ff",
};

/** Which chain event types a technique can actually send downstream (for link preview). */
export function emittedTypes(id: string, upstream: readonly ChainEventType[] = []): ChainEventType[] {
  const t = TECH[id];
  if (!t) return [];
  const out = new Set<ChainEventType>();
  for (const e of t.emits) {
    if (e === "PASSES") upstream.forEach((u) => out.add(u));
    else if (e === "COPIED") upstream.forEach((u) => out.add(u)); // refined by preview with the copied tech
    else if (e === "CONVERTED") {
      const map: Record<ChainEventType, ChainEventType> = { HIT: "LAUNCH", LAUNCH: "CRIT", CRIT: "PARRY", PARRY: "HIT", KILL: "KILL", STAGGER: "STAGGER" };
      upstream.forEach((u) => out.add(map[u]));
    } else out.add(e);
  }
  // Anything that hits can kill.
  if (t.emits.some((e) => e === "HIT" || e === "CRIT")) out.add("KILL");
  return [...out];
}

export function receivesType(id: string, type: ChainEventType): boolean {
  const t = TECH[id];
  if (!t) return false;
  return t.receives.includes("ANY") || t.receives.includes(type);
}
