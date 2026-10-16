export class EventFlags {
    values = {};
    listeners = new Set();
    constructor(initial = {}) { Object.assign(this.values, structuredClone(initial)); }
    set(key, value) { this.values[key] = structuredClone(value); for (const listener of this.listeners)
        listener(key, value); }
    get(key, fallback) { return (key in this.values ? structuredClone(this.values[key]) : fallback); }
    has(key) { return key in this.values; }
    delete(key) { if (!(key in this.values))
        return; delete this.values[key]; for (const listener of this.listeners)
        listener(key, undefined); }
    matches(predicate) { return predicate(this.snapshot()); }
    snapshot() { return structuredClone(this.values); }
    restore(snapshot) { for (const key of Object.keys(this.values))
        delete this.values[key]; Object.assign(this.values, structuredClone(snapshot)); }
    onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
export const flagEquals = (key, expected) => flags => JSON.stringify(flags[key]) === JSON.stringify(expected);
export const flagAll = (...predicates) => flags => predicates.every(predicate => predicate(flags));
export const flagAny = (...predicates) => flags => predicates.some(predicate => predicate(flags));
