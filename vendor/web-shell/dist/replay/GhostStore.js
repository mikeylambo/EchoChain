/** Persists pose ghosts using any shell StorageAdapter (browser, IndexedDB, memory, etc). */
export class StorageGhostStore {
    storage;
    prefix;
    constructor(storage, prefix = "ghost") {
        this.storage = storage;
        this.prefix = prefix;
    }
    load(id) { return this.storage.get(`${this.prefix}:${id}`); }
    save(id, recording) { return this.storage.set(`${this.prefix}:${id}`, recording); }
    remove(id) { return this.storage.remove(`${this.prefix}:${id}`); }
}
/** Uses the existing platform cloud-save contract. Playback remains unaware of storage origin. */
export class CloudGhostStore {
    cloud;
    prefix;
    constructor(cloud, prefix = "ghost") {
        this.cloud = cloud;
        this.prefix = prefix;
    }
    async load(id) { const value = await this.cloud.load(`${this.prefix}:${id}`); return value; }
    save(id, recording) { return this.cloud.save(`${this.prefix}:${id}`, recording); }
}
/** Read-through/write-through composition for local-first ghosts with optional cloud persistence. */
export class TieredGhostStore {
    local;
    remote;
    constructor(local, remote) {
        this.local = local;
        this.remote = remote;
    }
    async load(id) {
        const local = await this.local.load(id);
        if (local)
            return local;
        const remote = await this.remote?.load(id) ?? null;
        if (remote)
            await this.local.save(id, remote);
        return remote;
    }
    async save(id, recording) { await this.local.save(id, recording); await this.remote?.save(id, recording); }
    async remove(id) { await this.local.remove?.(id); await this.remote?.remove?.(id); }
}
