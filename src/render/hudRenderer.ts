import type { World } from "../sim/world";
import type { RunState } from "../sim/run";
import { TECHNIQUES, type TechniqueDef } from "../data/techniques";
import { TUNING } from "../data/tuning";
import { THEME, familyColor } from "./types";
import { BOSSES } from "../data/bosses";

const TECH_MAP = new Map<string, TechniqueDef>(TECHNIQUES.map((t) => [t.id, t]));

export interface HudTouchControls {
  strikeBtn: { x: number; y: number; w: number; h: number };
  syncBtn: { x: number; y: number; w: number; h: number };
  nextBtn: { x: number; y: number; w: number; h: number };
  pauseBtn: { x: number; y: number; w: number; h: number };
}

export class HudRenderer {
  touchControls: HudTouchControls = {
    strikeBtn: { x: 0, y: 0, w: 0, h: 0 },
    syncBtn: { x: 0, y: 0, w: 0, h: 0 },
    nextBtn: { x: 0, y: 0, w: 0, h: 0 },
    pauseBtn: { x: 0, y: 0, w: 0, h: 0 },
  };

  render(ctx: CanvasRenderingContext2D, world: World, run: RunState, width: number, height: number, prompts?: { primary: string; sync: string }): void {
    // 1. Top HUD Bar (Health, Act, Timer, Kills, Boss Bar)
    this.renderTopBar(ctx, world, run, width);

    // 2. Chain Trail Visualizer (Fighter -> Echo 1 -> Echo 2...)
    this.renderChainTrail(ctx, world, run, width, height);

    // 3. Sync Break Meter & Touch Controls
    this.renderBottomControls(ctx, world, width, height, prompts);

    // 4. Outcome Banner (Victory / Defeat)
    if (world.outcome !== "running") {
      this.renderOutcomeOverlay(ctx, world, width, height, prompts);
    }
  }

  private renderBossBar(ctx: CanvasRenderingContext2D, world: World, width: number): void {
    if (!world.boss) return;
    const b = world.boss;
    const bossDef = BOSSES[b.id];
    const bossEnemy = world.enemyById(b.enemyId);
    if (!bossEnemy || bossEnemy.state === "dead") return;

    const barW = Math.min(440, width * 0.44);
    const barH = 16;
    const barX = (width - barW) / 2;
    const barY = 24;

    ctx.save();

    // Header above bar: BOSS NAME + CURRENT PHASE
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = THEME.enemyBoss;
    const maxPhase = bossDef.phaseAt.length + 1;
    ctx.fillText(`👑 ${bossDef.name.toUpperCase()} — PHASE ${b.phase + 1} / ${maxPhase}`, width / 2, barY - 3);

    // Bar background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();
    ctx.stroke();

    // HP fill
    const hpRatio = Math.max(0, Math.min(1, bossEnemy.hp / bossEnemy.maxHp));
    const fillW = Math.max(0, barW * hpRatio);
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      grad.addColorStop(0, "#9f1239");
      grad.addColorStop(1, "#f43f5e");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 4);
      ctx.fill();
    }

    // Phase threshold divider notches
    const phaseAt = bossDef.phaseAt.map((p, i) => (b.id === "original" && i === 1 && world.cfg.ascension >= 10 ? 0.35 : p));
    for (const thresh of phaseAt) {
      const notchX = barX + barW * thresh;
      const isPassed = hpRatio <= thresh;

      // Vertical line
      ctx.strokeStyle = isPassed ? "rgba(255, 255, 255, 0.2)" : "#fbbf24";
      ctx.lineWidth = isPassed ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(notchX, barY - 2);
      ctx.lineTo(notchX, barY + barH + 2);
      ctx.stroke();

      // Diamond marker at top of notch if active
      if (!isPassed) {
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(notchX, barY - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HP Text inside bar
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(bossEnemy.hp)} / ${bossEnemy.maxHp} HP`, width / 2, barY + barH / 2);

    // Subtitle below boss bar
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    const durationS = (world.stats.durationMs / 1000).toFixed(1);
    ctx.fillText(`${durationS}s  •  Form: ${world.form.name}`, width / 2, barY + barH + 12);

    ctx.restore();
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, world: World, run: RunState, width: number): void {
    const pad = 20;
    const topY = 24;

    ctx.save();

    // Health Bar Container (Left)
    const hpBarW = Math.min(260, width * 0.35);
    const hpBarH = 18;
    const f = world.fighter;
    const hpRatio = Math.max(0, Math.min(1, f.hp / f.maxHp));

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pad, topY, hpBarW, hpBarH, 4);
    ctx.fill();
    ctx.stroke();

    // HP Fill
    const fillW = Math.max(0, hpBarW * hpRatio);
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(pad, topY, pad + fillW, topY);
      if (hpRatio > 0.35) {
        grad.addColorStop(0, "#059669");
        grad.addColorStop(1, THEME.healthGreen);
      } else {
        grad.addColorStop(0, "#b91c1c");
        grad.addColorStop(1, THEME.healthRed);
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad, topY, fillW, hpBarH, 4);
      ctx.fill();
    }

    // HP Numeric Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(f.hp)} / ${f.maxHp} HP`, pad + hpBarW / 2, topY + hpBarH / 2);

    // Center Display: Boss Bar vs Standard Encounter Title
    if (world.boss) {
      this.renderBossBar(ctx, world, width);
    } else {
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f3f4f6";
      const encounterTitle = run.mode === "endless"
        ? `ENDLESS ABYSS — DEPTH ${run.endlessDepth + 1}`
        : `ACT ${world.cfg.act} — ENCOUNTER ${run.fightIndex + 1}`;
      ctx.fillText(encounterTitle, width / 2, topY + 8);

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      const durationS = (world.stats.durationMs / 1000).toFixed(1);
      ctx.fillText(`${durationS}s  •  Form: ${world.form.name}`, width / 2, topY + 24);
    }

    // Pause button in top right
    const pauseW = 32;
    const pauseH = 32;
    const pauseX = width - pad - pauseW;
    const pauseY = topY - 4;
    this.touchControls.pauseBtn = { x: pauseX, y: pauseY, w: pauseW, h: pauseH };

    ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pauseX, pauseY, pauseW, pauseH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⏸", pauseX + pauseW / 2, pauseY + pauseH / 2);

    // Stats (Right): Kills & Longest Chain
    const statsRight = pauseX - 14;
    ctx.textAlign = "right";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = THEME.precision;
    ctx.fillText(`KILLS: ${world.stats.kills}`, statsRight, topY + 6);
    ctx.fillStyle = THEME.flow;
    ctx.fillText(`BEST CHAIN: ${world.stats.longestChain}`, statsRight, topY + 24);

    ctx.restore();
  }

  private renderChainTrail(ctx: CanvasRenderingContext2D, world: World, run: RunState, width: number, height: number): void {
    const trail = world.cfg.trail ?? [];
    const totalSlots = trail.length + 1; // Fighter (0) + Trail echoes

    const nodeW = Math.min(84, (width - 40) / Math.max(4, totalSlots));
    const nodeH = 46;
    const spacing = 12;
    const startX = Math.max(20, (width - (totalSlots * (nodeW + spacing) - spacing)) / 2);
    const startY = height - 120;

    ctx.save();

    for (let slot = 0; slot < totalSlots; slot++) {
      const x = startX + slot * (nodeW + spacing);
      const isFighter = slot === 0;

      let label = isFighter ? "FIGHTER" : `ECHO ${slot}`;
      let techName = isFighter ? world.form.name : "";
      let color = isFighter ? THEME.fighter : THEME.flow;
      let badge = "";

      if (!isFighter) {
        const item = trail[slot - 1]!;
        const tech = TECH_MAP.get(item.tech);
        if (tech) {
          techName = tech.name;
          color = familyColor(tech.family);
        }
        badge = `R${item.rank}`;
      }

      // Slot Node Box
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, startY, nodeW, nodeH, 6);
      ctx.fill();
      ctx.stroke();

      // Text inside slot
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 6, startY + 14);

      if (badge) {
        ctx.fillStyle = color;
        ctx.textAlign = "right";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText(badge, x + nodeW - 6, startY + 14);
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(techName.slice(0, 10), x + 6, startY + 32);

      // Connecting Arrow to next slot (Downstream flow: i -> i+1)
      if (slot < totalSlots - 1) {
        const arrowX0 = x + nodeW + 2;
        const arrowX1 = arrowX0 + spacing - 4;
        const arrowY = startY + nodeH / 2;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(arrowX0, arrowY);
        ctx.lineTo(arrowX1, arrowY);
        ctx.lineTo(arrowX1 - 3, arrowY - 3);
        ctx.moveTo(arrowX1, arrowY);
        ctx.lineTo(arrowX1 - 3, arrowY + 3);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderBottomControls(ctx: CanvasRenderingContext2D, world: World, width: number, height: number, prompts?: { primary: string; sync: string }): void {
    const isReady = world.chargeFull;
    const chargeRatio = Math.max(0, Math.min(1, world.charge / TUNING.syncChargeMax));

    const meterW = Math.min(320, width * 0.6);
    const meterH = 34;
    const meterX = (width - meterW) / 2;
    const meterY = height - 56;

    ctx.save();

    // Meter Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = isReady ? THEME.syncReady : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = isReady ? 2.5 : 1;
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, meterW, meterH, 6);
    ctx.fill();
    ctx.stroke();

    // Meter Fill
    const fillW = meterW * chargeRatio;
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(meterX, meterY, meterX + fillW, meterY);
      if (isReady) {
        grad.addColorStop(0, "#d97706");
        grad.addColorStop(1, THEME.syncReady);
      } else {
        grad.addColorStop(0, "#1d4ed8");
        grad.addColorStop(1, THEME.flow);
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(meterX, meterY, fillW, meterH, 6);
      ctx.fill();
    }

    // Ready pulse glow
    if (isReady) {
      const pulseAlpha = Math.sin(world.tick * 0.2) * 0.3 + 0.5;
      ctx.strokeStyle = `rgba(251, 191, 36, ${pulseAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(meterX - 2, meterY - 2, meterW + 4, meterH + 4, 8);
      ctx.stroke();
    }

    // Label Text
    ctx.fillStyle = isReady ? "#000000" : "#ffffff";
    ctx.font = `bold ${isReady ? 12 : 11}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const syncPrompt = prompts?.sync ?? "[SPACE / TAP]";
    const label = isReady ? `⚡ SYNC BREAK READY ${syncPrompt}` : `SYNC CHARGE ${Math.round(world.charge)} / ${TUNING.syncChargeMax}`;
    ctx.fillText(label, meterX + meterW / 2, meterY + meterH / 2);

    // Save touch boundaries for tap handling
    this.touchControls.syncBtn = { x: meterX, y: meterY, w: meterW, h: meterH };

    // Strike button for mobile on the right
    const btnW = 90;
    const btnH = 44;
    const strikeX = width - btnW - 16;
    const strikeY = height - 60;
    if (width < 768) {
      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(strikeX, strikeY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("STRIKE", strikeX + btnW / 2, strikeY + btnH / 2);

      this.touchControls.strikeBtn = { x: strikeX, y: strikeY, w: btnW, h: btnH };
    }

    ctx.restore();
  }

  private renderOutcomeOverlay(ctx: CanvasRenderingContext2D, world: World, width: number, height: number, prompts?: { primary: string; sync: string }): void {
    const isWon = world.outcome === "won";
    ctx.save();

    // Dark backdrop
    ctx.fillStyle = "rgba(4, 7, 13, 0.82)";
    ctx.fillRect(0, 0, width, height);

    // Outcome Card
    const cardW = Math.min(380, width * 0.85);
    const cardH = 220;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = isWon ? THEME.healthGreen : THEME.healthRed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.textAlign = "center";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = isWon ? THEME.healthGreen : THEME.healthRed;
    ctx.fillText(isWon ? "ENCOUNTER CLEARED" : "RUN CONCLUDED", width / 2, cardY + 45);

    // Stats Breakdown
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`Kills: ${world.stats.kills}   •   Sync Breaks: ${world.stats.syncs}`, width / 2, cardY + 80);
    ctx.fillText(`Longest Chain: ${world.stats.longestChain}   •   Time: ${(world.stats.durationMs / 1000).toFixed(1)}s`, width / 2, cardY + 104);

    // Continue / Restart Button
    const btnW = 200;
    const btnH = 38;
    const btnX = (width - btnW) / 2;
    const btnY = cardY + 145;

    ctx.fillStyle = isWon ? "#059669" : "#dc2626";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    const primaryPrompt = prompts?.primary ?? "[SPACE]";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(isWon ? `NEXT FIGHT ${primaryPrompt}` : `RETRY RUN ${primaryPrompt}`, width / 2, btnY + btnH / 2);

    this.touchControls.nextBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.restore();
  }
}
