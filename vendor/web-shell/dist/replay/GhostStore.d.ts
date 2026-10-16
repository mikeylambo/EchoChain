import type { StorageAdapter } from "../persistence/StorageAdapter.js";
import type { CloudSaveService } from "../platform/PlatformServices.js";
import type { GhostRecording } from "./PoseGhost.js";
export interface GhostStore {
    load(id: string): Promise<GhostRecording | null>;
    save(id: string, recording: GhostRecording): Promise<void>;
    remove?(id: string): Promise<void>;
}
/** Persists pose ghosts using any shell StorageAdapter (browser, IndexedDB, memory, etc). */
export declare class StorageGhostStore implements GhostStore {
    private readonly storage;
    private readonly prefix;
    constructor(storage: StorageAdapter, prefix?: string);
    load(id: string): Promise<GhostRecording | null>;
    save(id: string, recording: GhostRecording): Promise<void>;
    remove(id: string): Promise<void>;
}
/** Uses the existing platform cloud-save contract. Playback remains unaware of storage origin. */
export declare class CloudGhostStore implements GhostStore {
    private readonly cloud;
    private readonly prefix;
    constructor(cloud: CloudSaveService, prefix?: string);
    load(id: string): Promise<GhostRecording | null>;
    save(id: string, recording: GhostRecording): Promise<void>;
}
/** Read-through/write-through composition for local-first ghosts with optional cloud persistence. */
export declare class TieredGhostStore implements GhostStore {
    private readonly local;
    private readonly remote?;
    constructor(local: GhostStore, remote?: GhostStore | undefined);
    load(id: string): Promise<GhostRecording | null>;
    save(id: string, recording: GhostRecording): Promise<void>;
    remove(id: string): Promise<void>;
}
