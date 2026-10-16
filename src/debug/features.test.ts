import assert from "node:assert/strict";
import { test } from "node:test";
import { newRun, addRelic, makeDraft, fightConfig, chooseFork, currentStep } from "../sim/run";
import { World, type Command } from "../sim/world";
import { STARTER_TECHS } from "../data/techniques";
import { SaveManager } from "../storage/saveData";
import { TUNING } from "../data/tuning";

test("Relic: kinetic_battery initializes start charge to 50%", () => {
  const run = newRun("seed-1", "duelist", 0, "standard", [...STARTER_TECHS]);
  addRelic(run, "kinetic_battery");
  const step = currentStep(run);
  const node = chooseFork(run, 0);
  const cfg = fightConfig(run, node);
  const world = new World(cfg);

  assert.equal(world.charge, TUNING.syncChargeMax * 0.5);
});

test("Relic: iron_pact increases maxHp and hp by 25", () => {
  const run = newRun("seed-2", "duelist", 0, "standard", [...STARTER_TECHS]);
  const baseMaxHp = run.maxHp;
  const baseHp = run.hp;
  addRelic(run, "iron_pact");

  assert.equal(run.maxHp, baseMaxHp + 25);
  assert.equal(run.hp, baseHp + 25);
});

test("Relic: abyssal_compass offers 4 choices in card drafts instead of 3", () => {
  const run = newRun("seed-3", "duelist", 0, "standard", [...STARTER_TECHS]);
  const defaultDraft = makeDraft(run);
  assert.equal(defaultDraft.length, 3);

  addRelic(run, "abyssal_compass");
  const relicDraft = makeDraft(run);
  assert.equal(relicDraft.length, 4);
});

test("Daily Run: sets daily mode, mutator, and Glass Cannon stat adjustments", () => {
  const run = newRun("DAILY-2026-10-16", "duelist", 0, "daily", [...STARTER_TECHS]);
  assert.equal(run.mode, "daily");
  assert.equal(run.dailyMutator, "glass_cannon");

  const step = currentStep(run);
  const node = chooseFork(run, 0);
  const cfg = fightConfig(run, node);
  const world = new World(cfg);

  assert.equal(world.fighter.maxHp, 50);
  assert.equal(world.mods.damageMult, 1.75);
});

test("SaveManager: export and import restores data integrity", () => {
  // Mock localStorage for Node test environment
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: 0,
  };

  const mgr = new SaveManager();
  mgr.recordCombo("Counter Wall");
  mgr.unlockAchievement("first_strike");
  mgr.recordLeaderboardEntry({
    form: "duelist",
    mode: "standard",
    ascension: 1,
    score: 12500,
    kills: 14,
    longestChain: 6,
    durationMs: 42000,
    won: true,
    seed: "ECHO-TEST-123",
  });

  const exported = mgr.exportSave();
  assert.ok(typeof exported === "string" && exported.length > 20);

  const mgr2 = new SaveManager();
  mgr2.save(); // reset
  const success = mgr2.importSave(exported);
  assert.equal(success, true);
  assert.ok(mgr2.get().discoveredCombos.includes("Counter Wall"));
  assert.ok(mgr2.get().unlockedAchievements.includes("first_strike"));
  assert.equal(mgr2.get().leaderboard.length, 1);
  assert.equal(mgr2.get().leaderboard[0]!.score, 12500);
});

test("Deterministic Replay: identical fight config and input timeline produces identical world state", () => {
  const run = newRun("replay-seed-4", "duelist", 0, "standard", [...STARTER_TECHS]);
  const step = currentStep(run);
  const node = chooseFork(run, 0);
  const cfg = fightConfig(run, node);

  // Run 1: original playthrough
  const world1 = new World(cfg);
  const inputs: { tick: number; type: "strike" | "sync" }[] = [
    { tick: 10, type: "strike" },
    { tick: 30, type: "strike" },
    { tick: 50, type: "strike" },
  ];

  for (let tick = 0; tick < 120; tick++) {
    const matching = inputs.filter((i) => i.tick === world1.tick);
    for (const cmd of matching) {
      if (cmd.type === "strike") world1.fighterStrike(false);
      else if (cmd.type === "sync") world1.requestSync();
    }
    world1.step();
  }

  // Run 2: replay with same cfg and recorded inputs
  const world2 = new World(cfg);
  for (let tick = 0; tick < 120; tick++) {
    const matching = inputs.filter((i) => i.tick === world2.tick);
    for (const cmd of matching) {
      if (cmd.type === "strike") world2.fighterStrike(false);
      else if (cmd.type === "sync") world2.requestSync();
    }
    world2.step();
  }

  assert.equal(world1.fighter.hp, world2.fighter.hp);
  assert.equal(world1.stats.kills, world2.stats.kills);
  assert.equal(world1.stats.crits, world2.stats.crits);
  assert.equal(world1.charge, world2.charge);
  assert.equal(world1.tick, world2.tick);
});
