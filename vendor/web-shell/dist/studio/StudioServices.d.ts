import type { BuildInfo, JsonValue } from "../core/types.js";
import { TelemetryRecorder } from "../telemetry/Telemetry.js";
import { RuntimeDiagnostics } from "../diagnostics/RuntimeDiagnostics.js";
import { DevConsoleRegistry } from "../debug/DevConsole.js";
import { LocalizationRegistry } from "../localization/Localization.js";
import { PlayerCopyCatalog } from "../localization/PlayerCopy.js";
import { AssetManifest } from "../assets/AssetManifest.js";
import { type PlatformServices } from "../platform/PlatformServices.js";
import { RuntimeConfig, FeatureFlags, type RuntimeConfigValues } from "../config/RuntimeConfig.js";
import { FrameTimeSampler } from "../performance/PerformanceBudget.js";
import { CertificationRunner } from "../certification/Certification.js";
export interface StudioServicesOptions {
    platform?: PlatformServices;
    locale?: string;
    telemetryContext?: Record<string, JsonValue>;
    installGlobalDiagnostics?: boolean;
    configDefaults?: RuntimeConfigValues;
    configOverrides?: RuntimeConfigValues;
}
export declare class StudioServices {
    readonly build: BuildInfo;
    private readonly options;
    readonly telemetry: TelemetryRecorder;
    readonly diagnostics: RuntimeDiagnostics;
    readonly dev: DevConsoleRegistry;
    readonly localization: LocalizationRegistry;
    readonly copy: PlayerCopyCatalog;
    readonly assets: AssetManifest;
    readonly platform: PlatformServices;
    readonly config: RuntimeConfig;
    readonly features: FeatureFlags;
    readonly frameTimes: FrameTimeSampler;
    readonly certification: CertificationRunner;
    private stopDiagnostics;
    constructor(build: BuildInfo, options?: StudioServicesOptions);
    start(): void;
    stop(): void;
    debugBundle(): unknown;
    exportDebugBundle(pretty?: boolean): string;
}
