export class ModeManager {
    modes = new Map();
    activeId = null;
    register(modes) {
        for (const mode of modes)
            this.modes.set(mode.id, structuredClone(mode));
    }
    replace(modes) {
        this.modes.clear();
        this.activeId = null;
        this.register(modes);
    }
    activate(id) {
        const mode = this.modes.get(id);
        if (!mode)
            throw new Error(`Unknown mode: ${id}`);
        this.activeId = id;
        return structuredClone(mode);
    }
    active() {
        return this.activeId ? structuredClone(this.modes.get(this.activeId) ?? null) : null;
    }
    list() {
        return [...this.modes.values()].map((x) => structuredClone(x));
    }
}
