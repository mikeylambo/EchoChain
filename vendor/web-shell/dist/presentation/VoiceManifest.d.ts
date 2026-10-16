export interface VoiceLine {
    id: string;
    speaker: string;
    assetId: string;
    textKey?: string;
    durationMs?: number;
    locale?: string;
    emotion?: string;
    tags?: string[];
}
/** Central registry for VO ids so narrative, subtitles, localization and audio stay aligned. */
export declare class VoiceManifest {
    private readonly lines;
    register(lines: readonly VoiceLine[]): void;
    get(id: string): VoiceLine | null;
    list(): VoiceLine[];
    validate(): string[];
}
