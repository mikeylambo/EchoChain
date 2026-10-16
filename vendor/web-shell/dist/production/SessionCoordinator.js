import { createRunDescriptor, runMetadata } from "../game/RunDescriptor.js";
import { scheduledSeed } from "../game/ScheduledSeeds.js";
/** Coordinates the shared production/platform work around one authoritative run. */
export class ProductionSessionCoordinator {
    options;
    run = null;
    constructor(options) {
        this.options = options;
    }
    get current() { return this.run ? structuredClone(this.run) : null; }
    async start(input = {}) {
        if (this.run)
            throw new Error(`Run already active: ${this.run.runId}`);
        this.run = createRunDescriptor({ gameId: this.options.build.gameId, version: this.options.build.version, ...input });
        const metadata = runMetadata(this.run);
        this.options.telemetry.setContext(metadata);
        this.options.telemetry.record("run.start", metadata);
        await this.options.platform.presence.setPresence("playing", this.presenceDetails(this.run));
        return structuredClone(this.run);
    }
    async startScheduled(cadence, input = {}, date = new Date()) {
        const scheduled = scheduledSeed(this.options.build.gameId, cadence, date);
        return this.start({ ...input, seed: scheduled.seed, challengeKey: scheduled.key, metadata: { ...(input.metadata ?? {}), cadence } });
    }
    async unlockAchievement(id) {
        const unlocked = await this.options.production.achievements.unlock(id);
        if (unlocked)
            this.options.telemetry.record("run.achievement", { id, ...this.requireRunMetadata() });
        return unlocked;
    }
    async end(result = {}) {
        const run = this.requireRun();
        const metadata = { ...runMetadata(run), ...(result.metadata ?? {}) };
        this.options.telemetry.record("run.end", { ...metadata, outcome: result.outcome ?? "complete", ...(result.score === undefined ? {} : { score: result.score }) });
        if (result.leaderboard && result.score !== undefined)
            await this.options.platform.leaderboards.submit(result.leaderboard, result.score, metadata);
        await this.options.flush?.();
        await this.options.platform.presence.setPresence(result.presence ?? "menu", { gameId: run.gameId });
        this.run = null;
        return structuredClone(run);
    }
    async abandon(reason = "abandoned") { return this.end({ outcome: reason }); }
    ghostMetadata(extra = {}) {
        return { ...this.requireRunMetadata(), ...extra };
    }
    requireRun() { if (!this.run)
        throw new Error("No active run"); return this.run; }
    requireRunMetadata() { return runMetadata(this.requireRun()); }
    presenceDetails(run) {
        return Object.fromEntries(Object.entries({ mode: run.modeId, level: run.levelId, difficulty: run.difficultyId, challenge: run.challengeKey }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    }
}
