export type SeedCadence = "daily" | "weekly";
export interface ScheduledSeed {
    cadence: SeedCadence;
    key: string;
    seed: number;
    startsAt: string;
    endsAt: string;
}
export declare function scheduledSeed(gameId: string, cadence: SeedCadence, date?: Date): ScheduledSeed;
