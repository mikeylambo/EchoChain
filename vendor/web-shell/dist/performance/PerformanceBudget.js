export function evaluatePerformanceBudget(metrics, budget) {
    const violations = [];
    for (const key of Object.keys(budget)) {
        const limit = budget[key];
        const actual = metrics[key];
        if (limit === undefined || actual === undefined)
            continue;
        const exceeds = key === "fps" ? actual < limit : actual > limit;
        if (exceeds)
            violations.push({ metric: key, actual, budget: limit, ratio: key === "fps" ? limit / Math.max(actual, 0.0001) : actual / Math.max(limit, 0.0001) });
    }
    return { ok: violations.length === 0, violations };
}
export class FrameTimeSampler {
    maxSamples;
    samples = [];
    constructor(maxSamples = 240) {
        this.maxSamples = maxSamples;
    }
    push(frameMs) { if (Number.isFinite(frameMs) && frameMs >= 0) {
        this.samples.push(frameMs);
        if (this.samples.length > this.maxSamples)
            this.samples.shift();
    } }
    summary() {
        if (!this.samples.length)
            return { count: 0, meanMs: 0, p95Ms: 0, worstMs: 0, fps: 0 };
        const sorted = [...this.samples].sort((a, b) => a - b);
        const meanMs = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
        const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
        const worstMs = sorted.at(-1) ?? 0;
        return { count: this.samples.length, meanMs, p95Ms, worstMs, fps: meanMs > 0 ? 1000 / meanMs : 0 };
    }
}
