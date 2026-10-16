import type { AudioSystem } from "./AudioContract.js";
export interface AudioLifecycleOptions {
    pauseOnHidden?: boolean;
    pauseOnGamePause?: boolean;
}
/** Coordinates browser visibility and shell pause state with a game's audio
 * implementation. Prevents loops/music continuing behind pause menus or after
 * tab blur without forcing a specific WebAudio implementation. */
export declare class AudioLifecycleCoordinator {
    private readonly audio;
    private readonly pauseOnHidden;
    private readonly pauseOnGamePause;
    private hidden;
    private gamePaused;
    private suspended;
    private detachVisibility;
    constructor(audio: AudioSystem, options?: AudioLifecycleOptions);
    installVisibility(documentRef?: Document | undefined): () => void;
    setGamePaused(paused: boolean): void;
    dispose(): void;
    private sync;
}
