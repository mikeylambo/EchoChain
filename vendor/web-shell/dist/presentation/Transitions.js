import { EventBus } from "../core/EventBus.js";
export class TransitionManager {
    events = new EventBus();
    active = null;
    start(request) { this.active = structuredClone(request); this.events.emit("transition:start", structuredClone(request)); }
    end(id = this.active?.id) { if (!id || !this.active || this.active.id !== id)
        return false; this.active = null; this.events.emit("transition:end", { id }); return true; }
    get current() { return this.active ? structuredClone(this.active) : null; }
}
