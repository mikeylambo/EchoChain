/**
 * Headless sim: `npm run sim [-- --runs 1000 --seed X]`
 * Runs random builds through all three acts and reports win rate, longest chain, DPS outliers by technique,
 * fights over 90s, and proves no chain ever exceeds trail length.
 */
import { STARTER_TECHS, TECHNIQUES } from "../data/techniques";
import { FORM_LIST, type FormId } from "../data/forms";
import { bossPlan } from "../sim/enemies";
import { bestOrder } from "../sim/links";
import { streamFor, stableHashString, type DeterministicRng } from "../sim/rng";
import {
  advance, applyCard, applyFight, arrange, betweenFights, chooseFork, currentStep, fightConfig, forge, makeDraft, makeOpeningDraft, makeSealDraft,
  newRun, placePending, rest, type RunState,
} from "../sim/run";
import { World, type Command } from "../sim/world";
import { TUNING } from "../data/tuning";

export interface FightRecord {
  act: number;
  type: string;
  durationS: number;
  won: boolean;
  trailLen: number;
  longestChain: number;
  techs: string[];
  techDamage: Record<string, number>;
}

export interface RunResult {
  won: boolean;
  act: number;
  timeS: number;
  longestChain: number;
  violations: number;
  fights: FightRecord[];
  hash: number;
  form: FormId;
}

export interface AiOptions {
  allUnlocked?: boolean;
  form?: FormId;
  ascension?: number;
  smartDraft?: boolean;
}

function aiSync(w: World): Command[] {
  if (!w.chargeFull) return [];
  const n = w.aliveSorted().length;
  if (w.boss || n >= 3 || w.fighter.hp < w.fighter.maxHp * 0.35) return [{ type: "sync" }];
  return [];
}

export function runFight(run: RunState, cmdsLog?: { fight: number; tick: number }[]): { world: World } {
  const node = currentStep(run).options[currentStep(run).chosen]!;
  const w = new World(fightConfig(run, node));
  const startX = w.fighter.x;
  const cap = 240 * TUNING.simHz;
  while (w.outcome === "running" && w.tick < cap) {
    const cmds = aiSync(w);
    if (cmds.length) cmdsLog?.push({ fight: run.fightIndex, tick: w.tick + 1 });
    w.step(cmds);
  }
  if (w.outcome === "running") w.outcome = "lost";
  (w as unknown as { distance: number }).distance = w.fighter.x - startX;
  return { world: w };
}

export function simulateRun(seed: string, opt: AiOptions = {}): RunResult {
  const ai: DeterministicRng = streamFor(seed, "ai");
  const unlocked = opt.allUnlocked ? TECHNIQUES.map((t) => t.id) : [...STARTER_TECHS];
  const form = opt.form ?? "duelist";
  const run = newRun(seed, form, opt.ascension ?? 0, "standard", unlocked);
  const fights: FightRecord[] = [];
  let violations = 0;
  let hashAcc = 0;
  const opening = makeOpeningDraft(run);
  if (opening.length) { const i = ai.int(0, opening.length - 1); run.choices.push({ t: "draft", i }); applyCard(run, opening[i]!); }
  while (run.status === "map") {
    const step = currentStep(run);
    const node = chooseFork(run, ai.int(0, step.options.length - 1));
    if (node.type === "forge") {
      const cands = run.trail.map((s, i) => (s.rank < 3 ? i : -1)).filter((i) => i >= 0);
      if (cands.length) forge(run, ai.pick(cands));
    } else if (node.type === "rest") {
      if (run.hp < run.maxHp * 0.6) rest(run, true);
      else {
        rest(run, false);
        const seals = makeSealDraft(run);
        if (seals.length) applyCard(run, seals[ai.int(0, seals.length - 1)]!);
      }
    } else {
      const { world } = runFight(run);
      violations += world.stats.violations;
      const dist = (world as unknown as { distance: number }).distance;
      fights.push({
        act: run.act, type: node.type, durationS: world.stats.durationMs / 1000, won: world.outcome === "won",
        trailLen: run.trail.length, longestChain: world.stats.longestChain, techs: run.trail.map((s) => s.tech), techDamage: world.stats.techDamage,
      });
      hashAcc = stableHashString(`${hashAcc}:${world.tick}:${Math.round(world.fighter.hp * 1000)}:${world.stats.kills}`);
      const reward = applyFight(run, node, world.stats, world.fighter.hp, world.outcome === "won", dist);
      if (run.status !== "map") break;
      // draft
      const cards = makeDraft(run);
      if (cards.length) {
        let pick = ai.int(0, cards.length - 1);
        if (opt.smartDraft) {
          const echo = cards.findIndex((c) => c.kind === "echo");
          if (echo >= 0 && run.trail.length < run.slots) pick = echo;
        }
        run.choices.push({ t: "draft", i: pick });
        applyCard(run, cards[pick]!);
      }
      if (run.pendingEcho) placePending(run, ai.chance(0.5) ? ai.int(0, run.trail.length - 1) : -1);
      if (reward.sealDraft) {
        const seals = makeSealDraft(run);
        if (seals.length) applyCard(run, seals[ai.int(0, seals.length - 1)]!);
      }
      betweenFights(run);
    }
    arrange(run, bestOrder(run.trail, run.form).map((s) => s.tech));
    advance(run);
  }
  return {
    won: run.status === "won",
    act: Math.min(3, run.act),
    timeS: run.stats.timeMs / 1000,
    longestChain: run.stats.longestChain,
    violations,
    fights,
    hash: hashAcc,
    form,
  };
}

/** The Original vs a trail whose links never connect. Must lose. */
export function noLinkOriginal(seed: string): { won: boolean; bossHpLeft: number; timeS: number } {
  const trail = ["juggler", "read", "riposte", "slam", "pinpoint", "shockline"].map((tech) => ({ tech, rank: 3 as const }));
  const w = new World({ seed, form: "duelist", trail, act: 3, plan: bossPlan("original"), hp: 160, maxHp: 160, ascension: 0 });
  while (w.outcome === "running" && w.tick < 600 * TUNING.simHz) w.step(aiSync(w));
  const b = w.boss ? w.enemyById(w.boss.enemyId) : undefined;
  return { won: w.outcome === "won", bossHpLeft: b ? b.hp / b.maxHp : 0, timeS: w.tick / TUNING.simHz };
}

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

function main(): void {
  const runs = Number(arg("runs", "1000"));
  const base = arg("seed", "HEADLESS");
  const allUnlocked = process.argv.includes("--all");
  const t0 = Date.now();
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    const form = allUnlocked ? FORM_LIST[i % 3]! : "duelist";
    results.push(simulateRun(`${base}-${i}`, { allUnlocked, form }));
    if ((i + 1) % 100 === 0) process.stderr.write(`  ${i + 1}/${runs}\n`);
  }
  const wins = results.filter((r) => r.won).length;
  const byAct = [1, 2, 3].map((a) => results.filter((r) => !r.won && r.act === a).length);
  const longest = Math.max(...results.map((r) => r.longestChain));
  const violations = results.reduce((s, r) => s + r.violations, 0);
  const allFights = results.flatMap((r) => r.fights);
  const long = allFights.filter((f) => f.durationS > 90);
  const winTimes = results.filter((r) => r.won).map((r) => r.timeS);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // DPS by technique: damage per second of fight time, over fights where it was slotted.
  const dps: Record<string, number[]> = {};
  for (const f of allFights) for (const t of f.techs) (dps[t] ??= []).push((f.techDamage[t] ?? 0) / Math.max(1, f.durationS));
  const rows = Object.entries(dps).map(([t, xs]) => ({ t, dps: avg(xs), n: xs.length }));
  const m = avg(rows.map((r) => r.dps));
  const sd = Math.sqrt(avg(rows.map((r) => (r.dps - m) ** 2)));
  const outliers = rows.filter((r) => Math.abs(r.dps - m) > 1.5 * sd);

  // Determinism: same seed + same choices = identical run.
  const det = [0, 1, 2].every((i) => simulateRun(`${base}-${i}`, { allUnlocked }).hash === results[i]!.hash);
  const noLink = noLinkOriginal(`${base}-nolink`);

  const fightLen = [1, 2, 3].map((a) => avg(allFights.filter((f) => f.act === a && f.type === "fight").map((f) => f.durationS)));
  console.log("\n══ ECHO CHAIN headless ══");
  console.log(`runs: ${runs}  (${((Date.now() - t0) / 1000).toFixed(1)}s)  unlocks: ${allUnlocked ? "all" : "starter"}`);
  console.log(`win rate: ${((wins / runs) * 100).toFixed(1)}%   losses by act: A1 ${byAct[0]}  A2 ${byAct[1]}  A3 ${byAct[2]}`);
  console.log(`avg winning run (sim time): ${(avg(winTimes) / 60).toFixed(1)} min  (fights only)`);
  console.log(`avg fight length: A1 ${fightLen[0]!.toFixed(1)}s  A2 ${fightLen[1]!.toFixed(1)}s  A3 ${fightLen[2]!.toFixed(1)}s`);
  const bosses = allFights.filter((f) => f.type !== "fight");
  console.log(`avg elite/boss length: ${avg(bosses.map((f) => f.durationS)).toFixed(1)}s`);
  console.log(`longest chain: ${longest}`);
  console.log(`fights over 90s: ${long.length}${long.length ? `  e.g. ${long.slice(0, 3).map((f) => `A${f.act} ${f.type} ${f.durationS.toFixed(0)}s`).join(", ")}` : ""}`);
  console.log(`DPS by technique (mean ${m.toFixed(1)}, sd ${sd.toFixed(1)}):`);
  for (const r of rows.sort((a, b) => b.dps - a.dps)) console.log(`   ${r.t.padEnd(12)} ${r.dps.toFixed(1).padStart(6)}  (n=${r.n})${outliers.includes(r) ? "  ← outlier" : ""}`);
  console.log(`chain > trail length violations: ${violations}  ${violations === 0 ? "✓ PROVEN for all fights" : "✗ FAIL"}`);
  console.log(`determinism (same seed + choices): ${det ? "✓ identical" : "✗ MISMATCH"}`);
  console.log(`no-link trail vs The Original: ${noLink.won ? "✗ WON (should lose)" : `✓ lost (boss at ${(noLink.bossHpLeft * 100).toFixed(0)}% after ${noLink.timeS.toFixed(0)}s)`}`);
  if (violations > 0 || !det || noLink.won) process.exitCode = 1;
}

const isMain = typeof process !== "undefined" && process.argv[1] && /headless\.ts$/.test(process.argv[1]);
if (isMain) main();
