import { EventBus } from "../core/EventBus.js";
/** Browser PWA lifecycle: connectivity, install prompt, SW registration and update readiness. */
export class PWAController {
    events = new EventBus();
    installPrompt = null;
    registration = null;
    detachFns = [];
    attach(windowRef = window) {
        this.detach();
        const online = () => this.events.emit("pwa:online", undefined);
        const offline = () => this.events.emit("pwa:offline", undefined);
        const beforeInstall = (event) => { event.preventDefault(); this.installPrompt = event; this.events.emit("pwa:install-available", undefined); };
        const installed = () => { this.installPrompt = null; this.events.emit("pwa:installed", undefined); };
        windowRef.addEventListener("online", online);
        windowRef.addEventListener("offline", offline);
        windowRef.addEventListener("beforeinstallprompt", beforeInstall);
        windowRef.addEventListener("appinstalled", installed);
        this.detachFns = [() => windowRef.removeEventListener("online", online), () => windowRef.removeEventListener("offline", offline), () => windowRef.removeEventListener("beforeinstallprompt", beforeInstall), () => windowRef.removeEventListener("appinstalled", installed)];
        return () => this.detach();
    }
    async register(scriptUrl, options) {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
            return null;
        const registration = await navigator.serviceWorker.register(scriptUrl, options);
        this.registration = registration;
        this.events.emit("pwa:registered", { registration });
        const inspect = () => { const worker = registration.waiting; if (worker)
            this.events.emit("pwa:update-ready", { registration }); };
        inspect();
        registration.addEventListener("updatefound", () => { const worker = registration.installing; if (!worker)
            return; worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller)
            inspect(); }); });
        return registration;
    }
    async promptInstall() {
        const prompt = this.installPrompt;
        if (!prompt)
            return "unavailable";
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted")
            this.installPrompt = null;
        return choice.outcome;
    }
    activateWaitingUpdate() { const worker = this.registration?.waiting; if (!worker)
        return false; worker.postMessage({ type: "SKIP_WAITING" }); return true; }
    async checkForUpdate() { await this.registration?.update(); }
    get canInstall() { return this.installPrompt !== null; }
    get isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine; }
    get currentRegistration() { return this.registration; }
    detach() { for (const fn of this.detachFns)
        fn(); this.detachFns = []; }
}
