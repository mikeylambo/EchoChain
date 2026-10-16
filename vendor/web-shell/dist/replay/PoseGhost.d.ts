export interface GhostPose {
    x: number;
    y: number;
    z: number;
    state?: number;
}
export interface GhostRecordingMetadata {
    id?: string;
    seed?: string | number;
    levelId?: string;
    durationMs?: number;
    [key: string]: string | number | boolean | undefined;
}
export interface GhostRecording {
    schemaVersion: 1;
    sampleHz: number;
    stride: 5;
    samples: number[];
    metadata?: GhostRecordingMetadata;
}
export interface GhostRecorderOptions {
    sampleHz?: number;
    maxSamples?: number;
    positionScale?: number;
    clock?: () => number;
}
/**
 * Lightweight pose recording inspired by Descent's ghost implementation.
 * Playback interpolates captured poses instead of re-running simulation, so
 * ghosts remain renderer-neutral, deterministic and cheap to store.
 */
export declare class PoseGhostRecorder {
    private readonly sampleHz;
    private readonly maxSamples;
    private readonly positionScale;
    private readonly clock;
    private readonly startedAt;
    private nextSampleMs;
    private finished;
    private readonly samples;
    constructor(options?: GhostRecorderOptions);
    sample(pose: GhostPose, force?: boolean): boolean;
    finish(pose?: GhostPose): void;
    serialize(metadata?: GhostRecordingMetadata): GhostRecording;
}
export interface GhostPlaybackPose extends GhostPose {
    timeMs: number;
    done: boolean;
}
export declare class PoseGhostPlayer {
    readonly recording: GhostRecording;
    private readonly positionScale;
    private timeMs;
    constructor(recording: GhostRecording, positionScale?: number);
    reset(): void;
    seek(timeMs: number): void;
    advance(deltaMs: number): GhostPlaybackPose | null;
    poseAt(timeMs: number): GhostPlaybackPose | null;
    get durationMs(): number;
    private readPose;
}
