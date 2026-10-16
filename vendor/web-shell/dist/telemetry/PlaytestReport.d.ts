import type { TelemetryEvent } from "./Telemetry.js";
export interface LevelPlaytestStats {
    loads: number;
    completions: number;
    failures: number;
    deaths: number;
    restarts: number;
    completionRate: number;
}
export interface PositionBucket {
    x: number;
    y: number;
    z: number;
    count: number;
}
export interface PlaytestReport {
    schemaVersion: 1;
    sessionId: string | null;
    durationMs: number;
    eventCounts: Record<string, number>;
    levels: Record<string, LevelPlaytestStats>;
    deathHotspots: PositionBucket[];
}
/** Builds a deterministic local playtest summary from semantic telemetry. */
export declare function buildPlaytestReport(events: readonly TelemetryEvent[], positionBucketSize?: number): PlaytestReport;
