import type { JsonValue } from "../core/types.js";
export type RuntimeConfigValues = Record<string, JsonValue>;
export declare class RuntimeConfig {
    private readonly values;
    private readonly sources;
    constructor(defaults?: RuntimeConfigValues, buildOverrides?: RuntimeConfigValues);
    set(key: string, value: JsonValue, source?: "local" | "query"): void;
    get<T extends JsonValue>(key: string, fallback: T): T;
    has(key: string): boolean;
    source(key: string): string | undefined;
    snapshot(): RuntimeConfigValues;
    applyQuery(search: string, prefix?: string): void;
}
export declare class FeatureFlags {
    private readonly config;
    private readonly prefix;
    constructor(config: RuntimeConfig, prefix?: string);
    enabled(id: string, fallback?: boolean): boolean;
    variant(id: string, fallback?: string): string;
}
