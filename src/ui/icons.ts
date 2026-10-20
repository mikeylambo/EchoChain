/** Inline SVG icon set: chain events and the 24 techniques. All stroke currentColor. */

const EV: Record<string, string> = {
  HIT: '<path d="M6 18L16 4M10 20L20 6"/>',
  CRIT: '<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" fill="currentColor" stroke="none"/>',
  KILL: '<circle cx="12" cy="12" r="8.5"/><path d="M8 8l8 8M16 8l-8 8"/>',
  PARRY: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  LAUNCH: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
  STAGGER: '<path d="M2.5 12l4-5 4 10 4-10 4 10 3-5"/>',
  ANY: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>',
  ENEMY_ATTACK: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  TICK: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  COPIED: '<rect x="4" y="4" width="11" height="11" rx="1.5"/><rect x="9" y="9" width="11" height="11" rx="1.5"/>',
  PASSES: '<path d="M3 12h18M15 6l6 6-6 6"/>',
  CONVERTED: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4"/>',
};

export const EVENT_NAME: Record<string, string> = {
  HIT: "Hit", CRIT: "Crit", KILL: "Kill", PARRY: "Parry", LAUNCH: "Launch", STAGGER: "Stagger", ANY: "Any event",
  ENEMY_ATTACK: "Enemy attack", TICK: "Tick", COPIED: "Copies", PASSES: "Passes on", CONVERTED: "Converts",
};

export function evIcon(type: string, cls = "ev"): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="${EVENT_NAME[type] ?? type}"><title>${EVENT_NAME[type] ?? type}</title>${EV[type] ?? EV.ANY}</svg>`;
}

const T: Record<string, string> = {
  guard: '<path d="M16 4l9 4v8c0 6-4 10-9 12-5-2-9-6-9-12V8z"/><path d="M11 14c2 2 8 2 10 0"/><circle cx="13" cy="11" r="1" fill="currentColor"/><circle cx="19" cy="11" r="1" fill="currentColor"/>',
  read: '<path d="M3 16c4-7 22-7 26 0-4 7-22 7-26 0z"/><circle cx="16" cy="16" r="3.5" fill="currentColor"/>',
  needle: '<path d="M5 27L25 7"/><path d="M21 5l6 0 0 6"/><circle cx="7" cy="25" r="2"/>',
  pinpoint: '<circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="2.5" fill="currentColor"/><path d="M16 3v6M16 23v6M3 16h6M23 16h6"/>',
  sunder: '<path d="M16 4l9 4v8c0 6-4 10-9 12-5-2-9-6-9-12V8z"/><path d="M17 6l-3 7 4 3-3 8"/>',
  executioner: '<path d="M9 4v24"/><path d="M9 6c10 0 16 4 17 11-7 0-13-2-17-5"/>',
  lastlight: '<path d="M16 4c4 6 7 9 7 14a7 7 0 0 1-14 0c0-5 3-8 7-14z"/><path d="M16 14c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z" fill="currentColor"/>',
  riposte: '<path d="M3 16h25M22 10l6 6-6 6"/><path d="M11 8v16M17 9v14"/>',
  launcher: '<path d="M16 27V7M9 14l7-7 7 7"/><path d="M7 27h18"/>',
  juggler: '<circle cx="7" cy="21" r="2.5" fill="currentColor"/><circle cx="16" cy="8" r="2.5" fill="currentColor"/><circle cx="25" cy="21" r="2.5" fill="currentColor"/><path d="M7 17c1-6 4-9 9-9s8 3 9 9" stroke-dasharray="2 3"/>',
  slam: '<path d="M16 3v16M9 12l7 7 7-7"/><path d="M4 27h24M3 22l4 3M29 22l-4 3"/>',
  flurry: '<path d="M5 22L14 6M11 26L20 10M17 28L26 12"/>',
  pursuit: '<path d="M3 10h7M1 16h10M3 22h7"/><path d="M14 8l8 8-8 8M21 8l8 8-8 8"/>',
  shockline: '<path d="M2 22h6l3-9 4 14 4-14 3 9h8"/>',
  tempo: '<path d="M11 24V8l12-3v16"/><circle cx="8" cy="24" r="3" fill="currentColor"/><circle cx="20" cy="21" r="3" fill="currentColor"/>',
  overdrive: '<path d="M5 22a11 11 0 1 1 22 0"/><path d="M16 22l7-8"/><circle cx="16" cy="22" r="2" fill="currentColor"/>',
  mirror: '<path d="M16 3v26" stroke-dasharray="2 2.5"/><path d="M13 8L5 16l8 8z"/><path d="M19 8l8 8-8 8z" fill="currentColor"/>',
  amplifier: '<path d="M5 13h5l6-6v18l-6-6H5z"/><path d="M21 11a7 7 0 0 1 0 10M24.5 7.5a12 12 0 0 1 0 17"/>',
  prism: '<path d="M14 6L24 24H4z"/><path d="M19 14l10-5M21 17l9 0M19 20l10 5"/>',
  inverse: '<circle cx="16" cy="16" r="11"/><path d="M16 5a11 11 0 0 1 0 22z" fill="currentColor"/>',
  doppel: '<circle cx="11" cy="9" r="3.5"/><path d="M5 26c0-6 3-10 6-10s6 4 6 10"/><circle cx="21" cy="11" r="3" fill="currentColor"/><path d="M16 27c0-5 2-8 5-8s5 3 5 8" fill="currentColor"/>',
  bell: '<path d="M8 23c2-2 2-6 2-10a6 6 0 0 1 12 0c0 4 0 8 2 10z"/><path d="M6 23h20M14 27h4"/>',
  harvest: '<path d="M23 6a11 11 0 1 0 3 13 8 8 0 1 1-3-13z"/><path d="M6 28l7-7"/>',
  burning: '<path d="M3 27h26"/><path d="M9 23c-2-3 0-5 2-8 1 3 3 3 3 6s-2 2-5 2zM18 23c-2-3 0-7 3-10 1 4 4 5 4 7s-3 3-7 3z"/>',
};

export function techIcon(id: string, cls = "ti"): string {
  return `<svg class="${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${T[id] ?? T.mirror}</svg>`;
}

/** Node glyphs for the road map. */
const N: Record<string, string> = {
  fight: '<path d="M7 25L22 10M22 10h-5M22 10v5"/><path d="M25 25L10 10M10 10h5M10 10v5"/>',
  elite: '<path d="M16 3l3.5 8.5L28 13l-6.5 6 2 9-7.5-4.5L8.5 28l2-9L4 13l8.5-1.5z"/>',
  boss: '<path d="M5 24l3-14 5 6 3-10 3 10 5-6 3 14z"/><path d="M5 27h22"/>',
  forge: '<path d="M6 20h20l-3 6H9z"/><path d="M10 20c0-5 2-8 6-8s6 3 6 8"/><path d="M16 4v5M10 6l2 4M22 6l-2 4"/>',
  rest: '<path d="M8 26c-1-5 2-7 4-11 1 4 4 5 4 8M16 26c0-4 3-7 6-12 1 5 3 7 3 12"/><path d="M5 27h22"/>',
};

export function nodeIcon(type: string, cls = "ni"): string {
  return `<svg class="${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${N[type] ?? N.fight}</svg>`;
}

export const UI_ICON = {
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  speed1: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l10 7-10 7z"/></svg>',
  speed2: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5l9 7-9 7zM12 5l9 7-9 7z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h11M4 12h7M4 17h13"/><path d="M18 4l2 3-2 3M14 14l3 3-3 3"/></svg>',
};
