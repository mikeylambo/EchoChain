export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_strike", title: "First Echo", desc: "Complete your first combat encounter", icon: "⚔️" },
  { id: "chain_5", title: "Kinetic Surge", desc: "Form a link chain of 5 or more techniques", icon: "⚡" },
  { id: "chain_7", title: "Trail Perfection", desc: "Form a maximum-length chain of 7 techniques", icon: "✦" },
  { id: "perfect_flow", title: "Flawless Form", desc: "Win a combat encounter taking 0 damage", icon: "🛡️" },
  { id: "duplicate_fallen", title: "Mirror Shattered", desc: "Defeat The Duplicate (Act 2 Boss)", icon: "🪞" },
  { id: "original_sin", title: "The First Falls", desc: "Defeat The Original (Act 3 Boss)", icon: "👑" },
  { id: "sync_burst", title: "Resonant Climax", desc: "Trigger a full Sync Break overdrive in combat", icon: "💥" },
  { id: "codex_master", title: "Grand Archivist", desc: "Discover all 4 legendary GDD §6 synergy combos", icon: "📖" },
  { id: "ascension_5", title: "Ascension Master", desc: "Complete an expedition on Ascension 5 or higher", icon: "🏆" },
  { id: "abyssal_walker", title: "Abyssal Voyager", desc: "Reach Depth 10 in Endless Abyss", icon: "♾️" },
];

export interface AchievementToast {
  id: string;
  title: string;
  desc: string;
  icon: string;
  life: number; // seconds
  maxLife: number;
}

export class AchievementSystem {
  private toasts: AchievementToast[] = [];

  queueToast(def: AchievementDef): void {
    this.toasts.push({
      id: def.id,
      title: def.title,
      desc: def.desc,
      icon: def.icon,
      life: 3.5,
      maxLife: 3.5,
    });
  }

  update(dt: number): void {
    for (const t of this.toasts) {
      t.life -= dt;
    }
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }

  render(ctx: CanvasRenderingContext2D, width: number): void {
    if (this.toasts.length === 0) return;

    ctx.save();
    let curY = 20;

    for (const toast of this.toasts) {
      const toastW = 280;
      const toastH = 58;
      const toastX = width - toastW - 20;

      // Slide in from right and fade out
      const progress = Math.max(0, toast.life / toast.maxLife);
      const alpha = Math.min(1, Math.min(toast.life, toast.maxLife - toast.life) * 3);
      const slideX = toastX + (1 - alpha) * 40;

      ctx.globalAlpha = alpha;

      // Toast Card Box
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(slideX, curY, toastW, toastH, 8);
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.font = "24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(toast.icon, slideX + 26, curY + toastH / 2);

      // Title & Label
      ctx.textAlign = "left";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("TROPHY UNLOCKED", slideX + 52, curY + 18);

      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(toast.title, slideX + 52, curY + 34);

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(toast.desc.slice(0, 34), slideX + 52, curY + 48);

      curY += toastH + 10;
    }

    ctx.restore();
  }
}
