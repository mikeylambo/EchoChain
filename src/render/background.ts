/** Parallax dusk scenes per act. Fully procedural, seamless tiles, no assets. */

export interface Theme {
  name: string;
  sky: [string, string, string, string];
  sun: { x: number; y: number; r: number; core: string; glow: string; ring?: boolean };
  layers: { color: string; base: number; amp: number; par: number; freq: number[]; jag: number }[];
  fog: string;
  ground: [string, string];
  road: string;
  roadMark: string;
  props: "torii" | "lantern" | "monolith";
  motes: "dust" | "ember" | "snow";
  moteColor: string;
  propColor: string;
  propGlow: string;
}

export const THEMES: Theme[] = [
  {
    name: "The Outskirts",
    sky: ["#120c18", "#3b1a26", "#9a4433", "#f3a65c"],
    sun: { x: 0.68, y: 0.6, r: 64, core: "#ffe0a0", glow: "rgba(255,170,90,0.55)" },
    layers: [
      { color: "#5a2a2e", base: 0.62, amp: 90, par: 0.04, freq: [1, 2, 5], jag: 0.25 },
      { color: "#3a1b22", base: 0.68, amp: 70, par: 0.12, freq: [2, 3, 7], jag: 0.45 },
      { color: "#22111a", base: 0.74, amp: 46, par: 0.3, freq: [3, 5, 11], jag: 0.3 },
    ],
    fog: "rgba(243,166,92,0.16)",
    ground: ["#140b0f", "#07050a"],
    road: "#1c1115",
    roadMark: "rgba(239,233,220,0.06)",
    props: "torii",
    motes: "dust",
    moteColor: "255,214,160",
    propColor: "#120a0f",
    propGlow: "rgba(255,170,90,0.0)",
  },
  {
    name: "The Long Road",
    sky: ["#07071a", "#1d1640", "#4b2a6a", "#c9739c"],
    sun: { x: 0.3, y: 0.38, r: 40, core: "#f6ecff", glow: "rgba(200,170,255,0.45)" },
    layers: [
      { color: "#3a2a5e", base: 0.6, amp: 120, par: 0.04, freq: [1, 3, 4], jag: 0.6 },
      { color: "#251a44", base: 0.67, amp: 92, par: 0.13, freq: [2, 4, 9], jag: 0.7 },
      { color: "#150f2a", base: 0.75, amp: 40, par: 0.32, freq: [3, 6, 13], jag: 0.35 },
    ],
    fog: "rgba(201,115,156,0.14)",
    ground: ["#0d0a18", "#05040b"],
    road: "#141026",
    roadMark: "rgba(239,233,220,0.05)",
    props: "lantern",
    motes: "ember",
    moteColor: "255,190,140",
    propColor: "#0b0817",
    propGlow: "rgba(255,190,120,0.9)",
  },
  {
    name: "The Summit",
    sky: ["#2a2838", "#6e6474", "#cdb48c", "#fff3d2"],
    sun: { x: 0.5, y: 0.34, r: 52, core: "#fffaf0", glow: "rgba(255,240,200,0.7)", ring: true },
    layers: [
      { color: "#b9a68e", base: 0.56, amp: 150, par: 0.03, freq: [1, 2, 3], jag: 0.9 },
      { color: "#7f6e60", base: 0.65, amp: 100, par: 0.11, freq: [2, 3, 8], jag: 0.8 },
      { color: "#3e332c", base: 0.75, amp: 44, par: 0.3, freq: [3, 7, 12], jag: 0.4 },
    ],
    fog: "rgba(255,243,210,0.22)",
    ground: ["#1a1512", "#0a0807"],
    road: "#221c18",
    roadMark: "rgba(255,243,210,0.07)",
    props: "monolith",
    motes: "snow",
    moteColor: "255,250,240",
    propColor: "#16110e",
    propGlow: "rgba(255,230,170,0.0)",
  },
];

const TILE = 2400;
const TAU = Math.PI * 2;

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Mote { x: number; y: number; s: number; v: number; ph: number }

export class Scene {
  readonly theme: Theme;
  private phases: number[][];
  private motes: Mote[] = [];
  private skyCache: { h: number; g: CanvasGradient } | null = null;

  constructor(act: number) {
    this.theme = THEMES[Math.max(0, Math.min(2, act - 1))]!;
    this.phases = this.theme.layers.map((_, i) => [0, 1, 2, 3, 4].map((k) => hash(act * 31 + i * 7 + k) * TAU));
    for (let i = 0; i < 70; i++) this.motes.push({ x: hash(i * 3.1) , y: hash(i * 7.7), s: 0.5 + hash(i * 1.3) * 1.8, v: 0.3 + hash(i * 9.1), ph: hash(i * 5.3) * TAU });
  }

  private height(li: number, wx: number): number {
    const L = this.theme.layers[li]!;
    const ph = this.phases[li]!;
    let h = 0, norm = 0;
    L.freq.forEach((f, k) => {
      const w = 1 / (k + 1);
      h += Math.sin((wx / TILE) * TAU * f + ph[k]!) * w;
      norm += w;
    });
    h /= norm;
    // jagged ridges: fold the sine for sharp peaks
    const j = 1 - Math.abs(Math.sin((wx / TILE) * TAU * (L.freq[2]! * 2) + ph[3]!));
    return h * (1 - L.jag * 0.5) + j * L.jag * 0.5;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, W: number, H: number, groundY: number, t: number, flash = 0): void {
    const th = this.theme;
    if (!this.skyCache || this.skyCache.h !== H) {
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      g.addColorStop(0, th.sky[0]);
      g.addColorStop(0.4, th.sky[1]);
      g.addColorStop(0.75, th.sky[2]);
      g.addColorStop(1, th.sky[3]);
      this.skyCache = { h: H, g };
    }
    ctx.fillStyle = this.skyCache.g;
    ctx.fillRect(-40, -40, W + 80, groundY + 42);

    // celestial body
    const sx = W * th.sun.x, sy = groundY * th.sun.y + 40;
    const glow = ctx.createRadialGradient(sx, sy, th.sun.r * 0.4, sx, sy, th.sun.r * 5);
    glow.addColorStop(0, th.sun.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sx - th.sun.r * 5, sy - th.sun.r * 5, th.sun.r * 10, th.sun.r * 10);
    ctx.fillStyle = th.sun.core;
    ctx.beginPath();
    ctx.arc(sx, sy, th.sun.r, 0, TAU);
    ctx.fill();
    if (th.sun.ring) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,246,220,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.6 - i * 0.18;
        ctx.beginPath();
        ctx.arc(sx, sy, th.sun.r * (1.9 + i * 0.75) + Math.sin(t * 0.6 + i) * 3, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    // mountain layers
    th.layers.forEach((L, li) => {
      const off = camX * L.par;
      const base = groundY * L.base + 30 * li;
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(-40, groundY + 4);
      for (let x = -40; x <= W + 44; x += 6) ctx.lineTo(x, base - this.height(li, x + off) * L.amp - L.amp * 0.3);
      ctx.lineTo(W + 44, groundY + 4);
      ctx.closePath();
      ctx.fill();
      // fog band at each layer foot
      const fg = ctx.createLinearGradient(0, base - 30, 0, groundY);
      fg.addColorStop(0, "rgba(0,0,0,0)");
      fg.addColorStop(1, th.fog);
      ctx.fillStyle = fg;
      ctx.fillRect(0, base - 30, W, groundY - base + 30);
    });

    this.drawProps(ctx, camX * 0.6, W, groundY, t);

    // ground
    const gg = ctx.createLinearGradient(0, groundY - 64, 0, H);
    gg.addColorStop(0, th.ground[0]);
    gg.addColorStop(1, th.ground[1]);
    ctx.fillStyle = gg;
    ctx.fillRect(-40, groundY - 64, W + 80, H - groundY + 104);
    // horizon rim light
    ctx.fillStyle = th.fog.replace(/[\d.]+\)$/, "0.5)");
    ctx.fillRect(0, groundY - 64, W, 1.5);
    // road
    ctx.fillStyle = th.road;
    ctx.fillRect(-40, groundY - 34, W + 80, 66);
    ctx.fillStyle = th.roadMark;
    const step = 90;
    const start = Math.floor(camX / step) * step;
    for (let wx = start; wx < camX + W + step; wx += step) {
      const x = wx - camX;
      const r = hash(wx * 0.37);
      ctx.fillRect(x, groundY - 30 + r * 52, 22 + r * 40, 2);
      ctx.fillRect(x + 40, groundY + 30, 50, 1.5);
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, groundY + 32, W, 3);

    this.drawMotes(ctx, camX, W, groundY, t);
    this.drawForeground(ctx, camX * 1.35, W, H, t);

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawProps(ctx: CanvasRenderingContext2D, off: number, W: number, gy: number, t: number): void {
    const th = this.theme;
    const spacing = 520;
    const first = Math.floor((off - 200) / spacing);
    ctx.fillStyle = th.propColor;
    for (let i = first; i < first + Math.ceil(W / spacing) + 3; i++) {
      const r = hash(i * 13.7);
      if (r < 0.25) continue;
      const x = i * spacing + r * 260 - off;
      const y = gy - 60;
      const s = 0.75 + hash(i * 3.3) * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      if (th.props === "torii") {
        if (r > 0.6) {
          // torii gate
          ctx.fillRect(-46, -110, 7, 110);
          ctx.fillRect(39, -110, 7, 110);
          ctx.beginPath();
          ctx.moveTo(-66, -118); ctx.quadraticCurveTo(0, -112, 66, -122); ctx.lineTo(62, -110); ctx.quadraticCurveTo(0, -102, -62, -108);
          ctx.fill();
          ctx.fillRect(-52, -96, 104, 6);
        } else {
          // windswept tree
          ctx.fillRect(-3, -70, 6, 70);
          ctx.beginPath();
          ctx.ellipse(-18, -82, 42, 14, -0.15, 0, TAU);
          ctx.ellipse(-30, -98, 28, 10, -0.2, 0, TAU);
          ctx.fill();
        }
      } else if (th.props === "lantern") {
        // stone lantern
        ctx.fillRect(-6, -40, 12, 40);
        ctx.fillRect(-14, -48, 28, 8);
        ctx.fillRect(-11, -66, 22, 18);
        ctx.beginPath();
        ctx.moveTo(-20, -66); ctx.lineTo(0, -82); ctx.lineTo(20, -66); ctx.fill();
        const flick = 0.75 + Math.sin(t * 9 + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.08;
        const lg = ctx.createRadialGradient(0, -57, 1, 0, -57, 46);
        lg.addColorStop(0, th.propGlow.replace(/[\d.]+\)$/, `${0.55 * flick})`));
        lg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(-46, -103, 92, 92);
        ctx.fillStyle = `rgba(255,214,150,${flick})`;
        ctx.fillRect(-5, -62, 10, 9);
        ctx.fillStyle = th.propColor;
      } else {
        // monolith with prayer flags
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(-10, -120 * s); ctx.lineTo(8, -130 * s); ctx.lineTo(16, 0);
        ctx.fill();
        if (r > 0.55) {
          ctx.strokeStyle = th.propColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(8, -110); ctx.quadraticCurveTo(70, -80, 140, -96);
          ctx.stroke();
          for (let k = 0; k < 7; k++) {
            const fx = 14 + k * 18, fy = -106 + Math.sin((k + 1) / 8 * Math.PI) * 18;
            ctx.fillRect(fx, fy + Math.sin(t * 4 + k) * 1.5, 9, 12);
          }
        }
      }
      ctx.restore();
    }
  }

  private drawMotes(ctx: CanvasRenderingContext2D, camX: number, W: number, gy: number, t: number): void {
    const th = this.theme;
    for (const m of this.motes) {
      let x: number, y: number, a: number;
      if (th.motes === "snow") {
        x = ((m.x * W * 1.4 - camX * 0.5 * m.v - t * 30 * m.v) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        y = ((m.y * gy + t * 40 * m.v) % (gy + 60));
        a = 0.35 + m.v * 0.4;
      } else if (th.motes === "ember") {
        x = ((m.x * W * 1.4 - camX * 0.4 * m.v + Math.sin(t + m.ph) * 20) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        y = gy - ((m.y * gy * 0.8 + t * 22 * m.v) % (gy * 0.8));
        a = (0.4 + 0.5 * Math.sin(t * 3 + m.ph)) * 0.8;
      } else {
        x = ((m.x * W * 1.4 - camX * 0.3 * m.v - t * 12 * m.v) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        y = gy * (0.35 + m.y * 0.65) + Math.sin(t * 0.8 + m.ph) * 12;
        a = 0.25 + 0.25 * Math.sin(t * 1.3 + m.ph);
      }
      ctx.fillStyle = `rgba(${th.moteColor},${Math.max(0, a)})`;
      ctx.fillRect(x, y, m.s, m.s);
    }
  }

  private drawForeground(ctx: CanvasRenderingContext2D, off: number, W: number, H: number, t: number): void {
    ctx.fillStyle = "#030205";
    const spacing = 34;
    const first = Math.floor(off / spacing);
    for (let i = first; i < first + Math.ceil(W / spacing) + 2; i++) {
      const r = hash(i * 7.31);
      if (r < 0.35) continue;
      const x = i * spacing - off;
      const h = 14 + r * 34;
      const sway = Math.sin(t * 1.6 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(x - 5, H);
      ctx.quadraticCurveTo(x, H - h * 0.6, x + sway, H - h);
      ctx.quadraticCurveTo(x + 2, H - h * 0.5, x + 6, H);
      ctx.fill();
    }
  }
}
