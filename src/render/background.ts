/**
 * The threshold: procedural space settings. Each region has its own palette, sky feature and floor;
 * every fight rolls a variant (seeded) so no two roads look identical. The sky brightens with the chain.
 */

export interface Theme {
  name: string;
  base: string;
  neb: string[];
  horizon: string; // rgb
  floorTint: string; // rgb
  feature: "moon" | "aurora" | "ring";
  motes: "dust" | "ember" | "snow";
  moteColor: string;
  ridge: string;
  ridgeRim: string;
}

export const THEMES: Theme[] = [
  {
    name: "The Threshold",
    base: "#04030c",
    neb: ["#3a1d8a", "#1b2a8f", "#6b2fa8", "#0d4a8a"],
    horizon: "170,150,255",
    floorTint: "120,100,220",
    feature: "moon",
    motes: "dust",
    moteColor: "200,190,255",
    ridge: "#07061a",
    ridgeRim: "140,120,255",
  },
  {
    name: "The Long Night",
    base: "#020509",
    neb: ["#0b4a5a", "#123a7a", "#5a1440", "#0a6a6a"],
    horizon: "90,220,210",
    floorTint: "60,180,190",
    feature: "aurora",
    motes: "ember",
    moteColor: "150,255,230",
    ridge: "#03080d",
    ridgeRim: "90,220,210",
  },
  {
    name: "The Summit",
    base: "#0a0710",
    neb: ["#6a4a2a", "#8a5a3a", "#3a2a6a", "#a07a4a"],
    horizon: "255,226,170",
    floorTint: "255,210,150",
    feature: "ring",
    motes: "snow",
    moteColor: "255,244,220",
    ridge: "#0d0a0c",
    ridgeRim: "255,220,160",
  },
];

const TAU = Math.PI * 2;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star { x: number; y: number; s: number; tw: number; layer: number }
interface Shoot { x: number; y: number; vx: number; vy: number; life: number }

export class Scene {
  readonly theme: Theme;
  private tile: HTMLCanvasElement;
  private stars: Star[] = [];
  private ridge: number[] = [];
  private shoots: Shoot[] = [];
  private rnd: () => number;
  private hue: number;
  private featX: number;
  private lastT = 0;
  /** 0..1, set by the view from chain length; the sky answers the chain. */
  energy = 0;

  constructor(act: number, variant = 0) {
    this.theme = THEMES[Math.max(0, Math.min(2, act - 1))]!;
    this.rnd = mulberry(act * 7919 + variant * 104729 + 17);
    const r = this.rnd;
    this.hue = (r() - 0.5) * 36;
    this.featX = 0.18 + r() * 0.64;
    this.tile = this.makeTile();
    for (let i = 0; i < 420; i++) this.stars.push({ x: r(), y: r() * 0.95, s: r() ** 5 * 2.6 + 0.5, tw: r() * TAU, layer: r() < 0.6 ? 0 : r() < 0.7 ? 1 : 2 });
    for (let i = 0; i < 64; i++) this.ridge.push(r());
  }

  private makeTile(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 520;
    const g = c.getContext("2d")!;
    g.fillStyle = this.theme.base;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "lighter";
    g.filter = `hue-rotate(${this.hue}deg)`;
    const r = this.rnd;
    for (let i = 0; i < 30; i++) {
      // wrap-safe: draw each cloud twice so the tile tiles horizontally
      const x = r() * c.width, y = r() * c.height * 0.9, rad = 50 + r() * c.width * 0.28;
      for (const ox of [0, -c.width, c.width]) {
        const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad);
        gr.addColorStop(0, this.theme.neb[i % this.theme.neb.length]!);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.14 + r() * 0.24;
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2);
      }
    }
    g.filter = "none";
    g.globalAlpha = 1;
    // fine dust
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.18})`;
      g.fillRect(r() * c.width, r() * c.height, 1, 1);
    }
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, W: number, H: number, groundY: number, t: number, flash = 0): void {
    const dt = Math.max(0, Math.min(0.05, t - this.lastT));
    this.lastT = t;
    const th = this.theme;
    ctx.fillStyle = th.base;
    ctx.fillRect(-40, -40, W + 80, H + 80);

    // nebula tile, slow parallax + drift
    const tw = this.tile.width, scale = (groundY + 40) / this.tile.height;
    const sw = tw * scale;
    let ox = -(((camX * 0.04 + t * 3) % sw) + sw) % sw;
    ctx.globalAlpha = 0.85 + this.energy * 0.35;
    for (; ox < W + 40; ox += sw) ctx.drawImage(this.tile, ox - 20, -20, sw, groundY + 60);
    ctx.globalAlpha = 1;

    // feature
    const fx = W * this.featX - camX * 0.02;
    if (th.feature === "moon") {
      const fy = groundY * 0.3, r = 46;
      glowAt(ctx, fx, fy, r * 6, "200,190,255", 0.35 + this.energy * 0.2);
      ctx.drawImage(crescent(r), fx - r - 2, fy - r - 2);
    } else if (th.feature === "aurora") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let b = 0; b < 3; b++) {
        const g = ctx.createLinearGradient(0, groundY * 0.1, 0, groundY * 0.65);
        const col = b === 1 ? "180,80,200" : th.horizon;
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(0.5, `rgba(${col},${0.12 + this.energy * 0.1})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 16) {
          const y = groundY * (0.25 + b * 0.08) + Math.sin(x * 0.006 + t * 0.4 + b * 2) * 40 + Math.sin(x * 0.017 - t * 0.7) * 14;
          if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let x = W + 20; x >= -20; x -= 16) {
          const y = groundY * (0.48 + b * 0.06) + Math.sin(x * 0.005 + t * 0.3 + b) * 30;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      const fy = groundY * 0.34, r = 54;
      glowAt(ctx, fx, fy, r * 7, "255,230,180", 0.45 + this.energy * 0.25);
      ctx.fillStyle = "#fff8ea";
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill();
      ctx.save();
      ctx.strokeStyle = "rgba(255,240,210,0.5)";
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 2.5 - i * 0.6;
        ctx.beginPath();
        ctx.ellipse(fx, fy, r * (2.2 + i * 0.5), r * (0.42 + i * 0.1), -0.18 + Math.sin(t * 0.2) * 0.02, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    // stars, three parallax layers with twinkle
    for (const s of this.stars) {
      const par = [0.02, 0.06, 0.12][s.layer]!;
      const x = ((((s.x * W * 1.3 - camX * par) % (W * 1.3)) + W * 1.3) % (W * 1.3)) - W * 0.15;
      const y = s.y * groundY;
      const a = 0.45 + 0.55 * Math.sin(t * (1 + s.layer) + s.tw) ** 2;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, s.s, s.s);
      if (s.s > 2.3) {
        ctx.globalAlpha = a * 0.45;
        ctx.fillRect(x - 6, y + s.s / 2 - 0.4, 12 + s.s, 0.8);
        ctx.fillRect(x + s.s / 2 - 0.4, y - 6, 0.8, 12 + s.s);
        ctx.globalAlpha = 1;
      }
    }

    // shooting stars (more as the chain climbs)
    if (this.rnd() < dt * (0.25 + this.energy * 2)) {
      this.shoots.push({ x: this.rnd() * W, y: this.rnd() * groundY * 0.4, vx: -500 - this.rnd() * 400, vy: 150 + this.rnd() * 150, life: 0 });
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.shoots) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const a = Math.max(0, 1 - s.life / 0.7);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      ctx.stroke();
    }
    ctx.restore();
    this.shoots = this.shoots.filter((s) => s.life < 0.7);

    // far ridge with rim light
    const off = camX * 0.18;
    ctx.fillStyle = th.ridge;
    ctx.beginPath();
    ctx.moveTo(-40, groundY + 2);
    const pts: [number, number][] = [];
    for (let x = -40; x <= W + 40; x += 10) {
      const u = (x + off) / 120;
      const i = Math.floor(u), f = u - i;
      const a = this.ridge[((i % 64) + 64) % 64]!, b = this.ridge[(((i + 1) % 64) + 64) % 64]!;
      const h = a + (b - a) * (f * f * (3 - 2 * f));
      const y = groundY - 18 - h * 70;
      pts.push([x, y]);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, groundY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${th.ridgeRim},0.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();

    // horizon glow
    const hg = ctx.createLinearGradient(0, groundY - 60, 0, groundY + 2);
    hg.addColorStop(0, `rgba(${th.horizon},0)`);
    hg.addColorStop(1, `rgba(${th.horizon},${0.32 + this.energy * 0.25})`);
    ctx.fillStyle = hg;
    ctx.fillRect(-40, groundY - 60, W + 80, 62);

    // motes
    for (let i = 0; i < 60; i++) {
      const sx = (i * 97.13) % 1, sy = (i * 61.7) % 1, v = 0.4 + ((i * 13.1) % 1);
      let x: number, y: number;
      if (th.motes === "snow") {
        x = ((sx * W * 1.3 - camX * 0.5 * v - t * 26 * v) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        y = (sy * groundY + t * 34 * v) % groundY;
      } else if (th.motes === "ember") {
        x = ((sx * W * 1.3 - camX * 0.4 * v + Math.sin(t + i) * 18) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        y = groundY - ((sy * groundY * 0.8 + t * 20 * v) % (groundY * 0.8));
      } else {
        x = ((sx * W * 1.3 - camX * 0.3 * v - t * 10 * v) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        y = groundY * (0.3 + sy * 0.7) + Math.sin(t * 0.8 + i) * 10;
      }
      ctx.fillStyle = `rgba(${th.moteColor},${0.25 + 0.3 * Math.sin(t * 1.4 + i) ** 2})`;
      ctx.fillRect(x, y, 1.6 * v, 1.6 * v);
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Floor drawn after the world and its reflection. */
  drawFloor(ctx: CanvasRenderingContext2D, camX: number, W: number, H: number, groundY: number, t: number): void {
    const th = this.theme;
    const fg = ctx.createLinearGradient(0, groundY, 0, H);
    fg.addColorStop(0, "rgba(4,3,10,0.35)");
    fg.addColorStop(0.5, "rgba(4,3,10,0.85)");
    fg.addColorStop(1, "rgba(3,2,7,1)");
    ctx.fillStyle = fg;
    ctx.fillRect(-40, groundY + 2, W + 80, H - groundY + 40);
    // ripples / glints moving with the camera
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const step = 70;
    const start = Math.floor(camX / step) * step;
    for (let wx = start; wx < camX + W + step; wx += step) {
      const h = Math.sin(wx * 12.9898) * 43758.5453;
      const r = h - Math.floor(h);
      const x = wx - camX;
      const y = groundY + 10 + r * (H - groundY - 30);
      const a = (0.05 + 0.08 * Math.sin(t * 1.2 + r * 10) ** 2) * (1 - (y - groundY) / (H - groundY));
      ctx.fillStyle = `rgba(${th.floorTint},${a})`;
      ctx.fillRect(x, y, 24 + r * 60, 1);
    }
    ctx.restore();
    ctx.fillStyle = `rgba(${th.horizon},0.75)`;
    ctx.fillRect(-40, groundY + 1, W + 80, 1);
  }
}

function glowAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

let moonC: HTMLCanvasElement | null = null;
function crescent(r: number): HTMLCanvasElement {
  if (moonC) return moonC;
  const c = document.createElement("canvas");
  c.width = c.height = r * 2 + 4;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ece8ff";
  g.beginPath(); g.arc(r + 2, r + 2, r, 0, TAU); g.fill();
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.arc(r + 2 + r * 0.42, r + 2 - r * 0.18, r * 0.9, 0, TAU); g.fill();
  moonC = c;
  return c;
}
