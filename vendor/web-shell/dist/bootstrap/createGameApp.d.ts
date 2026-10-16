import type { RendererAdapter } from "../adapters/RendererAdapter.js";
import { BrowserStorage } from "../platform/browser/BrowserStorage.js";
import { BrowserInputFamilyDetector } from "../platform/browser/InputFamilyDetector.js";
import { type MobileViewportOptions } from "../platform/browser/MobileViewport.js";
import { PWAController } from "../pwa/PWAController.js";
import { SettingsStore } from "../persistence/SettingsStore.js";
import { SLUWebShell } from "../Shell.js";
import type { ProductionServicesOptions } from "../studio/ProductionServices.js";
import type { AudioSystem } from "../audio/AudioContract.js";
import { AudioLifecycleCoordinator } from "../audio/AudioLifecycle.js";
import { AudioMixer } from "../audio/AudioMixer.js";
import { AssemblyComposer } from "../assemblies/AssemblyComposer.js";
import { DOMGameUI } from "../ui-shell/DOMGameUI.js";
import { GameFlowController, type GameFlowOptions } from "../ui-shell/GameFlowController.js";
import type { FrameAssembly } from "../assemblies/types.js";
export interface CreateGameAppOptions {
    gameId: string;
    gameName: string;
    version: string;
    renderer: RendererAdapter;
    root: HTMLElement;
    assemblies: Array<(shell: SLUWebShell<any>) => FrameAssembly>;
    flow?: GameFlowOptions;
    production?: ProductionServicesOptions;
    audio?: AudioSystem;
    mobileViewport?: false | MobileViewportOptions;
    pwa?: false | {
        serviceWorkerUrl?: string;
        scope?: string;
    };
}
export declare function createGameApp(options: CreateGameAppOptions): Promise<{
    shell: SLUWebShell<import("../index.js").CoreSettings>;
    composer: AssemblyComposer;
    ui: DOMGameUI;
    flow: GameFlowController;
    storage: BrowserStorage;
    settings: SettingsStore<import("../index.js").CoreSettings>;
    audioMixer: AudioMixer | null;
    audioLifecycle: AudioLifecycleCoordinator | null;
    unbindAudioSettings: (() => void) | null;
    inputFamily: BrowserInputFamilyDetector;
    pwa: PWAController | null;
    removeViewportPolicy: (() => void) | null;
}>;
