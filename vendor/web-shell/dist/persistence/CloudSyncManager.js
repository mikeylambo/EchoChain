/** Coordinates an existing local save manager with the platform cloud-save provider. */
export class CloudSyncManager {
    local;
    metadataStorage;
    cloud;
    slot;
    clock;
    metaKey;
    constructor(local, metadataStorage, cloud, slot, clock = () => new Date()) {
        this.local = local;
        this.metadataStorage = metadataStorage;
        this.cloud = cloud;
        this.slot = slot;
        this.clock = clock;
        this.metaKey = `cloud-sync:${slot}`;
    }
    async saveLocal(data) {
        await this.local.save(data);
        const meta = await this.metadata();
        await this.writeMeta({ ...meta, dirty: true, updatedAt: this.clock().toISOString() });
    }
    async sync(policy = "newest") {
        const [localData, remoteRaw, meta] = await Promise.all([this.local.load(), this.cloud.load(this.slot), this.metadata()]);
        const remote = this.parseRemote(remoteRaw);
        if (localData === null && !remote)
            return "empty";
        if (localData === null && remote) {
            await this.pull(remote);
            return "downloaded";
        }
        if (localData !== null && !remote) {
            await this.push(localData, meta, 0);
            return "uploaded";
        }
        if (localData === null || !remote)
            return "empty";
        const remoteAdvanced = remote.revision > meta.lastRemoteRevision;
        if (!meta.dirty) {
            if (remoteAdvanced) {
                await this.pull(remote);
                return "downloaded";
            }
            return "synced";
        }
        if (!remoteAdvanced) {
            await this.push(localData, meta, remote.revision);
            return "uploaded";
        }
        const winner = this.resolve(policy, meta.updatedAt, remote.updatedAt);
        if (winner === "cloud") {
            await this.pull(remote);
            return "conflict-cloud";
        }
        await this.push(localData, meta, remote.revision);
        return "conflict-local";
    }
    async metadata() { return (await this.metadataStorage.get(this.metaKey)) ?? { dirty: false, updatedAt: null, lastRemoteRevision: 0 }; }
    resolve(policy, localUpdatedAt, remoteUpdatedAt) {
        if (policy === "local")
            return "local";
        if (policy === "cloud")
            return "cloud";
        if (!localUpdatedAt)
            return "cloud";
        return Date.parse(localUpdatedAt) >= Date.parse(remoteUpdatedAt) ? "local" : "cloud";
    }
    async pull(remote) { await this.local.save(structuredClone(remote.data)); await this.writeMeta({ dirty: false, updatedAt: remote.updatedAt, lastRemoteRevision: remote.revision }); }
    async push(data, meta, remoteRevision) { const updatedAt = meta.updatedAt ?? this.clock().toISOString(); const envelope = { schemaVersion: 1, revision: Math.max(remoteRevision, meta.lastRemoteRevision) + 1, updatedAt, data: structuredClone(data) }; await this.cloud.save(this.slot, envelope); await this.writeMeta({ dirty: false, updatedAt, lastRemoteRevision: envelope.revision }); }
    parseRemote(value) { if (!value || typeof value !== "object")
        return null; const candidate = value; if (candidate.schemaVersion !== 1 || typeof candidate.revision !== "number" || typeof candidate.updatedAt !== "string" || !("data" in candidate))
        return null; return structuredClone(candidate); }
    writeMeta(meta) { return this.metadataStorage.set(this.metaKey, meta); }
}
