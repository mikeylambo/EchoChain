import type { StorageAdapter } from "./StorageAdapter.js";
import type { CloudSaveService } from "../platform/PlatformServices.js";
export interface LocalSaveStore<T> {
    load(): Promise<T | null>;
    save(data: T): Promise<void>;
}
export interface CloudSaveEnvelope<T> {
    schemaVersion: 1;
    revision: number;
    updatedAt: string;
    data: T;
}
export interface CloudSyncMetadata {
    dirty: boolean;
    updatedAt: string | null;
    lastRemoteRevision: number;
}
export type CloudConflictPolicy = "newest" | "local" | "cloud";
export type CloudSyncResult = "empty" | "synced" | "uploaded" | "downloaded" | "conflict-local" | "conflict-cloud";
/** Coordinates an existing local save manager with the platform cloud-save provider. */
export declare class CloudSyncManager<T> {
    private readonly local;
    private readonly metadataStorage;
    private readonly cloud;
    private readonly slot;
    private readonly clock;
    private readonly metaKey;
    constructor(local: LocalSaveStore<T>, metadataStorage: StorageAdapter, cloud: CloudSaveService, slot: string, clock?: () => Date);
    saveLocal(data: T): Promise<void>;
    sync(policy?: CloudConflictPolicy): Promise<CloudSyncResult>;
    metadata(): Promise<CloudSyncMetadata>;
    private resolve;
    private pull;
    private push;
    private parseRemote;
    private writeMeta;
}
