export class InputReplayRecorder {
    clock;
    metadata;
    frames = [];
    startedAt;
    constructor(clock = () => performance.now(), metadata) {
        this.clock = clock;
        this.metadata = metadata;
        this.startedAt = this.clock();
    }
    record(action) { this.frames.push({ atMs: Math.max(0, this.clock() - this.startedAt), action }); }
    finish() { const durationMs = Math.max(this.frames.at(-1)?.atMs ?? 0, this.clock() - this.startedAt); return { schemaVersion: 1, startedAt: this.startedAt, durationMs, frames: this.frames.map(f => ({ ...f })), metadata: this.metadata ? { ...this.metadata } : undefined }; }
}
export class InputReplayPlayer {
    replay;
    index = 0;
    elapsedMs = 0;
    constructor(replay) {
        this.replay = replay;
    }
    reset() { this.index = 0; this.elapsedMs = 0; }
    seek(ms) { this.elapsedMs = Math.max(0, ms); this.index = this.replay.frames.findIndex(f => f.atMs >= this.elapsedMs); if (this.index < 0)
        this.index = this.replay.frames.length; }
    advance(deltaMs) {
        this.elapsedMs = Math.max(0, this.elapsedMs + deltaMs);
        const due = [];
        while (this.index < this.replay.frames.length && this.replay.frames[this.index].atMs <= this.elapsedMs) {
            due.push(this.replay.frames[this.index].action);
            this.index++;
        }
        return due;
    }
    get done() { return this.index >= this.replay.frames.length; }
    get timeMs() { return this.elapsedMs; }
}
