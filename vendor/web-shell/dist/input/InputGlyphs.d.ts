export type InputDeviceFamily = "keyboard-mouse" | "xbox" | "playstation" | "nintendo" | "touch" | "generic-gamepad";
export interface InputGlyph {
    action: string;
    family: InputDeviceFamily;
    label: string;
    assetId?: string;
}
export declare class InputGlyphRegistry {
    private readonly glyphs;
    private family;
    register(glyphs: readonly InputGlyph[]): void;
    setFamily(family: InputDeviceFamily): void;
    get activeFamily(): InputDeviceFamily;
    resolve(action: string, family?: InputDeviceFamily): InputGlyph | null;
    private key;
}
