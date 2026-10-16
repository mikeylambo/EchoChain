import { LocalizationRegistry } from "./Localization.js";
export type PlayerCopyPurpose = "action" | "state" | "consequence" | "navigation" | "instruction" | "fiction";
export interface PlayerCopyEntry {
    key: string;
    purpose: PlayerCopyPurpose;
    defaultText: string;
    notes?: string;
}
export interface PlayerCopyAudit {
    registered: number;
    used: number;
    unused: string[];
    missingLocalization: Record<string, string[]>;
}
/**
 * Strict registry for player-facing text. A string must declare why it exists before
 * it can be resolved. Decorative system names, taglines, and filler have no purpose
 * category and therefore do not belong here unless the game explicitly approves them
 * as essential fiction.
 */
export declare class PlayerCopyCatalog {
    readonly localization: LocalizationRegistry;
    private readonly defaultLocale;
    private readonly entries;
    private readonly usage;
    constructor(localization: LocalizationRegistry, defaultLocale?: string);
    register(entries: readonly PlayerCopyEntry[]): void;
    text(key: string, vars?: Record<string, string | number>): string;
    entry(key: string): PlayerCopyEntry | undefined;
    keys(): string[];
    audit(locales?: Iterable<string>): PlayerCopyAudit;
}
export declare function createPlayerCopyCatalog(entries: readonly PlayerCopyEntry[], options?: {
    locale?: string;
    strict?: boolean;
}): PlayerCopyCatalog;
