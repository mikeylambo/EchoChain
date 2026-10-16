import { LocalizationRegistry } from "./Localization.js";
/**
 * Strict registry for player-facing text. A string must declare why it exists before
 * it can be resolved. Decorative system names, taglines, and filler have no purpose
 * category and therefore do not belong here unless the game explicitly approves them
 * as essential fiction.
 */
export class PlayerCopyCatalog {
    localization;
    defaultLocale;
    entries = new Map();
    usage = new Map();
    constructor(localization, defaultLocale = "en") {
        this.localization = localization;
        this.defaultLocale = defaultLocale;
    }
    register(entries) {
        const table = {};
        for (const entry of entries) {
            if (this.entries.has(entry.key))
                throw new Error(`Duplicate player copy key: ${entry.key}`);
            if (!entry.defaultText.trim())
                throw new Error(`Player copy '${entry.key}' is empty`);
            this.entries.set(entry.key, { ...entry });
            table[entry.key] = entry.defaultText;
        }
        this.localization.register(this.defaultLocale, table);
    }
    text(key, vars = {}) {
        if (!this.entries.has(key))
            throw new Error(`Unregistered player-facing copy: ${key}`);
        this.usage.set(key, (this.usage.get(key) ?? 0) + 1);
        return this.localization.t(key, vars);
    }
    entry(key) { const value = this.entries.get(key); return value ? { ...value } : undefined; }
    keys() { return [...this.entries.keys()].sort(); }
    audit(locales = [this.localization.getLocale()]) {
        const keys = this.keys();
        return { registered: keys.length, used: [...this.usage.values()].filter(count => count > 0).length, unused: keys.filter(key => (this.usage.get(key) ?? 0) === 0), missingLocalization: this.localization.auditKeys(keys, locales) };
    }
}
export function createPlayerCopyCatalog(entries, options = {}) {
    const locale = options.locale ?? "en";
    const localization = new LocalizationRegistry({ defaultLocale: locale, fallbackLocale: locale, strict: options.strict ?? true });
    const catalog = new PlayerCopyCatalog(localization, locale);
    catalog.register(entries);
    return catalog;
}
