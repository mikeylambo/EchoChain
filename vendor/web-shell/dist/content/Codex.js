import { EventBus } from "../core/EventBus.js";
export class CodexManager {
    events = new EventBus();
    entries = new Map();
    unlocked = new Set();
    read = new Set();
    register(entries) { for (const entry of entries)
        this.entries.set(entry.id, structuredClone(entry)); }
    unlock(id) {
        const entry = this.entries.get(id);
        if (!entry)
            throw new Error(`Unknown codex entry: ${id}`);
        if (this.unlocked.has(id))
            return false;
        this.unlocked.add(id);
        this.events.emit("codex:unlocked", structuredClone(entry));
        return true;
    }
    markRead(id) { if (!this.unlocked.has(id))
        throw new Error(`Codex entry is locked: ${id}`); if (!this.read.has(id)) {
        this.read.add(id);
        this.events.emit("codex:read", { id });
    } }
    isUnlocked(id) { return this.unlocked.has(id); }
    isRead(id) { return this.read.has(id); }
    list(category) { return [...this.entries.values()].filter(entry => (!category || entry.category === category) && this.unlocked.has(entry.id)).map(entry => structuredClone(entry)); }
    snapshot() { return { unlocked: [...this.unlocked], read: [...this.read] }; }
    hydrate(state) {
        this.unlocked.clear();
        this.read.clear();
        for (const id of state.unlocked ?? [])
            if (this.entries.has(id))
                this.unlocked.add(id);
        for (const id of state.read ?? [])
            if (this.unlocked.has(id))
                this.read.add(id);
    }
}
