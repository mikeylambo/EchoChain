import { EventBus } from "../../core/EventBus.js";
export type CompanionPhase = "lobby" | "together" | "split" | "regroup" | "results";
export type CompanionViewMode = "shared" | "private";
export interface CompanionPublicPlayer {
    id: string;
    slot: number;
    displayName: string;
    ready: boolean;
    connected: boolean;
    view: CompanionViewMode;
    privateZoneId?: string;
}
export interface CompanionJoinReceipt extends CompanionPublicPlayer {
    reconnectToken: string;
}
export type CompanionAudience = {
    kind: "all";
} | {
    kind: "player";
    playerId: string;
};
export interface CompanionMessage<T = unknown> {
    id: string;
    sequence: number;
    type: string;
    audience: CompanionAudience;
    payload: T;
    createdAt: number;
}
export interface CompanionAction<T = unknown> {
    playerId: string;
    type: string;
    payload: T;
    phase: CompanionPhase;
    view: CompanionViewMode;
    privateZoneId?: string;
    createdAt: number;
}
export interface CompanionClientView {
    roomCode: string;
    phase: CompanionPhase;
    player: CompanionJoinReceipt;
    players: CompanionPublicPlayer[];
    publicState: Record<string, unknown>;
    privateState: Record<string, unknown>;
    messages: CompanionMessage[];
}
export interface CompanionHostSnapshot {
    roomCode: string;
    phase: CompanionPhase;
    players: CompanionPublicPlayer[];
    publicState: Record<string, unknown>;
    privateStateByPlayer: Record<string, Record<string, unknown>>;
}
export interface CompanionSessionOptions {
    maxPlayers?: number;
    roomCode?: string;
    now?: () => number;
    reconnectTokenFactory?: (slot: number) => string;
    messageLimit?: number;
}
export interface CompanionSessionEvents {
    "companion:player-joined": CompanionPublicPlayer;
    "companion:player-disconnected": CompanionPublicPlayer;
    "companion:player-reconnected": CompanionPublicPlayer;
    "companion:player-left": CompanionPublicPlayer;
    "companion:player-ready": CompanionPublicPlayer;
    "companion:phase-changed": {
        previous: CompanionPhase;
        current: CompanionPhase;
    };
    "companion:message": CompanionMessage;
    "companion:action": CompanionAction;
    "companion:public-state": {
        key: string;
        value: unknown;
    };
    "companion:private-state": {
        playerId: string;
        key: string;
        value: unknown;
    };
    [key: string]: unknown;
}
/**
 * Host-authoritative state for shared-screen + personal-screen multiplayer.
 * Public truth and per-player private truth are stored separately by construction.
 */
export declare class CompanionSessionManager {
    readonly events: EventBus<CompanionSessionEvents>;
    readonly roomCode: string;
    private readonly maxPlayers;
    private readonly now;
    private readonly reconnectTokenFactory;
    private readonly messageLimit;
    private readonly players;
    private readonly publicState;
    private readonly privateState;
    private readonly messages;
    private phaseValue;
    private messageSequence;
    constructor(options?: CompanionSessionOptions);
    phase(): CompanionPhase;
    join(deviceId: string, displayName?: string): CompanionJoinReceipt;
    reconnect(reconnectToken: string, deviceId: string): CompanionJoinReceipt;
    disconnect(playerId: string): CompanionPublicPlayer;
    leave(playerId: string): boolean;
    setReady(playerId: string, ready?: boolean): CompanionPublicPlayer;
    allReady(minPlayers?: number): boolean;
    start(minPlayers?: number): void;
    split(assignments: Partial<Record<string, string>>): void;
    regroup(): void;
    resumeTogether(): void;
    finish(payload?: unknown): void;
    setPublicState(key: string, value: unknown): void;
    setPrivateState(playerId: string, key: string, value: unknown): void;
    broadcast<T = unknown>(type: string, payload: T): CompanionMessage<T>;
    sendPrivate<T = unknown>(playerId: string, type: string, payload: T): CompanionMessage<T>;
    submitAction<T = unknown>(playerId: string, type: string, payload: T): CompanionAction<T>;
    viewFor(playerId: string, afterSequence?: number): CompanionClientView;
    hostSnapshot(): CompanionHostSnapshot;
    listPlayers(): CompanionPublicPlayer[];
    private pushMessage;
    private transition;
    private nextSlot;
    private requirePlayer;
    private requireConnectedPlayer;
    private requireKey;
    private publicPlayer;
    private receipt;
}
