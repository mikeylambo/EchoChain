import type { FormId } from "../data/forms";

export interface KeybindSettings {
  strike: string;
  sync: string;
  pause: string;
  codex: string;
}

export interface GameSettings {
  volume: number;      // 0..1
  screenShake: number; // 0..1
  muted: boolean;
  haptics: boolean;
  keybinds: KeybindSettings;
}

export interface LeaderboardEntry {
  id: string;
  date: string;
  form: FormId;
  mode: "standard" | "endless" | "daily";
  score: number;
  kills: number;
  longestChain: number;
  won: boolean;
  durationMs: number;
  ascension: number;
  seed: string;
}

export interface SaveData {
  version: 1;
  unlockedForms: FormId[];
  highestAscension: number;
  discoveredCombos: string[];
  unlockedAchievements: string[];
  leaderboard: LeaderboardEntry[];
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
  unlockedAchievements: [],
  leaderboard: [],
  bestChain: 0,
  totalKills: 0,
  totalRuns: 0,
  settings: {
    volume: 0.7,
    screenShake: 1.0,
    muted: false,
    haptics: true,
    keybinds: {
      strike: "Space",
      sync: "KeyS",
      pause: "Escape",
      codex: "KeyC",
    },
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

  unlockAchievement(id: string): boolean {
    if (!this.data.unlockedAchievements) {
      this.data.unlockedAchievements = [];
    }
    if (!this.data.unlockedAchievements.includes(id)) {
      this.data.unlockedAchievements.push(id);
      this.save();
      return true;
    }
    return false;
  }

  recordRunEnd(
    kills: number,
    longestChain: number,
    won: boolean,
    act: number,
    ascension = 0,
    mode: "standard" | "endless" | "daily" = "standard"
  ): void {
    this.data.totalRuns++;
    this.data.totalKills += kills;
    this.data.bestChain = Math.max(this.data.bestChain, longestChain);

    if (act >= 1 && !this.data.unlockedForms.includes("brawler")) {
      this.unlockForm("brawler");
    }
    if (won && !this.data.unlockedForms.includes("phantom")) {
      this.unlockForm("phantom");
    }

    // Win progression: unlock next Ascension tier if current or higher ascension was conquered
    if (won && mode === "standard") {
      if (ascension >= this.data.highestAscension) {
        this.data.highestAscension = Math.min(10, this.data.highestAscension + 1);
      }
    }

    this.save();
  }

  unlockAscension(level: number): void {
    this.data.highestAscension = Math.max(this.data.highestAscension, Math.min(10, level));
    this.save();
  }

  updateSettings(settings: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }

  recordLeaderboardEntry(entry: Omit<LeaderboardEntry, "id" | "date">): LeaderboardEntry {
    if (!this.data.leaderboard) {
      this.data.leaderboard = [];
    }
    const newEntry: LeaderboardEntry = {
      ...entry,
      id: `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    this.data.leaderboard.unshift(newEntry);
    // Keep top 30 records
    this.data.leaderboard = this.data.leaderboard.slice(0, 30);
    this.save();
    return newEntry;
  }

  exportSave(): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  }

  importSave(encoded: string): boolean {
    try {
      const decoded = decodeURIComponent(escape(atob(encoded.trim())));
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.version === 1) {
        this.data = {
          ...DEFAULT_SAVE,
          ...parsed,
          settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
        };
        this.save();
        return true;
      }
    } catch (e) {
      console.warn("[EchoChain] Failed to import save:", e);
    }
    return false;
  }
}
