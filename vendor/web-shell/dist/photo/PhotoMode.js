import { EventBus } from "../core/EventBus.js";
export class PhotoModeController {
    events = new EventBus();
    state = { active: false, hideHud: true, timeScale: 0, exposure: 1 };
    enter(overrides = {}) {
        this.state = { ...this.state, ...overrides, active: true };
        this.events.emit("photo:enter", this.snapshot());
        return this.snapshot();
    }
    patch(changes) {
        if (!this.state.active)
            throw new Error("Photo mode is not active");
        this.state = { ...this.state, ...changes };
        this.events.emit("photo:change", this.snapshot());
        return this.snapshot();
    }
    capture() { if (!this.state.active)
        throw new Error("Photo mode is not active"); this.events.emit("photo:capture", this.snapshot()); }
    exit() {
        const previous = this.snapshot();
        this.state = { ...this.state, active: false };
        this.events.emit("photo:exit", previous);
        return this.snapshot();
    }
    snapshot() { return { ...this.state }; }
}
