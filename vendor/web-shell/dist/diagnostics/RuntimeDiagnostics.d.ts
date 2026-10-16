import type { BuildInfo, JsonValue } from "../core/types.js";
export interface DiagnosticEntry {
    at: string;
    kind: "error" | "warning" | "info";
    message: string;
    stack?: string;
    context?: Record<string, JsonValue>;
}
export interface DiagnosticReport {
    schemaVersion: 1;
    build?: BuildInfo;
    generatedAt: string;
    userAgent?: string;
    url?: string;
    entries: DiagnosticEntry[];
}
export declare class RuntimeDiagnostics {
    private readonly build?;
    private readonly maxEntries;
    private readonly entries;
    private uninstallers;
    constructor(build?: BuildInfo | undefined, maxEntries?: number);
    capture(error: unknown, context?: Record<string, JsonValue>): DiagnosticEntry;
    warn(message: string, context?: Record<string, JsonValue>): DiagnosticEntry;
    info(message: string, context?: Record<string, JsonValue>): DiagnosticEntry;
    private push;
    installGlobalHandlers(): () => void;
    dispose(): void;
    snapshot(): readonly DiagnosticEntry[];
    clear(): void;
    report(): DiagnosticReport;
    exportJSON(pretty?: boolean): string;
}
