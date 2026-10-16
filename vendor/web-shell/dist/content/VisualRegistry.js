/**
 * Renderer-neutral registry for presentation factories.
 *
 * The shell owns naming/lifecycle only. Three.js, Babylon, Phaser, DOM, Canvas,
 * and future renderers provide their own visual type and mounting adapter.
 * Gameplay must never read presentation geometry back into authoritative state.
 */
export class VisualRegistry {
    entries = new Map();
    register(key, registration) {
        assertVisualKey(key);
        if (this.entries.has(key))
            throw new Error(`Visual key already registered: ${key}`);
        this.entries.set(key, registration);
    }
    replace(key, registration) {
        assertVisualKey(key);
        this.entries.set(key, registration);
    }
    unregister(key) {
        return this.entries.delete(key);
    }
    has(key) {
        return this.entries.has(key);
    }
    get(key) {
        return this.entries.get(key);
    }
    keys() {
        return [...this.entries.keys()].sort();
    }
    create(key, context) {
        const registration = this.entries.get(key);
        if (!registration)
            return null;
        const visual = registration.factory(context);
        let disposed = false;
        return {
            key,
            visual,
            registration,
            update: (dt, nextContext) => {
                if (!disposed)
                    registration.update?.(visual, dt, nextContext);
            },
            dispose: () => {
                if (disposed)
                    return;
                disposed = true;
                registration.dispose?.(visual);
            }
        };
    }
}
export function createVisualRegistry() {
    return new VisualRegistry();
}
function assertVisualKey(key) {
    if (!key.trim())
        throw new Error("Visual key must be non-empty");
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(key)) {
        throw new Error(`Invalid visual key: ${key}`);
    }
}
