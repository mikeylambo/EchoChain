import type { Enemy } from "../sim/types";

/** Hard geometric slate silhouettes. Drawn facing +x in local space; caller flips to face the fighter. */
export const SLATE = "#262a34";
export const SLATE_RIM = "#7a8394";
export const SLATE_EYE = "#efe9dc";

type Shape = (ctx: CanvasRenderingContext2D, e: Enemy, t: number, w: number) => void;

/** Device-space eye position recorded while the shape draws (so the glint sits on the head through any rotation). */
export const eyeOut = { x: 0, y: 0, ok: false };
const markEye = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const m = ctx.getTransform();
  eyeOut.x = m.a * x + m.c * y + m.e;
  eyeOut.y = m.b * x + m.d * y + m.f;
  eyeOut.ok = true;
};

const poly = (ctx: CanvasRenderingContext2D, pts: number[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.closePath();
  ctx.fill();
};

const legs = (ctx: CanvasRenderingContext2D, t: number, hip: number, len: number, spread: number, w: number, walking: number) => {
  const p = t * 9;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  for (const s of [1, -1]) {
    const a = Math.sin(p) * 0.5 * s * walking;
    ctx.beginPath();
    ctx.moveTo(spread * s * 0.3, -hip);
    ctx.lineTo(spread * s * 0.3 + Math.sin(a) * len, -hip + Math.cos(a) * len);
    ctx.stroke();
  }
};

const husk: Shape = (ctx, e, t, wk) => {
  const wind = e.state === "windup" ? 1 : 0;
  legs(ctx, t, 20, 21, 10, 7, wk);
  ctx.save();
  ctx.translate(0, -20);
  ctx.rotate(0.35 - wind * 0.45);
  poly(ctx, [-11, 2, 11, 2, 14, -26, 2, -34, -12, -24]);
  // head (triangle)
  poly(ctx, [4, -30, 20, -36, 8, -46]);
  markEye(ctx, 11, -37);
  // club arm
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(8, -22);
  const a = wind ? -1.9 : 0.4 + Math.sin(t * 9) * 0.15;
  ctx.lineTo(8 + Math.cos(a) * 22, -22 + Math.sin(a) * 22);
  ctx.stroke();
  ctx.restore();
};

const bulwark: Shape = (ctx, e, t, wk) => {
  const wind = e.state === "windup" ? 1 : 0;
  legs(ctx, t * 0.7, 22, 23, 18, 10, wk);
  ctx.save();
  ctx.translate(0, -22);
  ctx.rotate(0.1 - wind * 0.2);
  poly(ctx, [-18, 2, 16, 2, 18, -36, 6, -48, -16, -40]);
  // helm
  poly(ctx, [-4, -44, 12, -46, 14, -58, 0, -64, -8, -56]);
  markEye(ctx, 8, -54);
  ctx.restore();
  if (e.shield) {
    // tower shield slab, front
    ctx.save();
    ctx.translate(24 + wind * 6, -36);
    ctx.rotate(-0.06 + wind * 0.25);
    poly(ctx, [-6, -38, 7, -34, 8, 34, -6, 38]);
    ctx.restore();
  }
};

const lancer: Shape = (ctx, e, t, wk) => {
  const wind = e.state === "windup" ? Math.min(1, 1 - e.windupT / 0.7) : 0;
  legs(ctx, t, 26, 27, 8, 6, wk);
  ctx.save();
  ctx.translate(0, -26);
  ctx.rotate(0.08 - wind * 0.3);
  poly(ctx, [-7, 2, 7, 2, 8, -34, 0, -40, -8, -32]);
  // head: tall spike
  poly(ctx, [-4, -38, 6, -40, 1, -60]);
  markEye(ctx, 2, -45);
  // spear
  const a = -0.25 - wind * 1.1;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(a) * 26, -24 - Math.sin(a) * 26);
  ctx.lineTo(Math.cos(a) * 34, -24 + Math.sin(a) * 34);
  ctx.stroke();
  ctx.translate(Math.cos(a) * 34, -24 + Math.sin(a) * 34);
  ctx.rotate(a);
  poly(ctx, [0, -4, 14, 0, 0, 4]);
  ctx.restore();
};

const splitter: Shape = (ctx, e, t, wk) => {
  legs(ctx, t, 18, 19, 10, 6, wk);
  ctx.save();
  ctx.translate(0, -40);
  ctx.rotate(Math.sin(t * 3) * 0.08 + (e.state === "windup" ? -0.4 : 0));
  poly(ctx, [0, -26, 20, 0, 0, 24, -20, 0]);
  markEye(ctx, 6, -6);
  ctx.restore();
};

const splitling: Shape = (ctx, e, t) => {
  const hop = Math.abs(Math.sin(t * 10)) * 6;
  ctx.save();
  ctx.translate(0, -14 - hop);
  ctx.rotate(Math.sin(t * 10) * 0.25);
  poly(ctx, [0, -14, 11, 0, 0, 13, -11, 0]);
  markEye(ctx, 3, -3);
  ctx.restore();
};

const mimic: Shape = (ctx, e, t, wk) => {
  legs(ctx, t, 22, 23, 10, 7, wk);
  ctx.save();
  ctx.translate(0, -22);
  ctx.rotate(0.12 + (e.state === "windup" ? -0.35 : 0));
  poly(ctx, [-12, 2, 12, 2, 13, -30, 0, -38, -13, -30]);
  // hex mask
  const r = 11;
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) pts.push(4 + Math.cos(i * Math.PI / 3) * r, -48 + Math.sin(i * Math.PI / 3) * r);
  poly(ctx, pts);
  markEye(ctx, 7, -48);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(8, -26);
  ctx.lineTo(26, -14 + Math.sin(t * 8) * 4);
  ctx.stroke();
  ctx.restore();
};

const SHAPES: Partial<Record<Enemy["kind"], Shape>> = { husk, bulwark, lancer, splitter, splitling, mimic };

export function drawEnemyShape(ctx: CanvasRenderingContext2D, e: Enemy, t: number, fill: string, walking: number): void {
  const s = SHAPES[e.kind];
  if (!s) return;
  eyeOut.ok = false;
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  s(ctx, e, t, walking);
}

/** Approximate visual height in local units (for HP bars / numbers). */
export function enemyHeight(kind: Enemy["kind"]): number {
  return { husk: 60, bulwark: 88, lancer: 90, splitter: 70, splitling: 32, mimic: 76, duplicate: 96, original: 100 }[kind];
}
