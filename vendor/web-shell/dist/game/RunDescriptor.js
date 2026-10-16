import { stableHashString } from "../core/DeterministicRNG.js";
export function createRunDescriptor(input) {
    const startedAt = input.startedAt ?? new Date().toISOString();
    const identity = [input.gameId, input.version, input.modeId ?? "", input.levelId ?? "", input.difficultyId ?? "", String(input.seed ?? ""), input.challengeKey ?? "", startedAt].join("|");
    return {
        schemaVersion: 1,
        runId: input.runId ?? `${input.gameId}-${stableHashString(identity).toString(36)}`,
        gameId: input.gameId,
        version: input.version,
        modeId: input.modeId,
        levelId: input.levelId,
        difficultyId: input.difficultyId,
        seed: input.seed,
        challengeKey: input.challengeKey,
        startedAt,
        metadata: input.metadata ? { ...input.metadata } : undefined
    };
}
export function runMetadata(run) {
    return Object.fromEntries(Object.entries({ runId: run.runId, gameId: run.gameId, version: run.version, modeId: run.modeId, levelId: run.levelId, difficultyId: run.difficultyId, seed: run.seed, challengeKey: run.challengeKey }).filter(([, value]) => value !== undefined));
}
