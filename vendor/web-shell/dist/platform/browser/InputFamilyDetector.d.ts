import type { InputDeviceFamily } from "../../input/InputGlyphs.js";
export interface InputFamilyDetectorOptions {
    onChange?: (family: InputDeviceFamily) => void;
}
export declare function gamepadFamily(id: string): InputDeviceFamily;
/** Tracks the player's most recently used input family for prompt/glyph switching. */
export declare class BrowserInputFamilyDetector {
    private readonly options;
    private family;
    private detachFns;
    constructor(options?: InputFamilyDetectorOptions);
    attach(windowRef?: Window, documentRef?: Document): () => void;
    sampleGamepads(navigatorRef?: Navigator): InputDeviceFamily;
    set(family: InputDeviceFamily): void;
    get activeFamily(): InputDeviceFamily;
    detach(): void;
}
