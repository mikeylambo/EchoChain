import type { FormId } from "../data/forms";
import type { Pose } from "../sim/types";

/**
 * Procedural ink-figure rig. Local space faces +x, canvas y-down, hip at (0,0), feet near y = +38.
 * Limb angles are measured from straight down; positive swings forward (+x).
 * Forearm / shin angles are relative bends.
 */
export interface Rig {
  lean: number;
  bob: number;
  aFu: number; aFl: number;
  aBu: number; aBl: number;
  lFu: number; lFl: number;
  lBu: number; lBl: number;
  weapon: number; // absolute, radians from +x (canvas y-down)
  weaponB: number; // phantom off-hand dagger
  smear: number; // 0..1 slash smear intensity
  smearFrom: number;
  smearTo: number;
  crouch: number;
}

const BASE: Rig = {
  lean: 0.1, bob: 0, aFu: 0.55, aFl: 0.9, aBu: -0.25, aBl: 0.5,
  lFu: 0.28, lFl: -0.32, lBu: -0.32, lBl: -0.05, weapon: 0.55, weaponB: 2.4,
  smear: 0, smearFrom: 0, smearTo: 0, crouch: 0,
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x: number) => 1 - (1 - x) ** 3;
const easeIn = (x: number) => x * x * x;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mix(a: Rig, b: Partial<Rig>, t: number): Rig {
  const o = { ...a };
  for (const k of Object.keys(b) as (keyof Rig)[]) o[k] = lerp(a[k], b[k] as number, t);
  return o;
}

function idle(t: number): Rig {
  const br = Math.sin(t * 2.4);
  return { ...BASE, bob: br * 1.1, aFu: 0.55 + br * 0.04, aBu: -0.25 - br * 0.05, crouch: 1 + br * 0.5 };
}

function walk(t: number, rate = 1.25): Rig {
  const p = t * Math.PI * 2 * rate;
  const s = Math.sin(p);
  return {
    ...BASE,
    lean: 0.16,
    bob: -Math.abs(Math.cos(p)) * 2.4,
    lFu: 0.48 * s,
    lFl: -0.7 * Math.max(0, Math.sin(p + 1.7)) - 0.05,
    lBu: -0.48 * s,
    lBl: -0.7 * Math.max(0, Math.sin(p + Math.PI + 1.7)) - 0.05,
    aFu: 0.4 - 0.32 * s,
    aFl: 0.9,
    aBu: -0.1 + 0.36 * s,
    aBl: 0.7,
    weapon: 0.75 - 0.25 * s,
  };
}

const WIND: Partial<Rig> = { lean: -0.08, aFu: -2.5, aFl: 0.3, weapon: -2.35, aBu: 0.5, lFu: 0.2, lBu: -0.25 };
const SLASH: Partial<Rig> = { lean: 0.42, aFu: 1.45, aFl: 0.15, weapon: 0.95, aBu: -0.9, aBl: 0.4, lFu: 0.78, lFl: -0.1, lBu: -0.75, lBl: -0.1, crouch: 5 };

function strike(t: number): Rig {
  const base = idle(t);
  if (t < 0.06) return mix(base, WIND, ease(t / 0.06));
  if (t < 0.13) {
    const k = easeIn(clamp01((t - 0.06) / 0.07));
    const r = mix(mix(base, WIND, 1), SLASH, k);
    r.smear = 1;
    r.smearFrom = -2.35;
    r.smearTo = lerp(-2.35, 0.95, k);
    return r;
  }
  const k = ease(clamp01((t - 0.13) / 0.25));
  const r = mix(mix(base, SLASH, 1), base, k);
  r.smear = Math.max(0, 1 - (t - 0.13) / 0.12);
  r.smearFrom = -2.35;
  r.smearTo = 0.95;
  return r;
}

const HWIND: Partial<Rig> = { lean: -0.2, aFu: -3.0, aFl: 0.1, aBu: -2.8, aBl: 0.1, weapon: -1.75, lFu: 0.35, lBu: -0.35, crouch: -2 };
const HSLAM: Partial<Rig> = { lean: 0.55, aFu: 1.2, aFl: 0.1, aBu: 1.0, aBl: 0.2, weapon: 1.25, lFu: 0.85, lFl: -0.2, lBu: -0.8, lBl: -0.2, crouch: 9 };

function heavy(t: number): Rig {
  const base = idle(t);
  if (t < 0.12) return mix(base, HWIND, ease(t / 0.12));
  if (t < 0.2) {
    const k = easeIn(clamp01((t - 0.12) / 0.08));
    const r = mix(mix(base, HWIND, 1), HSLAM, k);
    r.smear = 1;
    r.smearFrom = -1.75;
    r.smearTo = lerp(-1.75, 1.25, k);
    return r;
  }
  const k = ease(clamp01((t - 0.2) / 0.32));
  const r = mix(mix(base, HSLAM, 1), base, k);
  r.smear = Math.max(0, 1 - (t - 0.2) / 0.14);
  r.smearFrom = -1.75;
  r.smearTo = 1.25;
  return r;
}

function parry(t: number): Rig {
  const P: Partial<Rig> = { lean: -0.05, aFu: -1.0, aFl: 1.1, weapon: -1.45, aBu: 0.2, lFu: 0.45, lFl: -0.3, lBu: -0.5, crouch: 4 };
  const k = t < 0.05 ? ease(t / 0.05) : 1 - ease(clamp01((t - 0.18) / 0.25));
  return mix(idle(t), P, k);
}

function hurt(t: number): Rig {
  const H: Partial<Rig> = { lean: -0.38, aFu: -0.5, aFl: 0.4, aBu: -1.2, aBl: 0.3, lFu: 0.5, lBu: -0.15, weapon: -0.6 };
  const k = t < 0.04 ? ease(t / 0.04) : 1 - ease(clamp01((t - 0.12) / 0.3));
  return mix(idle(t), H, k);
}

function dash(t: number): Rig {
  return { ...walk(t, 2.2), lean: 0.62, aFu: -0.9, aBu: -1.1, weapon: 2.6, crouch: 5 };
}

function victory(t: number): Rig {
  const V: Partial<Rig> = { lean: -0.04, aFu: -2.95, aFl: 0.05, weapon: -1.57, aBu: -0.3, aBl: 0.4, lFu: 0.22, lFl: 0, lBu: -0.22, lBl: 0, crouch: -1 };
  return mix(walk(t), V, ease(clamp01(t / 0.35)));
}

/** Pose override names used by phantom strikes and techniques. */
export type ExtraPose = Pose | "uppercut" | "spike" | "thrust" | "cast" | "lunge";

function uppercut(t: number): Rig {
  const U: Partial<Rig> = { lean: -0.2, aFu: -2.7, aFl: 0.1, weapon: -1.7, aBu: 0.6, lFu: 0.5, lFl: -0.6, lBu: -0.2, crouch: -3 };
  const k = ease(clamp01(t / 0.08));
  const r = mix(mix(idle(t), { aFu: 1.2, weapon: 1.4, crouch: 8, lean: 0.4 }, 1), U, k);
  r.smear = clamp01(1 - (t - 0.08) / 0.12);
  r.smearFrom = 1.4;
  r.smearTo = lerp(1.4, -1.7, k);
  return r;
}

function spike(t: number): Rig {
  const r = heavy(t * 0.75 + 0.06);
  return r;
}

function thrust(t: number): Rig {
  const T: Partial<Rig> = { lean: 0.35, aFu: 1.55, aFl: 0, weapon: 0.02, aBu: -1.0, lFu: 0.85, lFl: -0.05, lBu: -0.8, crouch: 6 };
  const k = t < 0.06 ? easeIn(t / 0.06) : 1 - ease(clamp01((t - 0.12) / 0.2));
  return mix(idle(t), T, k);
}

function cast(t: number): Rig {
  const C: Partial<Rig> = { lean: -0.1, aFu: -1.6, aFl: 0.2, aBu: -1.6, aBl: 0.2, weapon: -1.2, crouch: 2 };
  const k = t < 0.08 ? ease(t / 0.08) : 1 - ease(clamp01((t - 0.2) / 0.25));
  return mix(idle(t), C, k);
}

export function rigFor(pose: ExtraPose, t: number, walkRate = 1.25): Rig {
  switch (pose) {
    case "walk": return walk(t, walkRate);
    case "strike": case "lunge": return strike(t);
    case "heavy": return heavy(t);
    case "parry": return parry(t);
    case "hurt": return hurt(t);
    case "dash": return dash(t);
    case "victory": return victory(t);
    case "uppercut": return uppercut(t);
    case "spike": return spike(t);
    case "thrust": return thrust(t);
    case "cast": return cast(t);
    default: return idle(t);
  }
}

export interface FigureLook {
  form: FormId | "original" | "duplicate";
  /** time for secondary motion (scarf) */
  time: number;
  /** horizontal speed for scarf drag */
  speed?: number;
  smearColor?: string;
  noScarf?: boolean;
}

const UP = 19, LOW = 18, THIGH = 20, SHIN = 19, TORSO = 30;

function seg(x: number, y: number, a: number, l: number): [number, number] {
  return [x + Math.sin(a) * l, y + Math.cos(a) * l];
}

/**
 * Draw a single-colour silhouette into ctx at its current transform (hip at 0,0, facing +x).
 * Everything uses the current fillStyle/strokeStyle so callers can colour it (ink, echo glow, inversion).
 */
export function drawSilhouette(ctx: CanvasRenderingContext2D, r: Rig, look: FigureLook): void {
  const form = look.form;
  const bulk = form === "brawler" ? 1.28 : form === "phantom" ? 0.86 : 1;
  const hipY = -(THIGH + SHIN) * 0.96 + r.bob + r.crouch;
  const hx = 0;
  // legs
  const leg = (u: number, l: number, w: number) => {
    const [kx, ky] = seg(hx, hipY, u, THIGH);
    const [fx, fy] = seg(kx, ky, u + l, SHIN);
    ctx.lineWidth = 8.5 * w;
    line(ctx, hx, hipY, kx, ky);
    ctx.lineWidth = 6.2 * w;
    line(ctx, kx, ky, fx, fy);
    // foot
    ctx.beginPath();
    ctx.moveTo(fx - 2, fy - 2);
    ctx.lineTo(fx + 8 * w, fy + 1);
    ctx.lineTo(fx - 3, fy + 2.5);
    ctx.closePath();
    ctx.fill();
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  leg(r.lBu, r.lBl, bulk * 0.95);

  const nx = hx + Math.sin(r.lean) * TORSO;
  const ny = hipY - Math.cos(r.lean) * TORSO;
  const shx = nx - Math.sin(r.lean) * 3;
  const shy = ny + Math.cos(r.lean) * 3;

  // back arm
  const arm = (u: number, l: number, w: number): [number, number, number] => {
    const ua = u + r.lean * 0.5;
    const [ex, ey] = seg(shx, shy, ua, UP);
    const fa = ua + l;
    const [wx, wy] = seg(ex, ey, fa, LOW);
    ctx.lineWidth = 7 * w;
    line(ctx, shx, shy, ex, ey);
    ctx.lineWidth = 5.5 * w;
    line(ctx, ex, ey, wx, wy);
    return [wx, wy, fa];
  };
  const [bwx, bwy] = arm(r.aBu, r.aBl, bulk * 0.92);
  if (form === "brawler") circle(ctx, bwx, bwy, 5.2);
  if (form === "phantom") blade(ctx, bwx, bwy, r.weaponB, 15, 2.6);

  // scarf / cloak (behind torso)
  if (!look.noScarf) scarf(ctx, nx, ny, look, form);

  // torso
  const hw = 6.2 * bulk, sw = 8.6 * bulk;
  const px = Math.cos(r.lean), py = Math.sin(r.lean);
  ctx.beginPath();
  ctx.moveTo(hx - hw * px, hipY - hw * py);
  ctx.lineTo(hx + hw * px, hipY + hw * py);
  ctx.lineTo(shx + sw * px * 0.9, shy + sw * py * 0.9);
  ctx.quadraticCurveTo(nx, ny - 3, shx - sw * px, shy - sw * py);
  ctx.closePath();
  ctx.fill();
  // belt sash
  ctx.lineWidth = 3;
  line(ctx, hx - hw * px, hipY - hw * py - 2, hx - hw * px - 9, hipY + 6);

  // head
  const hdx = nx + Math.sin(r.lean) * 9.5;
  const hdy = ny - Math.cos(r.lean) * 9.5;
  if (form === "phantom") {
    ctx.beginPath();
    ctx.moveTo(hdx + 7.5, hdy + 2);
    ctx.quadraticCurveTo(hdx + 4, hdy - 11, hdx - 4, hdy - 9);
    ctx.lineTo(hdx - 14, hdy + 4);
    ctx.lineTo(hdx - 5, hdy + 7);
    ctx.closePath();
    ctx.fill();
  } else {
    circle(ctx, hdx, hdy, form === "brawler" ? 8 : 7.2);
    if (form === "duelist" || form === "duplicate" || form === "original") {
      // topknot
      ctx.beginPath();
      ctx.moveTo(hdx - 3, hdy - 6);
      ctx.quadraticCurveTo(hdx - 10, hdy - 12, hdx - 13, hdy - 7);
      ctx.quadraticCurveTo(hdx - 9, hdy - 6, hdx - 6, hdy - 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // front leg
  leg(r.lFu, r.lFl, bulk);

  // front arm + weapon
  const [wx, wy] = arm(r.aFu, r.aFl, bulk);
  if (form === "brawler") {
    circle(ctx, wx, wy, 6.4);
  } else if (form === "phantom") {
    blade(ctx, wx, wy, r.weapon, 17, 2.8);
  } else {
    blade(ctx, wx, wy, r.weapon, form === "original" ? 50 : 44, 3.1);
    // tsuba
    ctx.lineWidth = 3;
    const gx = Math.cos(r.weapon + Math.PI / 2) * 4, gy = Math.sin(r.weapon + Math.PI / 2) * 4;
    line(ctx, wx - gx, wy - gy, wx + gx, wy + gy);
  }

  // slash smear
  if (r.smear > 0.02 && look.smearColor) {
    const reach = form === "brawler" ? 34 : form === "phantom" ? 36 : 60;
    ctx.save();
    ctx.globalAlpha *= r.smear * 0.85;
    ctx.strokeStyle = look.smearColor;
    const a0 = Math.min(r.smearFrom, r.smearTo), a1 = Math.max(r.smearFrom, r.smearTo);
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = (7 - i * 2.2) * (form === "brawler" ? 1.6 : 1);
      ctx.globalAlpha *= 0.8;
      ctx.beginPath();
      ctx.arc(shx, shy, reach - i * 7, a0, a1);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function scarf(ctx: CanvasRenderingContext2D, nx: number, ny: number, look: FigureLook, form: FigureLook["form"]): void {
  const n = form === "phantom" ? 6 : 6;
  const len = form === "phantom" ? 6.5 : form === "brawler" ? 5 : 7.5;
  const drag = Math.min(1.4, 0.35 + (look.speed ?? 0) / 80);
  const t = look.time;
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const x = nx - 2 - k * len * drag;
    const wave = Math.sin(t * 7.5 - k * 0.85) * (0.6 + k * 0.9);
    const y = ny + 1 + k * (2.6 - drag * 1.4) + wave;
    const w = (form === "phantom" ? 7 : 3.2) * (1 - k / (n + 2));
    top.push([x, y - w]);
    bot.push([x, y + w]);
  }
  ctx.beginPath();
  ctx.moveTo(top[0]![0], top[0]![1]);
  for (const p of top) ctx.lineTo(p[0], p[1]);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i]![0], bot[i]![1]);
  ctx.closePath();
  ctx.fill();
  if (form === "phantom") {
    // tattered cloak hem
    ctx.beginPath();
    ctx.moveTo(nx - 2, ny + 2);
    for (let k = 0; k < 5; k++) ctx.lineTo(nx - 6 - k * 3, ny + 26 + (k % 2) * 6 + Math.sin(t * 6 + k) * 2);
    ctx.lineTo(nx + 4, ny + 20);
    ctx.closePath();
    ctx.fill();
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function blade(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, w: number): void {
  const dx = Math.cos(a), dy = Math.sin(a);
  const nx = -dy, ny = dx;
  ctx.beginPath();
  ctx.moveTo(x - dx * 6 + nx * w * 0.5, y - dy * 6 + ny * w * 0.5);
  ctx.lineTo(x + dx * len + nx * w * 0.6, y + dy * len + ny * w * 0.6);
  ctx.lineTo(x + dx * (len + 6), y + dy * (len + 6));
  ctx.lineTo(x + dx * len - nx * w * 0.4, y + dy * len - ny * w * 0.4);
  ctx.lineTo(x - dx * 6 - nx * w * 0.5, y - dy * 6 - ny * w * 0.5);
  ctx.closePath();
  ctx.fill();
}

/** Ink fighter with bone-white rim light. */
export function drawInkFigure(ctx: CanvasRenderingContext2D, r: Rig, look: FigureLook, ink = "#07070a", rim = "#efe9dc"): void {
  ctx.save();
  ctx.fillStyle = rim;
  ctx.strokeStyle = rim;
  ctx.translate(-1.3, -1.6);
  drawSilhouette(ctx, r, { ...look, smearColor: undefined });
  ctx.restore();
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  drawSilhouette(ctx, r, look);
  ctx.restore();
}
