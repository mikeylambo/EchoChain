import { AchievementManager } from "../game/Achievements.js";
import { NarrativeDirector } from "../narrative/NarrativeDirector.js";
import { CodexManager } from "../content/Codex.js";
import { EntitlementManager } from "../release/Entitlements.js";
import { CreditsRegistry } from "../release/Credits.js";
import { PhotoModeController } from "../photo/PhotoMode.js";
import { InputGlyphRegistry } from "../input/InputGlyphs.js";
import { CheckpointManager } from "../modules/checkpoints/CheckpointManager.js";
import { SubtitlePlayer } from "../presentation/Subtitles.js";
import { VoiceManifest } from "../presentation/VoiceManifest.js";
import { CinematicDirector } from "../presentation/Cinematics.js";
import { NotificationCenter } from "../presentation/Notifications.js";
import { TransitionManager } from "../presentation/Transitions.js";
import { CaptureService } from "../presentation/Capture.js";
import { OnboardingManager } from "../onboarding/OnboardingManager.js";
/** High-level game production services that are deliberately renderer-neutral.
 * Individual games may ignore any service they do not need. */
export class ProductionServices {
    achievements;
    narrative = new NarrativeDirector();
    codex = new CodexManager();
    entitlements;
    credits = new CreditsRegistry();
    photo = new PhotoModeController();
    glyphs = new InputGlyphRegistry();
    checkpoints = new CheckpointManager();
    subtitles = new SubtitlePlayer();
    voice = new VoiceManifest();
    cinematics = new CinematicDirector();
    notifications = new NotificationCenter();
    transitions = new TransitionManager();
    onboarding = new OnboardingManager();
    capture;
    constructor(options = {}) {
        this.achievements = new AchievementManager(options.achievementProvider);
        this.entitlements = new EntitlementManager(options.entitlement ?? "full");
        this.capture = new CaptureService(options.captureAdapter);
    }
    /** Durable shell-owned state only. Transient presentation state and platform-derived entitlements are intentionally excluded. */
    snapshotState() {
        return {
            schemaVersion: 1,
            achievements: this.achievements.snapshot(),
            codex: this.codex.snapshot(),
            onboarding: this.onboarding.snapshot(),
            checkpoints: this.checkpoints.snapshot()
        };
    }
    hydrateState(state) {
        if (!state)
            return;
        if (state.schemaVersion !== undefined && state.schemaVersion !== 1)
            throw new Error(`Unsupported production state schema: ${state.schemaVersion}`);
        this.achievements.hydrate(state.achievements ?? {});
        this.codex.hydrate(state.codex ?? {});
        this.onboarding.hydrate(state.onboarding ?? {});
        this.checkpoints.hydrate(state.checkpoints ?? {});
    }
}
