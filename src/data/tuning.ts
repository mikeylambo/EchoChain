/** GDD §12 starting values. Everything numeric that designers might tune lives here. */
export const TUNING = {
  simHz: 60,
  fighterHp: 100,
  phantomHp: 70,
  echoDelay: 0.22, // seconds per slot of history delay
  echoSpacing: 46, // px formation offset per slot so a standing trail stays readable
  echoCooldown: 0.35,
  linkBeatMs: 60,
  syncFreeze: 0.4,
  syncChargeMax: 120,
  startSlots: 2,
  maxSlots: 6,
  maxSlotsWithSeal: 7,
  maxPacket: 12, // cap on events in one packet so multipliers can't explode
  critMult: 2,
  baseCrit: 0.12,
  rankMult: [1, 1.5, 2] as const,
  betweenFightHeal: 0.14,
  restHeal: 0.4,
  strikeRange: 64,
  marchSpeed: 70, // px/s
  /** gait ladder: distance to the next enemy → speed multiplier (with hysteresis) */
  gait: { runGap: 200, dashGap: 420, run: 1.9, dash: 3.4, hyst: 30 },
  enemyGap: 30,
  hitstop: { hit: 0.04, crit: 0.08, chain5: 0.12 },
  draftWeights: { echo: 0.55, rank: 0.3, seal: 0.15 },
  actHp: [1, 2.3, 4.6] as const,
  actDmg: [1, 1.35, 1.75] as const,
  originalLinkRule: 3,
  originalStaggerChain: 5,
  originalBufferMs: 1000,
} as const;

export const DT = 1 / TUNING.simHz;
export const MS_PER_TICK = 1000 / TUNING.simHz;
