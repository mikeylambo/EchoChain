import { EventBus } from "../core/EventBus.js";
export type TransitionKind = "fade" | "wipe" | "crossfade" | "loading" | "custom";
export interface TransitionRequest {
    id: string;
    kind: TransitionKind;
    durationMs?: number;
    message?: string;
    payload?: unknown;
}
export interface TransitionEvents {
    "transition:start": TransitionRequest;
    "transition:end": {
        id: string;
    };
    [key: string]: unknown;
}
export declare class TransitionManager {
    readonly events: EventBus<TransitionEvents>;
    private active;
    start(request: TransitionRequest): void;
    end(id?: string | undefined): boolean;
    get current(): TransitionRequest | null;
}
