export class InputGlyphRegistry {
    glyphs = new Map();
    family = "keyboard-mouse";
    register(glyphs) {
        for (const glyph of glyphs)
            this.glyphs.set(this.key(glyph.action, glyph.family), { ...glyph });
    }
    setFamily(family) { this.family = family; }
    get activeFamily() { return this.family; }
    resolve(action, family = this.family) {
        const exact = this.glyphs.get(this.key(action, family));
        const generic = this.glyphs.get(this.key(action, "generic-gamepad"));
        const keyboard = this.glyphs.get(this.key(action, "keyboard-mouse"));
        return exact ? { ...exact } : generic ? { ...generic } : keyboard ? { ...keyboard } : null;
    }
    key(action, family) { return `${family}:${action}`; }
}
