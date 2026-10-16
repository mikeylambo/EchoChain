import { EventBus } from "../core/EventBus.js";
/** Renderer-neutral dialogue/cutscene state machine. Rendering, VO playback,
 * camera work and objective changes subscribe to emitted events. */
export class NarrativeDirector {
    events = new EventBus();
    sequences = new Map();
    active = null;
    index = -1;
    elapsedMs = 0;
    waitingForChoice = false;
    register(sequence) {
        if (!sequence.id)
            throw new Error("Narrative sequence requires an id");
        if (sequence.beats.length === 0)
            throw new Error(`Narrative sequence ${sequence.id} has no beats`);
        this.sequences.set(sequence.id, structuredClone(sequence));
    }
    play(id) {
        const sequence = this.sequences.get(id);
        if (!sequence)
            throw new Error(`Unknown narrative sequence: ${id}`);
        if (this.active)
            this.end(false);
        this.active = structuredClone(sequence);
        this.index = 0;
        this.elapsedMs = 0;
        this.waitingForChoice = false;
        this.events.emit("narrative:start", { sequenceId: id });
        const beat = this.current;
        if (!beat)
            throw new Error(`Narrative sequence ${id} has no playable beat`);
        this.emitBeat(beat);
        return structuredClone(beat);
    }
    tick(deltaMs) {
        const beat = this.current;
        if (!this.active || !beat || this.waitingForChoice || deltaMs <= 0)
            return;
        const duration = beat.durationMs;
        if (duration === undefined)
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= duration)
            this.advance();
    }
    advance() {
        if (!this.active)
            return null;
        const beat = this.current;
        if (beat?.choices?.length) {
            this.waitingForChoice = true;
            return structuredClone(beat);
        }
        this.index++;
        this.elapsedMs = 0;
        this.waitingForChoice = false;
        const next = this.current;
        if (!next) {
            this.end(false);
            return null;
        }
        this.emitBeat(next);
        return structuredClone(next);
    }
    choose(choiceId) {
        if (!this.active || !this.current)
            throw new Error("No active narrative choice");
        const beat = this.current;
        const choice = beat.choices?.find(item => item.id === choiceId);
        if (!choice)
            throw new Error(`Unknown narrative choice: ${choiceId}`);
        this.events.emit("narrative:choice", { sequenceId: this.active.id, beatId: beat.id, choice: structuredClone(choice) });
        this.waitingForChoice = false;
        this.elapsedMs = 0;
        if (choice.nextBeatId) {
            const nextIndex = this.active.beats.findIndex(item => item.id === choice.nextBeatId);
            if (nextIndex < 0)
                throw new Error(`Unknown target beat: ${choice.nextBeatId}`);
            this.index = nextIndex;
            const next = this.current;
            if (next)
                this.emitBeat(next);
            return next ? structuredClone(next) : null;
        }
        return this.advance();
    }
    skip() {
        if (!this.active || this.active.skippable === false)
            return false;
        this.end(true);
        return true;
    }
    stop() { if (this.active)
        this.end(false); }
    get current() { return this.active?.beats[this.index] ?? null; }
    get sequenceId() { return this.active?.id ?? null; }
    get isActive() { return this.active !== null; }
    get awaitingChoice() { return this.waitingForChoice; }
    emitBeat(beat) {
        if (!this.active)
            return;
        this.waitingForChoice = !!beat.choices?.length;
        this.events.emit("narrative:beat", { sequenceId: this.active.id, beat: structuredClone(beat), index: this.index });
    }
    end(skipped) {
        const sequenceId = this.active?.id;
        if (!sequenceId)
            return;
        this.active = null;
        this.index = -1;
        this.elapsedMs = 0;
        this.waitingForChoice = false;
        this.events.emit("narrative:end", { sequenceId, skipped });
    }
}
