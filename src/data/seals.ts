/** Seals are pure modifier bundles; the engine reads the aggregated RunMods. */
export interface RunMods {
  extraSlots: number;
  delayMult: number;
  cdMult: number;
  overflow: boolean;
  firstLight: number;
  tailwind: number;
  maxHpBonus: number;
  chargeMult: number;
  afterglow: number;
  chainTax: number;
}

export const BASE_MODS: RunMods = {
  extraSlots: 0,
  delayMult: 1,
  cdMult: 1,
  overflow: false,
  firstLight: 1,
  tailwind: 1,
  maxHpBonus: 0,
  chargeMult: 1,
  afterglow: 0,
  chainTax: 0,
};

export interface SealDef {
  id: string;
  name: string;
  desc: string;
  glyph: string; // single symbol used on the card
  mods: Partial<RunMods>;
  healOnPick?: number;
}

export const SEALS: SealDef[] = [
  { id: "longline", name: "Long Line", desc: "+1 slot", glyph: "⟶", mods: { extraSlots: 1 } },
  { id: "tight", name: "Tight Formation", desc: "Echoes march closer", glyph: "≡", mods: { delayMult: 0.65 } },
  { id: "quick", name: "Quick Hands", desc: "Echo cooldown −30%", glyph: "≫", mods: { cdMult: 0.7 } },
  { id: "overflow", name: "Overflow", desc: "Missed links still charge", glyph: "◌", mods: { overflow: true } },
  { id: "firstlight", name: "First Light", desc: "Slot 1 · +50%", glyph: "①", mods: { firstLight: 1.5 } },
  { id: "tailwind", name: "Tailwind", desc: "Last slot · +60%", glyph: "⇥", mods: { tailwind: 1.6 } },
  { id: "iron", name: "Iron Body", desc: "+30 HP", glyph: "▣", mods: { maxHpBonus: 30 }, healOnPick: 30 },
  { id: "resonant", name: "Resonant Core", desc: "Resound · +25% charge", glyph: "◎", mods: { chargeMult: 1.25 } },
  { id: "afterglow", name: "Afterglow", desc: "Hits echo again · 10%", glyph: "∿", mods: { afterglow: 0.1 } },
  { id: "chaintax", name: "Chain Tax", desc: "×5 chain · heal 3", glyph: "✚", mods: { chainTax: 3 } },
];

export const SEAL: Record<string, SealDef> = Object.fromEntries(SEALS.map((s) => [s.id, s]));

export function aggregateMods(sealIds: readonly string[]): RunMods {
  const m: RunMods = { ...BASE_MODS };
  for (const id of sealIds) {
    const s = SEAL[id];
    if (!s) continue;
    const d = s.mods;
    if (d.extraSlots) m.extraSlots += d.extraSlots;
    if (d.delayMult) m.delayMult *= d.delayMult;
    if (d.cdMult) m.cdMult *= d.cdMult;
    if (d.overflow) m.overflow = true;
    if (d.firstLight) m.firstLight *= d.firstLight;
    if (d.tailwind) m.tailwind *= d.tailwind;
    if (d.maxHpBonus) m.maxHpBonus += d.maxHpBonus;
    if (d.chargeMult) m.chargeMult *= d.chargeMult;
    if (d.afterglow) m.afterglow += d.afterglow;
    if (d.chainTax) m.chainTax += d.chainTax;
  }
  return m;
}
