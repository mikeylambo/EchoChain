export class AssetManifest {
    records = new Map();
    register(record) { if (this.records.has(record.key))
        throw new Error(`Duplicate asset key: ${record.key}`); this.records.set(record.key, { ...record, metadata: record.metadata ? { ...record.metadata } : undefined }); }
    upsert(record) { this.records.set(record.key, { ...record, metadata: record.metadata ? { ...record.metadata } : undefined }); }
    get(key) { const value = this.records.get(key); return value ? { ...value, metadata: value.metadata ? { ...value.metadata } : undefined } : undefined; }
    require(key) { const value = this.get(key); if (!value)
        throw new Error(`Unknown asset: ${key}`); return value; }
    list(filter) { return [...this.records.values()].filter(record => (!filter?.kind || record.kind === filter.kind) && (!filter?.tier || record.tier === filter.tier)).map(record => ({ ...record, metadata: record.metadata ? { ...record.metadata } : undefined })); }
    validate() { const issues = []; for (const record of this.records.values()) {
        if (!record.url)
            issues.push(`${record.key}: missing url`);
        if (record.fallbackKey && !this.records.has(record.fallbackKey))
            issues.push(`${record.key}: missing fallback ${record.fallbackKey}`);
    } return issues; }
    totalBytes(filter) { return this.list(filter).reduce((sum, record) => sum + (record.bytes ?? 0), 0); }
}
