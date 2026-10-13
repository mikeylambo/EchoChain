/** Shared sim types. The sim never imports render code. */

export type ChainEventType = "HIT" | "CRIT" | "KILL" | "PARRY" | "LAUNCH" | "STAGGER";
export type WorldEventType = "ENEMY_ATTACK" | "TICK";
export type Receive = ChainEventType | WorldEventType | "ANY";
export type Family = "precision" | "momentum" | "resonance";

export const CHAIN_EVENTS: readonly ChainEventType[] = ["HIT", "CRIT", "KILL", "PARRY", "LAUNCH", "STAGGER"];

export interface ChainEvent {
  type: ChainEventType;
  targetId: number; // -1 when there is no specific target
}

/** All events produced by one echo action travel together as one packet. */
export interface Packet {
  events: ChainEvent[];
  fromSlot: number;
  chainId: number;
  links: number; // echo triggers along this path so far
  amp: number; // output multiplier applied to the receiver (Amplifier)
  deliverAt: number; // sim ms
  path: string[]; // technique ids that triggered along this path (codex)
  sync?: boolean;
}

export type Pose = "idle" | "walk" | "strike" | "heavy" | "parry" | "hurt" | "dash" | "victory";

export interface FighterSample {
  x: number;
  pose: Pose;
  poseT: number; // seconds into pose
}

export type EnemyKind = "husk" | "bulwark" | "lancer" | "splitter" | "splitling" | "mimic" | "duplicate" | "original";
export type EnemyState = "walk" | "windup" | "air" | "stagger" | "dead";
export type EliteTrait = "armored" | "hasted" | "splitting";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number; // air height
  vz: number;
  lane: number; // visual depth 0..1 (presentation only uses it)
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  range: number;
  attackEvery: number;
  attackT: number;
  windupT: number;
  state: EnemyState;
  staggerT: number;
  stunT: number;
  airT: number;
  breakStacks: number;
  shield: boolean;
  burnT: number;
  burnDps: number;
  burnSlot: number;
  mimicTech: string | null;
  mimicT: number;
  mimicCd: number;
  elite: boolean;
  trait: EliteTrait | null;
  deadT: number;
  flashT: number;
  size: number;
  isBoss: boolean;
  spawnT: number;
  splitChild: boolean;
}

export interface Projectile {
  id: number;
  x: number;
  vx: number;
  dmg: number;
  ownerId: number;
  t: number;
}

export interface FireZone {
  x0: number;
  x1: number;
  t: number;
  dps: number;
  slot: number;
  tickT: number;
}

/** Presentation events: the sim pushes, the renderer drains. Never read back by the sim. */
export type Fx =
  | { k: "arc"; from: number; to: number; family: Family | "ink"; dropped?: boolean }
  | { k: "trigger"; slot: number; family: Family | "ink"; tech: string; targetId: number }
  | { k: "hit"; x: number; z: number; lane: number; dmg: number; crit: boolean; family: Family | "ink"; blocked?: boolean }
  | { k: "note"; slot: number; links: number }
  | { k: "chain"; links: number }
  | { k: "parry"; x: number }
  | { k: "clang"; x: number; z: number }
  | { k: "kill"; x: number; z: number; lane: number; kind: EnemyKind }
  | { k: "sync"; slots: number }
  | { k: "hurt"; dmg: number }
  | { k: "beam"; x0: number; x1: number; z: number; family: Family }
  | { k: "wave"; x: number; family: Family }
  | { k: "pulse"; x: number; r: number; family: Family }
  | { k: "launch"; x: number }
  | { k: "slam"; x: number }
  | { k: "boss"; text: "phase" | "stagger" | "reorder" }
  | { k: "doppel"; slot: number }
  | { k: "mimic"; id: number; tech: string }
  | { k: "heal"; amount: number }
  | { k: "ghost"; idx: number };

export interface EventLogEntry {
  tick: number;
  slot: number;
  type: ChainEventType | WorldEventType;
  targetId: number;
  chainId: number;
  links: number;
}
