import type { CoreSettings, SettingsStore } from "../persistence/SettingsStore.js";
import type { AudioMixer } from "./AudioMixer.js";
/** Keeps canonical CoreSettings and the shared mixer aligned. */
export declare function bindAudioSettings(settings: SettingsStore<CoreSettings>, mixer: AudioMixer): () => void;
