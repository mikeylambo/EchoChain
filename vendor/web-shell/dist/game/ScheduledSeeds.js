import { stableHashString } from "../core/DeterministicRNG.js";
function startOfUtcDay(date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function startOfUtcWeek(date) { const day = startOfUtcDay(date); const weekday = (day.getUTCDay() + 6) % 7; day.setUTCDate(day.getUTCDate() - weekday); return day; }
export function scheduledSeed(gameId, cadence, date = new Date()) {
    const start = cadence === "daily" ? startOfUtcDay(date) : startOfUtcWeek(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (cadence === "daily" ? 1 : 7));
    const key = `${cadence}:${start.toISOString().slice(0, 10)}`;
    return { cadence, key, seed: stableHashString(`${gameId}:${key}`), startsAt: start.toISOString(), endsAt: end.toISOString() };
}
