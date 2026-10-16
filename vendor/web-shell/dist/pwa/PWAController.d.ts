import { EventBus } from "../core/EventBus.js";
export interface PWAEvents {
    "pwa:online": undefined;
    "pwa:offline": undefined;
    "pwa:install-available": undefined;
    "pwa:installed": undefined;
    "pwa:update-ready": {
        registration: ServiceWorkerRegistration;
    };
    "pwa:registered": {
        registration: ServiceWorkerRegistration;
    };
    [key: string]: unknown;
}
/** Browser PWA lifecycle: connectivity, install prompt, SW registration and update readiness. */
export declare class PWAController {
    readonly events: EventBus<PWAEvents>;
    private installPrompt;
    private registration;
    private detachFns;
    attach(windowRef?: Window): () => void;
    register(scriptUrl: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistration | null>;
    promptInstall(): Promise<"accepted" | "dismissed" | "unavailable">;
    activateWaitingUpdate(): boolean;
    checkForUpdate(): Promise<void>;
    get canInstall(): boolean;
    get isOnline(): boolean;
    get currentRegistration(): ServiceWorkerRegistration | null;
    detach(): void;
}
