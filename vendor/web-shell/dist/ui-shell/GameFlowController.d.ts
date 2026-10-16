import type { SLUWebShell } from "../Shell.js";
import type { DOMGameUI } from "./DOMGameUI.js";
import type { UIChoice } from "./types.js";
export interface FlowCapabilities {
    stageSelect?: boolean;
    characterSelect?: boolean;
    vehicleSelect?: boolean;
    loadout?: boolean;
    difficulty?: boolean;
}
export interface SettingsExtension {
    choices: (shell: SLUWebShell<any>) => UIChoice[];
    handle: (choiceId: string, shell: SLUWebShell<any>) => boolean | Promise<boolean>;
}
export interface GameFlowOptions {
    settingsExtension?: SettingsExtension;
}
export declare class GameFlowController {
    private readonly shell;
    private readonly ui;
    private readonly caps;
    private readonly options;
    private selectedMode;
    private setupQueue;
    private setupIndex;
    private settingsBackTarget;
    constructor(shell: SLUWebShell<any>, ui: DOMGameUI, caps: FlowCapabilities, options?: GameFlowOptions);
    start(): void;
    onActivate(screenId: string, choiceId: string): void;
    onBack(screenId: string): void;
    showPause(): void;
    showResults(): void;
    private buildSetupQueue;
    private advanceSetup;
    private launch;
    private showSettings;
    private handleSetting;
}
