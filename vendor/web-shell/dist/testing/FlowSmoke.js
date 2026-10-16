export async function runSmokeFlow(steps) {
    const results = [];
    for (const step of steps) {
        const start = performance.now();
        try {
            await step.run();
            const assertion = step.assert ? await step.assert() : true;
            const ok = assertion === true;
            results.push({ label: step.label, ok, message: typeof assertion === "string" ? assertion : ok ? undefined : "assertion failed", durationMs: performance.now() - start });
        }
        catch (error) {
            results.push({ label: step.label, ok: false, message: error instanceof Error ? error.message : String(error), durationMs: performance.now() - start });
        }
    }
    return { ok: results.every(result => result.ok), results };
}
