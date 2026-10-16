export class RuntimeConfig {
    values;
    sources = new Map();
    constructor(defaults = {}, buildOverrides = {}) {
        this.values = { ...defaults, ...buildOverrides };
        for (const key of Object.keys(defaults))
            this.sources.set(key, "default");
        for (const key of Object.keys(buildOverrides))
            this.sources.set(key, "build");
    }
    set(key, value, source = "local") { this.values[key] = value; this.sources.set(key, source); }
    get(key, fallback) { return (key in this.values ? this.values[key] : fallback); }
    has(key) { return key in this.values; }
    source(key) { return this.sources.get(key); }
    snapshot() { return structuredClone(this.values); }
    applyQuery(search, prefix = "slu.") {
        const params = new URLSearchParams(search);
        for (const [rawKey, rawValue] of params) {
            if (!rawKey.startsWith(prefix))
                continue;
            const key = rawKey.slice(prefix.length);
            let value = rawValue;
            if (rawValue === "true" || rawValue === "false")
                value = rawValue === "true";
            else if (rawValue !== "" && Number.isFinite(Number(rawValue)))
                value = Number(rawValue);
            this.set(key, value, "query");
        }
    }
}
export class FeatureFlags {
    config;
    prefix;
    constructor(config, prefix = "feature.") {
        this.config = config;
        this.prefix = prefix;
    }
    enabled(id, fallback = false) { return Boolean(this.config.get(`${this.prefix}${id}`, fallback)); }
    variant(id, fallback = "control") { return String(this.config.get(`${this.prefix}${id}.variant`, fallback)); }
}
