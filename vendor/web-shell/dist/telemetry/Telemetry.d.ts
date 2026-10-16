import type { JsonValue } from "../core/types.js";
export interface TelemetryEvent {
    seq: number;
    name: string;
    atMs: number;
    sessionId: string;
    data: Record<string, JsonValue>;
}
export interface TelemetryOptions {
    sessionId?: string;
    maxEvents?: number;
    clock?: () => number;
    context?: Record<string, JsonValue>;
}
export declare class TelemetryRecorder {
    private readonly events;
    private readonly maxEvents;
    private readonly clock;
    private readonly startedAt;
    private readonly sessionId;
    private context;
    constructor(options?: TelemetryOptions);
    setContext(values: Record<string, JsonValue>): void;
    record(name: string, data?: Record<string, JsonValue>): TelemetryEvent;
    snapshot(): readonly TelemetryEvent[];
    clear(): void;
    exportJSON(pretty?: boolean): string;
    exportCSV(): string;
}
