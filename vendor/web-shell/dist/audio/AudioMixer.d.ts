import type { AudioBusName, AudioSystem } from "./AudioContract.js";
export declare const STANDARD_AUDIO_BUSES: readonly ["master", "music", "sfx", "ui", "voice", "ambience"];
export type StandardAudioBus = (typeof STANDARD_AUDIO_BUSES)[number];
export interface AudioMixSnapshot {
    id: string;
    volumes?: Partial<Record<StandardAudioBus, number>>;
    muted?: boolean;
}
/** Renderer/audio-engine-neutral mix state. Games supply AudioSystem; shell owns consistent bus policy. */
export declare class AudioMixer {
    private readonly audio;
    private readonly base;
    private readonly modifiers;
    private muted;
    constructor(audio: AudioSystem);
    setVolume(bus: AudioBusName, value: number): void;
    getVolume(bus: AudioBusName): number;
    setMuted(muted: boolean): void;
    get isMuted(): boolean;
    pushModifier(id: string, volumes: Partial<Record<StandardAudioBus, number>>): void;
    removeModifier(id: string): boolean;
    applySnapshot(snapshot: AudioMixSnapshot): void;
    duck(id: string, buses: readonly StandardAudioBus[], amount: number): () => void;
    snapshot(): {
        muted: boolean;
        volumes: Record<string, number>;
        effective: Record<string, number>;
        modifiers: string[];
    };
    private effective;
    private apply;
    private applyAll;
    private clamp;
}
