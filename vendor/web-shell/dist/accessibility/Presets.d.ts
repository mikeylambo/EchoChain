import { type AccessibilitySettings } from "./Accessibility.js";
export type AccessibilityPresetId = "default" | "reduced-motion" | "low-stimulation" | "high-readability";
export declare const accessibilityPresets: Record<AccessibilityPresetId, AccessibilitySettings>;
export declare function applyAccessibilityPreset(id: AccessibilityPresetId, overrides?: Partial<AccessibilitySettings>): AccessibilitySettings;
