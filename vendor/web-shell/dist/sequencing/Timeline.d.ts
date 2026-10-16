export interface TimelineCue<T = unknown> {
    atMs: number;
    id: string;
    payload?: T;
}
export interface TimelineOptions {
    durationMs?: number;
    loop?: boolean;
}
export declare class Timeline<T = unknown> {
    private readonly options;
    private readonly cues;
    private timeMs;
    private index;
    private playing;
    constructor(options?: TimelineOptions);
    add(cue: TimelineCue<T>): this;
    play(): void;
    pause(): void;
    reset(): void;
    seek(ms: number): void;
    tick(deltaMs: number): TimelineCue<T>[];
    get currentTimeMs(): number;
    get isPlaying(): boolean;
}
