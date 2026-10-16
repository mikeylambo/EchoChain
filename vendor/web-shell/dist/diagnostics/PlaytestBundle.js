const clone = (value) => {
    try {
        return structuredClone(value);
    }
    catch {
        return JSON.parse(JSON.stringify(value));
    }
};
/**
 * Creates one portable snapshot for crashes, bug reports and playtests.
 * Optional game-specific providers (RNG/replay/ghost/game state) remain opt-in,
 * while the shell-owned diagnostic surface is always present.
 */
export function createPlaytestBundle(input) {
    const { build, phase, levelId, inputFamily, settings, production, studio, clock, ...extras } = input;
    return {
        schemaVersion: 1,
        generatedAt: (clock?.() ?? new Date()).toISOString(),
        build: clone(build),
        runtime: { phase, levelId, inputFamily },
        settings: clone(settings),
        production: clone(production),
        studio: clone(studio),
        run: extras.run ? clone(extras.run) : null,
        ...(extras.rng === undefined ? {} : { rng: clone(extras.rng) }),
        ...(extras.replay === undefined ? {} : { replay: clone(extras.replay) }),
        ...(extras.ghost === undefined ? {} : { ghost: clone(extras.ghost) }),
        ...(extras.game === undefined ? {} : { game: clone(extras.game) }),
        ...(extras.environment === undefined ? {} : { environment: clone(extras.environment) }),
        ...(extras.notes === undefined ? {} : { notes: extras.notes })
    };
}
export function exportPlaytestBundle(bundle, pretty = true) {
    return JSON.stringify(bundle, null, pretty ? 2 : 0);
}
