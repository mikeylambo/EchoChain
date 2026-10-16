import { defaultAccessibility } from "./Accessibility.js";
export const accessibilityPresets = {
    default: { ...defaultAccessibility },
    "reduced-motion": { ...defaultAccessibility, reducedMotion: true, screenShake: 0, flashes: 0, vibration: false },
    "low-stimulation": { ...defaultAccessibility, reducedMotion: true, screenShake: 0.2, flashes: 0.2, vibration: false },
    "high-readability": { ...defaultAccessibility, highContrastUI: true, textScale: 1.25, screenShake: 0.6, flashes: 0.5 }
};
export function applyAccessibilityPreset(id, overrides = {}) {
    return { ...accessibilityPresets[id], ...overrides };
}
