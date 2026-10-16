export type GyroLookMode = "off" | "always" | "conditional";
export interface GyroLookOptions {
    sensitivity?: number;
    mode?: GyroLookMode;
    condition?: () => boolean;
}
/** Orientation-aware device-motion look source generalized from Traversal FPS. */
export declare class GyroLook {
    private readonly options;
    private x;
    private y;
    private enabled;
    private permission;
    private mode;
    private sensitivity;
    constructor(options?: GyroLookOptions);
    requestPermission(): Promise<boolean>;
    attach(target?: Window): () => void;
    setMode(mode: GyroLookMode): void;
    setSensitivity(value: number): void;
    consume(): {
        x: number;
        y: number;
    };
    get granted(): boolean;
    private onMotion;
}
