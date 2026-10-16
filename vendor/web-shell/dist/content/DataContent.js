export class DataContentLoader {
    parser;
    validator;
    constructor(parser, validator) {
        this.parser = parser;
        this.validator = validator;
    }
    parse(input) {
        const raw = typeof input === "string" ? JSON.parse(input) : input;
        if (!raw || typeof raw !== "object")
            throw new Error("Content document must be an object");
        const doc = raw;
        if (typeof doc.schemaVersion !== "number")
            throw new Error("Content document missing schemaVersion");
        if (typeof doc.group !== "string" || !doc.group)
            throw new Error("Content document missing group");
        if (!Array.isArray(doc.entries))
            throw new Error("Content document entries must be an array");
        const entries = doc.entries.map(this.parser);
        const validation = this.validator?.validate(entries) ?? { ok: true, issues: [] };
        return { document: { schemaVersion: doc.schemaVersion, group: doc.group, entries }, validation };
    }
}
export class LiveContentSource {
    revision = 0;
    listeners = new Set();
    bump() { this.revision++; for (const listener of this.listeners)
        listener(this.revision); }
    currentRevision() { return this.revision; }
    onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
