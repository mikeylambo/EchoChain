import { EventBus } from "../core/EventBus.js";
export type SubtitleSpeakerMode = "name" | "portrait" | "hidden";
export interface SubtitleStyle {
    maxLines?: number;
    textScale?: number;
    backgroundOpacity?: number;
    speakerMode?: SubtitleSpeakerMode;
}
export interface SubtitleCue {
    id: string;
    startMs: number;
    endMs: number;
    text: string;
    speaker?: string;
    voiceId?: string;
    priority?: number;
    tags?: string[];
}
export interface SubtitleTrack {
    id: string;
    cues: SubtitleCue[];
    locale?: string;
}
export interface SubtitleEvents {
    "subtitle:show": SubtitleCue;
    "subtitle:hide": {
        id: string;
    };
    [key: string]: unknown;
}
/** Renderer-neutral timed subtitle scheduler. Presentation subscribes to events. */
export declare class SubtitlePlayer {
    readonly style: SubtitleStyle;
    readonly events: EventBus<SubtitleEvents>;
    private track;
    private timeMs;
    private active;
    private playing;
    constructor(style?: SubtitleStyle);
    load(track: SubtitleTrack): void;
    play(): void;
    pause(): void;
    stop(): void;
    seek(ms: number): void;
    tick(deltaMs: number): void;
    get currentTimeMs(): number;
    private sync;
}
