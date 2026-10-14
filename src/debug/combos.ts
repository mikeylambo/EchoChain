/** Shared combo harness: runs a sandbox fight for a fixed trail and reports what chains formed. */
import type { TrailSlot } from "../sim/chain";
import type { EnemyKind } from "../sim/types";
import { World } from "../sim/world";

export interface ComboSpec {
  name: string;
  trail: string[];
  enemies: EnemyKind[];
  /** what the GDD claims, for the report */
  claim: string;
}

export const GDD_COMBOS: ComboSpec[] = [
  { name: "Counter Wall", trail: ["guard", "read", "pinpoint", "mirror"], enemies: ["lancer", "husk"], claim: "A parried attack becomes four crits" },
  { name: "Juggle", trail: ["launcher", "juggler", "juggler", "slam", "shockline"], enemies: ["husk", "husk", "bulwark"], claim: "One hit becomes an air combo ending in a lane-clearing wave" },
  { name: "Converter", trail: ["flurry", "inverse", "juggler"], enemies: ["husk", "husk", "husk"], claim: "Three hits become three launches become six air hits" },
  { name: "Amp Stack", trail: ["needle", "amplifier", "pinpoint", "amplifier", "mirror"], enemies: ["husk", "husk", "bulwark"], claim: "(no claim stated)" },
];

export interface ComboResult {
  name: string;
  fullLength: number;
  bestLinks: number;
  bestPath: string[];
  fullChains: number;
  /** events per chain that completed the full trail, averaged */
  eventsPerFullChain: Record<string, number>;
}

export function runCombo(spec: ComboSpec, rank: 1 | 2 | 3 = 1, seconds = 30, seed = "COMBO"): ComboResult {
  const trail: TrailSlot[] = spec.trail.map((tech) => ({ tech, rank }));
  const w = new World({
    seed, form: "duelist", trail, act: 1, hp: 9999, maxHp: 9999, ascension: 0, sandbox: true,
    plan: { family: "husks" as never, groups: spec.enemies.map((kind, i) => ({ at: i * 0.5, kind, count: 3 })) },
  });
  const chainEvents = new Map<number, Record<string, number>>();
  let best = { links: 0, path: [] as string[] };
  const full = new Set<number>();
  let seen = 0;
  // Keep the lane populated so every combo has targets for the whole window.
  while (w.tick < seconds * 60) {
    if (w.aliveSorted().length < 3) for (const k of spec.enemies) w.spawn(k, { x: w.fighter.x + 180 });
    w.step([]);
    for (; seen < w.log.length; seen++) {
      const e = w.log[seen]!;
      if (e.chainId <= 0) continue;
      const rec = chainEvents.get(e.chainId) ?? {};
      rec[e.type] = (rec[e.type] ?? 0) + 1;
      chainEvents.set(e.chainId, rec);
      if (e.slot === spec.trail.length) full.add(e.chainId);
    }
    for (const c of w.stats.codex) if (c.links > best.links) best = { links: c.links, path: c.path };
  }
  if (best.links < w.stats.longestChain) best = { links: w.stats.longestChain, path: best.path };
  const totals: Record<string, number> = {};
  for (const id of full) for (const [k, v] of Object.entries(chainEvents.get(id)!)) totals[k] = (totals[k] ?? 0) + v;
  for (const k of Object.keys(totals)) totals[k] = +(totals[k]! / Math.max(1, full.size)).toFixed(2);
  return { name: spec.name, fullLength: spec.trail.length, bestLinks: best.links, bestPath: best.path, fullChains: full.size, eventsPerFullChain: totals };
}
