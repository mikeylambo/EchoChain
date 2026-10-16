import type { JsonValue } from "../core/types.js";
export type EventFlagValue = JsonValue;
export type EventFlagSnapshot = Record<string, EventFlagValue>;
export type EventFlagPredicate = (flags: Readonly<EventFlagSnapshot>) => boolean;
export declare class EventFlags {
    private readonly values;
    private readonly listeners;
    constructor(initial?: EventFlagSnapshot);
    set(key: string, value: EventFlagValue): void;
    get<T extends EventFlagValue>(key: string, fallback: T): T;
    has(key: string): boolean;
    delete(key: string): void;
    matches(predicate: EventFlagPredicate): boolean;
    snapshot(): EventFlagSnapshot;
    restore(snapshot: EventFlagSnapshot): void;
    onChange(listener: (key: string, value: EventFlagValue | undefined) => void): () => void;
}
export declare const flagEquals: (key: string, expected: EventFlagValue) => EventFlagPredicate;
export declare const flagAll: (...predicates: EventFlagPredicate[]) => EventFlagPredicate;
export declare const flagAny: (...predicates: EventFlagPredicate[]) => EventFlagPredicate;
