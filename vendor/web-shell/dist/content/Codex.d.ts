import { EventBus } from "../core/EventBus.js";
export interface CodexEntry {
    id: string;
    category: string;
    title: string;
    body: string;
    hidden?: boolean;
    tags?: string[];
    payload?: unknown;
}
export interface CodexEvents {
    "codex:unlocked": CodexEntry;
    "codex:read": {
        id: string;
    };
    [key: string]: unknown;
}
export declare class CodexManager {
    readonly events: EventBus<CodexEvents>;
    private readonly entries;
    private readonly unlocked;
    private readonly read;
    register(entries: readonly CodexEntry[]): void;
    unlock(id: string): boolean;
    markRead(id: string): void;
    isUnlocked(id: string): boolean;
    isRead(id: string): boolean;
    list(category?: string): CodexEntry[];
    snapshot(): {
        unlocked: string[];
        read: string[];
    };
    hydrate(state: {
        unlocked?: readonly string[];
        read?: readonly string[];
    }): void;
}
