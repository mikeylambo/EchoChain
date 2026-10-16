import type { BuildInfo } from "../core/types.js";
import type { RunDescriptor } from "../game/RunDescriptor.js";
import type { InputDeviceFamily } from "../input/InputGlyphs.js";
export interface PlaytestBundleExtras {
    run?: RunDescriptor | null;
    rng?: unknown;
    replay?: unknown;
    ghost?: unknown;
    game?: unknown;
    environment?: unknown;
    notes?: string;
}
export interface PlaytestBundleV1 {
    schemaVersion: 1;
    generatedAt: string;
    build: BuildInfo;
    runtime: {
        phase: string;
        levelId: string | null;
        inputFamily: InputDeviceFamily;
    };
    settings: unknown;
    production: unknown;
    studio: unknown;
    run: RunDescriptor | null;
    rng?: unknown;
    replay?: unknown;
    ghost?: unknown;
    game?: unknown;
    environment?: unknown;
    notes?: string;
}
export interface PlaytestBundleInput extends PlaytestBundleExtras {
    build: BuildInfo;
    phase: string;
    levelId: string | null;
    inputFamily: InputDeviceFamily;
    settings: unknown;
    production: unknown;
    studio: unknown;
    clock?: () => Date;
}
/**
 * Creates one portable snapshot for crashes, bug reports and playtests.
 * Optional game-specific providers (RNG/replay/ghost/game state) remain opt-in,
 * while the shell-owned diagnostic surface is always present.
 */
export declare function createPlaytestBundle(input: PlaytestBundleInput): PlaytestBundleV1;
export declare function exportPlaytestBundle(bundle: PlaytestBundleV1, pretty?: boolean): string;
