import { EventBus } from "../core/EventBus.js";
export interface NarrativeChoice {
    id: string;
    label: string;
    nextBeatId?: string;
}
export interface NarrativeBeat {
    id: string;
    speaker?: string;
    text?: string;
    voiceId?: string;
    durationMs?: number;
    choices?: NarrativeChoice[];
    tags?: string[];
    payload?: unknown;
}
export interface NarrativeSequence {
    id: string;
    beats: NarrativeBeat[];
    skippable?: boolean;
}
export interface NarrativeEvents {
    "narrative:start": {
        sequenceId: string;
    };
    "narrative:beat": {
        sequenceId: string;
        beat: NarrativeBeat;
        index: number;
    };
    "narrative:choice": {
        sequenceId: string;
        beatId: string;
        choice: NarrativeChoice;
    };
    "narrative:end": {
        sequenceId: string;
        skipped: boolean;
    };
    [key: string]: unknown;
}
/** Renderer-neutral dialogue/cutscene state machine. Rendering, VO playback,
 * camera work and objective changes subscribe to emitted events. */
export declare class NarrativeDirector {
    readonly events: EventBus<NarrativeEvents>;
    private readonly sequences;
    private active;
    private index;
    private elapsedMs;
    private waitingForChoice;
    register(sequence: NarrativeSequence): void;
    play(id: string): NarrativeBeat;
    tick(deltaMs: number): void;
    advance(): NarrativeBeat | null;
    choose(choiceId: string): NarrativeBeat | null;
    skip(): boolean;
    stop(): void;
    get current(): NarrativeBeat | null;
    get sequenceId(): string | null;
    get isActive(): boolean;
    get awaitingChoice(): boolean;
    private emitBeat;
    private end;
}
