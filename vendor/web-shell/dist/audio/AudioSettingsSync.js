/** Keeps canonical CoreSettings and the shared mixer aligned. */
export function bindAudioSettings(settings, mixer) {
    const apply = (value) => {
        mixer.setVolume("master", value.masterVolume);
        mixer.setVolume("music", value.musicVolume);
        mixer.setVolume("sfx", value.sfxVolume);
        mixer.setVolume("ui", value.uiVolume);
        mixer.setMuted(value.muted);
    };
    apply(settings.snapshot());
    return settings.events.on("changed", apply);
}
