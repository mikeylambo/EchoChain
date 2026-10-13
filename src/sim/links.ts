import type { FormId } from "../data/forms";
import { FORMS } from "../data/forms";
import { emittedTypes, TECH } from "../data/techniques";
import type { TrailSlot } from "./chain";
import type { ChainEventType } from "./types";

export interface LinkInfo {
  /** Event types each slot can send downstream (index 0 = fighter). */
  emits: ChainEventType[][];
  /** links[j] true if slot j-1 feeds slot j (j ≥ 1). */
  links: boolean[];
  /** Length of the longest connected run of echoes. */
  longest: number;
  /** Total connected links. */
  count: number;
}

function receivesAny(id: string, types: readonly ChainEventType[]): ChainEventType[] {
  const t = TECH[id];
  if (!t) return [];
  if (t.receives.includes("ANY")) return [...types];
  return types.filter((x) => t.receives.includes(x));
}

/** Static link analysis of a trail. Mirrors the engine's routing rules for preview, drafts, and AI. */
export function analyzeTrail(trail: readonly TrailSlot[], form: FormId): LinkInfo {
  const f = FORMS[form];
  const fighterEmits = new Set<ChainEventType>([...f.emits, "CRIT", "KILL"]);
  const emits: ChainEventType[][] = [[...fighterEmits]];
  const links: boolean[] = [false];
  for (let j = 1; j <= trail.length; j++) {
    const id = trail[j - 1]!.tech;
    const t = TECH[id];
    const up = emits[j - 1]!;
    const got = receivesAny(id, up);
    const world = t?.receives.includes("ENEMY_ATTACK") ?? false;
    links.push(got.length > 0);
    let out: ChainEventType[];
    if (t?.emits.includes("COPIED")) {
      // copies nearest upstream non-passive action
      let k = j - 1;
      while (k >= 1 && (TECH[trail[k - 1]!.tech]?.passive || trail[k - 1]!.tech === "mirror")) k--;
      out = k === 0 ? [...fighterEmits] : emits[k]!;
    } else {
      out = emittedTypes(id, got.length ? got : world ? [] : up);
    }
    emits.push([...new Set(out)]);
  }
  let longest = 0;
  let run = 0;
  let count = 0;
  for (let j = 1; j <= trail.length; j++) {
    const self = TECH[trail[j - 1]!.tech];
    const starts = self?.receives.includes("ENEMY_ATTACK");
    if (links[j]) {
      run++;
      count++;
    } else run = starts ? 1 : 0;
    longest = Math.max(longest, run);
  }
  return { emits, links, longest, count };
}

/** Score an order for AI arranging: favour long connected runs, then total links. */
export function scoreOrder(trail: readonly TrailSlot[], form: FormId): number {
  const a = analyzeTrail(trail, form);
  let s = a.longest * 10 + a.count * 3;
  // reward guard ghost at the head (it starts its own chain)
  if (trail[0]?.tech === "guard") s += 2;
  return s;
}

export function bestOrder(trail: readonly TrailSlot[], form: FormId): TrailSlot[] {
  if (trail.length <= 1) return [...trail];
  let best = [...trail];
  let bestScore = scoreOrder(best, form);
  const arr = [...trail];
  const n = arr.length;
  const c = new Array(n).fill(0);
  let i = 0;
  // Heap's algorithm (≤ 7! = 5040 permutations)
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) [arr[0], arr[i]] = [arr[i]!, arr[0]!];
      else [arr[c[i]], arr[i]] = [arr[i]!, arr[c[i]]!];
      const s = scoreOrder(arr, form);
      if (s > bestScore) {
        bestScore = s;
        best = [...arr];
      }
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
  return best;
}
