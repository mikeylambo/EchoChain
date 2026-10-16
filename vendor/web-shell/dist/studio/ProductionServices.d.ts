import { AchievementManager, type AchievementProvider } from "../game/Achievements.js";
import { NarrativeDirector } from "../narrative/NarrativeDirector.js";
import { CodexManager } from "../content/Codex.js";
import { EntitlementManager, type EntitlementState } from "../release/Entitlements.js";
import { CreditsRegistry } from "../release/Credits.js";
import { PhotoModeController } from "../photo/PhotoMode.js";
import { InputGlyphRegistry } from "../input/InputGlyphs.js";
import { CheckpointManager, type CheckpointSnapshot } from "../modules/checkpoints/CheckpointManager.js";
import { SubtitlePlayer } from "../presentation/Subtitles.js";
import { VoiceManifest } from "../presentation/VoiceManifest.js";
import { CinematicDirector } from "../presentation/Cinematics.js";
import { NotificationCenter } from "../presentation/Notifications.js";
import { TransitionManager } from "../presentation/Transitions.js";
import { CaptureService, type CaptureAdapter } from "../presentation/Capture.js";
import { OnboardingManager, type OnboardingState } from "../onboarding/OnboardingManager.js";
export interface ProductionServicesOptions {
    achievementProvider?: AchievementProvider;
    entitlement?: EntitlementState;
    captureAdapter?: CaptureAdapter;
}
export interface ProductionStateV1 {
    schemaVersion: 1;
    achievements: {
        unlocked: string[];
    };
    codex: {
        unlocked: string[];
        read: string[];
    };
    onboarding: OnboardingState;
    checkpoints: CheckpointSnapshot<unknown>;
}
export type ProductionState = ProductionStateV1;
/** High-level game production services that are deliberately renderer-neutral.
 * Individual games may ignore any service they do not need. */
export declare class ProductionServices {
    readonly achievements: AchievementManager;
    readonly narrative: NarrativeDirector;
    readonly codex: CodexManager;
    readonly entitlements: EntitlementManager;
    readonly credits: CreditsRegistry;
    readonly photo: PhotoModeController;
    readonly glyphs: InputGlyphRegistry;
    readonly checkpoints: CheckpointManager<unknown>;
    readonly subtitles: SubtitlePlayer;
    readonly voice: VoiceManifest;
    readonly cinematics: CinematicDirector;
    readonly notifications: NotificationCenter;
    readonly transitions: TransitionManager;
    readonly onboarding: OnboardingManager;
    readonly capture: CaptureService;
    constructor(options?: ProductionServicesOptions);
    /** Durable shell-owned state only. Transient presentation state and platform-derived entitlements are intentionally excluded. */
    snapshotState(): ProductionState;
    hydrateState(state: Partial<ProductionState> | null | undefined): void;
}
