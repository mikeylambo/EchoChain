import type { World } from "../sim/world";
import type { Enemy, Projectile, FireZone } from "../sim/types";
import { TECHNIQUES, type TechniqueDef } from "../data/techniques";
import { TUNING } from "../data/tuning";
import type { Camera } from "./types";
import { THEME, familyColor } from "./types";
import type { VfxEngine } from "./vfx";
import type { SoundEngine } from "../audio/soundEngine";
import { BOSSES } from "../data/bosses";

const TECH_MAP = new Map<string, TechniqueDef>(TECHNIQUES.map((t) => [t.id, t]));

export class ArenaRenderer {
  camera: Camera = {
    x: 0,
    y: 0,
    targetX: 0,
    shakeTime: 0,
    shakeIntensity: 0,
    zoom: 1.0,
  };

  private groundY = 80;
  private prevFighterX = 0;
  private lastObservedOutcome: "running" | "won" | "lost" = "running";

  // Boss cinematic presentation & phase state
  private activeBossId: string | null = null;
  private bossIntroTimer = 0;
  private phaseAlertTimer = 0;
  private phaseAlertText = "";
  private flashAlpha = 0;

  update(world: World, dt: number, vfx: VfxEngine, audio?: SoundEngine, gamepad?: { rumble: (w: number, s: number, d: number) => void }): void {
    // Smooth camera track on fighter with forward anticipation
    const targetLead = 180;
    this.camera.targetX = world.fighter.x + targetLead;
    this.camera.x += (this.camera.targetX - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y = 0;

    // Update boss visual timers
    if (this.bossIntroTimer > 0) this.bossIntroTimer -= dt;
    if (this.phaseAlertTimer > 0) this.phaseAlertTimer -= dt;
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);

    // Detect boss encounter start
    if (world.boss && this.activeBossId !== world.boss.id) {
      this.activeBossId = world.boss.id;
      this.bossIntroTimer = 3.2;
      audio?.bossIntro();
      vfx.shake(this.camera, 14, 0.5);
      gamepad?.rumble(0.7, 0.9, 300);
    } else if (!world.boss) {
      this.activeBossId = null;
    }

    // Detect new sim events for visual triggers and audio playback
    this.processSimEvents(world, vfx, audio, gamepad);

    this.prevFighterX = world.fighter.x;
    this.lastObservedOutcome = world.outcome;
  }

  private processSimEvents(world: World, vfx: VfxEngine, audio?: SoundEngine, gamepad?: { rumble: (w: number, s: number, d: number) => void }): void {
    // Process sim fx queue
    while (world.fx.length > 0) {
      const fx = world.fx.shift()!;
      switch (fx.k) {
        case "hit":
          if (fx.crit) {
            vfx.burst(fx.x, this.groundY - 30, THEME.precision, 16, 160);
            vfx.shake(this.camera, 6, 0.2);
            vfx.addText(fx.x, this.groundY - 60, `CRIT ${Math.round(fx.dmg)}`, THEME.precision, 20, true);
            audio?.hit(true);
            gamepad?.rumble(0.4, 0.6, 60);
          } else {
            vfx.burst(fx.x, this.groundY - 30, THEME.fighter, 8, 90);
            vfx.addText(fx.x, this.groundY - 50, `${Math.round(fx.dmg)}`, "#ffffff", 14);
            audio?.hit(false);
            gamepad?.rumble(0.2, 0.1, 35);
          }
          break;
        case "hurt":
          vfx.addText(world.fighter.x, this.groundY - 55, `-${Math.round(fx.dmg)}`, THEME.healthRed, 18, true);
          vfx.shake(this.camera, 10, 0.3);
          audio?.hit(false);
          gamepad?.rumble(0.6, 0.8, 140);
          break;
        case "parry":
          vfx.burst(fx.x, this.groundY - 35, THEME.flow, 18, 140);
          vfx.shake(this.camera, 8, 0.25);
          vfx.addText(fx.x, this.groundY - 60, "PARRY", THEME.flow, 18, true);
          audio?.parry();
          gamepad?.rumble(0.6, 0.4, 90);
          break;
        case "slam":
        case "launch":
          vfx.burst(fx.x, this.groundY - 30, THEME.momentum, 14, 130);
          vfx.addText(fx.x, this.groundY - 55, fx.k.toUpperCase(), THEME.momentum, 16);
          audio?.stagger();
          gamepad?.rumble(0.5, 0.7, 100);
          break;
        case "note":
        case "chain":
          audio?.chainLink(fx.links);
          break;
        case "arc": {
          const x0 = fx.from === 0 ? world.fighter.x : world.echoX(fx.from);
          const x1 = world.echoX(fx.to);
          const col = fx.family === "ink" ? THEME.fighter : familyColor(fx.family);
          vfx.addLightning(x0, this.groundY - 32, x1, this.groundY - 32, col);
          vfx.burst(x1, this.groundY - 32, col, 6, 80);
          break;
        }
        case "trigger": {
          const x = fx.slot === 0 ? world.fighter.x : world.echoX(fx.slot);
          const col = fx.family === "ink" ? THEME.fighter : familyColor(fx.family);
          vfx.burst(x, this.groundY - 32, col, 8, 90);
          break;
        }
        case "sync":
          audio?.syncBreak();
          break;
        case "heal":
          vfx.addText(world.fighter.x, this.groundY - 70, `+${Math.round(fx.amount)}`, THEME.healthGreen, 16);
          vfx.burst(world.fighter.x, this.groundY - 30, THEME.healthGreen, 10, 80);
          break;
        case "clang":
          vfx.burst(fx.x, this.groundY - 40, "#94a3b8", 12, 110);
          vfx.addText(fx.x, this.groundY - 60, "GUARDED", "#94a3b8", 14);
          audio?.hit(false);
          break;
        case "boss":
          if (fx.text === "phase") {
            const nextPhase = (world.boss?.phase ?? 1) + 1;
            const isFinal = world.boss?.id === "original" && nextPhase >= 3;
            this.phaseAlertText = isFinal ? "FINAL PHASE: SHATTERED TEMPO" : `PHASE ${nextPhase}: ECHO OVERLOAD`;
            this.phaseAlertTimer = 2.4;
            this.flashAlpha = 0.55;
            vfx.shake(this.camera, 22, 0.7);
            vfx.burst(world.fighter.x + 180, this.groundY - 50, THEME.enemyBoss, 30, 240);
            audio?.bossPhaseShift();
          } else if (fx.text === "reorder") {
            this.phaseAlertText = "TRAIL REORDERED: SEQUENCE INVERTED!";
            this.phaseAlertTimer = 2.0;
            this.flashAlpha = 0.35;
            vfx.shake(this.camera, 16, 0.5);
            vfx.burst(world.fighter.x + 160, this.groundY - 40, THEME.resonance, 24, 200);
            audio?.bossPhaseShift();
          }
          break;
        case "kill":
          vfx.burst(fx.x, this.groundY - 30, THEME.momentum, 20, 180);
          break;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, world: World, vfx: VfxEngine, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;

    // Responsive zoom scaling
    this.camera.zoom = width < 600 ? 0.75 : width < 1000 ? 0.9 : 1.0;

    let sx = 0;
    let sy = 0;
    if (this.camera.shakeTime > 0) {
      const mag = this.camera.shakeIntensity * (this.camera.shakeTime / 0.3);
      sx = (Math.random() - 0.5) * mag * 2;
      sy = (Math.random() - 0.5) * mag * 2;
    }

    ctx.save();
    // Clear canvas
    ctx.fillStyle = THEME.bgDark;
    ctx.fillRect(0, 0, width, height);

    // Apply Camera transform
    ctx.translate(cx + sx - this.camera.x * this.camera.zoom, cy + sy - this.camera.y * this.camera.zoom);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // 1. Parallax Environment & Lane
    this.renderEnvironment(ctx, world, width);

    // 2. Fire Zones
    this.renderFireZones(ctx, world.zones);

    // 3. Trail Echo Ghosts
    this.renderEchoTrail(ctx, world);

    // 4. Fighter Silhouette & Weapon
    this.renderFighter(ctx, world);

    // 5. Enemies
    this.renderEnemies(ctx, world.enemies);

    // 6. Projectiles
    this.renderProjectiles(ctx, world.projectiles);

    ctx.restore();

    // 7. VFX on top of world
    vfx.render(ctx, this.camera, width, height);

    // 8. Screen-Space Overlays (Flash, Boss Intro Splash, Phase Shift Banner)
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (this.bossIntroTimer > 0 && world.boss) {
      this.renderBossIntroSplash(ctx, world, width, height);
    }

    if (this.phaseAlertTimer > 0) {
      this.renderPhaseAlertBanner(ctx, width, height);
    }

    // 9. Low-Health Pulsing Heartbeat Vignette
    this.renderLowHealthVignette(ctx, world, width, height);
  }

  private renderLowHealthVignette(ctx: CanvasRenderingContext2D, world: World, width: number, height: number): void {
    const f = world.fighter;
    if (f.hp <= 0 || f.hp > f.maxHp * 0.35) return;
    const severity = 1 - (f.hp / (f.maxHp * 0.35)); // 0..1
    const pulse = Math.sin(world.tick * 0.12) * 0.5 + 0.5; // Heartbeat sine wave
    const alpha = (0.18 + severity * 0.38) * (0.6 + pulse * 0.4);

    ctx.save();
    const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.65);
    grad.addColorStop(0, "rgba(220, 38, 38, 0)");
    grad.addColorStop(1, `rgba(220, 38, 38, ${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private renderEnvironment(ctx: CanvasRenderingContext2D, world: World, viewportWidth: number): void {
    const viewLeft = this.camera.x - (viewportWidth / this.camera.zoom) * 0.7;
    const viewRight = this.camera.x + (viewportWidth / this.camera.zoom) * 0.7;

    // Distant background mountains / pillars (parallax factor 0.2)
    ctx.save();
    ctx.fillStyle = "#0e1017";
    const bgOffset = this.camera.x * 0.2;
    for (let x = Math.floor((viewLeft - bgOffset) / 240) * 240; x < viewRight; x += 240) {
      const h = 180 + Math.abs(Math.sin(x * 0.005)) * 140;
      ctx.fillRect(x + bgOffset, this.groundY - h, 140, h);
    }
    ctx.restore();

    // Midground lane floor
    ctx.save();
    const laneH = 160;
    const grad = ctx.createLinearGradient(0, this.groundY - 10, 0, this.groundY + laneH);
    grad.addColorStop(0, THEME.bgLane);
    grad.addColorStop(1, "#07080b");
    ctx.fillStyle = grad;
    ctx.fillRect(viewLeft - 100, this.groundY - 10, (viewRight - viewLeft) + 200, laneH);

    // Ground edge line
    ctx.strokeStyle = THEME.laneLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(viewLeft - 100, this.groundY);
    ctx.lineTo(viewRight + 100, this.groundY);
    ctx.stroke();

    // Distance grid markers
    ctx.strokeStyle = THEME.gridLine;
    ctx.lineWidth = 1;
    const gridStep = 100;
    for (let x = Math.floor(viewLeft / gridStep) * gridStep; x < viewRight; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, this.groundY - 6);
      ctx.lineTo(x, this.groundY + 40);
      ctx.stroke();

      // Small tick label
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.font = "10px monospace";
      ctx.fillText(`${x}m`, x + 4, this.groundY + 16);
    }
    ctx.restore();
  }

  private renderEchoTrail(ctx: CanvasRenderingContext2D, world: World): void {
    const trail = world.cfg.trail;
    if (!trail || !trail.length) return;

    for (let i = 0; i < trail.length; i++) {
      const slot = i + 1;
      const echoX = world.echoX(slot);
      const slotDef = trail[i]!;
      const tech = TECH_MAP.get(slotDef.tech);
      const color = tech ? familyColor(tech.family) : THEME.flow;

      ctx.save();
      ctx.translate(echoX, this.groundY);

      // Ethereal ink aura
      const auraPulse = Math.sin(world.tick * 0.1 + slot) * 0.15 + 0.35;
      const auraGrad = ctx.createRadialGradient(0, -32, 4, 0, -32, 42);
      auraGrad.addColorStop(0, color);
      auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = auraGrad;
      ctx.globalAlpha = auraPulse;
      ctx.beginPath();
      ctx.arc(0, -32, 42, 0, Math.PI * 2);
      ctx.fill();

      // Echo Ghost Silhouette
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;

      // Echo body
      ctx.beginPath();
      ctx.ellipse(0, -28, 12, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Echo head
      ctx.beginPath();
      ctx.arc(0, -56, 9, 0, Math.PI * 2);
      ctx.fill();

      // Slot indicator pill
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-22, -88, 44, 18, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`E${slot} ${tech ? tech.name.slice(0, 4) : ""}`, 0, -79);

      // Link line to predecessor (slot 1 links to fighter, slot i links to slot i-1)
      const prevX = slot === 1 ? world.fighter.x : world.echoX(slot - 1);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(echoX, this.groundY - 30);
      ctx.lineTo(prevX, this.groundY - 30);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderFighter(ctx: CanvasRenderingContext2D, world: World): void {
    const f = world.fighter;
    ctx.save();
    ctx.translate(f.x, this.groundY);

    const isStriking = f.pose === "strike" || f.pose === "heavy";
    const isHurt = f.hurtT > 0;

    // Overdrive aura
    if (f.overdrive > 0) {
      ctx.save();
      ctx.fillStyle = THEME.overdrive;
      ctx.globalAlpha = 0.25 + Math.sin(world.tick * 0.2) * 0.15;
      ctx.beginPath();
      ctx.ellipse(0, -32, 22, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body Color
    ctx.fillStyle = isHurt ? THEME.healthRed : THEME.fighter;

    // Legs / Walk bob
    const walkBob = f.pose === "walk" ? Math.sin(f.poseT * 12) * 3 : 0;

    // Torso & Cloak
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(12, -32 + walkBob);
    ctx.lineTo(-8, -32 + walkBob);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(2, -48 + walkBob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Ink Sword / Weapon
    ctx.save();
    ctx.translate(8, -26 + walkBob);
    if (isStriking) {
      // Swing arc
      ctx.rotate(Math.PI * 0.45);
      ctx.strokeStyle = THEME.fighter;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(36, 0);
      ctx.stroke();

      // Weapon tip trail
      ctx.strokeStyle = THEME.fighterGlow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 36, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
    } else {
      // Resting blade angle
      ctx.rotate(-Math.PI * 0.25);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(28, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Guaranteed Crit Blade Glow
    if (f.guaranteedCrits > 0) {
      ctx.fillStyle = THEME.precision;
      ctx.beginPath();
      ctx.arc(14, -28, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead Health Mini-Bar
    const barW = 44;
    const barH = 5;
    const hpRatio = Math.max(0, Math.min(1, f.hp / f.maxHp));
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(-barW / 2, -68, barW, barH);
    ctx.fillStyle = hpRatio > 0.35 ? THEME.healthGreen : THEME.healthRed;
    ctx.fillRect(-barW / 2, -68, barW * hpRatio, barH);

    ctx.restore();
  }

  private renderEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[]): void {
    for (const e of enemies) {
      if (e.deadT > 0.6) continue;
      ctx.save();
      ctx.translate(e.x, this.groundY - (e.z ?? 0));

      const isDead = e.state === "dead";
      const isStaggered = e.staggerT > 0 || e.stunT > 0;
      const isWindup = e.state === "windup" || e.windupT > 0;
      const isBoss = !!e.isBoss;
      const isElite = !!e.elite;

      ctx.globalAlpha = isDead ? Math.max(0, 1 - e.deadT / 0.6) : 1;

      // Telegraph ring / windup indicator & warning flare
      if (isWindup && !isDead) {
        ctx.save();
        const pulse = 1 + Math.sin(e.windupT * 24) * 0.25;
        const col = isBoss ? THEME.enemyBoss : THEME.momentum;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;

        // Ground range ellipse
        ctx.beginPath();
        ctx.ellipse(0, 0, e.range * pulse * 0.45, 10, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Directional charging strike hazard cone pointing left toward player
        const coneW = Math.min(180, e.range * 0.9);
        const fillAlpha = Math.min(0.4, (e.windupT % 0.5) * 0.8 + 0.1);
        ctx.fillStyle = isBoss ? `rgba(239, 68, 68, ${fillAlpha})` : `rgba(249, 115, 22, ${fillAlpha})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-coneW, -14);
        ctx.lineTo(-coneW, 14);
        ctx.closePath();
        ctx.fill();

        // Warning Flare Beacon overhead
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -e.size * 32, 5 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Warning "!" Text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, -e.size * 32);
        ctx.restore();
      }

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(0, 0, e.size * 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Base Enemy Silhouette color
      let bodyColor = isBoss ? THEME.enemyBoss : isElite ? THEME.enemyElite : THEME.enemyNormal;
      if (e.flashT > 0) bodyColor = "#ffffff";
      else if (isStaggered) bodyColor = "#94a3b8";
      ctx.fillStyle = bodyColor;

      // Enemy Silhouette based on kind
      const rad = e.size * 14;
      ctx.beginPath();
      if (e.kind === "bulwark") {
        // Broad blocky form
        ctx.roundRect(-rad, -rad * 2.2, rad * 2, rad * 2.2, 4);
      } else if (e.kind === "lancer") {
        // Fast sloped charging form
        ctx.moveTo(-rad * 1.4, 0);
        ctx.lineTo(rad * 0.8, -rad * 1.2);
        ctx.lineTo(-rad * 0.6, -rad * 2.2);
        ctx.closePath();
      } else if (e.kind === "splitter" || e.kind === "splitling") {
        // Floating crystal shard form
        ctx.moveTo(0, -rad * 2.4);
        ctx.lineTo(rad * 1.2, -rad * 1.2);
        ctx.lineTo(0, 0);
        ctx.lineTo(-rad * 1.2, -rad * 1.2);
        ctx.closePath();
      } else if (e.kind === "duplicate") {
        // The Duplicate: Corrupted shadow king with trailing shadow echo
        ctx.save();
        ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
        ctx.beginPath();
        ctx.moveTo(-rad * 1.5, 0);
        ctx.lineTo(rad * 1.5, 0);
        ctx.lineTo(rad * 1.7, -rad * 2.8);
        ctx.lineTo(0, -rad * 3.4);
        ctx.lineTo(-rad * 1.7, -rad * 2.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Main body
        ctx.moveTo(-rad * 1.2, 0);
        ctx.lineTo(rad * 1.2, 0);
        ctx.lineTo(rad * 1.4, -rad * 2.6);
        ctx.lineTo(0, -rad * 3.2);
        ctx.lineTo(-rad * 1.4, -rad * 2.6);
        ctx.closePath();
      } else if (e.kind === "original") {
        // The Original: Ancient paragon with crowned robes
        ctx.moveTo(-rad * 1.3, 0);
        ctx.lineTo(rad * 1.3, 0);
        ctx.lineTo(rad * 1.5, -rad * 2.8);
        ctx.lineTo(0, -rad * 3.5);
        ctx.lineTo(-rad * 1.5, -rad * 2.8);
        ctx.closePath();

        // Orbiting ethereal spectral blades
        ctx.save();
        const bladeCount = 4;
        const rot = (Date.now() / 1000) * 2.5;
        for (let i = 0; i < bladeCount; i++) {
          const ang = rot + (i * Math.PI * 2) / bladeCount;
          const bx = Math.cos(ang) * (rad * 1.7);
          const by = -rad * 1.7 + Math.sin(ang) * (rad * 0.9);
          ctx.strokeStyle = THEME.precision;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - 5, by - 10);
          ctx.lineTo(bx + 5, by + 10);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Default standard husk / pawn
        ctx.ellipse(0, -rad * 1.1, rad * 0.85, rad * 1.1, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // Boss facial glowing accents
      if (e.kind === "duplicate" && !isDead) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(-rad * 0.35, -rad * 2.1, 2.5, 0, Math.PI * 2);
        ctx.arc(rad * 0.35, -rad * 2.1, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "original" && !isDead) {
        ctx.fillStyle = THEME.precision;
        ctx.fillRect(-rad * 0.45, -rad * 2.3, rad * 0.9, 3);
      }

      // Shield overlay
      if (e.shield && !isDead) {
        ctx.strokeStyle = THEME.flow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -rad * 1.1, rad * 1.35, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
      }

      // Stagger / Stun Stars
      if (isStaggered && !isDead) {
        ctx.fillStyle = THEME.precision;
        for (let i = 0; i < 3; i++) {
          const a = (e.staggerT * 10) + (i * Math.PI * 2) / 3;
          const sx = Math.cos(a) * (rad * 1.2);
          const sy = -rad * 2.4 + Math.sin(a) * 4;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Health Bar
      if (!isDead && (e.hp < e.maxHp || isBoss || isElite)) {
        const hpBarW = Math.max(36, rad * 2);
        const hpBarH = isBoss ? 7 : 4;
        const hpRatio = Math.max(0, Math.min(1, e.hp / e.maxHp));
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(-hpBarW / 2, -rad * 2.6 - 6, hpBarW, hpBarH);
        ctx.fillStyle = isBoss ? THEME.resonance : isElite ? THEME.enemyElite : THEME.healthRed;
        ctx.fillRect(-hpBarW / 2, -rad * 2.6 - 6, hpBarW * hpRatio, hpBarH);

        // Name tag for Elites and Bosses
        if (isBoss || isElite) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText((isBoss ? "BOSS: " : "ELITE ") + e.kind.toUpperCase(), 0, -rad * 2.6 - 10);
        }
      }

      ctx.restore();
    }
  }

  private renderFireZones(ctx: CanvasRenderingContext2D, zones: FireZone[]): void {
    for (const z of zones) {
      ctx.save();
      const grad = ctx.createLinearGradient(0, this.groundY - 20, 0, this.groundY + 10);
      grad.addColorStop(0, "rgba(239, 68, 68, 0.4)");
      grad.addColorStop(1, "rgba(245, 158, 11, 0.05)");
      ctx.fillStyle = grad;
      ctx.fillRect(z.x0, this.groundY - 14, z.x1 - z.x0, 24);

      // Flickering flame top
      ctx.strokeStyle = THEME.force;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(z.x0, this.groundY - 14);
      for (let x = z.x0; x < z.x1; x += 15) {
        ctx.lineTo(x + 7.5, this.groundY - 20 - Math.random() * 8);
        ctx.lineTo(x + 15, this.groundY - 14);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D, projs: Projectile[]): void {
    for (const p of projs) {
      ctx.save();
      ctx.translate(p.x, this.groundY - 28);
      ctx.fillStyle = THEME.resonance;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.strokeStyle = THEME.resonance;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(p.vx > 0 ? -16 : 16, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderBossIntroSplash(ctx: CanvasRenderingContext2D, world: World, width: number, height: number): void {
    const b = world.boss;
    if (!b) return;
    const def = BOSSES[b.id];
    const t = this.bossIntroTimer;
    const alpha = Math.min(1, Math.min(t, 3.2 - t) * 2.2);

    ctx.save();

    // Cinematic widescreen letterbox bars
    const barH = Math.min(60, height * 0.08) * alpha;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, barH);
    ctx.fillRect(0, height - barH, width, barH);

    // Vignette band in center
    const bandH = 120;
    const bandY = (height - bandH) / 2;
    const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    grad.addColorStop(0, "rgba(15, 23, 42, 0)");
    grad.addColorStop(0.5, `rgba(15, 23, 42, ${0.85 * alpha})`);
    grad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY, width, bandH);

    // Text: WARNING / BOSS ENCOUNTER
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = THEME.enemyBoss;
    ctx.fillText("✦ BOSS ENCOUNTER ✦", width / 2, height / 2 - 28);

    // Boss Name
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = b.id === "duplicate" ? "#a855f7" : "#fbbf24";
    ctx.shadowBlur = 18;
    ctx.fillText(def.name.toUpperCase(), width / 2, height / 2 + 4);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    const sub = b.id === "duplicate" ? "Echo Mimic • Inverts Your Chain" : "The First Fighter • Master of the Trail";
    ctx.fillText(sub, width / 2, height / 2 + 32);

    ctx.restore();
  }

  private renderPhaseAlertBanner(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const t = this.phaseAlertTimer;
    const alpha = Math.min(1, Math.min(t, 2.4 - t) * 3);

    ctx.save();
    ctx.globalAlpha = alpha;

    const bannerH = 46;
    const bannerY = height * 0.32;

    // Amber / crimson pulsing warning banner
    const grad = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerH);
    grad.addColorStop(0, "rgba(225, 29, 72, 0.85)");
    grad.addColorStop(1, "rgba(159, 18, 57, 0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bannerY, width, bannerH);

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, bannerY, width, bannerH);

    // Glowing alert text
    ctx.font = "900 16px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 12;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`⚠️  ${this.phaseAlertText}  ⚠️`, width / 2, bannerY + bannerH / 2);

    ctx.restore();
  }
}
