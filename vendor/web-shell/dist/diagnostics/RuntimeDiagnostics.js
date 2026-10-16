export class RuntimeDiagnostics {
    build;
    maxEntries;
    entries = [];
    uninstallers = [];
    constructor(build, maxEntries = 200) {
        this.build = build;
        this.maxEntries = maxEntries;
    }
    capture(error, context) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        return this.push("error", normalized.message, normalized.stack, context);
    }
    warn(message, context) { return this.push("warning", message, undefined, context); }
    info(message, context) { return this.push("info", message, undefined, context); }
    push(kind, message, stack, context) {
        const entry = { at: new Date().toISOString(), kind, message, stack, context };
        this.entries.push(entry);
        if (this.entries.length > this.maxEntries)
            this.entries.splice(0, this.entries.length - this.maxEntries);
        return entry;
    }
    installGlobalHandlers() {
        if (typeof window === "undefined")
            return () => { };
        const onError = (event) => this.capture(event.error ?? event.message, { source: event.filename, line: event.lineno, column: event.colno });
        const onRejection = (event) => this.capture(event.reason, { source: "unhandledrejection" });
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        const uninstall = () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
        this.uninstallers.push(uninstall);
        return uninstall;
    }
    dispose() { for (const off of this.uninstallers.splice(0))
        off(); }
    snapshot() { return this.entries.map(e => ({ ...e, context: e.context ? { ...e.context } : undefined })); }
    clear() { this.entries.length = 0; }
    report() { return { schemaVersion: 1, build: this.build, generatedAt: new Date().toISOString(), userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined, url: typeof location !== "undefined" ? location.href : undefined, entries: [...this.entries] }; }
    exportJSON(pretty = true) { return JSON.stringify(this.report(), null, pretty ? 2 : 0); }
}
