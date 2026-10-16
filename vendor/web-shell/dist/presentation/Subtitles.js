import { EventBus } from "../core/EventBus.js";
/** Renderer-neutral timed subtitle scheduler. Presentation subscribes to events. */
export class SubtitlePlayer {
    style;
    events = new EventBus();
    track = null;
    timeMs = 0;
    active = new Set();
    playing = false;
    constructor(style = {}) {
        this.style = style;
    }
    load(track) { this.stop(); this.track = structuredClone(track); this.timeMs = 0; }
    play() { if (this.track)
        this.playing = true; }
    pause() { this.playing = false; }
    stop() { for (const id of this.active)
        this.events.emit("subtitle:hide", { id }); this.active.clear(); this.playing = false; this.timeMs = 0; }
    seek(ms) { this.stop(); this.timeMs = Math.max(0, ms); this.sync(); }
    tick(deltaMs) { if (!this.playing || !this.track || deltaMs <= 0)
        return; this.timeMs += deltaMs; this.sync(); }
    get currentTimeMs() { return this.timeMs; }
    sync() {
        if (!this.track)
            return;
        const should = new Set(this.track.cues.filter(c => c.startMs <= this.timeMs && c.endMs > this.timeMs).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map(c => c.id));
        for (const id of [...this.active])
            if (!should.has(id)) {
                this.active.delete(id);
                this.events.emit("subtitle:hide", { id });
            }
        for (const cue of this.track.cues)
            if (should.has(cue.id) && !this.active.has(cue.id)) {
                this.active.add(cue.id);
                this.events.emit("subtitle:show", structuredClone(cue));
            }
    }
}
