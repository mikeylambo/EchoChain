export const STANDARD_AUDIO_BUSES = ["master", "music", "sfx", "ui", "voice", "ambience"];
/** Renderer/audio-engine-neutral mix state. Games supply AudioSystem; shell owns consistent bus policy. */
export class AudioMixer {
    audio;
    base = new Map();
    modifiers = new Map();
    muted = false;
    constructor(audio) {
        this.audio = audio;
        for (const bus of STANDARD_AUDIO_BUSES)
            this.base.set(bus, 1);
        this.applyAll();
    }
    setVolume(bus, value) { this.base.set(bus, this.clamp(value)); this.apply(bus); }
    getVolume(bus) { return this.base.get(bus) ?? 1; }
    setMuted(muted) { this.muted = muted; this.audio.setMuted(muted); }
    get isMuted() { return this.muted; }
    pushModifier(id, volumes) { const map = new Map(); for (const [bus, value] of Object.entries(volumes))
        if (value !== undefined)
            map.set(bus, this.clamp(value)); this.modifiers.set(id, map); this.applyAll(); }
    removeModifier(id) { const removed = this.modifiers.delete(id); if (removed)
        this.applyAll(); return removed; }
    applySnapshot(snapshot) { if (snapshot.volumes)
        for (const [bus, value] of Object.entries(snapshot.volumes))
            if (value !== undefined)
                this.setVolume(bus, value); if (snapshot.muted !== undefined)
        this.setMuted(snapshot.muted); }
    duck(id, buses, amount) { this.pushModifier(id, Object.fromEntries(buses.map(bus => [bus, amount]))); return () => this.removeModifier(id); }
    snapshot() { const volumes = Object.fromEntries(this.base); return { muted: this.muted, volumes, effective: Object.fromEntries([...this.base.keys()].map(bus => [bus, this.effective(bus)])), modifiers: [...this.modifiers.keys()] }; }
    effective(bus) { let value = this.base.get(bus) ?? 1; for (const modifier of this.modifiers.values())
        value *= modifier.get(bus) ?? 1; return this.clamp(value); }
    apply(bus) { this.audio.setBusVolume(bus, this.effective(bus)); }
    applyAll() { for (const bus of this.base.keys())
        this.apply(bus); }
    clamp(value) { return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)); }
}
