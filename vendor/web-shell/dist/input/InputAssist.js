export class InputBuffer {
    windowMs;
    clock;
    until = 0;
    constructor(windowMs, clock = () => performance.now()) {
        this.windowMs = windowMs;
        this.clock = clock;
    }
    press() { this.until = this.clock() + Math.max(0, this.windowMs); }
    consume() { if (this.clock() > this.until)
        return false; this.until = 0; return true; }
    clear() { this.until = 0; }
}
export function applyRadialDeadzone(x, y, deadzone = 0.15) {
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude <= deadzone)
        return { x: 0, y: 0, magnitude: 0 };
    const scaled = (magnitude - deadzone) / Math.max(0.0001, 1 - deadzone);
    const nx = magnitude > 0 ? x / magnitude : 0;
    const ny = magnitude > 0 ? y / magnitude : 0;
    return { x: nx * scaled, y: ny * scaled, magnitude: scaled };
}
export class AnalogHysteresis {
    enterThreshold;
    exitThreshold;
    active = false;
    constructor(enterThreshold = 0.6, exitThreshold = 0.4) {
        this.enterThreshold = enterThreshold;
        this.exitThreshold = exitThreshold;
        if (exitThreshold > enterThreshold)
            throw new Error("exitThreshold must be <= enterThreshold");
    }
    update(value) { const magnitude = Math.abs(value); if (this.active) {
        if (magnitude <= this.exitThreshold)
            this.active = false;
    }
    else if (magnitude >= this.enterThreshold)
        this.active = true; return this.active; }
    reset() { this.active = false; }
}
