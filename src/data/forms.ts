import type { ChainEventType } from "../sim/types";

export type FormId = "duelist" | "brawler" | "phantom";

export interface FormDef {
  id: FormId;
  name: string;
  hp: number;
  interval: number; // seconds between strikes
  dmg: number;
  crit: number;
  emits: ChainEventType[];
  startSlots: number;
  desc: string;
  unlock: string;
}

export const FORMS: Record<FormId, FormDef> = {
  duelist: { id: "duelist", name: "Duelist", hp: 100, interval: 0.7, dmg: 10, crit: 0.18, emits: ["HIT"], startSlots: 2, desc: "Quick strike", unlock: "" },
  brawler: { id: "brawler", name: "Brawler", hp: 115, interval: 1.1, dmg: 17, crit: 0.08, emits: ["HIT", "STAGGER"], startSlots: 2, desc: "Heavy strike, staggers", unlock: "Clear Act 1" },
  phantom: { id: "phantom", name: "Phantom", hp: 70, interval: 0.8, dmg: 6.5, crit: 0.12, emits: ["HIT"], startSlots: 3, desc: "Weak strike, 3 echo slots", unlock: "Clear a run" },
};

export const FORM_LIST: FormId[] = ["duelist", "brawler", "phantom"];
