import { FORM_LIST, type FormId } from "../data/forms";
import { STARTER_TECHS, TECH } from "../data/techniques";
import type { RunState, RunStats } from "../sim/run";

/** Persistent profile. Stored in localStorage behind try/catch; the game runs fine without it. */
export interface Settings {
  master: number;
  music: number;
  sfx: number;
  speed: 1 | 2;
  reducedFlash: boolean;
  reducedShake: boolean;
  numbers: boolean;
  outfit: "coat" | "cloak" | "scarf";
}

export interface CodexEntry {
  key: string;
  path: string[];
  links: number;
  form: FormId;
  count: number;
}

export interface Profile {
  v: 1;
  techs: string[];
  forms: FormId[];
  ascension: number; // highest unlocked
  endless: boolean;
  codex: CodexEntry[];
  runs: number;
  wins: number;
  bestChain: number;
  bestEndless: number;
  seenTutorial: boolean;
  settings: Settings;
  savedRun: RunState | null;
}

const KEY = "echochain.profile.v1";

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.6, sfx: 0.8, speed: 1, reducedFlash: false, reducedShake: false, numbers: true, outfit: "cloak" };

export function freshProfile(): Profile {
  return {
    v: 1, techs: [...STARTER_TECHS], forms: ["duelist"], ascension: 0, endless: false, codex: [], runs: 0, wins: 0, bestChain: 0, bestEndless: 0,
    seenTutorial: false, settings: { ...DEFAULT_SETTINGS }, savedRun: null,
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProfile();
    const p = JSON.parse(raw) as Partial<Profile>;
    const base = freshProfile();
    const merged: Profile = { ...base, ...p, settings: { ...base.settings, ...(p.settings ?? {}) } } as Profile;
    merged.techs = [...new Set([...STARTER_TECHS, ...(merged.techs ?? [])])].filter((t) => TECH[t]);
    merged.forms = (merged.forms ?? ["duelist"]).filter((f) => FORM_LIST.includes(f));
    if (!merged.forms.includes("duelist")) merged.forms.unshift("duelist");
    // v2: the cloak became the hero's default attire
    if (!(p as { attireV?: number }).attireV) merged.settings.outfit = "cloak";
    (merged as { attireV?: number }).attireV = 2;
    return merged;
  } catch {
    return freshProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}

export function recordCodex(p: Profile, entries: { path: string[]; links: number }[], form: FormId): CodexEntry[] {
  const fresh: CodexEntry[] = [];
  for (const e of entries) {
    if (e.links < 4) continue;
    const key = e.path.join(">");
    const ex = p.codex.find((c) => c.key === key);
    if (ex) ex.count++;
    else {
      const c: CodexEntry = { key, path: e.path.slice(), links: e.links, form, count: 1 };
      p.codex.push(c);
      fresh.push(c);
    }
    p.bestChain = Math.max(p.bestChain, e.links);
  }
  p.codex.sort((a, b) => b.links - a.links || b.count - a.count);
  if (p.codex.length > 400) p.codex.length = 400;
  return fresh;
}

// ───── unlock goals (GDD §10)

export interface Goal {
  tech: string;
  text: string;
  test(s: RunStats): boolean;
}

export const GOALS: Goal[] = [
  { tech: "pinpoint", text: "Parry 20 attacks in one run", test: (s) => s.parries >= 20 },
  { tech: "inverse", text: "Trigger a 5-link chain", test: (s) => s.longestChain >= 5 },
  { tech: "doppel", text: "Kill 3 Splitter children within 1s", test: (s) => s.splitTriple },
  { tech: "executioner", text: "Kill 5 enemies within 2s", test: (s) => s.killBurst5 },
  { tech: "lastlight", text: "Land 30 crits in one fight", test: (s) => s.maxCritsFight >= 30 },
  { tech: "riposte", text: "Stagger 40 enemies in one run", test: (s) => s.staggers >= 40 },
  { tech: "pursuit", text: "Win 8 fights in one run", test: (s) => s.fightsWon >= 8 },
  { tech: "shockline", text: "Slam 15 times in one run", test: (s) => s.slams >= 15 },
  { tech: "tempo", text: "Clear a fight in under 14s", test: (s) => s.fastestFightMs < 14000 },
  { tech: "overdrive", text: "Resound twice in one fight", test: (s) => s.maxSyncsFight >= 2 },
  { tech: "harvest", text: "Defeat Who He Was", test: (s) => s.duplicateDefeated },
  { tech: "burning", text: "March with a 6-echo trail", test: (s) => s.maxTrail >= 6 },
];

export function goalFor(tech: string): Goal | undefined {
  return GOALS.find((g) => g.tech === tech);
}

export interface Unlocks {
  techs: string[];
  forms: FormId[];
  ascension: number | null;
  endless: boolean;
}

/** Evaluate goals at the end of a run; mutate the profile and report what's new. */
export function evaluateUnlocks(p: Profile, run: RunState): Unlocks {
  const out: Unlocks = { techs: [], forms: [], ascension: null, endless: false };
  for (const g of GOALS) {
    if (!p.techs.includes(g.tech) && g.test(run.stats)) {
      p.techs.push(g.tech);
      out.techs.push(g.tech);
    }
  }
  if (run.stats.act1Cleared && !p.forms.includes("brawler")) { p.forms.push("brawler"); out.forms.push("brawler"); }
  if (run.stats.runCleared && !p.forms.includes("phantom")) { p.forms.push("phantom"); out.forms.push("phantom"); }
  if (run.stats.runCleared && run.mode === "standard") {
    if (!p.endless) { p.endless = true; out.endless = true; }
    const next = Math.min(10, run.ascension + 1);
    if (next > p.ascension) { p.ascension = next; out.ascension = next; }
  }
  return out;
}
