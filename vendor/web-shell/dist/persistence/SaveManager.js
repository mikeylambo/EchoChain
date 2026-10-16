import { stableHashString } from "../core/DeterministicRNG.js";
const checksum = (schemaVersion, data) => stableHashString(JSON.stringify({ schemaVersion, data })).toString(16).padStart(8, "0");
export class SaveManager {
    storage;
    key;
    schemaVersion;
    migrations;
    backupKey;
    stagingKey;
    constructor(storage, key, schemaVersion, migrations = {}) {
        this.storage = storage;
        this.key = key;
        this.schemaVersion = schemaVersion;
        this.migrations = migrations;
        this.backupKey = `${key}:backup`;
        this.stagingKey = `${key}:staging`;
    }
    validateEnvelope(value) {
        if (!value || typeof value !== "object")
            throw new Error("Malformed save envelope");
        const envelope = value;
        if (!Number.isInteger(envelope.schemaVersion) || Number(envelope.schemaVersion) < 0)
            throw new Error("Invalid save schema version");
        if (typeof envelope.savedAt !== "string" || Number.isNaN(Date.parse(envelope.savedAt)))
            throw new Error("Invalid save timestamp");
        if (!("data" in envelope))
            throw new Error("Save envelope missing data");
        if (envelope.integrity !== undefined) {
            if (typeof envelope.integrity !== "string")
                throw new Error("Invalid save integrity marker");
            const expected = checksum(envelope.schemaVersion, envelope.data);
            if (envelope.integrity !== expected)
                throw new Error("Save integrity check failed");
        }
        return envelope;
    }
    async readEnvelope(key) {
        const raw = await this.storage.get(key);
        return raw === null ? null : this.validateEnvelope(raw);
    }
    migrateEnvelope(envelope) {
        if (envelope.schemaVersion > this.schemaVersion)
            throw new Error(`Save is newer than runtime: ${envelope.schemaVersion} > ${this.schemaVersion}`);
        let version = envelope.schemaVersion;
        let data = envelope.data;
        while (version < this.schemaVersion) {
            const migrate = this.migrations[version];
            if (!migrate)
                throw new Error(`Missing save migration ${version} -> ${version + 1}`);
            data = migrate(data);
            version++;
        }
        return data;
    }
    async load() { const envelope = await this.readEnvelope(this.key); return envelope ? this.migrateEnvelope(envelope) : null; }
    async loadWithRecovery() {
        const candidates = [];
        let primaryError;
        for (const [source, key] of [["primary", this.key], ["staging", this.stagingKey], ["backup", this.backupKey]]) {
            try {
                const envelope = await this.readEnvelope(key);
                if (envelope)
                    candidates.push({ source, envelope, data: this.migrateEnvelope(envelope) });
            }
            catch (error) {
                if (source === "primary")
                    primaryError = error instanceof Error ? error : new Error(String(error));
            }
        }
        if (candidates.length === 0)
            return { data: null, source: "empty", error: primaryError };
        const priority = { primary: 3, staging: 2, backup: 1 };
        candidates.sort((a, b) => Date.parse(b.envelope.savedAt) - Date.parse(a.envelope.savedAt) || priority[b.source] - priority[a.source]);
        const chosen = candidates[0];
        if (chosen.source === "staging") {
            await this.storage.set(this.key, chosen.envelope);
            await this.storage.remove(this.stagingKey);
        }
        return { data: structuredClone(chosen.data), source: chosen.source, error: primaryError };
    }
    async save(data) {
        const savedAt = new Date().toISOString();
        const envelope = { schemaVersion: this.schemaVersion, savedAt, data: structuredClone(data), integrity: checksum(this.schemaVersion, data) };
        await this.storage.set(this.stagingKey, envelope);
        const staged = await this.readEnvelope(this.stagingKey);
        if (!staged)
            throw new Error("Staged save vanished before commit");
        let previous = null;
        try {
            previous = await this.readEnvelope(this.key);
        }
        catch { /* never preserve a corrupt primary as last-known-good */ }
        if (previous)
            await this.storage.set(this.backupKey, previous);
        await this.storage.set(this.key, staged);
        await this.readEnvelope(this.key); // verify committed bytes before removing recovery staging
        await this.storage.remove(this.stagingKey);
    }
    async restoreBackup() { const backup = await this.readEnvelope(this.backupKey); if (!backup)
        return false; this.migrateEnvelope(backup); await this.storage.set(this.key, backup); return true; }
    async delete() { await this.storage.remove(this.key); await this.storage.remove(this.backupKey); await this.storage.remove(this.stagingKey); }
}
