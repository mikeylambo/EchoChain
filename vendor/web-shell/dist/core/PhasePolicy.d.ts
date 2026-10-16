import type { GamePhase } from "./types.js";
export type PhaseTransitionMap = Partial<Record<GamePhase, readonly GamePhase[]>>;
export declare class PhasePolicy {
    private readonly allowed;
    constructor(allowed: PhaseTransitionMap);
    allows(from: GamePhase, to: GamePhase): boolean;
    assert(from: GamePhase, to: GamePhase): void;
}
export declare const productionPhasePolicy: PhasePolicy;
