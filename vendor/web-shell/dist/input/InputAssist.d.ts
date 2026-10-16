export declare class InputBuffer {
    private readonly windowMs;
    private readonly clock;
    private until;
    constructor(windowMs: number, clock?: () => number);
    press(): void;
    consume(): boolean;
    clear(): void;
}
export declare function applyRadialDeadzone(x: number, y: number, deadzone?: number): {
    x: number;
    y: number;
    magnitude: number;
};
export declare class AnalogHysteresis {
    private readonly enterThreshold;
    private readonly exitThreshold;
    private active;
    constructor(enterThreshold?: number, exitThreshold?: number);
    update(value: number): boolean;
    reset(): void;
}
