export interface HapticPattern {
    mobile: number | number[];
    duration: number;
    weak: number;
    strong: number;
}
export type HapticCatalog = Record<string, HapticPattern>;
/** Browser-safe haptics bridge generalized from Descent's mobile + gamepad rumble layer. */
export declare class BrowserHaptics {
    private readonly catalog;
    private enabled;
    constructor(catalog?: HapticCatalog);
    setEnabled(enabled: boolean): boolean;
    pulse(id: string): boolean;
    get isEnabled(): boolean;
}
