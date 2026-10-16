const makeSessionId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export class TelemetryRecorder {
    events = [];
    maxEvents;
    clock;
    startedAt;
    sessionId;
    context;
    constructor(options = {}) {
        this.maxEvents = Math.max(100, options.maxEvents ?? 10000);
        this.clock = options.clock ?? (() => performance.now());
        this.startedAt = this.clock();
        this.sessionId = options.sessionId ?? makeSessionId();
        this.context = { ...(options.context ?? {}) };
    }
    setContext(values) { this.context = { ...this.context, ...values }; }
    record(name, data = {}) {
        const event = { seq: this.events.length ? this.events[this.events.length - 1].seq + 1 : 1, name, atMs: Math.max(0, this.clock() - this.startedAt), sessionId: this.sessionId, data: { ...this.context, ...data } };
        this.events.push(event);
        if (this.events.length > this.maxEvents)
            this.events.splice(0, this.events.length - this.maxEvents);
        return event;
    }
    snapshot() { return this.events.map(e => ({ ...e, data: { ...e.data } })); }
    clear() { this.events.length = 0; }
    exportJSON(pretty = true) { return JSON.stringify({ schemaVersion: 1, sessionId: this.sessionId, events: this.events }, null, pretty ? 2 : 0); }
    exportCSV() {
        const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
        return ["seq,name,atMs,sessionId,data", ...this.events.map(e => [e.seq, quote(e.name), e.atMs.toFixed(3), quote(e.sessionId), quote(JSON.stringify(e.data))].join(","))].join("\n");
    }
}
