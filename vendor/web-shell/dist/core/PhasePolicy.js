export class PhasePolicy {
    allowed;
    constructor(allowed) {
        this.allowed = allowed;
    }
    allows(from, to) { return from === to || (this.allowed[from]?.includes(to) ?? false); }
    assert(from, to) { if (!this.allows(from, to))
        throw new Error(`Invalid game phase transition: ${from} -> ${to}`); }
}
export const productionPhasePolicy = new PhasePolicy({
    boot: ["title", "menu", "loading", "error"],
    title: ["menu", "loading", "error"],
    menu: ["title", "loading", "playing", "error"],
    loading: ["playing", "menu", "error"],
    playing: ["paused", "results", "loading", "menu", "error"],
    paused: ["playing", "menu", "loading", "error"],
    results: ["menu", "loading", "playing", "error"],
    error: ["title", "menu", "loading"]
});
