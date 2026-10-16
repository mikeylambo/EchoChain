export interface Camera {
  x: number;
  y: number;
  targetX: number;
  shakeTime: number;
  shakeIntensity: number;
  zoom: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  alpha: number;
  vy: number;
  life: number;
  maxLife: number;
  crit?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  drag: number;
  gravity?: number;
}

export interface SlashArc {
  x: number;
  y: number;
  radius: number;
  angle0: number;
  angle1: number;
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

export interface ChainPulse {
  fromSlot: number;
  toSlot: number;
  color: string;
  progress: number; // 0..1
  life: number;
}

export const THEME = {
  bgDark: "#090a0f",
  bgLane: "#12141c",
  laneLine: "#25293a",
  gridLine: "rgba(255, 255, 255, 0.04)",
  fighter: "#f3f4f6",
  fighterGlow: "rgba(255, 255, 255, 0.4)",
  overdrive: "#f59e0b",
  precision: "#f59e0b", // Gold
  momentum: "#ef4444",  // Crimson
  resonance: "#a855f7", // Violet
  force: "#ef4444",     // Crimson alias
  flow: "#06b6d4",      // Cyan alias
  enemyNormal: "#e2e8f0",
  enemyElite: "#f97316",
  enemyBoss: "#ec4899",
  healthGreen: "#10b981",
  healthRed: "#ef4444",
  syncReady: "#fbbf24",
};

export function familyColor(family: string): string {
  if (family === "precision") return THEME.precision;
  if (family === "momentum" || family === "force") return THEME.momentum;
  if (family === "resonance") return THEME.resonance;
  return THEME.flow;
}

