export class CreditsRegistry {
    document = { entries: [] };
    set(document) { this.document = structuredClone(document); }
    add(entry) { this.document.entries.push(structuredClone(entry)); }
    snapshot() { return structuredClone(this.document); }
    sections() { return [...new Set(this.document.entries.map(entry => entry.section ?? "Credits"))]; }
    bySection(section) { return this.document.entries.filter(entry => (entry.section ?? "Credits") === section).map(entry => structuredClone(entry)); }
}
