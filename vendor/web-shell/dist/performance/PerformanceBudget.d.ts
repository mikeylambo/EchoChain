export interface PerformanceMetrics {
    frameMs?: number;
    fps?: number;
    drawCalls?: number;
    triangles?: number;
    textureBytes?: number;
    heapBytes?: number;
    bundleBytes?: number;
}
export interface PerformanceBudget extends PerformanceMetrics {
}
export interface BudgetViolation {
    metric: keyof PerformanceMetrics;
    actual: number;
    budget: number;
    ratio: number;
}
export interface BudgetReport {
    ok: boolean;
    violations: BudgetViolation[];
}
export declare function evaluatePerformanceBudget(metrics: PerformanceMetrics, budget: PerformanceBudget): BudgetReport;
export declare class FrameTimeSampler {
    private readonly maxSamples;
    private samples;
    constructor(maxSamples?: number);
    push(frameMs: number): void;
    summary(): {
        count: number;
        meanMs: number;
        p95Ms: number;
        worstMs: number;
        fps: number;
    };
}
