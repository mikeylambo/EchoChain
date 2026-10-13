import type { ChainEvent, ChainEventType, Enemy, Family } from "./types";
import type { DeterministicRng } from "@slu/web-shell";

export interface HitOpts {
  crit?: boolean; // force crit
  critChance?: number; // roll
  aoe?: boolean;
  pierce?: boolean;
  silent?: boolean;
}

export interface HitResult {
  dealt: number;
  crit: boolean;
  killed: boolean;
}

/**
 * The API a technique's action is written against. The chain engine builds one per trigger.
 * Techniques never touch the queue, slot routing, or cooldowns — the engine owns the law of the chain.
 */
export interface ActionCtx {
  readonly slot: number;
  readonly rank: 1 | 2 | 3;
  /** Output multiplier: rank × amp × seals. */
  readonly power: number;
  /** Fighter base damage for the active form. */
  readonly base: number;
  readonly rng: DeterministicRng;
  readonly family: Family;
  /** Per-slot persistent scratch for this technique (counters etc). */
  readonly state: Record<string, number>;

  // queries
  target(ev?: ChainEvent): Enemy | undefined;
  front(): Enemy | undefined;
  lowest(): Enemy | undefined;
  alive(): Enemy[];
  after(e: Enemy, n: number): Enemy[];
  echoX(): number;
  fighterX(): number;
  distinctEventTypes(): number;

  // effects
  hit(e: Enemy, mult: number, opts?: HitOpts): HitResult;
  launch(e: Enemy): void;
  stagger(e: Enemy, secs: number): void;
  stun(e: Enemy, secs: number): void;
  addBreak(e: Enemy, n: number, cap: number): void;
  ignite(x0: number, x1: number, secs: number, dps: number): void;
  addCharge(fraction: number): void;
  addOverdrive(pct: number, cap: number): void;
  grantCrits(n: number): void;
  spawnDoppel(secs: number, max: number): void;
  /** Interception for Guard Ghost: negates the pending enemy attack. */
  intercept(): void;
  pulseFx(r: number): void;
  waveFx(): void;
  beamFx(e: Enemy): void;

  // emission
  emit(type: ChainEventType, targetId: number): void;
  passThrough(events: ChainEvent[]): void;
  setAmp(mult: number): void;
  /** Mirror: replay the nearest upstream non-passive action at `mult`. */
  mirror(mult: number): void;
}
