export type CertificationStatus = "pass" | "fail" | "skip";
export interface CertificationCheckResult {
    status: CertificationStatus;
    name: string;
    message?: string;
    durationMs: number;
}
export type CertificationCheck = () => void | boolean | string | Promise<void | boolean | string>;
export interface CertificationProfile {
    name: string;
    checks: Record<string, CertificationCheck>;
}
export interface CertificationReport {
    profile: string;
    ok: boolean;
    startedAt: string;
    finishedAt: string;
    results: CertificationCheckResult[];
}
export declare class CertificationRunner {
    run(profile: CertificationProfile): Promise<CertificationReport>;
}
export declare const mergeCertificationProfiles: (name: string, ...profiles: CertificationProfile[]) => CertificationProfile;
