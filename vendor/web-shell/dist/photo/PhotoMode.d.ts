import { EventBus } from "../core/EventBus.js";
export interface PhotoModeState {
    active: boolean;
    hideHud: boolean;
    timeScale: number;
    exposure: number;
    fov?: number;
    roll?: number;
    filterId?: string;
}
export interface PhotoModeEvents {
    "photo:enter": PhotoModeState;
    "photo:change": PhotoModeState;
    "photo:exit": PhotoModeState;
    "photo:capture": PhotoModeState;
    [key: string]: unknown;
}
export declare class PhotoModeController {
    readonly events: EventBus<PhotoModeEvents>;
    private state;
    enter(overrides?: Partial<Omit<PhotoModeState, "active">>): PhotoModeState;
    patch(changes: Partial<Omit<PhotoModeState, "active">>): PhotoModeState;
    capture(): void;
    exit(): PhotoModeState;
    snapshot(): PhotoModeState;
}
