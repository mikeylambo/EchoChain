export interface MobileViewportOptions {
    rootSelector?: string;
    background?: string;
    includeSafeAreaPadding?: boolean;
    styleId?: string;
}
/** Installs one shared dynamic-viewport/safe-area policy for standalone mobile web games. */
export declare function installMobileViewportPolicy(options?: MobileViewportOptions): () => void;
