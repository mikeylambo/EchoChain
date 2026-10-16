export interface InputReplayFrame<T> {
    atMs: number;
    action: T;
}
export interface InputReplayData<T> {
    schemaVersion: 1;
    startedAt: number;
    durationMs: number;
    frames: InputReplayFrame<T>[];
    metadata?: Record<string, string | number | boolean>;
}
export declare class InputReplayRecorder<T> {
    private readonly clock;
    private readonly metadata?;
    private readonly frames;
    private readonly startedAt;
    constructor(clock?: () => number, metadata?: Record<string, string | number | boolean> | undefined);
    record(action: T): void;
    finish(): InputReplayData<T>;
}
export declare class InputReplayPlayer<T> {
    readonly replay: InputReplayData<T>;
    private index;
    private elapsedMs;
    constructor(replay: InputReplayData<T>);
    reset(): void;
    seek(ms: number): void;
    advance(deltaMs: number): T[];
    get done(): boolean;
    get timeMs(): number;
}
