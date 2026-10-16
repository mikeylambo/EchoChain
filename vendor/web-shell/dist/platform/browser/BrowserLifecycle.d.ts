export interface BrowserLifecycleHandlers {
    onBackground?: () => void;
    onForeground?: () => void;
    onControllerConnected?: (index: number, id: string) => void;
    onControllerDisconnected?: (index: number, id: string) => void;
    onContextLost?: () => void;
    onContextRestored?: () => void;
}
export declare function installBrowserLifecycle(handlers: BrowserLifecycleHandlers, canvas?: HTMLCanvasElement): () => void;
