export class Timeline {
    options;
    cues = [];
    timeMs = 0;
    index = 0;
    playing = false;
    constructor(options = {}) {
        this.options = options;
    }
    add(cue) { this.cues.push({ ...cue }); this.cues.sort((a, b) => a.atMs - b.atMs); this.seek(this.timeMs); return this; }
    play() { this.playing = true; }
    pause() { this.playing = false; }
    reset() { this.timeMs = 0; this.index = 0; this.playing = false; }
    seek(ms) { this.timeMs = Math.max(0, ms); this.index = this.cues.findIndex(c => c.atMs >= this.timeMs); if (this.index < 0)
        this.index = this.cues.length; }
    tick(deltaMs) {
        if (!this.playing || deltaMs <= 0)
            return [];
        const due = [];
        this.timeMs += deltaMs;
        while (this.index < this.cues.length && this.cues[this.index].atMs <= this.timeMs) {
            due.push({ ...this.cues[this.index] });
            this.index++;
        }
        const duration = this.options.durationMs ?? this.cues.at(-1)?.atMs ?? 0;
        if (duration > 0 && this.timeMs >= duration) {
            if (this.options.loop) {
                this.timeMs %= duration;
                this.index = 0;
                while (this.index < this.cues.length && this.cues[this.index].atMs <= this.timeMs) {
                    due.push({ ...this.cues[this.index] });
                    this.index++;
                }
            }
            else
                this.playing = false;
        }
        return due;
    }
    get currentTimeMs() { return this.timeMs; }
    get isPlaying() { return this.playing; }
}
