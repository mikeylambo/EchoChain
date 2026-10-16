export type MessageTable = Record<string, string>;
export interface LocalizationOptions {
    defaultLocale: string;
    fallbackLocale?: string;
    strict?: boolean;
}
export declare class LocalizationRegistry {
    private readonly options;
    private readonly tables;
    private readonly missingKeys;
    private locale;
    constructor(options: LocalizationOptions);
    register(locale: string, table: MessageTable): void;
    setLocale(locale: string): void;
    getLocale(): string;
    has(key: string, locale?: string): boolean;
    t(key: string, vars?: Record<string, string | number>): string;
    missing(): readonly string[];
    auditKeys(required: Iterable<string>, locales?: Iterable<string>): Record<string, string[]>;
}
export declare function pseudoLocalize(text: string, expansion?: number): string;
