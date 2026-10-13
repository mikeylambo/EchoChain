export interface BossDef {
  id: "duplicate" | "original";
  name: string;
  phaseAt: number[]; // hp fractions
  escorts: { at: number; kind: "husk" | "lancer" | "splitter"; count: number }[];
  /** Duplicate: ghost strike damage per connected link. Original: echo strike damage. */
  ghostDmg: number;
  ghostEvery: number;
  reorderEvery?: number;
  phase2Echoes?: number;
}

export const BOSSES: Record<"duplicate" | "original", BossDef> = {
  duplicate: {
    id: "duplicate",
    name: "The Duplicate",
    phaseAt: [0.5],
    escorts: [
      { at: 10, kind: "husk", count: 3 },
      { at: 26, kind: "lancer", count: 1 },
      { at: 40, kind: "husk", count: 4 },
    ],
    ghostDmg: 2.2,
    ghostEvery: 2.4,
    reorderEvery: 8,
  },
  original: {
    id: "original",
    name: "The Original",
    phaseAt: [0.5, 0.2],
    escorts: [{ at: 14, kind: "husk", count: 3 }, { at: 34, kind: "splitter", count: 2 }],
    ghostDmg: 3,
    ghostEvery: 2.2,
    phase2Echoes: 3,
  },
};

/** Ascension 1–10, cumulative. Difficulty leans on information/behaviour before raw stats. */
export interface AscensionDef {
  level: number;
  desc: string;
}

export const ASCENSIONS: AscensionDef[] = [
  { level: 1, desc: "Elite traits appear in every act" },
  { level: 2, desc: "Lancers throw faster" },
  { level: 3, desc: "Passive healing between fights halved" },
  { level: 4, desc: "Enemies move 15% faster" },
  { level: 5, desc: "The Duplicate reorders from the start" },
  { level: 6, desc: "Mimics join every fight from Act 2" },
  { level: 7, desc: "Sync Break charges 20% slower" },
  { level: 8, desc: "Enemies +20% HP" },
  { level: 9, desc: "Enemies hit 20% harder" },
  { level: 10, desc: "The Original's final phase begins at 35%" },
];
