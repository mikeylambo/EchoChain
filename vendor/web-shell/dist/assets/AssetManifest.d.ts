export type AssetKind = "audio" | "image" | "texture" | "model" | "font" | "data" | "video" | "other";
export type AssetTier = "core" | "deferred" | "mobile" | "desktop" | "optional";
export interface AssetRecord {
    key: string;
    url: string;
    kind: AssetKind;
    bytes?: number;
    tier?: AssetTier;
    fallbackKey?: string;
    license?: string;
    source?: string;
    metadata?: Record<string, string | number | boolean>;
}
export declare class AssetManifest {
    private readonly records;
    register(record: AssetRecord): void;
    upsert(record: AssetRecord): void;
    get(key: string): AssetRecord | undefined;
    require(key: string): AssetRecord;
    list(filter?: {
        kind?: AssetKind;
        tier?: AssetTier;
    }): AssetRecord[];
    validate(): string[];
    totalBytes(filter?: {
        kind?: AssetKind;
        tier?: AssetTier;
    }): number;
}
