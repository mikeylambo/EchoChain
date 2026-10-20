/** Lightweight particle + effect system. World-space x, screen-space y. */

export const FAM_RGB: Record<string, string> = {
  precision: "255,201,74",
  momentum: "255,59,78",
  resonance: "63,240,255",
  ink: "239,233,220",
  bone: "239,233,220",
  slate: "150,160,180",
  gold: "255,236,180",
  hurt: "255,59,78",
};

const glowCache = new Map<string, HTMLCanvasElement>();
/** Soft radial glow sprite (cached per rgb). Draw with 'lighter'. */
export function glowSprite(rgb: string): HTMLCanvasElement {
  let c = glowCache.get(rgb);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.45)`);
  grad.addColorStop(0.6, `rgba(${rgb},0.1)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(rgb, c);
  return c;
}

export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  if (a <= 0.003) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prev;
}

type Kind = "mote" | "spark" | "shard" | "dust" | "ring" | "slash" | "beam" | "num" | "wave" | "star" | "streak" | "flame" | "glint" | "text";

export interface Particle {
  k: Kind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number;
  rgb: string;
  rot: number; vr: number;
  add: boolean;
  x1?: number; y1?: number;
  text?: string;
  g?: number;
}

export class Fx {
  ps: Particle[] = [];
  reduced = false;

  add(p: Partial<Particle> & { k: Kind; x: number; y: number }): void {
    if (this.ps.length > 900) this.ps.splice(0, 100);
    this.ps.push({ vx: 0, vy: 0, life: 0, max: 0.4, size: 3, rgb: FAM_RGB.bone!, rot: 0, vr: 0, add: true, ...p });
  }

  sparks(x: number, y: number, rgb: string, n: number, speed = 260, size = 2.2): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      this.add({ k: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, max: 0.22 + Math.random() * 0.25, size, rgb, g: 600 });
    }
  }

  shards(x: number, y: number, n: number, rgb = "38,42,52"): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * Math.random();
      const v = 140 + Math.random() * 320;
      this.add({ k: "shard", x, y: y - Math.random() * 30, vx: Math.cos(a) * v + 80, vy: Math.sin(a) * v, max: 0.6 + Math.random() * 0.5, size: 3 + Math.random() * 6, rgb, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 22, add: false, g: 1100 });
    }
  }

  dust(x: number, y: number, n: number, rgb = "200,190,180"): void {
    for (let i = 0; i < n; i++) {
      this.add({ k: "dust", x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 50, max: 0.5 + Math.random() * 0.4, size: 6 + Math.random() * 10, rgb, add: false });
    }
  }

  ring(x: number, y: number, r: number, rgb: string, max = 0.35, width = 3): void {
    this.add({ k: "ring", x, y, size: r, max, rgb, x1: width });
  }

  num(x: number, y: number, text: string, rgb: string, big = false): void {
    this.add({ k: "num", x: x + (Math.random() - 0.5) * 16, y, vy: -70, max: big ? 0.8 : 0.55, size: big ? 17 : 12, rgb, text, add: false });
  }

  update(dt: number): void {
    for (const p of this.ps) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.g) p.vy += p.g * dt;
      if (p.k === "dust" || p.k === "num") { p.vx *= 0.92; p.vy *= 0.94; }
      p.rot += p.vr * dt;
    }
    this.ps = this.ps.filter((p) => p.life < p.max);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number): void {
    for (const p of this.ps) {
      const k = p.life / p.max;
      const a = 1 - k;
      const x = p.x - camX;
      ctx.globalCompositeOperation = p.add ? "lighter" : "source-over";
      switch (p.k) {
        case "mote": {
          ctx.fillStyle = `rgba(${p.rgb},${a * 0.9})`;
          ctx.fillRect(x, p.y, p.size, p.size);
          break;
        }
        case "spark": {
          ctx.strokeStyle = `rgba(${p.rgb},${a})`;
          ctx.lineWidth = p.size * (1 - k * 0.5);
          ctx.beginPath();
          ctx.moveTo(x, p.y);
          ctx.lineTo(x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
          break;
        }
        case "shard": {
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = `rgba(${p.rgb},${Math.min(1, a * 1.6)})`;
          ctx.beginPath();
          ctx.moveTo(-p.size, -p.size * 0.4);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(-p.size * 0.3, p.size * 0.6);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "dust": {
          ctx.fillStyle = `rgba(${p.rgb},${a * 0.18})`;
          ctx.beginPath();
          ctx.arc(x, p.y, p.size * (0.6 + k), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "ring": {
          const r = p.size * (0.25 + 0.75 * (1 - (1 - k) ** 3));
          ctx.strokeStyle = `rgba(${p.rgb},${a})`;
          ctx.lineWidth = (p.x1 ?? 3) * (1 - k * 0.7);
          ctx.beginPath();
          ctx.ellipse(x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "star": {
          const s = p.size * (1 - k * 0.6);
          ctx.fillStyle = `rgba(${p.rgb},${a})`;
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(0, -s * 2.4); ctx.lineTo(s * 0.35, -s * 0.35); ctx.lineTo(s * 2.4, 0); ctx.lineTo(s * 0.35, s * 0.35);
          ctx.lineTo(0, s * 2.4); ctx.lineTo(-s * 0.35, s * 0.35); ctx.lineTo(-s * 2.4, 0); ctx.lineTo(-s * 0.35, -s * 0.35);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "beam": {
          const x1 = (p.x1 ?? p.x) - camX;
          ctx.strokeStyle = `rgba(${p.rgb},${a})`;
          ctx.lineWidth = p.size * a;
          ctx.beginPath();
          ctx.moveTo(x, p.y);
          ctx.lineTo(x1, p.y1 ?? p.y);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.9})`;
          ctx.lineWidth = Math.max(0.5, p.size * a * 0.35);
          ctx.stroke();
          break;
        }
        case "streak": {
          const x1 = (p.x1 ?? p.x) - camX;
          const grad = ctx.createLinearGradient(x, p.y, x1, p.y1 ?? p.y);
          grad.addColorStop(0, `rgba(${p.rgb},0)`);
          grad.addColorStop(1, `rgba(${p.rgb},${a})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(x, p.y);
          ctx.lineTo(x1, p.y1 ?? p.y);
          ctx.stroke();
          break;
        }
        case "wave": {
          // ground shockwave travelling right
          const wx = x + k * 520;
          ctx.fillStyle = `rgba(${p.rgb},${a * 0.9})`;
          for (let i = 0; i < 5; i++) {
            const h = (26 - i * 4) * (1 - k * 0.5);
            ctx.fillRect(wx - i * 18, p.y - h, 4, h);
          }
          drawGlow(ctx, wx, p.y - 10, 60, p.rgb, a * 0.5);
          break;
        }
        case "flame": {
          ctx.fillStyle = `rgba(${p.rgb},${a * 0.8})`;
          ctx.beginPath();
          ctx.ellipse(x, p.y - k * 18, p.size * a, p.size * 1.8 * a, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "glint": {
          drawGlow(ctx, x, p.y, p.size * (1 + k), p.rgb, a);
          break;
        }
        case "num": {
          ctx.font = `700 ${p.size}px "Barlow Semi Condensed", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`;
          ctx.fillText(p.text ?? "", x + 1, p.y + 1);
          ctx.fillStyle = `rgba(${p.rgb},${Math.min(1, a * 1.5)})`;
          ctx.fillText(p.text ?? "", x, p.y);
          break;
        }
        case "text": {
          ctx.font = `700 ${p.size}px Syncopate, system-ui, sans-serif`;
          ctx.textAlign = "center";
          const s = 1 + (1 - Math.min(1, k * 6)) * 0.4;
          ctx.save();
          ctx.translate(x, p.y);
          ctx.scale(s, s);
          ctx.fillStyle = `rgba(${p.rgb},${Math.min(1, a * 2)})`;
          ctx.fillText(p.text ?? "", 0, 0);
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
