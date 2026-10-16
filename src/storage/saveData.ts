import type { FormId } from "../data/forms";

export interface GameSettings {
  volume: number;      // 0..1
  screenShake: number; // 0..1
  muted: boolean;
}

export interface SaveData {
  version: 1;
  unlockedForms: FormId[];
  highestAscension: number;
  discoveredCombos: string[];
  bestChain: number;
  totalKills: number;
  totalRuns: number;
  settings: GameSettings;
}

const STORAGE_KEY = "echo_chain_save_v1";

const DEFAULT_SAVE: SaveData = {
  version: 1,
  unlockedForms: ["duelist"],
  highestAscension: 0,
  discoveredCombos: [],
  bestChain: 0,
  totalKills: 0,
  totalRuns: 0,
  settings: {
    volume: 0.7,
    screenShake: 1.0,
    muted: false,
  },
};

export class SaveManager {
  private data: SaveData = { ...DEFAULT_SAVE };

  constructor() {
    this.load();
  }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          this.data = {
            ...DEFAULT_SAVE,
            ...parsed,
            settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
          };
          return this.data;
        }
      }
    } catch (e) {
      console.warn("[EchoChain] Could not load localStorage save:", e);
    }
    this.data = { ...DEFAULT_SAVE };
    return this.data;
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("[EchoChain] Could not write localStorage save:", e);
    }
  }

  get(): SaveData {
    return this.data;
  }

  unlockForm(form: FormId): boolean {
    if (!this.data.unlockedForms.includes(form)) {
      this.data.unlockedForms.push(form);
      this.save();
      return true;
    }
    return false;
  }

  recordCombo(comboName: string): boolean {
    if (!this.data.discoveredCombos.includes(comboName)) {
      this.data.discoveredCombos.push(comboName);
      this.save();
      return true;
    }
    return false;
  }

  recordRunEnd(kills: number, longestChain: number, won: boolean, act: number): void {
    this.data.totalRuns++;
    this.data.totalKills += kills;
    this.data.bestChain = Math.max(this.data.bestChain, longestChain);

    if (act >= 1 && !this.data.unlockedForms.includes("brawler")) {
      this.unlockForm("brawler");
    }
    if (won && !this.data.unlockedForms.includes("phantom")) {
      this.unlockForm("phantom");
    }

    this.save();
  }

  updateSettings(settings: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }
}
