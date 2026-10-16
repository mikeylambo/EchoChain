import { FORMS, FORM_LIST, type FormId } from "../data/forms";
import { SEAL } from "../data/seals";
import { TECH, TECHNIQUES } from "../data/techniques";
import { analyzeTrail, type LinkInfo } from "../sim/links";
import type { DraftCard, MapNode, RunState } from "../sim/run";
import { THEME, familyColor } from "../render/types";
import { GDD_COMBOS } from "../debug/combos";
import type { GameSettings } from "../storage/saveData";
import { ASCENSIONS } from "../data/bosses";
import { ACHIEVEMENTS, type AchievementDef } from "../game/achievements";

export type ScreenState =
  | "title"
  | "combat"
  | "draft"
  | "organizer"
  | "fork"
  | "forge"
  | "rest"
  | "victory"
  | "game_over"
  | "pause"
  | "codex";

export interface ClickZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: () => void;
}

export class FlowScreens {
  clickZones: ClickZone[] = [];
  selectedForm: FormId = "duelist";
  selectedMode: "standard" | "endless" = "standard";
  selectedAscension = 0;
  codexTab: "combos" | "achievements" = "combos";

  resetZones(): void {
    this.clickZones = [];
  }

  handlePointerDown(x: number, y: number): boolean {
    for (const z of this.clickZones) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
        z.action();
        return true;
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. TITLE SCREEN & FORM SELECTION
  // ─────────────────────────────────────────────────────────────
  renderTitle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    unlockedForms: FormId[],
    highestAscension: number,
    onStart: (form: FormId, ascension: number, mode: "standard" | "endless") => void,
    onOpenCodex?: () => void,
    primaryPrompt = "[SPACE]",
    onInstallApp?: () => void
  ): void {
    this.resetZones();
    ctx.save();

    // Ensure selectedForm is unlocked; if not, default to first unlocked form
    if (!unlockedForms.includes(this.selectedForm)) {
      this.selectedForm = unlockedForms[0] ?? "duelist";
    }

    // Ensure selectedAscension does not exceed highestAscension
    if (this.selectedAscension > highestAscension) {
      this.selectedAscension = highestAscension;
    }

    // Dark ink backdrop with subtle center bloom
    ctx.fillStyle = THEME.bgDark;
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.6);
    grad.addColorStop(0, "rgba(30, 41, 59, 0.4)");
    grad.addColorStop(1, "rgba(9, 10, 15, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px system-ui, sans-serif";
    ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
    ctx.shadowBlur = 16;
    ctx.fillText("ECHO CHAIN", width / 2, height * 0.11);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("A KINETIC ROGUE-LITE", width / 2, height * 0.15);

    // Install Button in top right (if PWA installable)
    if (onInstallApp) {
      const installBtnW = 110;
      const installBtnH = 32;
      const installBtnX = width - (onOpenCodex ? 140 : 20) - installBtnW - 10;
      const installBtnY = 20;

      this.clickZones.push({
        id: "title-install",
        x: installBtnX,
        y: installBtnY,
        w: installBtnW,
        h: installBtnH,
        action: onInstallApp,
      });

      ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
      ctx.strokeStyle = THEME.healthGreen;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(installBtnX, installBtnY, installBtnW, installBtnH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = THEME.healthGreen;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("📲 INSTALL", installBtnX + installBtnW / 2, installBtnY + installBtnH / 2);
    }

    // Codex Button in top right
    if (onOpenCodex) {
      const codexBtnW = 120;
      const codexBtnH = 32;
      const codexBtnX = width - codexBtnW - 20;
      const codexBtnY = 20;

      this.clickZones.push({
        id: "title-codex",
        x: codexBtnX,
        y: codexBtnY,
        w: codexBtnW,
        h: codexBtnH,
        action: onOpenCodex,
      });

      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(codexBtnX, codexBtnY, codexBtnW, codexBtnH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = THEME.precision;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("📖 CODEX", codexBtnX + codexBtnW / 2, codexBtnY + codexBtnH / 2);
    }

    // ── GAME MODE TOGGLE ──────────────────────────────────
    const modeY = height * 0.19;
    const modeW = 170;
    const modeH = 32;
    const modeSpacing = 12;
    const totalModeW = modeW * 2 + modeSpacing;
    const standardX = (width - totalModeW) / 2;
    const endlessX = standardX + modeW + modeSpacing;

    // Standard Mode Button
    const isStandard = this.selectedMode === "standard";
    this.clickZones.push({
      id: "mode-standard",
      x: standardX,
      y: modeY,
      w: modeW,
      h: modeH,
      action: () => { this.selectedMode = "standard"; },
    });
    ctx.fillStyle = isStandard ? "rgba(59, 130, 246, 0.25)" : "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = isStandard ? THEME.flow : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = isStandard ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(standardX, modeY, modeW, modeH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isStandard ? "#ffffff" : "#94a3b8";
    ctx.font = `bold ${isStandard ? "12px" : "11px"} system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚔️ 3-ACT EXPEDITION", standardX + modeW / 2, modeY + modeH / 2);

    // Endless Mode Button
    const isEndless = this.selectedMode === "endless";
    this.clickZones.push({
      id: "mode-endless",
      x: endlessX,
      y: modeY,
      w: modeW,
      h: modeH,
      action: () => { this.selectedMode = "endless"; },
    });
    ctx.fillStyle = isEndless ? "rgba(168, 85, 247, 0.25)" : "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = isEndless ? THEME.momentum : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = isEndless ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(endlessX, modeY, modeW, modeH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isEndless ? "#ffffff" : "#94a3b8";
    ctx.font = `bold ${isEndless ? "12px" : "11px"} system-ui, sans-serif`;
    ctx.fillText("♾️ ENDLESS ABYSS", endlessX + modeW / 2, modeY + modeH / 2);

    // ── ASCENSION SELECTOR (STANDARD MODE ONLY) ───────────
    if (this.selectedMode === "standard") {
      const ascY = height * 0.255;
      const ascBoxW = 280;
      const ascBoxH = 34;
      const ascBoxX = (width - ascBoxW) / 2;

      // Left Arrow
      const arrowW = 34;
      const canDec = this.selectedAscension > 0;
      if (canDec) {
        this.clickZones.push({
          id: "asc-dec",
          x: ascBoxX,
          y: ascY,
          w: arrowW,
          h: ascBoxH,
          action: () => {
            if (this.selectedAscension > 0) this.selectedAscension--;
          },
        });
      }
      ctx.fillStyle = canDec ? "rgba(30, 41, 59, 0.85)" : "rgba(15, 23, 42, 0.4)";
      ctx.strokeStyle = canDec ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ascBoxX, ascY, arrowW, ascBoxH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = canDec ? "#ffffff" : "#475569";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("◀", ascBoxX + arrowW / 2, ascY + ascBoxH / 2);

      // Ascension Display Center
      const dispX = ascBoxX + arrowW + 8;
      const dispW = ascBoxW - arrowW * 2 - 16;
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.strokeStyle = this.selectedAscension > 0 ? THEME.precision : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(dispX, ascY, dispW, ascBoxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.selectedAscension > 0 ? THEME.precision : "#ffffff";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ascLabel = this.selectedAscension === 0 ? "STANDARD DIFFICULTY" : `ASCENSION ${this.selectedAscension}`;
      ctx.fillText(ascLabel, dispX + dispW / 2, ascY + ascBoxH / 2);

      // Right Arrow
      const rightX = ascBoxX + ascBoxW - arrowW;
      const canInc = this.selectedAscension < Math.min(10, highestAscension);
      if (canInc) {
        this.clickZones.push({
          id: "asc-inc",
          x: rightX,
          y: ascY,
          w: arrowW,
          h: ascBoxH,
          action: () => {
            if (this.selectedAscension < Math.min(10, highestAscension)) {
              this.selectedAscension++;
            }
          },
        });
      }
      ctx.fillStyle = canInc ? "rgba(30, 41, 59, 0.85)" : "rgba(15, 23, 42, 0.4)";
      ctx.strokeStyle = canInc ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.roundRect(rightX, ascY, arrowW, ascBoxH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = canInc ? "#ffffff" : "#475569";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText("▶", rightX + arrowW / 2, ascY + ascBoxH / 2);

      // Modifier Description
      ctx.textAlign = "center";
      ctx.font = "11px system-ui, sans-serif";
      if (this.selectedAscension === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Standard encounters (Beating Act 3 unlocks Ascension 1)", width / 2, ascY + ascBoxH + 16);
      } else {
        const desc = ASCENSIONS[this.selectedAscension - 1]?.desc ?? "";
        ctx.fillStyle = THEME.precision;
        ctx.fillText(`A${this.selectedAscension}: ${desc} (Cumulative)`, width / 2, ascY + ascBoxH + 16);
      }
    } else {
      // Endless description
      const ascY = height * 0.255;
      ctx.textAlign = "center";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = THEME.momentum;
      ctx.fillText("Infinite Depth • Escalating Enemy Density • True Trial of the Echo Trail", width / 2, ascY + 20);
    }

    // ── FORM SELECTION PROMPT ─────────────────────────────
    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("SELECT YOUR COMBAT FORM", width / 2, height * 0.35);

    // ── 3 FORM CARDS ──────────────────────────────────────
    const cardW = Math.min(220, (width - 60) / 3);
    const cardH = 210;
    const spacing = 16;
    const totalW = 3 * cardW + 2 * spacing;
    const startX = (width - totalW) / 2;
    const startY = height * 0.39;

    FORM_LIST.forEach((formId, i) => {
      const def = FORMS[formId];
      const isUnlocked = unlockedForms.includes(formId);
      const isSelected = this.selectedForm === formId && isUnlocked;
      const x = startX + i * (cardW + spacing);
      const y = startY;

      // Register click zone only if unlocked
      if (isUnlocked) {
        this.clickZones.push({
          id: `form-${formId}`,
          x,
          y,
          w: cardW,
          h: cardH,
          action: () => { this.selectedForm = formId; },
        });
      }

      // Card Background
      if (isUnlocked) {
        ctx.fillStyle = isSelected ? "rgba(30, 41, 59, 0.95)" : "rgba(15, 23, 42, 0.8)";
        ctx.strokeStyle = isSelected ? THEME.precision : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 10);
        ctx.fill();
        ctx.stroke();

        // Card Title
        ctx.textAlign = "center";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillStyle = isSelected ? THEME.precision : "#ffffff";
        ctx.fillText(def.name.toUpperCase(), x + cardW / 2, y + 36);

        // Description
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(def.desc, x + cardW / 2, y + 62);

        // Stats
        ctx.font = "11px monospace";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`HP: ${def.hp}`, x + cardW / 2, y + 100);
        ctx.fillText(`Interval: ${def.interval}s`, x + cardW / 2, y + 122);
        ctx.fillText(`Crit Rate: ${Math.round(def.crit * 100)}%`, x + cardW / 2, y + 144);
        ctx.fillText(`Echo Slots: ${def.startSlots}`, x + cardW / 2, y + 166);

        // Selected Tag
        if (isSelected) {
          ctx.fillStyle = THEME.precision;
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillText("✓ SELECTED", x + cardW / 2, y + 192);
        }
      } else {
        // LOCKED FORM CARD
        ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 10);
        ctx.fill();
        ctx.stroke();

        // Locked Title
        ctx.textAlign = "center";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(def.name.toUpperCase(), x + cardW / 2, y + 36);

        // Lock Icon & Badge
        ctx.font = "24px system-ui, sans-serif";
        ctx.fillText("🔒", x + cardW / 2, y + 80);

        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillStyle = "#f87171";
        ctx.fillText("LOCKED", x + cardW / 2, y + 108);

        // Requirement
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`REQUIRES: ${def.unlock.toUpperCase()}`, x + cardW / 2, y + 130);

        // Dimmed stats preview
        ctx.font = "10px monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
        ctx.fillText(`HP: ${def.hp}  •  Slots: ${def.startSlots}`, x + cardW / 2, y + 166);
      }
    });

    // ── START BUTTON ──────────────────────────────────────
    const btnW = 280;
    const btnH = 48;
    const btnX = (width - btnW) / 2;
    const btnY = height * 0.79;

    this.clickZones.push({
      id: "start-game",
      x: btnX,
      y: btnY,
      w: btnW,
      h: btnH,
      action: () => onStart(this.selectedForm, this.selectedAscension, this.selectedMode),
    });

    ctx.fillStyle = THEME.precision;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const startText = this.selectedMode === "endless" ? `ENTER THE ABYSS ${primaryPrompt}` : `BEGIN EXPEDITION ${primaryPrompt}`;
    ctx.fillText(startText, btnX + btnW / 2, btnY + btnH / 2);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 2. DRAFT SCREEN (TECHNIQUES / UPGRADES / RELICS)
  // ─────────────────────────────────────────────────────────────
  renderDraft(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cards: DraftCard[],
    run: RunState,
    onPick: (card: DraftCard) => void,
    onSkip?: () => void
  ): void {
    this.resetZones();
    ctx.save();

    // Dark backdrop
    ctx.fillStyle = "rgba(4, 7, 13, 0.9)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("WEAVE INTO YOUR TRAIL", width / 2, height * 0.16);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Choose an Echo technique, Rank enhancement, or Relic Seal", width / 2, height * 0.21);

    // Cards
    const cardW = Math.min(240, (width - 60) / Math.max(1, cards.length));
    const cardH = 280;
    const spacing = 20;
    const totalW = cards.length * cardW + (cards.length - 1) * spacing;
    const startX = (width - totalW) / 2;
    const startY = height * 0.28;

    const trailInfo = analyzeTrail(run.trail, run.form);
    const lastEmits = trailInfo.emits[trailInfo.emits.length - 1] ?? [];

    cards.forEach((card, i) => {
      const x = startX + i * (cardW + spacing);
      const y = startY;

      this.clickZones.push({
        id: `card-${i}`,
        x,
        y,
        w: cardW,
        h: cardH,
        action: () => onPick(card),
      });

      let title = "";
      let subtitle = "";
      let desc = "";
      let color = THEME.flow;
      let connects = false;

      if (card.kind === "echo") {
        const t = TECH[card.tech];
        if (t) {
          title = t.name;
          subtitle = `${t.family.toUpperCase()} • ECHO`;
          desc = t.desc;
          color = familyColor(t.family);
          connects = t.receives.includes("ANY") || lastEmits.some((e) => t.receives.includes(e));
        }
      } else if (card.kind === "rank") {
        const t = TECH[card.tech];
        if (t) {
          title = `${t.name} (RANK UP)`;
          subtitle = "TECHNIQUE MASTERY";
          desc = `Upgrades to next tier: ${t.rank3}`;
          color = THEME.precision;
        }
      } else {
        const s = SEAL[card.seal];
        if (s) {
          title = `${s.glyph} ${s.name}`;
          subtitle = "RELIC SEAL";
          desc = s.desc;
          color = THEME.resonance;
        }
      }

      // Card Container
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      // Card Header Banner
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, 56, [10, 10, 0, 0]);
      ctx.fill();

      // Card Subtitle
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(subtitle, x + cardW / 2, y + 22);

      // Card Title
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(title, x + cardW / 2, y + 42);

      // Description text (wrapped)
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      this.renderWrappedText(ctx, desc, x + 16, y + 90, cardW - 32, 18);

      // Synergy Indicator
      if (card.kind === "echo" && connects) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
        ctx.strokeStyle = THEME.healthGreen;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + 14, y + cardH - 80, cardW - 28, 26, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = THEME.healthGreen;
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillText("✓ CONNECTS WITH TRAIL", x + cardW / 2, y + cardH - 63);
      }

      // Choose Button
      const btnW = cardW - 32;
      const btnH = 36;
      const btnX = x + 16;
      const btnY = y + cardH - 46;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 6);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("SELECT", btnX + btnW / 2, btnY + btnH / 2);
    });

    // Skip Button
    if (onSkip) {
      const skipW = 140;
      const skipH = 34;
      const skipX = (width - skipW) / 2;
      const skipY = height * 0.85;

      this.clickZones.push({
        id: "skip-draft",
        x: skipX,
        y: skipY,
        w: skipW,
        h: skipH,
        action: onSkip,
      });

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(skipX, skipY, skipW, skipH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText("SKIP DRAFT", skipX + skipW / 2, skipY + skipH / 2);
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 3. TRAIL ORGANIZER (REORDERING & LINK CAUSALITY)
  // ─────────────────────────────────────────────────────────────
  renderOrganizer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    run: RunState,
    onMove: (fromIndex: number, toIndex: number) => void,
    onContinue: () => void
  ): void {
    this.resetZones();
    ctx.save();

    // Dark backdrop
    ctx.fillStyle = "rgba(7, 10, 16, 0.94)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText("TRAIL CAUSALITY ENGINE", width / 2, height * 0.12);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Events flow downstream (0 → 1 → 2 ...). Reorder echoes to maximize connected links.", width / 2, height * 0.16);

    // Link analysis
    const linkInfo = analyzeTrail(run.trail, run.form);

    // Link Health Pill
    const pillW = 320;
    const pillH = 30;
    const pillX = (width - pillW) / 2;
    const pillY = height * 0.20;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = linkInfo.longest === run.trail.length && run.trail.length > 0 ? THEME.healthGreen : THEME.precision;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`CHAIN POTENTIAL: ${linkInfo.count} / ${run.trail.length} LINKS CONNECTED (MAX ${linkInfo.longest + 1})`, pillX + pillW / 2, pillY + pillH / 2);

    // Slots Display: Slot 0 (Fighter) + Echoes
    const totalSlots = run.trail.length + 1;
    const slotW = Math.min(130, (width - 40) / Math.max(3, totalSlots));
    const slotH = 170;
    const spacing = 16;
    const totalW = totalSlots * slotW + (totalSlots - 1) * spacing;
    const startX = (width - totalW) / 2;
    const startY = height * 0.32;

    for (let slot = 0; slot < totalSlots; slot++) {
      const x = startX + slot * (slotW + spacing);
      const y = startY;
      const isFighter = slot === 0;

      let name = isFighter ? FORMS[run.form].name : "";
      let family = "precision";
      let rankText = "";
      let desc = "";

      if (isFighter) {
        desc = `Emits: ${linkInfo.emits[0]?.join(", ")}`;
      } else {
        const item = run.trail[slot - 1]!;
        const t = TECH[item.tech];
        if (t) {
          name = t.name;
          family = t.family;
          rankText = `RANK ${item.rank}`;
          desc = t.desc;
        }
      }

      const isLinked = isFighter || linkInfo.links[slot] === true;
      const color = isFighter ? THEME.fighter : familyColor(family);

      // Slot Box
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = isLinked ? color : "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, slotW, slotH, 8);
      ctx.fill();
      ctx.stroke();

      // Top Tag
      ctx.fillStyle = color;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isFighter ? "SLOT 0: FIGHTER" : `SLOT ${slot}`, x + slotW / 2, y + 20);

      // Name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(name, x + slotW / 2, y + 42);

      // Rank
      if (rankText) {
        ctx.fillStyle = THEME.precision;
        ctx.font = "bold 9px monospace";
        ctx.fillText(rankText, x + slotW / 2, y + 58);
      }

      // Link status pill
      if (!isFighter) {
        ctx.fillStyle = isLinked ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
        ctx.strokeStyle = isLinked ? THEME.healthGreen : THEME.healthRed;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + 10, y + 74, slotW - 20, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isLinked ? THEME.healthGreen : THEME.healthRed;
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText(isLinked ? "✓ LINKED" : "✗ UNLINKED", x + slotW / 2, y + 84);
      }

      // Description
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      this.renderWrappedText(ctx, desc, x + 8, y + 104, slotW - 16, 13);

      // Reorder buttons for Echoes
      if (!isFighter) {
        const echoIdx = slot - 1;
        const btnY = y + slotH - 32;

        // Move Left
        if (echoIdx > 0) {
          const lX = x + 8;
          this.clickZones.push({
            id: `move-left-${echoIdx}`,
            x: lX,
            y: btnY,
            w: 36,
            h: 24,
            action: () => onMove(echoIdx, echoIdx - 1),
          });

          ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
          ctx.beginPath();
          ctx.roundRect(lX, btnY, 36, 24, 4);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px system-ui, sans-serif";
          ctx.fillText("◀", lX + 18, btnY + 12);
        }

        // Move Right
        if (echoIdx < run.trail.length - 1) {
          const rX = x + slotW - 44;
          this.clickZones.push({
            id: `move-right-${echoIdx}`,
            x: rX,
            y: btnY,
            w: 36,
            h: 24,
            action: () => onMove(echoIdx, echoIdx + 1),
          });

          ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
          ctx.beginPath();
          ctx.roundRect(rX, btnY, 36, 24, 4);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px system-ui, sans-serif";
          ctx.fillText("▶", rX + 18, btnY + 12);
        }
      }

      // Arrow connecting to next slot
      if (slot < totalSlots - 1) {
        const nextLinked = linkInfo.links[slot + 1] === true;
        const arrowX0 = x + slotW + 2;
        const arrowX1 = arrowX0 + spacing - 4;
        const arrowY = y + slotH / 2;

        ctx.strokeStyle = nextLinked ? THEME.healthGreen : "rgba(239, 68, 68, 0.4)";
        ctx.lineWidth = nextLinked ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(arrowX0, arrowY);
        ctx.lineTo(arrowX1, arrowY);
        ctx.lineTo(arrowX1 - 4, arrowY - 4);
        ctx.moveTo(arrowX1, arrowY);
        ctx.lineTo(arrowX1 - 4, arrowY + 4);
        ctx.stroke();
      }
    }

    // Continue / Start Encounter Button
    const contW = 260;
    const contH = 46;
    const contX = (width - contW) / 2;
    const contY = height * 0.78;

    this.clickZones.push({
      id: "organizer-continue",
      x: contX,
      y: contY,
      w: contW,
      h: contH,
      action: onContinue,
    });

    ctx.fillStyle = THEME.precision;
    ctx.beginPath();
    ctx.roundRect(contX, contY, contW, contH, 8);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("COMMENCE ENCOUNTER [SPACE / TAP]", contX + contW / 2, contY + contH / 2);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 4. MAP FORK SELECTION SCREEN
  // ─────────────────────────────────────────────────────────────
  renderFork(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: MapNode[],
    onPick: (index: number) => void
  ): void {
    this.resetZones();
    ctx.save();

    ctx.fillStyle = "rgba(4, 7, 13, 0.92)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("CHOOSE YOUR PATH", width / 2, height * 0.22);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Select which encounter or sanctuary to march toward", width / 2, height * 0.28);

    const cardW = Math.min(260, (width - 60) / options.length);
    const cardH = 220;
    const spacing = 30;
    const totalW = options.length * cardW + (options.length - 1) * spacing;
    const startX = (width - totalW) / 2;
    const startY = height * 0.36;

    options.forEach((opt, i) => {
      const x = startX + i * (cardW + spacing);
      const y = startY;

      this.clickZones.push({
        id: `fork-${i}`,
        x,
        y,
        w: cardW,
        h: cardH,
        action: () => onPick(i),
      });

      let title = opt.type.toUpperCase();
      let color = THEME.flow;
      let desc = "Standard encounter";

      if (opt.type === "fight") {
        title = `${opt.family?.toUpperCase() ?? "ENEMY"} SQUAD`;
        color = THEME.flow;
        desc = "Standard combat encounter. Grants Echo Draft.";
      } else if (opt.type === "elite") {
        title = "ELITE VANGUARD";
        color = THEME.enemyElite;
        desc = "Dangerous commander. Grants Echo Draft & Slot milestone.";
      } else if (opt.type === "boss") {
        title = "ACT BOSS";
        color = THEME.enemyBoss;
        desc = "Formidable apex entity. Proof of mastery required.";
      } else if (opt.type === "forge") {
        title = "ECHO FORGE";
        color = THEME.precision;
        desc = "Sanctuary. Temper an existing Echo to Rank II or III.";
      } else if (opt.type === "rest") {
        title = "REST SITE";
        color = THEME.healthGreen;
        desc = "Sanctuary. Recover 35% Max HP or meditate.";
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(title, x + cardW / 2, y + 46);

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      this.renderWrappedText(ctx, desc, x + 20, y + 80, cardW - 40, 18);

      const btnW = cardW - 40;
      const btnH = 40;
      const btnX = x + 20;
      const btnY = y + cardH - 56;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 6);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("ADVANCE", btnX + btnW / 2, btnY + btnH / 2);
    });

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 5. REST SITE SCREEN
  // ─────────────────────────────────────────────────────────────
  renderRest(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    run: RunState,
    onRestChoice: (heal: boolean) => void
  ): void {
    this.resetZones();
    ctx.save();

    ctx.fillStyle = "rgba(4, 7, 13, 0.92)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("REST SITE", width / 2, height * 0.22);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Current Health: ${Math.round(run.hp)} / ${run.maxHp} HP`, width / 2, height * 0.28);

    const cardW = 240;
    const cardH = 200;
    const spacing = 30;
    const startX = (width - (cardW * 2 + spacing)) / 2;
    const startY = height * 0.36;

    // Option 1: Rest & Heal
    const healX = startX;
    this.clickZones.push({
      id: "rest-heal",
      x: healX,
      y: startY,
      w: cardW,
      h: cardH,
      action: () => onRestChoice(true),
    });

    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = THEME.healthGreen;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(healX, startY, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = THEME.healthGreen;
    ctx.fillText("REST & RECOVER", healX + cardW / 2, startY + 44);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`Heal 35% of max HP (+${Math.round(run.maxHp * 0.35)} HP)`, healX + cardW / 2, startY + 85);

    ctx.fillStyle = THEME.healthGreen;
    ctx.beginPath();
    ctx.roundRect(healX + 20, startY + cardH - 54, cardW - 40, 36, 6);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("REST", healX + cardW / 2, startY + cardH - 36);

    // Option 2: Meditate
    const medX = startX + cardW + spacing;
    this.clickZones.push({
      id: "rest-meditate",
      x: medX,
      y: startY,
      w: cardW,
      h: cardH,
      action: () => onRestChoice(false),
    });

    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = THEME.precision;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(medX, startY, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = THEME.precision;
    ctx.fillText("MEDITATE", medX + cardW / 2, startY + 44);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Focus kinetic spirit and march forward refreshed.", medX + cardW / 2, startY + 85);

    ctx.fillStyle = THEME.precision;
    ctx.beginPath();
    ctx.roundRect(medX + 20, startY + cardH - 54, cardW - 40, 36, 6);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("MEDITATE", medX + cardW / 2, startY + cardH - 36);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 6. FORGE SCREEN
  // ─────────────────────────────────────────────────────────────
  renderForge(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    run: RunState,
    onForgeSlot: (slot: number) => void
  ): void {
    this.resetZones();
    ctx.save();

    ctx.fillStyle = "rgba(4, 7, 13, 0.92)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("ECHO FORGE", width / 2, height * 0.20);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Select an equipped Echo to elevate its rank.", width / 2, height * 0.25);

    const slotW = Math.min(180, (width - 60) / Math.max(1, run.trail.length));
    const slotH = 200;
    const spacing = 16;
    const totalW = run.trail.length * slotW + (run.trail.length - 1) * spacing;
    const startX = (width - totalW) / 2;
    const startY = height * 0.35;

    run.trail.forEach((item, slot) => {
      const x = startX + slot * (slotW + spacing);
      const y = startY;
      const t = TECH[item.tech];
      const color = t ? familyColor(t.family) : THEME.flow;
      const canUpgrade = item.rank < 3;

      if (canUpgrade) {
        this.clickZones.push({
          id: `forge-slot-${slot}`,
          x,
          y,
          w: slotW,
          h: slotH,
          action: () => onForgeSlot(slot),
        });
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.strokeStyle = canUpgrade ? color : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = canUpgrade ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, slotW, slotH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(t?.name ?? item.tech, x + slotW / 2, y + 36);

      ctx.font = "bold 11px monospace";
      ctx.fillStyle = THEME.precision;
      ctx.fillText(`CURRENT: RANK ${item.rank}`, x + slotW / 2, y + 62);

      if (canUpgrade) {
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = THEME.healthGreen;
        ctx.fillText(`➜ UPGRADE TO RANK ${item.rank + 1}`, x + slotW / 2, y + 88);

        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        this.renderWrappedText(ctx, t?.rank3 ?? "", x + 12, y + 112, slotW - 24, 13);

        const btnW = slotW - 24;
        const btnH = 34;
        const btnX = x + 12;
        const btnY = y + slotH - 44;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 6);
        ctx.fill();

        ctx.fillStyle = "#000000";
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText("FORGE", btnX + btnW / 2, btnY + btnH / 2);
      } else {
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText("MAX RANK", x + slotW / 2, y + 110);
      }
    });

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 7. PAUSE MENU & SETTINGS SCREEN
  // ─────────────────────────────────────────────────────────────
  renderPause(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: GameSettings,
    onResume: () => void,
    onToggleMute: () => void,
    onChangeVolume: (delta: number) => void,
    onChangeShake: (delta: number) => void,
    onOpenCodex: () => void,
    onAbandon: () => void
  ): void {
    this.resetZones();
    ctx.save();

    // Dark translucent backdrop
    ctx.fillStyle = "rgba(4, 7, 13, 0.88)";
    ctx.fillRect(0, 0, width, height);

    // Modal Card
    const cardW = Math.min(360, width * 0.88);
    const cardH = 380;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
    ctx.strokeStyle = THEME.precision;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.textAlign = "center";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PAUSED", width / 2, cardY + 40);

    // 1. Resume Button
    const btnW = cardW - 48;
    const btnH = 38;
    const btnX = cardX + 24;

    let curY = cardY + 68;
    this.clickZones.push({
      id: "pause-resume",
      x: btnX,
      y: curY,
      w: btnW,
      h: btnH,
      action: onResume,
    });
    ctx.fillStyle = THEME.precision;
    ctx.beginPath();
    ctx.roundRect(btnX, curY, btnW, btnH, 6);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("RESUME EXPEDITION [ESC]", btnX + btnW / 2, curY + btnH / 2);

    // 2. Volume Row
    curY += 52;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("MASTER VOLUME", btnX, curY + 12);

    // [-] button
    const volMinusX = btnX + btnW - 110;
    this.clickZones.push({
      id: "vol-minus",
      x: volMinusX,
      y: curY - 2,
      w: 28,
      h: 28,
      action: () => onChangeVolume(-0.1),
    });
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.beginPath();
    ctx.roundRect(volMinusX, curY - 2, 28, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("-", volMinusX + 14, curY + 12);

    // Vol value
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${Math.round(settings.volume * 100)}%`, volMinusX + 54, curY + 12);

    // [+] button
    const volPlusX = btnX + btnW - 30;
    this.clickZones.push({
      id: "vol-plus",
      x: volPlusX,
      y: curY - 2,
      w: 28,
      h: 28,
      action: () => onChangeVolume(0.1),
    });
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.beginPath();
    ctx.roundRect(volPlusX, curY - 2, 28, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.fillText("+", volPlusX + 14, curY + 12);

    // 3. Screen Shake Row
    curY += 46;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("SCREEN SHAKE", btnX, curY + 12);

    // Shake [-] button
    this.clickZones.push({
      id: "shake-minus",
      x: volMinusX,
      y: curY - 2,
      w: 28,
      h: 28,
      action: () => onChangeShake(-0.25),
    });
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.beginPath();
    ctx.roundRect(volMinusX, curY - 2, 28, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("-", volMinusX + 14, curY + 12);

    // Shake value
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${Math.round(settings.screenShake * 100)}%`, volMinusX + 54, curY + 12);

    // Shake [+] button
    this.clickZones.push({
      id: "shake-plus",
      x: volPlusX,
      y: curY - 2,
      w: 28,
      h: 28,
      action: () => onChangeShake(0.25),
    });
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.beginPath();
    ctx.roundRect(volPlusX, curY - 2, 28, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.fillText("+", volPlusX + 14, curY + 12);

    // 4. Mute Toggle
    curY += 46;
    this.clickZones.push({
      id: "pause-mute",
      x: btnX,
      y: curY,
      w: btnW,
      h: 32,
      action: onToggleMute,
    });
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.beginPath();
    ctx.roundRect(btnX, curY, btnW, 32, 6);
    ctx.fill();
    ctx.fillStyle = settings.muted ? THEME.healthRed : THEME.flow;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(settings.muted ? "AUDIO: MUTED (TAP TO UNMUTE)" : "AUDIO: ACTIVE (TAP TO MUTE)", btnX + btnW / 2, curY + 16);

    // 5. Open Codex Button
    curY += 44;
    this.clickZones.push({
      id: "pause-codex",
      x: btnX,
      y: curY,
      w: btnW,
      h: 34,
      action: onOpenCodex,
    });
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.strokeStyle = THEME.precision;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(btnX, curY, btnW, 34, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("📖 VIEW COMBO CODEX", btnX + btnW / 2, curY + 17);

    // 6. Abandon Run Button
    curY += 44;
    this.clickZones.push({
      id: "pause-abandon",
      x: btnX,
      y: curY,
      w: btnW,
      h: 32,
      action: onAbandon,
    });
    ctx.fillStyle = "rgba(220, 38, 38, 0.2)";
    ctx.strokeStyle = THEME.healthRed;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(btnX, curY, btnW, 32, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = THEME.healthRed;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("ABANDON EXPEDITION", btnX + btnW / 2, curY + 16);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 8. CODEX / COMBO COMPENDIUM SCREEN
  // ─────────────────────────────────────────────────────────────
  renderCodex(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    discoveredCombos: string[],
    unlockedAchievements: string[],
    onClose: () => void
  ): void {
    this.resetZones();
    ctx.save();

    // Dark backdrop
    ctx.fillStyle = "rgba(7, 10, 16, 0.96)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText("COMBO CODEX & ARCHIVES", width / 2, 38);

    // Close Button top-right
    const closeBtnW = 100;
    const closeBtnH = 32;
    const closeBtnX = width - closeBtnW - 20;
    const closeBtnY = 24;

    this.clickZones.push({
      id: "close-codex",
      x: closeBtnX,
      y: closeBtnY,
      w: closeBtnW,
      h: closeBtnH,
      action: onClose,
    });

    ctx.fillStyle = THEME.precision;
    ctx.beginPath();
    ctx.roundRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH, 6);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("CLOSE [ESC]", closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2);

    // Two Tabs: COMBOS & TECHNIQUES vs TROPHIES & ACHIEVEMENTS
    const tabW = 210;
    const tabH = 30;
    const tabY = 56;
    const tab1X = width / 2 - tabW - 8;
    const tab2X = width / 2 + 8;

    this.clickZones.push({
      id: "codex-tab-combos",
      x: tab1X,
      y: tabY,
      w: tabW,
      h: tabH,
      action: () => { this.codexTab = "combos"; },
    });
    const isCombos = this.codexTab === "combos";
    ctx.fillStyle = isCombos ? "rgba(59, 130, 246, 0.3)" : "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = isCombos ? THEME.flow : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = isCombos ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(tab1X, tabY, tabW, tabH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = `bold ${isCombos ? "12px" : "11px"} system-ui, sans-serif`;
    ctx.fillStyle = isCombos ? "#ffffff" : "#94a3b8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📖 COMBOS & TECHNIQUES", tab1X + tabW / 2, tabY + tabH / 2);

    this.clickZones.push({
      id: "codex-tab-achievements",
      x: tab2X,
      y: tabY,
      w: tabW,
      h: tabH,
      action: () => { this.codexTab = "achievements"; },
    });
    const isAchievements = this.codexTab === "achievements";
    ctx.fillStyle = isAchievements ? "rgba(245, 158, 11, 0.3)" : "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = isAchievements ? "#fbbf24" : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = isAchievements ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(tab2X, tabY, tabW, tabH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = `bold ${isAchievements ? "12px" : "11px"} system-ui, sans-serif`;
    ctx.fillStyle = isAchievements ? "#ffffff" : "#94a3b8";
    ctx.fillText(`🏆 TROPHIES (${unlockedAchievements.length} / ${ACHIEVEMENTS.length})`, tab2X + tabW / 2, tabY + tabH / 2);

    if (this.codexTab === "combos") {
      // Section 1: The 4 Legendary Combos
      ctx.textAlign = "left";
      ctx.fillStyle = THEME.precision;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("LEGENDARY SYNERGY SEQUENCES (GDD §6)", 30, 110);

      const comboCardW = Math.min(260, (width - 80) / 2);
      const comboCardH = 92;
      const startY = 124;

      GDD_COMBOS.forEach((spec, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 30 + col * (comboCardW + 20);
        const y = startY + row * (comboCardH + 12);

        const isDiscovered = discoveredCombos.includes(spec.name);

        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.strokeStyle = isDiscovered ? THEME.precision : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = isDiscovered ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, comboCardW, comboCardH, 8);
        ctx.fill();
        ctx.stroke();

        // Combo Name & Badge
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(spec.name.toUpperCase(), x + 12, y + 22);

        ctx.textAlign = "right";
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = isDiscovered ? THEME.healthGreen : "#64748b";
        ctx.fillText(isDiscovered ? "✓ DISCOVERED" : "🔒 LOCKED", x + comboCardW - 12, y + 22);

        // Sequence Trail
        ctx.textAlign = "left";
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = THEME.flow;
        ctx.fillText(spec.trail.join(" ➔ "), x + 12, y + 44);

        // Claim Description
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        this.renderWrappedText(ctx, spec.claim, x + 12, y + 62, comboCardW - 24, 13);
      });

      // Section 2: Technique Compendium Grid
      const techStartY = startY + 2 * (comboCardH + 12) + 20;
      ctx.textAlign = "left";
      ctx.fillStyle = THEME.flow;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("AUTHORITATIVE TECHNIQUE ARCHETYPES", 30, techStartY);

      const techCardW = Math.min(180, (width - 70) / 4);
      const techCardH = 72;
      const gridStartY = techStartY + 14;

      TECHNIQUES.slice(0, 8).forEach((tech, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 30 + col * (techCardW + 10);
        const y = gridStartY + row * (techCardH + 10);
        const color = familyColor(tech.family);

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, techCardW, techCardH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(tech.name, x + 10, y + 20);

        ctx.font = "9px monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`IN: ${tech.receives.join(",")} ➜ OUT: ${tech.emits.join(",")}`, x + 10, y + 36);

        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        this.renderWrappedText(ctx, tech.desc, x + 10, y + 52, techCardW - 20, 12);
      });
    } else {
      // ACHIEVEMENTS TAB
      const achCardW = Math.min(360, (width - 60) / 2);
      const achCardH = 68;
      const startY = 114;

      ACHIEVEMENTS.forEach((ach, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = (width - (achCardW * 2 + 20)) / 2 + col * (achCardW + 20);
        const y = startY + row * (achCardH + 12);
        const isUnlocked = unlockedAchievements.includes(ach.id);

        ctx.fillStyle = isUnlocked ? "rgba(15, 23, 42, 0.9)" : "rgba(15, 23, 42, 0.55)";
        ctx.strokeStyle = isUnlocked ? "#fbbf24" : "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = isUnlocked ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, achCardW, achCardH, 8);
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.font = "24px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isUnlocked ? ach.icon : "🔒", x + 30, y + achCardH / 2);

        // Title
        ctx.textAlign = "left";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillStyle = isUnlocked ? "#ffffff" : "#64748b";
        ctx.fillText(ach.title, x + 58, y + 22);

        // Status badge
        ctx.textAlign = "right";
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = isUnlocked ? THEME.healthGreen : "#ef4444";
        ctx.fillText(isUnlocked ? "✓ UNLOCKED" : "LOCKED", x + achCardW - 14, y + 22);

        // Description
        ctx.textAlign = "left";
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = isUnlocked ? "#cbd5e1" : "#64748b";
        ctx.fillText(ach.desc, x + 58, y + 46);
      });
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // TEXT WRAPPING HELPER
  // ─────────────────────────────────────────────────────────────
  private renderWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split(" ");
    let line = "";
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x + maxWidth / 2, curY);
        line = words[n] + " ";
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x + maxWidth / 2, curY);
  }

  // ─────────────────────────────────────────────────────────────
  // 9. VICTORY / DEFEAT RUN SUMMARY SCREEN
  // ─────────────────────────────────────────────────────────────
  renderRunSummary(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    run: RunState,
    isVictory: boolean,
    onReturnTitle: () => void
  ): void {
    this.resetZones();
    ctx.save();

    // Dark background with color radial glow
    ctx.fillStyle = THEME.bgDark;
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createRadialGradient(width / 2, height / 2, 60, width / 2, height / 2, width * 0.55);
    grad.addColorStop(0, isVictory ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.2)");
    grad.addColorStop(1, "rgba(9, 10, 15, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Card Box
    const cardW = Math.min(480, width - 40);
    const cardH = 340;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = isVictory ? THEME.healthGreen : THEME.healthRed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.textAlign = "center";
    ctx.font = "900 28px system-ui, sans-serif";
    ctx.fillStyle = isVictory ? THEME.healthGreen : THEME.healthRed;
    ctx.fillText(isVictory ? "✦ EXPEDITION CONQUERED ✦" : "✦ EXPEDITION TERMINATED ✦", width / 2, cardY + 48);

    // Subtitle
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    const sub = isVictory
      ? (run.mode === "endless" ? `Endless Abyss reached Depth ${run.endlessDepth}!` : `Act 3 Boss Defeated on Ascension ${run.ascension}!`)
      : `Fell in Act ${run.act} (Ascension ${run.ascension})`;
    ctx.fillText(sub, width / 2, cardY + 76);

    // Stats Grid
    const statY = cardY + 115;
    ctx.font = "12px monospace";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`KILLS: ${run.stats.kills}`, width / 2 - 100, statY);
    ctx.fillText(`FIGHTS WON: ${run.stats.fightsWon}`, width / 2 + 100, statY);
    ctx.fillText(`LONGEST CHAIN: ${run.stats.longestChain}`, width / 2 - 100, statY + 28);
    ctx.fillText(`PARRIES: ${run.stats.parries}`, width / 2 + 100, statY + 28);
    ctx.fillText(`STAGGERS: ${run.stats.staggers}`, width / 2 - 100, statY + 56);
    ctx.fillText(`CRITS: ${run.stats.crits}`, width / 2 + 100, statY + 56);

    // Unlocks / Progression note
    if (isVictory) {
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = THEME.precision;
      if (run.ascension < 10) {
        ctx.fillText(`★ UNLOCKED: Ascension ${run.ascension + 1} difficulty tier!`, width / 2, cardY + 225);
      } else {
        ctx.fillText("★ MAXIMUM ASCENSION (A10) CLEARED! MASTER OF THE TRAIL!", width / 2, cardY + 225);
      }
    }

    // Return to Title button
    const btnW = 240;
    const btnH = 42;
    const btnX = (width - btnW) / 2;
    const btnY = cardY + cardH - 65;

    this.clickZones.push({
      id: "summary-title-btn",
      x: btnX,
      y: btnY,
      w: btnW,
      h: btnH,
      action: onReturnTitle,
    });

    ctx.fillStyle = isVictory ? THEME.healthGreen : THEME.precision;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("RETURN TO TITLE [SPACE / TAP]", btnX + btnW / 2, btnY + btnH / 2);

    ctx.restore();
  }
}
