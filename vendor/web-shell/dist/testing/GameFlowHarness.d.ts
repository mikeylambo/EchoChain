import { type SmokeReport } from "./FlowSmoke.js";
export interface FlowHarnessAdapter {
    boot(): void | Promise<void>;
    openMenu?(): void | Promise<void>;
    startGame(): void | Promise<void>;
    pause(): void | Promise<void>;
    resume(): void | Promise<void>;
    finishRun?(): void | Promise<void>;
    openResults?(): void | Promise<void>;
    retry?(): void | Promise<void>;
    quit(): void | Promise<void>;
    phase(): string;
}
export interface FlowHarnessOptions {
    expected?: Partial<Record<"boot" | "menu" | "play" | "pause" | "resume" | "results" | "retry" | "quit", string>>;
    includeResults?: boolean;
    includeRetry?: boolean;
}
/** Canonical automated shell flow: boot -> menu -> play -> pause -> resume -> results -> retry -> quit. */
export declare function runCanonicalGameFlow(adapter: FlowHarnessAdapter, options?: FlowHarnessOptions): Promise<SmokeReport>;
