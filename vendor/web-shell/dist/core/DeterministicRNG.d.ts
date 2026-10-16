export declare function stableHashString(value: string): number;
export declare class DeterministicRng {
    private stateValue;
    private draws;
    constructor(seed: number);
    next(): number;
    range(min: number, max: number): number;
    int(min: number, max: number): number;
    chance(probability: number): boolean;
    pick<T>(items: readonly T[]): T;
    weighted<T>(items: readonly T[], weights: readonly number[]): T;
    shuffle<T>(items: T[]): T[];
    get cursor(): number;
    get state(): number;
}
/** Independent named streams prevent one subsystem's random draws from perturbing another. */
export declare class DeterministicRngRegistry<TName extends string = string> {
    private readonly names;
    private readonly streams;
    private masterSeed;
    private seedText;
    constructor(names: readonly TName[]);
    init(seed: number | string): void;
    stream(name: TName): DeterministicRng;
    cursors(): Record<string, number>;
    states(): Record<string, number>;
    snapshot(): {
        seed: string;
        masterSeed: number;
        cursors: Record<string, number>;
        states: Record<string, number>;
    };
    static freshSeed(length?: number): string;
}
