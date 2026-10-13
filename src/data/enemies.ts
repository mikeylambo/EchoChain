import type { EliteTrait, EnemyKind } from "../sim/types";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  range: number;
  attackEvery: number;
  windup: number;
  size: number;
  ranged?: boolean;
  shield?: boolean;
  splitInto?: EnemyKind;
  mimic?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  husk: { kind: "husk", name: "Husk", hp: 26, dmg: 4, speed: 40, range: 42, attackEvery: 1.7, windup: 0.45, size: 1 },
  bulwark: { kind: "bulwark", name: "Bulwark", hp: 70, dmg: 7, speed: 26, range: 46, attackEvery: 2.1, windup: 0.6, size: 1.3, shield: true },
  lancer: { kind: "lancer", name: "Lancer", hp: 32, dmg: 6, speed: 34, range: 250, attackEvery: 2.7, windup: 0.7, size: 1.05, ranged: true },
  splitter: { kind: "splitter", name: "Splitter", hp: 44, dmg: 5, speed: 32, range: 42, attackEvery: 1.8, windup: 0.5, size: 1.15, splitInto: "splitling" },
  splitling: { kind: "splitling", name: "Splitling", hp: 14, dmg: 3, speed: 52, range: 36, attackEvery: 1.3, windup: 0.35, size: 0.68 },
  mimic: { kind: "mimic", name: "Mimic", hp: 64, dmg: 6, speed: 30, range: 46, attackEvery: 1.9, windup: 0.5, size: 1.1, mimic: true },
  duplicate: { kind: "duplicate", name: "The Duplicate", hp: 1500, dmg: 5, speed: 30, range: 70, attackEvery: 1.1, windup: 0.3, size: 1.25 },
  original: { kind: "original", name: "The Original", hp: 2700, dmg: 7, speed: 26, range: 70, attackEvery: 1.3, windup: 0.3, size: 1.25 },
};

export const ELITE = { hpMult: 1.8, traits: ["armored", "hasted", "splitting"] as EliteTrait[] };

export type FightFamily = "husk" | "bulwark" | "lancer" | "splitter" | "mimic" | "mixed";

export interface SpawnGroup {
  at: number; // seconds into fight
  kind: EnemyKind;
  count: number;
  elite?: boolean;
}

export interface FightPlan {
  family: FightFamily;
  groups: SpawnGroup[];
  elite?: boolean;
  boss?: "duplicate" | "original";
}

/** Families that may appear as a fight's theme per act (index = act-1). */
export const ACT_FAMILIES: FightFamily[][] = [
  ["husk", "bulwark", "lancer"],
  ["bulwark", "lancer", "splitter", "mimic", "mixed"],
  ["splitter", "mimic", "lancer", "bulwark", "mixed"],
];

/** Hand-authored elite of Act 1. */
export const TWIN_LANCER: FightPlan = {
  family: "lancer",
  elite: true,
  groups: [
    { at: 0, kind: "husk", count: 3 },
    { at: 1.5, kind: "lancer", count: 2, elite: true },
    { at: 7, kind: "bulwark", count: 1 },
    { at: 11, kind: "husk", count: 4 },
    { at: 16, kind: "lancer", count: 1 },
  ],
};
