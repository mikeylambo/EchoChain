import { ACT_FAMILIES, type FightFamily, type FightPlan } from "../data/enemies";
import { FORMS, type FormId } from "../data/forms";
import { aggregateMods, SEAL, SEALS } from "../data/seals";
import { TECH } from "../data/techniques";
import { TUNING } from "../data/tuning";
import type { TrailSlot } from "./chain";
import { bossPlan, elitePlan, planFight } from "./enemies";
import { analyzeTrail } from "./links";
import { resumeRng, streamFor, type DeterministicRng } from "./rng";
import type { FightConfig, FightStats } from "./world";

export type NodeType = "fight" | "elite" | "boss" | "forge" | "rest";

export interface MapNode {
  type: NodeType;
  family?: FightFamily;
  plan?: FightPlan;
  idxInAct?: number;
}

export interface MapStep {
  options: MapNode[];
  chosen: number; // -1 until picked
}

export type DraftCard = { kind: "echo"; tech: string } | { kind: "rank"; tech: string } | { kind: "seal"; seal: string };

export type Choice =
  | { t: "fork"; i: number }
  | { t: "draft"; i: number }
  | { t: "seal"; i: number }
  | { t: "arrange"; order: string[] }
  | { t: "place"; slot: number } // -1 discards
  | { t: "forge"; slot: number }
  | { t: "rest"; heal: boolean }
  | { t: "sync"; fight: number; tick: number };

export interface RunStats {
  fightsWon: number;
  kills: number;
  parries: number;
  staggers: number;
  slams: number;
  crits: number;
  longestChain: number;
  maxCritsFight: number;
  maxSyncsFight: number;
  fastestFightMs: number;
  splitTriple: boolean;
  killBurst5: boolean;
  duplicateDefeated: boolean;
  act1Cleared: boolean;
  runCleared: boolean;
  maxTrail: number;
  timeMs: number;
  techDamage: Record<string, number>;
}

export interface RunState {
  version: 1;
  seed: string;
  form: FormId;
  ascension: number;
  mode: "standard" | "endless";
  act: number;
  step: number;
  acts: MapStep[][];
  trail: TrailSlot[];
  slots: number;
  seals: string[];
  hp: number;
  maxHp: number;
  draftRng: number;
  mapRng: number;
  fightIndex: number;
  stats: RunStats;
  choices: Choice[];
  distance: number;
  endlessDepth: number;
  pendingEcho: string | null;
  status: "map" | "won" | "lost";
  unlocked: string[];
}

function emptyRunStats(): RunStats {
  return {
    fightsWon: 0, kills: 0, parries: 0, staggers: 0, slams: 0, crits: 0, longestChain: 0, maxCritsFight: 0, maxSyncsFight: 0,
    fastestFightMs: 1e12, splitTriple: false, killBurst5: false, duplicateDefeated: false, act1Cleared: false, runCleared: false,
    maxTrail: 0, timeMs: 0, techDamage: {},
  };
}

function fightNode(rng: DeterministicRng, act: number, idx: number, asc: number, exclude?: FightFamily): MapNode {
  const fams = ACT_FAMILIES[act - 1]!.filter((f) => f !== exclude);
  const family = rng.pick(fams);
  return { type: "fight", family, idxInAct: idx, plan: planFight(rng, act, family, idx, asc) };
}

function buildAct(rng: DeterministicRng, act: number, asc: number): MapStep[] {
  const one = (n: MapNode): MapStep => ({ options: [n], chosen: -1 });
  const fork = (a: MapNode, b: MapNode): MapStep => ({ options: [a, b], chosen: -1 });
  const f0 = fightNode(rng, act, 0, asc);
  if (act === 1) f0.family = "husk";
  const f1a = fightNode(rng, act, 1, asc);
  const f1b = fightNode(rng, act, 1, asc, f1a.family);
  const f2 = fightNode(rng, act, 2, asc);
  const f3a = fightNode(rng, act, 3, asc);
  const f3b = fightNode(rng, act, 3, asc, f3a.family);
  const special = act === 1 ? one({ type: "forge" }) : act === 2 ? fork({ type: "forge" }, { type: "rest" }) : one({ type: "rest" });
  const end: MapNode =
    act === 1 ? { type: "elite", plan: elitePlan(1), family: "lancer" } : { type: "boss", plan: bossPlan(act === 2 ? "duplicate" : "original") };
  return [one(f0), fork(f1a, f1b), special, one(f2), fork(f3a, f3b), one(end)];
}

export function newRun(seed: string, form: FormId, ascension: number, mode: "standard" | "endless", unlocked: string[]): RunState {
  const mapRng = streamFor(seed, "map");
  const acts = mode === "standard" ? [1, 2, 3].map((a) => buildAct(mapRng, a, ascension)) : [];
  const f = FORMS[form];
  const run: RunState = {
    version: 1, seed, form, ascension, mode, act: 1, step: 0, acts,
    trail: [], slots: f.startSlots, seals: [], hp: f.hp, maxHp: f.hp,
    draftRng: streamFor(seed, "draft").state, mapRng: mapRng.state,
    fightIndex: 0, stats: emptyRunStats(), choices: [], distance: 0, endlessDepth: 0, pendingEcho: null, status: "map",
    unlocked: [...unlocked],
  };
  if (mode === "endless") run.acts = [[endlessStep(run)]];
  return run;
}

function endlessStep(run: RunState): MapStep {
  const rng = resumeRng(run.mapRng);
  const d = run.endlessDepth;
  const act = Math.min(3, 1 + Math.floor(d / 5));
  let step: MapStep;
  if (d > 0 && d % 12 === 11) step = { options: [{ type: "boss", plan: bossPlan(d % 24 === 23 ? "original" : "duplicate") }], chosen: -1 };
  else if (d > 0 && d % 6 === 5) step = { options: [{ type: "elite", plan: elitePlan(act) }], chosen: -1 };
  else if (d > 0 && d % 4 === 3) step = { options: [{ type: "forge" }, { type: "rest" }], chosen: -1 };
  else {
    const a = fightNode(rng, act, Math.min(3, d % 4), run.ascension);
    a.plan = planFight(rng, act, a.family!, Math.min(3, d % 4), run.ascension, d);
    const b = fightNode(rng, act, Math.min(3, d % 4), run.ascension, a.family);
    b.plan = planFight(rng, act, b.family!, Math.min(3, d % 4), run.ascension, d);
    step = { options: [a, b], chosen: -1 };
  }
  run.mapRng = rng.state;
  return step;
}

export function currentStep(run: RunState): MapStep {
  return run.acts[run.act - 1]![run.step]!;
}

export function chosenNode(run: RunState): MapNode | null {
  const s = currentStep(run);
  return s.chosen >= 0 ? s.options[s.chosen]! : null;
}

export function chooseFork(run: RunState, i: number): MapNode {
  const s = currentStep(run);
  s.chosen = Math.max(0, Math.min(s.options.length - 1, i));
  run.choices.push({ t: "fork", i: s.chosen });
  return s.options[s.chosen]!;
}

export function runMods(run: RunState) {
  return aggregateMods(run.seals);
}

export function capSlots(run: RunState): number {
  return run.seals.includes("longline") ? TUNING.maxSlotsWithSeal : TUNING.maxSlots;
}

export function fightAct(run: RunState): number {
  return run.mode === "endless" ? Math.min(3, 1 + Math.floor(run.endlessDepth / 5)) : run.act;
}

export function fightConfig(run: RunState, node: MapNode): FightConfig {
  return {
    seed: `${run.seed}:f${run.fightIndex}`,
    form: run.form,
    trail: run.trail.map((s) => ({ ...s })),
    mods: runMods(run),
    act: fightAct(run),
    plan: node.plan!,
    hp: run.hp,
    maxHp: run.maxHp,
    ascension: run.ascension,
    endlessScale: run.mode === "endless" ? 1 + run.endlessDepth * 0.1 : 1,
  };
}

export interface FightReward {
  slotGained: boolean;
  sealDraft: boolean;
  actCleared: number;
  runWon: boolean;
}

/** Fold a finished fight into the run. Returns milestone rewards to present. */
export function applyFight(run: RunState, node: MapNode, stats: FightStats, hpLeft: number, won: boolean, distance: number): FightReward {
  run.fightIndex++;
  const s = run.stats;
  s.timeMs += stats.durationMs;
  s.kills += stats.kills;
  s.parries += stats.parries;
  s.staggers += stats.staggers;
  s.crits += stats.crits;
  s.slams += stats.techTriggers["slam"] ?? 0;
  s.longestChain = Math.max(s.longestChain, stats.longestChain);
  s.maxCritsFight = Math.max(s.maxCritsFight, stats.crits);
  s.maxSyncsFight = Math.max(s.maxSyncsFight, stats.syncs);
  for (const [k, v] of Object.entries(stats.techDamage)) s.techDamage[k] = (s.techDamage[k] ?? 0) + v;
  const st = stats.splitKillTimes;
  for (let i = 2; i < st.length; i++) if (st[i]! - st[i - 2]! <= 1000) s.splitTriple = true;
  const kt = stats.killTimes;
  for (let i = 4; i < kt.length; i++) if (kt[i]! - kt[i - 4]! <= 2000) s.killBurst5 = true;
  run.distance += distance;
  const reward: FightReward = { slotGained: false, sealDraft: false, actCleared: 0, runWon: false };
  if (!won) {
    run.hp = 0;
    run.status = "lost";
    return reward;
  }
  s.fightsWon++;
  if (node.type === "fight") s.fastestFightMs = Math.min(s.fastestFightMs, stats.durationMs);
  run.hp = hpLeft;
  if (node.type === "boss" && node.plan?.boss === "duplicate") s.duplicateDefeated = true;

  if (run.mode === "standard") {
    // Mid-act slot milestone (Acts 1–2), so six echoes are reachable by Act 3.
    if (run.step === 1 && run.act <= 2) reward.slotGained = addSlot(run);
    if (node.type === "elite" || node.type === "boss") {
      reward.actCleared = run.act;
      if (run.act === 1) {
        s.act1Cleared = true;
        reward.slotGained = addSlot(run) || reward.slotGained;
      } else if (run.act === 2) {
        reward.slotGained = addSlot(run) || reward.slotGained;
        reward.sealDraft = true;
      } else {
        s.runCleared = true;
        reward.runWon = true;
        run.status = "won";
      }
    }
  } else if (node.type === "boss" || node.type === "elite") {
    reward.slotGained = addSlot(run);
  }
  return reward;
}

function addSlot(run: RunState): boolean {
  if (run.slots >= capSlots(run)) return false;
  run.slots++;
  return true;
}

/** Passive heal between fights. */
export function betweenFights(run: RunState): void {
  if (run.status !== "map") return;
  const pct = TUNING.betweenFightHeal * (run.ascension >= 3 ? 0.5 : 1);
  run.hp = Math.min(run.maxHp, run.hp + run.maxHp * pct);
}

export function advance(run: RunState): void {
  if (run.mode === "endless") {
    run.endlessDepth++;
    run.acts[0]!.push(endlessStep(run));
    run.step++;
    return;
  }
  run.step++;
  if (run.step >= run.acts[run.act - 1]!.length) {
    run.act++;
    run.step = 0;
    if (run.act > 3) run.status = "won";
  }
}

// ───── Drafting

export function makeDraft(run: RunState): DraftCard[] {
  const rng = resumeRng(run.draftRng);
  const owned = new Set(run.trail.map((s) => s.tech));
  if (run.pendingEcho) owned.add(run.pendingEcho);
  const echoPool = run.unlocked.filter((id) => !owned.has(id) && TECH[id]);
  const rankPool = run.trail.filter((s) => s.rank < 3).map((s) => s.tech);
  const sealPool = SEALS.filter((s) => !run.seals.includes(s.id) && (s.id !== "longline" || run.slots < TUNING.maxSlotsWithSeal)).map((s) => s.id);
  const cards: DraftCard[] = [];
  const used = new Set<string>();
  const W = TUNING.draftWeights;
  for (let n = 0; n < 3; n++) {
    const kinds: ("echo" | "rank" | "seal")[] = [];
    const weights: number[] = [];
    if (echoPool.some((id) => !used.has(id))) { kinds.push("echo"); weights.push(W.echo); }
    if (rankPool.some((id) => !used.has(id))) { kinds.push("rank"); weights.push(W.rank); }
    if (sealPool.some((id) => !used.has(id))) { kinds.push("seal"); weights.push(W.seal); }
    if (!kinds.length) break;
    const kind = rng.weighted(kinds, weights);
    if (kind === "echo") {
      const id = rng.pick(echoPool.filter((x) => !used.has(x)));
      used.add(id);
      cards.push({ kind, tech: id });
    } else if (kind === "rank") {
      const id = rng.pick(rankPool.filter((x) => !used.has(x)));
      used.add(id);
      cards.push({ kind, tech: id });
    } else {
      const id = rng.pick(sealPool.filter((x) => !used.has(x)));
      used.add(id);
      cards.push({ kind, seal: id });
    }
  }
  // Guarantee: at least one technique that links to the current last slot's emitted events.
  const info = analyzeTrail(run.trail, run.form);
  const lastEmits = info.emits[info.emits.length - 1] ?? [];
  const links = (id: string) => {
    const t = TECH[id];
    return !!t && (t.receives.includes("ANY") || lastEmits.some((e) => t.receives.includes(e)));
  };
  const hasLink = cards.some((c) => c.kind === "echo" && links(c.tech));
  if (!hasLink) {
    const cand = echoPool.filter((id) => links(id) && !used.has(id));
    if (cand.length) {
      const pick = rng.pick(cand);
      const replaceAt = cards.findIndex((c) => c.kind !== "echo");
      const at = replaceAt >= 0 ? replaceAt : Math.max(0, cards.length - 1);
      if (cards.length < 3) cards.push({ kind: "echo", tech: pick });
      else cards[at] = { kind: "echo", tech: pick };
    }
  }
  run.draftRng = rng.state;
  return cards;
}

/** Opening pick before the first fight: three echoes that all link to the fighter's strike. */
export function makeOpeningDraft(run: RunState): DraftCard[] {
  const rng = resumeRng(run.draftRng);
  const emits = analyzeTrail([], run.form).emits[0]!;
  const pool = run.unlocked.filter((id) => {
    const t = TECH[id];
    return !!t && !t.passive && (t.receives.includes("ANY") || emits.some((e) => t.receives.includes(e)));
  });
  rng.shuffle(pool);
  run.draftRng = rng.state;
  return pool.slice(0, 3).map((tech) => ({ kind: "echo", tech }));
}

export function makeSealDraft(run: RunState): DraftCard[] {
  const rng = resumeRng(run.draftRng);
  const pool = SEALS.filter((s) => !run.seals.includes(s.id) && (s.id !== "longline" || run.slots < TUNING.maxSlotsWithSeal)).map((s) => s.id);
  rng.shuffle(pool);
  run.draftRng = rng.state;
  return pool.slice(0, 3).map((seal) => ({ kind: "seal", seal }));
}

export function applyCard(run: RunState, card: DraftCard): void {
  if (card.kind === "echo") {
    if (run.trail.length < run.slots) run.trail.push({ tech: card.tech, rank: 1 });
    else run.pendingEcho = card.tech;
  } else if (card.kind === "rank") {
    const s = run.trail.find((x) => x.tech === card.tech);
    if (s && s.rank < 3) s.rank = (s.rank + 1) as 2 | 3;
  } else {
    const def = SEAL[card.seal];
    if (!def || run.seals.includes(card.seal)) return;
    run.seals.push(card.seal);
    if (def.mods.maxHpBonus) run.maxHp += def.mods.maxHpBonus;
    if (def.healOnPick) run.hp = Math.min(run.maxHp, run.hp + def.healOnPick);
    if (def.mods.extraSlots) run.slots = Math.min(TUNING.maxSlotsWithSeal, run.slots + def.mods.extraSlots);
  }
  run.stats.maxTrail = Math.max(run.stats.maxTrail, run.trail.length);
}

/** Resolve a pending echo when the trail is full: replace slot or discard (-1). */
export function placePending(run: RunState, slot: number): void {
  if (!run.pendingEcho) return;
  run.choices.push({ t: "place", slot });
  if (slot >= 0 && slot < run.trail.length) run.trail[slot] = { tech: run.pendingEcho, rank: 1 };
  else if (run.trail.length < run.slots) run.trail.push({ tech: run.pendingEcho, rank: 1 });
  run.pendingEcho = null;
}

export function arrange(run: RunState, order: string[]): void {
  const by = new Map(run.trail.map((s) => [s.tech, s]));
  const next = order.map((id) => by.get(id)).filter((s): s is TrailSlot => !!s);
  if (next.length === run.trail.length) {
    run.trail = next;
    run.choices.push({ t: "arrange", order: [...order] });
  }
}

export function forge(run: RunState, slot: number): void {
  const s = run.trail[slot];
  run.choices.push({ t: "forge", slot });
  if (s && s.rank < 3) s.rank = (s.rank + 1) as 2 | 3;
}

export function rest(run: RunState, heal: boolean): void {
  run.choices.push({ t: "rest", heal });
  if (heal) run.hp = Math.min(run.maxHp, run.hp + run.maxHp * TUNING.restHeal);
}
