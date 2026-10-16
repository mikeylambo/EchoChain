export interface RunDescriptor {
    schemaVersion: 1;
    runId: string;
    gameId: string;
    version: string;
    modeId?: string;
    levelId?: string;
    difficultyId?: string;
    seed?: string | number;
    challengeKey?: string;
    startedAt: string;
    metadata?: Record<string, string | number | boolean>;
}
export interface RunDescriptorInput extends Omit<RunDescriptor, "schemaVersion" | "runId" | "startedAt"> {
    runId?: string;
    startedAt?: string;
}
export declare function createRunDescriptor(input: RunDescriptorInput): RunDescriptor;
export declare function runMetadata(run: RunDescriptor): Record<string, string | number | boolean>;
