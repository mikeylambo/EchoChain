import { EventBus } from "../core/EventBus.js";
/** Emits presentation intentions without depending on a renderer or camera implementation. */
export class CinematicDirector {
    events = new EventBus();
    emit(directive) { this.events.emit("cinematic:directive", structuredClone(directive)); }
    emitMany(directives) { for (const directive of directives)
        this.emit(directive); }
}
