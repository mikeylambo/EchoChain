export interface SmokeStep {
    label: string;
    run: () => void | Promise<void>;
    assert?: () => boolean | string | Promise<boolean | string>;
}
export interface SmokeStepResult {
    label: string;
    ok: boolean;
    message?: string;
    durationMs: number;
}
export interface SmokeReport {
    ok: boolean;
    results: SmokeStepResult[];
}
export declare function runSmokeFlow(steps: readonly SmokeStep[]): Promise<SmokeReport>;
