export type RelicId =
  | "kinetic_battery"
  | "chrono_shard"
  | "resonant_prism"
  | "vampiric_edge"
  | "iron_pact"
  | "abyssal_compass"
  | "void_needle"
  | "mirror_pendant";

export interface RelicDef {
  id: RelicId;
  name: string;
  icon: string;
  desc: string;
  rarity: "common" | "rare" | "legendary";
}

export const RELICS: Record<RelicId, RelicDef> = {
  kinetic_battery: {
    id: "kinetic_battery",
    name: "Kinetic Battery",
    icon: "🔋",
    desc: "Begin every combat encounter with 50% Sync Break charge.",
    rarity: "common",
  },
  chrono_shard: {
    id: "chrono_shard",
    name: "Chrono Shard",
    icon: "⏳",
    desc: "Successful parries grant +120ms hitstop and trigger a 25 damage counter-shock.",
    rarity: "rare",
  },
  resonant_prism: {
    id: "resonant_prism",
    name: "Resonant Prism",
    icon: "💎",
    desc: "Chains of 4+ links trigger a 35 damage resonant burst at the tail.",
    rarity: "rare",
  },
  vampiric_edge: {
    id: "vampiric_edge",
    name: "Vampiric Edge",
    icon: "🩸",
    desc: "Recover 4 HP whenever a chain of 5 or more techniques is completed.",
    rarity: "legendary",
  },
  iron_pact: {
    id: "iron_pact",
    name: "Iron Pact",
    icon: "🛡️",
    desc: "+25 Max HP. Take 25% less damage when below 40% health.",
    rarity: "common",
  },
  abyssal_compass: {
    id: "abyssal_compass",
    name: "Abyssal Compass",
    icon: "🧭",
    desc: "Draft reward screens offer 4 technique cards instead of 3.",
    rarity: "common",
  },
  void_needle: {
    id: "void_needle",
    name: "Void Needle",
    icon: "🪡",
    desc: "Critical hits instantly apply 2 stacks of Break vulnerability.",
    rarity: "rare",
  },
  mirror_pendant: {
    id: "mirror_pendant",
    name: "Mirror Pendant",
    icon: "🪞",
    desc: "Boss encounters reward an additional Rank II upgraded technique.",
    rarity: "legendary",
  },
};

export const RELIC_LIST: RelicDef[] = Object.values(RELICS);

export function getRelic(id: RelicId): RelicDef {
  return RELICS[id] ?? RELICS.kinetic_battery;
}
