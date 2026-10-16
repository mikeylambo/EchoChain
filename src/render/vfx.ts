import type { Camera, ChainLightningArc, FloatingText, Particle, SlashArc } from "./types";
import { THEME } from "./types";

export class VfxEngine {
  particles: Particle[] = [];
  texts: FloatingText[] = [];
  slashes: SlashArc[] = [];
  lightning: ChainLightningArc[] = [];
  private nextTextId = 1;

  update(dt: number, camera: Camera): void {
    // Camera shake decay
    if (camera.shakeTime > 0) {
      camera.shakeTime -= dt;
      if (camera.shakeTime <= 0) {
        camera.shakeIntensity = 0;
      }
    }

    // Particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      if (p.gravity) p.vy += p.gravity * dt;
      p.alpha -= p.decay * dt;
    }
    this.particles = this.particles.filter((p) => p.alpha > 0);

    // Floating text
    for (const t of this.texts) {
      t.y += t.vy * dt;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / t.maxLife);
    }
    this.texts = this.texts.filter((t) => t.life > 0);

    // Slashes
    for (const s of this.slashes) {
      s.life -= dt;
    }
    this.slashes = this.slashes.filter((s) => s.life > 0);

    // Lightning arcs
    for (const l of this.lightning) {
      l.life -= dt;
    }
    this.lightning = this.lightning.filter((l) => l.life > 0);
  }

  shake(camera: Camera, intensity: number, duration: number): void {
    camera.shakeIntensity = Math.max(camera.shakeIntensity, intensity);
    camera.shakeTime = Math.max(camera.shakeTime, duration);
  }

  addText(x: number, y: number, text: string, color = "#ffffff", size = 16, crit = false): void {
    this.texts.push({
      id: this.nextTextId++,
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 10,
      text,
      color,
      size: crit ? size * 1.3 : size,
      alpha: 1,
      vy: -40 - Math.random() * 20,
      life: crit ? 1.0 : 0.75,
      maxLife: crit ? 1.0 : 0.75,
      crit,
    });
  }

  burst(x: number, y: number, color: string, count = 12, speed = 120): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        decay: 1.5 + Math.random() * 1.5,
        drag: 0.92,
        gravity: 60,
      });
    }
  }

  addSlash(x: number, y: number, radius: number, color = THEME.fighter, width = 3): void {
    const angle0 = -Math.PI * 0.4 + (Math.random() - 0.5) * 0.2;
    const angle1 = Math.PI * 0.4 + (Math.random() - 0.5) * 0.2;
    this.slashes.push({
      x,
      y,
      radius,
      angle0,
      angle1,
      color,
      life: 0.16,
      maxLife: 0.16,
      width,
    });
  }

  /** Ink energy lightning arc between two echoes */
  addLightning(x0: number, y0: number, x1: number, y1: number, color: string): void {
    const segments = 6;
    const points: { x: number; y: number }[] = [{ x: x0, y: y0 }];
    const dx = (x1 - x0) / segments;
    const dy = (y1 - y0) / segments;

    for (let i = 1; i < segments; i++) {
      const jitter = (Math.random() - 0.5) * 18;
      points.push({
        x: x0 + dx * i + jitter * 0.3,
        y: y0 + dy * i + jitter,
      });
    }
    points.push({ x: x1, y: y1 });

    this.lightning.push({
      x0,
      y0,
      x1,
      y1,
      color,
      life: 0.18,
      maxLife: 0.18,
      points,
    });
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;

    let sx = 0;
    let sy = 0;
    if (camera.shakeTime > 0) {
      const mag = camera.shakeIntensity * (camera.shakeTime / 0.3);
      sx = (Math.random() - 0.5) * mag * 2;
      sy = (Math.random() - 0.5) * mag * 2;
    }

    ctx.save();
    ctx.translate(cx + sx - camera.x * camera.zoom, cy + sy - camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);

    // Lightning arcs
    for (const l of this.lightning) {
      const alpha = Math.max(0, l.life / l.maxLife);
      ctx.save();
      ctx.strokeStyle = l.color;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(l.points[0]!.x, l.points[0]!.y);
      for (let i = 1; i < l.points.length; i++) {
        ctx.lineTo(l.points[i]!.x, l.points[i]!.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Slashes
    for (const s of this.slashes) {
      const progress = 1 - s.life / s.maxLife;
      const alpha = Math.max(0, 1 - progress);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = s.width;
      ctx.arc(s.x, s.y, s.radius * (0.8 + progress * 0.4), s.angle0, s.angle1);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Floating combat texts
    for (const t of this.texts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = `${t.crit ? "bold " : ""}${Math.round(t.size)}px "Inter", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = t.crit ? "rgba(245, 158, 11, 0.8)" : "rgba(0,0,0,0.8)";
      ctx.shadowBlur = t.crit ? 10 : 4;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    ctx.restore();
  }
}
