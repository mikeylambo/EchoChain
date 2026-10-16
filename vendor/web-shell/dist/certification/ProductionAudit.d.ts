import type { VoiceManifest } from "../presentation/VoiceManifest.js";
import type { SubtitleTrack } from "../presentation/Subtitles.js";
export interface ProductionAuditInput {
    voice?: VoiceManifest;
    subtitleTracks?: readonly SubtitleTrack[];
    requiredVoiceIds?: readonly string[];
    requiredSubtitleVoiceIds?: readonly string[];
    requiredFeatures?: readonly {
        id: string;
        enabled: boolean;
    }[];
}
export interface ProductionAuditIssue {
    scope: string;
    message: string;
    severity: "warning" | "error";
}
export interface ProductionAuditReport {
    ok: boolean;
    issues: ProductionAuditIssue[];
}
export declare function auditProduction(input: ProductionAuditInput): ProductionAuditReport;
