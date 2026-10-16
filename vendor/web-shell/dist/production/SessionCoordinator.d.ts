import type { BuildInfo } from "../core/types.js";
import type { PlatformServices } from "../platform/PlatformServices.js";
import type { TelemetryRecorder } from "../telemetry/Telemetry.js";
import type { ProductionServices } from "../studio/ProductionServices.js";
import { type RunDescriptor, type RunDescriptorInput } from "../game/RunDescriptor.js";
import { type SeedCadence } from "../game/ScheduledSeeds.js";
export interface SessionCoordinatorOptions {
    build: BuildInfo;
    platform: PlatformServices;
    telemetry: TelemetryRecorder;
    production: ProductionServices;
    flush?: () => void | Promise<void>;
}
export interface StartRunOptions extends Omit<RunDescriptorInput, "gameId" | "version" | "runId" | "startedAt"> {
}
export interface EndRunOptions {
    outcome?: string;
    score?: number;
    leaderboard?: string;
    metadata?: Record<string, string | number | boolean>;
    presence?: string;
}
/** Coordinates the shared production/platform work around one authoritative run. */
export declare class ProductionSessionCoordinator {
    private readonly options;
    private run;
    constructor(options: SessionCoordinatorOptions);
    get current(): RunDescriptor | null;
    start(input?: StartRunOptions): Promise<RunDescriptor>;
    startScheduled(cadence: SeedCadence, input?: Omit<StartRunOptions, "seed" | "challengeKey">, date?: Date): Promise<RunDescriptor>;
    unlockAchievement(id: string): Promise<boolean>;
    end(result?: EndRunOptions): Promise<RunDescriptor>;
    abandon(reason?: string): Promise<RunDescriptor>;
    ghostMetadata(extra?: Record<string, string | number | boolean>): Record<string, string | number | boolean>;
    private requireRun;
    private requireRunMetadata;
    private presenceDetails;
}
