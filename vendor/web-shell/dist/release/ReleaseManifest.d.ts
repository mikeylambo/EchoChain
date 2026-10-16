export type ReleaseChannel = "development" | "demo" | "preview" | "release";
export interface ReleaseManifest {
    gameId: string;
    version: string;
    channel: ReleaseChannel;
    buildId?: string;
    commit?: string;
    demo?: boolean;
    supportedInputs?: string[];
    supportedLocales?: string[];
    requiredFeatures?: string[];
    notes?: string[];
}
export declare function validateReleaseManifest(manifest: ReleaseManifest): string[];
