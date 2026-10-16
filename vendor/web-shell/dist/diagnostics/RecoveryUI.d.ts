export interface RecoveryUIOptions {
    root?: HTMLElement;
    message?: string;
    retryLabel?: string;
    menuLabel?: string;
    onRetry?: () => void | Promise<void>;
    onMenu?: () => void | Promise<void>;
}
export interface RecoveryUIHandle {
    show(message?: string): void;
    hide(): void;
    dispose(): void;
}
/** Minimal player-safe recovery surface. Diagnostic detail stays out of player UI. */
export declare function mountRecoveryUI(options?: RecoveryUIOptions): RecoveryUIHandle;
