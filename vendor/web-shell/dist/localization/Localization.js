export class LocalizationRegistry {
    options;
    tables = new Map();
    missingKeys = new Set();
    locale;
    constructor(options) {
        this.options = options;
        this.locale = options.defaultLocale;
    }
    register(locale, table) { this.tables.set(locale, { ...(this.tables.get(locale) ?? {}), ...table }); }
    setLocale(locale) { this.locale = locale; }
    getLocale() { return this.locale; }
    has(key, locale = this.locale) { return key in (this.tables.get(locale) ?? {}); }
    t(key, vars = {}) {
        const fallback = this.options.fallbackLocale ?? this.options.defaultLocale;
        const value = this.tables.get(this.locale)?.[key] ?? this.tables.get(fallback)?.[key];
        if (value === undefined) {
            this.missingKeys.add(`${this.locale}:${key}`);
            if (this.options.strict)
                throw new Error(`Missing localization key: ${key} (${this.locale})`);
            return key;
        }
        return value.replace(/\{([\w.-]+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
    }
    missing() { return [...this.missingKeys].sort(); }
    auditKeys(required, locales = this.tables.keys()) {
        const result = {};
        for (const locale of locales) {
            const table = this.tables.get(locale) ?? {};
            const missing = [...required].filter(key => !(key in table));
            if (missing.length)
                result[locale] = missing;
        }
        return result;
    }
}
export function pseudoLocalize(text, expansion = 0.35) {
    const map = { a: "á", e: "ë", i: "ï", o: "ô", u: "ü", A: "Á", E: "Ë", I: "Ï", O: "Ö", U: "Û" };
    const transformed = [...text].map(c => map[c] ?? c).join("");
    const pad = "~".repeat(Math.max(1, Math.ceil(text.length * expansion)));
    return `[${transformed}${pad}]`;
}
