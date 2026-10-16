import { STARTER_TECHS } from "./data/techniques";
import type { FormId } from "./data/forms";
import {
  advance,
  addRelic,
  applyCard,
  applyFight,
  betweenFights,
  chooseFork,
  currentStep,
  fightConfig,
  forge,
  makeDraft,
  makeOpeningDraft,
  newRun,
  rest,
  type DraftCard,
  type MapNode,
  type RunState,
} from "./sim/run";
import { World, type Command, type FightConfig } from "./sim/world";
import { RELIC_LIST } from "./data/relics";
import { ArenaRenderer } from "./render/arenaRenderer";
import { HudRenderer } from "./render/hudRenderer";
import { VfxEngine } from "./render/vfx";
import { SoundEngine } from "./audio/soundEngine";
import { FlowScreens, type ScreenState } from "./ui/screens";
import { SaveManager } from "./storage/saveData";
import { GDD_COMBOS } from "./debug/combos";
import { GamepadManager, type GamepadState } from "./input/gamepad";
import { AchievementSystem, ACHIEVEMENTS } from "./game/achievements";
import { PWAController } from "../vendor/web-shell/src/pwa/PWAController";

class EchoChainGame {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private run!: RunState;
  private world!: World;
  private arenaRenderer = new ArenaRenderer();
  private hudRenderer = new HudRenderer();
  private vfx = new VfxEngine();
  private sound = new SoundEngine();
  private screens = new FlowScreens();
  private saveManager = new SaveManager();
  private gamepad = new GamepadManager();
  private achievements = new AchievementSystem();
  private pwa = new PWAController();

  private screen: ScreenState = "title";
  private previousScreen: ScreenState = "title";
  private draftCards: DraftCard[] = [];
  private isOpeningDraft = false;
  private victorySoundPlayed = false;

  // Kinetic juice & hitstop
  private hitstop = 0; // seconds
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60; // 60Hz authoritative sim tick
  private queuedCommands: Command[] = [];

  // Deterministic Replay System
  private currentFightConfig: FightConfig | null = null;
  private recordedCommands: { tick: number; type: "strike" | "sync" }[] = [];
  private isReplaying = false;

  init(): void {
    const canvasEl = document.getElementById("game-canvas") as HTMLCanvasElement;
    if (!canvasEl) throw new Error("Missing #game-canvas in DOM");
    this.canvas = canvasEl;
    const context = canvasEl.getContext("2d");
    if (!context) throw new Error("Canvas 2D unavailable");
    this.ctx = context;

    // Apply saved settings
    const settings = this.saveManager.get().settings;
    this.sound.setVolume(settings.volume);
    this.sound.setMuted(settings.muted);

    this.setupResize();
    this.setupInputs();

    // Attach PWA Controller for offline cache & mobile home screen installation
    this.pwa.attach(window);
    this.pwa.register("/sw.js").catch((e) => console.warn("[EchoChain] Service Worker register:", e));

    this.screen = "title";
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private tryUnlockAchievement(id: string): void {
    const isNew = this.saveManager.unlockAchievement(id);
    if (isNew) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) {
        this.achievements.queueToast(def);
        this.sound.achievement();
      }
    }
  }

  private startExpedition(
    form: FormId,
    ascension = 0,
    mode: "standard" | "endless" | "daily" = "standard",
    customSeed?: string
  ): void {
    this.sound.init();
    this.sound.uiClick();

    const today = new Date().toISOString().slice(0, 10);
    const seed = customSeed || (mode === "daily" ? `DAILY-${today}` : `run-${Date.now().toString(36)}`);
    this.run = newRun(seed, form, ascension, mode, [...STARTER_TECHS]);

    // Opening draft
    this.draftCards = makeOpeningDraft(this.run);
    this.isOpeningDraft = true;
    this.screen = "draft";
  }

  private loadCurrentFight(): void {
    const step = currentStep(this.run);
    const node = chooseFork(this.run, step.chosen >= 0 ? step.chosen : 0);
    const cfg = fightConfig(this.run, node);
    this.currentFightConfig = cfg;
    this.recordedCommands = [];
    this.isReplaying = false;
    this.world = new World(cfg);
    this.queuedCommands = [];
    this.victorySoundPlayed = false;
    this.hitstop = 0;

    // Ambient audio
    this.sound.startAmbientDrone();
    this.sound.setBossIntensity(!!this.world.boss);

    this.screen = "combat";
  }

  private startReplay(): void {
    if (!this.currentFightConfig) return;
    this.sound.uiClick();
    this.world = new World(this.currentFightConfig);
    this.queuedCommands = [];
    this.victorySoundPlayed = false;
    this.hitstop = 0;
    this.isReplaying = true;

    this.sound.startAmbientDrone();
    this.sound.setBossIntensity(!!this.world.boss);

    this.screen = "combat";
  }

  private recordLeaderboardForRun(won: boolean): void {
    const score = Math.round(
      (this.run.stats.kills * 120 + this.run.stats.longestChain * 250 + (won ? 5000 : 0)) *
        (1 + this.run.ascension * 0.2)
    );
    this.saveManager.recordLeaderboardEntry({
      mode: this.run.mode,
      form: this.run.form,
      ascension: this.run.ascension,
      score,
      kills: this.run.stats.kills,
      longestChain: this.run.stats.longestChain,
      durationMs: this.run.stats.timeMs,
      won,
      seed: this.run.seed,
    });
  }

  private checkNextStep(): void {
    if (this.run.status === "won") {
      this.sound.stopAmbientDrone();
      this.screen = "victory";
      this.sound.victory();
      this.saveManager.recordRunEnd(this.run.stats.kills, this.run.stats.longestChain, true, this.run.act, this.run.ascension, this.run.mode);
      this.recordLeaderboardForRun(true);
      if (this.run.ascension >= 5) {
        this.tryUnlockAchievement("ascension_5");
      }
      if (this.run.mode === "endless" && this.run.endlessDepth >= 10) {
        this.tryUnlockAchievement("abyssal_walker");
      }
      return;
    }
    if (this.run.status === "lost") {
      this.sound.stopAmbientDrone();
      this.screen = "game_over";
      this.saveManager.recordRunEnd(this.run.stats.kills, this.run.stats.longestChain, false, this.run.act, this.run.ascension, this.run.mode);
      this.recordLeaderboardForRun(false);
      return;
    }

    const step = currentStep(this.run);

    if (step.chosen < 0 && step.options.length > 1) {
      this.screen = "fork";
      return;
    }

    const node = step.options[Math.max(0, step.chosen)]!;
    if (node.type === "forge") {
      this.screen = "forge";
    } else if (node.type === "rest") {
      this.screen = "rest";
    } else {
      this.loadCurrentFight();
    }
  }

  private advanceEncounter(): void {
    if (this.world.outcome === "won") {
      const step = currentStep(this.run);
      const node = step.options[Math.max(0, step.chosen)]!;
      applyFight(this.run, node, this.world.stats, this.world.fighter.hp, true, this.world.fighter.x);
      betweenFights(this.run);

      // Achievements checks
      this.tryUnlockAchievement("first_strike");
      if (this.world.stats.damageTaken === 0) {
        this.tryUnlockAchievement("perfect_flow");
      }
      if (this.world.boss?.id === "duplicate") {
        this.tryUnlockAchievement("duplicate_fallen");
      }
      if (this.world.boss?.id === "original") {
        this.tryUnlockAchievement("original_sin");
      }

      // Check discovered combos from current trail
      this.checkDiscoveredCombos();

      advance(this.run);

      if (this.run.status === "won") {
        this.sound.stopAmbientDrone();
        this.screen = "victory";
        this.sound.victory();
        this.saveManager.recordRunEnd(this.run.stats.kills, this.run.stats.longestChain, true, this.run.act, this.run.ascension, this.run.mode);
        this.recordLeaderboardForRun(true);
        if (this.run.ascension >= 5) {
          this.tryUnlockAchievement("ascension_5");
        }
        if (this.run.mode === "endless" && this.run.endlessDepth >= 10) {
          this.tryUnlockAchievement("abyssal_walker");
        }
      } else {
        this.draftCards = makeDraft(this.run);
        this.isOpeningDraft = false;
        this.screen = "draft";
      }
    } else if (this.world.outcome === "lost") {
      this.sound.stopAmbientDrone();
      this.saveManager.recordRunEnd(this.world.stats.kills, this.world.stats.longestChain, false, this.run.act, this.run.ascension, this.run.mode);
      this.recordLeaderboardForRun(false);
      this.screen = "title";
    }
  }

  private checkDiscoveredCombos(): void {
    const currentTrailIds = this.run.trail.map((s) => s.tech).join(" ");
    for (const combo of GDD_COMBOS) {
      const comboStr = combo.trail.join(" ");
      if (currentTrailIds.includes(comboStr)) {
        const isNew = this.saveManager.recordCombo(combo.name);
        if (isNew) {
          this.vfx.addText(
            this.world.fighter.x,
            -20,
            `✦ DISCOVERED: ${combo.name.toUpperCase()}!`,
            "#fbbf24",
            22,
            true
          );
        }
      }
    }
    if (this.saveManager.get().discoveredCombos.length >= GDD_COMBOS.length) {
      this.tryUnlockAchievement("codex_master");
    }
  }

  private setupResize(): void {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    };

    window.addEventListener("resize", resize);
    resize();
  }

  private setupInputs(): void {
    // Keyboard
    window.addEventListener("keydown", (e) => {
      this.sound.init();

      if (e.code === "Escape") {
        e.preventDefault();
        if (this.screen === "combat") {
          this.previousScreen = "combat";
          this.screen = "pause";
        } else if (this.screen === "pause") {
          this.screen = "combat";
        } else if (this.screen === "codex") {
          this.screen = this.previousScreen;
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        this.handleSpaceKey();
      } else if (e.code === "KeyS" || e.code === "Enter" || e.code === "KeyK") {
        e.preventDefault();
        if (this.screen === "combat") this.triggerSync();
      } else if (e.code === "KeyM") {
        e.preventDefault();
        const muted = this.sound.toggleMute();
        this.saveManager.updateSettings({ muted });
      } else if (e.code === "KeyR") {
        e.preventDefault();
        this.sound.stopAmbientDrone();
        this.screen = "title";
      } else if (e.code === "ArrowLeft" && this.screen === "title") {
        if (this.screens.selectedAscension > 0) {
          this.screens.selectedAscension--;
          this.sound.uiClick();
        }
      } else if (e.code === "ArrowRight" && this.screen === "title") {
        const maxAsc = Math.min(10, this.saveManager.get().highestAscension);
        if (this.screens.selectedAscension < maxAsc) {
          this.screens.selectedAscension++;
          this.sound.uiClick();
        }
      }
    });

    // Pointer / Touch
    this.canvas.addEventListener("pointerdown", (e) => {
      this.sound.init();

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // In non-combat screens: check interactive UI zones
      if (this.screen !== "combat") {
        const handled = this.screens.handlePointerDown(x, y);
        if (handled) return;
      }

      // In combat screen: check HUD pause, sync, next, or arena tap
      if (this.screen === "combat") {
        const controls = this.hudRenderer.touchControls;

        // Check Pause button
        const pause = controls.pauseBtn;
        if (x >= pause.x && x <= pause.x + pause.w && y >= pause.y && y <= pause.y + pause.h) {
          this.sound.uiClick();
          this.previousScreen = "combat";
          this.screen = "pause";
          return;
        }

        // Check Next Encounter button
        if (this.world.outcome !== "running") {
          const btn = controls.nextBtn;
          if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
            this.sound.uiClick();
            this.advanceEncounter();
            return;
          }
        }

        // Check Sync Break button
        const sync = controls.syncBtn;
        if (x >= sync.x && x <= sync.x + sync.w && y >= sync.y && y <= sync.y + sync.h) {
          this.triggerSync();
          return;
        }

        // Tap on arena: strike
        this.handleCombatAction();
      }
    });
  }

  private handleSpaceKey(): void {
    if (this.screen === "title") {
      this.startExpedition(this.screens.selectedForm, this.screens.selectedAscension, this.screens.selectedMode, this.screens.customSeed || undefined);
    } else if (this.screen === "combat") {
      if (this.world.outcome !== "running") {
        this.advanceEncounter();
      } else {
        this.handleCombatAction();
      }
    } else if (this.screen === "organizer") {
      this.checkNextStep();
    } else if (this.screen === "victory" || this.screen === "game_over") {
      this.screen = "title";
    }
  }

  private handleCombatAction(): void {
    if (this.isReplaying) return;
    if (this.world.outcome !== "running") {
      this.advanceEncounter();
      return;
    }

    if (this.world.chargeFull) {
      this.triggerSync();
    } else {
      this.recordedCommands.push({ tick: this.world.tick, type: "strike" });
      const evs = this.world.fighterStrike(false);
      this.sound.slash();
      this.gamepad.rumble(0.2, 0.1, 35);
      this.vfx.addSlash(this.world.fighter.x + 24, 50, 30);

      // Hitstop micro-pause on crit (45ms)
      if (evs.some((ev) => ev.type === "CRIT")) {
        this.hitstop = 0.045;
      }
    }
  }

  private triggerSync(): void {
    if (this.world.outcome === "running") {
      if (!this.isReplaying) {
        this.recordedCommands.push({ tick: this.world.tick, type: "sync" });
      }
      this.queuedCommands.push({ type: "sync" });
      this.sound.syncBreak();
      this.gamepad.rumble(0.8, 1.0, 260);

      // Cinematic 60ms hitstop on Sync Break activation
      this.hitstop = 0.06;

      this.tryUnlockAchievement("sync_burst");

      const shakeMult = this.saveManager.get().settings.screenShake;
      this.vfx.shake(this.arenaRenderer.camera, 14 * shakeMult, 0.4);
      this.vfx.burst(this.world.fighter.x + 30, 50, "#fbbf24", 24, 200);
      this.vfx.addText(this.world.fighter.x + 20, 0, "⚡ SYNC BREAK!", "#fbbf24", 24, true);
    }
  }

  private handleGamepadInput(pad: GamepadState): void {
    if (!pad.connected) return;

    // Global Pause / Menu toggle
    if (pad.pausePressed) {
      if (this.screen === "combat") {
        this.sound.uiClick();
        this.screen = "pause";
      } else if (this.screen === "pause") {
        this.sound.uiClick();
        this.screen = "combat";
      } else if (this.screen === "codex") {
        this.sound.uiClick();
        this.screen = this.previousScreen;
      }
      return;
    }

    // Cancel / Back Button (B / Circle)
    if (pad.cancelPressed) {
      if (this.screen === "codex") {
        this.sound.uiClick();
        this.screen = this.previousScreen;
        return;
      }
      if (this.screen === "pause") {
        this.sound.uiClick();
        this.screen = "combat";
        return;
      }
      if (this.screen === "draft" && !this.isOpeningDraft) {
        this.sound.uiClick();
        this.screen = "organizer";
        return;
      }
    }

    // Codex Shortcut (Y / Triangle or Select)
    if (pad.codexPressed) {
      if (this.screen === "title" || this.screen === "combat" || this.screen === "pause") {
        this.sound.uiClick();
        this.previousScreen = this.screen;
        this.screen = "codex";
        return;
      }
    }

    // Screen-specific gamepad interactions
    if (this.screen === "title") {
      const forms: FormId[] = ["duelist", "brawler", "phantom"];
      const saved = this.saveManager.get();
      const unlocked = forms.filter((f) => saved.unlockedForms.includes(f));
      const curIdx = unlocked.indexOf(this.screens.selectedForm);

      if (pad.dpadLeft && curIdx > 0) {
        this.screens.selectedForm = unlocked[curIdx - 1]!;
        this.sound.uiClick();
      } else if (pad.dpadRight && curIdx < unlocked.length - 1) {
        this.screens.selectedForm = unlocked[curIdx + 1]!;
        this.sound.uiClick();
      }

      if (pad.dpadUp && this.screens.selectedAscension < saved.highestAscension) {
        this.screens.selectedAscension++;
        this.sound.uiClick();
      } else if (pad.dpadDown && this.screens.selectedAscension > 0) {
        this.screens.selectedAscension--;
        this.sound.uiClick();
      }

      if (pad.primaryPressed) {
        this.startExpedition(this.screens.selectedForm, this.screens.selectedAscension, this.screens.selectedMode, this.screens.customSeed || undefined);
      }
    } else if (this.screen === "combat") {
      if (pad.syncPressed) {
        this.triggerSync();
      } else if (pad.primaryPressed) {
        this.handleCombatAction();
      }
    } else if (this.screen === "codex") {
      const tabs: ("combos" | "achievements" | "leaderboard" | "data")[] = ["combos", "achievements", "leaderboard", "data"];
      const currentIdx = tabs.indexOf(this.screens.codexTab);
      if (pad.dpadLeft) {
        const nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
        this.screens.codexTab = tabs[nextIdx]!;
        this.sound.uiClick();
      } else if (pad.dpadRight) {
        const nextIdx = (currentIdx + 1) % tabs.length;
        this.screens.codexTab = tabs[nextIdx]!;
        this.sound.uiClick();
      }
    } else if (this.screen === "organizer") {
      if (pad.primaryPressed) {
        this.sound.uiClick();
        this.checkNextStep();
      }
    } else if (this.screen === "draft") {
      if (pad.primaryPressed && this.draftCards.length > 0) {
        this.sound.uiClick();
        applyCard(this.run, this.draftCards[0]!);
        this.screen = "organizer";
      }
    } else if (this.screen === "fork") {
      const step = currentStep(this.run);
      if (pad.primaryPressed && step.options.length > 0) {
        this.sound.uiClick();
        chooseFork(this.run, 0);
        const node = step.options[0]!;
        if (node.type === "forge") this.screen = "forge";
        else if (node.type === "rest") this.screen = "rest";
        else this.loadCurrentFight();
      }
    } else if (this.screen === "rest") {
      if (pad.primaryPressed) {
        this.sound.uiClick();
        rest(this.run, true);
        this.run.hp = Math.min(this.run.maxHp, this.run.hp + this.run.maxHp * 0.35);
        advance(this.run);
        this.screen = "organizer";
      } else if (pad.syncPressed) {
        this.sound.uiClick();
        rest(this.run, false);
        const unowned = RELIC_LIST.filter((r) => !this.run.relics.includes(r.id));
        if (unowned.length > 0) {
          const picked = unowned[Math.floor(Math.random() * unowned.length)]!;
          addRelic(this.run, picked.id);
        }
        advance(this.run);
        this.screen = "organizer";
      }
    } else if (this.screen === "forge") {
      if (pad.primaryPressed) {
        this.sound.uiClick();
        forge(this.run, 0);
        advance(this.run);
        this.screen = "organizer";
      }
    } else if (this.screen === "victory" || this.screen === "game_over") {
      if (pad.primaryPressed) {
        this.sound.uiClick();
        this.screen = "title";
      } else if (pad.syncPressed && this.currentFightConfig) {
        this.startReplay();
      }
    }
  }

  private loop(now: number): void {
    const elapsed = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Gamepad polling
    const pad = this.gamepad.poll();
    this.handleGamepadInput(pad);

    if (this.screen === "title") {
      const saved = this.saveManager.get();
      this.screens.renderTitle(
        this.ctx,
        w,
        h,
        saved.unlockedForms,
        saved.highestAscension,
        (form, ascension, mode, seed) => this.startExpedition(form, ascension, mode, seed),
        () => {
          this.previousScreen = "title";
          this.screen = "codex";
        },
        this.gamepad.getPrimaryPrompt(),
        this.pwa.canInstall ? () => this.pwa.promptInstall() : undefined
      );
    } else if (this.screen === "draft") {
      this.screens.renderDraft(
        this.ctx,
        w,
        h,
        this.draftCards,
        this.run,
        (card) => {
          this.sound.uiClick();
          applyCard(this.run, card);
          this.screen = "organizer";
        },
        this.isOpeningDraft ? undefined : () => {
          this.sound.uiClick();
          this.screen = "organizer";
        }
      );
    } else if (this.screen === "organizer") {
      this.screens.renderOrganizer(
        this.ctx,
        w,
        h,
        this.run,
        (from, to) => {
          this.sound.uiClick();
          const next = [...this.run.trail];
          const item = next.splice(from, 1)[0]!;
          next.splice(to, 0, item);
          this.run.trail = next;
        },
        () => {
          this.sound.uiClick();
          this.checkNextStep();
        }
      );
    } else if (this.screen === "fork") {
      const step = currentStep(this.run);
      this.screens.renderFork(this.ctx, w, h, step.options, (index) => {
        this.sound.uiClick();
        chooseFork(this.run, index);
        const node = step.options[index]!;
        if (node.type === "forge") this.screen = "forge";
        else if (node.type === "rest") this.screen = "rest";
        else this.loadCurrentFight();
      });
    } else if (this.screen === "rest") {
      this.screens.renderRest(this.ctx, w, h, this.run, (heal) => {
        this.sound.uiClick();
        rest(this.run, heal);
        if (heal) {
          this.run.hp = Math.min(this.run.maxHp, this.run.hp + this.run.maxHp * 0.35);
        } else {
          const unowned = RELIC_LIST.filter((r) => !this.run.relics.includes(r.id));
          if (unowned.length > 0) {
            const picked = unowned[Math.floor(Math.random() * unowned.length)]!;
            addRelic(this.run, picked.id);
            this.vfx.addText(w / 2, h / 2, `✦ RELIC: ${picked.name.toUpperCase()}!`, "#38bdf8", 22, true);
          }
        }
        advance(this.run);
        this.screen = "organizer";
      });
    } else if (this.screen === "forge") {
      this.screens.renderForge(this.ctx, w, h, this.run, (slot) => {
        this.sound.uiClick();
        forge(this.run, slot);
        advance(this.run);
        this.screen = "organizer";
      });
    } else if (this.screen === "combat") {
      // Micro-Hitstop logic
      if (this.hitstop > 0) {
        this.hitstop -= elapsed;
      } else {
        this.accumulator += elapsed;

        // Fixed 60Hz sim tick
        while (this.accumulator >= this.fixedDt) {
          if (this.isReplaying) {
            const replayCmds = this.recordedCommands.filter((c) => c.tick === this.world.tick);
            for (const cmd of replayCmds) {
              if (cmd.type === "strike") {
                this.world.fighterStrike(false);
                this.sound.slash();
              } else if (cmd.type === "sync") {
                this.queuedCommands.push({ type: "sync" });
                this.sound.syncBreak();
              }
            }
          }
          const cmds = [...this.queuedCommands];
          this.queuedCommands = [];
          this.world.step(cmds);
          this.accumulator -= this.fixedDt;
        }
      }

      // Check victory sound
      if (this.world.outcome === "won" && !this.victorySoundPlayed) {
        this.victorySoundPlayed = true;
        this.sound.victory();
      }

      // Update presentation with audio routing and haptic feedback
      this.arenaRenderer.update(this.world, elapsed, this.vfx, this.sound, this.gamepad);
      this.vfx.update(elapsed, this.arenaRenderer.camera);

      // Check chain length achievements
      if (this.world.stats.longestChain >= 5) {
        this.tryUnlockAchievement("chain_5");
      }
      if (this.world.stats.longestChain >= 7) {
        this.tryUnlockAchievement("chain_7");
      }

      // Render world & combat HUD
      this.arenaRenderer.render(this.ctx, this.world, this.vfx, w, h);
      this.hudRenderer.render(this.ctx, this.world, this.run, w, h, {
        primary: this.gamepad.getPrimaryPrompt(),
        sync: this.gamepad.getSyncPrompt(),
      });
    } else if (this.screen === "pause") {
      // Keep rendering frozen combat behind pause modal
      this.arenaRenderer.render(this.ctx, this.world, this.vfx, w, h);
      this.hudRenderer.render(this.ctx, this.world, this.run, w, h, {
        primary: this.gamepad.getPrimaryPrompt(),
        sync: this.gamepad.getSyncPrompt(),
      });

      const settings = this.saveManager.get().settings;
      this.screens.renderPause(
        this.ctx,
        w,
        h,
        settings,
        () => {
          this.sound.uiClick();
          this.screen = "combat";
        },
        () => {
          const muted = this.sound.toggleMute();
          this.saveManager.updateSettings({ muted });
        },
        (delta) => {
          this.sound.uiClick();
          const newVol = Math.max(0, Math.min(1, Math.round((settings.volume + delta) * 10) / 10));
          this.sound.setVolume(newVol);
          this.saveManager.updateSettings({ volume: newVol });
        },
        (delta) => {
          this.sound.uiClick();
          const newShake = Math.max(0, Math.min(1.5, Math.round((settings.screenShake + delta) * 10) / 10));
          this.saveManager.updateSettings({ screenShake: newShake });
        },
        () => {
          this.sound.uiClick();
          this.previousScreen = "pause";
          this.screen = "codex";
        },
        () => {
          this.sound.uiClick();
          this.sound.stopAmbientDrone();
          this.saveManager.recordRunEnd(this.world.stats.kills, this.world.stats.longestChain, false, this.run.act, this.run.ascension, this.run.mode);
          this.screen = "title";
        }
      );
    } else if (this.screen === "codex") {
      const saved = this.saveManager.get();
      this.screens.renderCodex(
        this.ctx,
        w,
        h,
        saved.discoveredCombos,
        saved.unlockedAchievements ?? [],
        saved.leaderboard ?? [],
        () => {
          this.sound.uiClick();
          this.screen = this.previousScreen;
        },
        () => {
          const b64 = this.saveManager.exportSave();
          try {
            navigator.clipboard?.writeText(b64);
            alert("Save data exported and copied to clipboard!");
          } catch {
            prompt("Copy your exported save data:", b64);
          }
        },
        (code) => {
          const ok = this.saveManager.importSave(code);
          if (ok) {
            alert("Save data successfully imported!");
          } else {
            alert("Invalid save data string.");
          }
        }
      );
    } else if (this.screen === "victory" || this.screen === "game_over") {
      this.screens.renderRunSummary(
        this.ctx,
        w,
        h,
        this.run,
        this.screen === "victory",
        () => {
          this.sound.uiClick();
          this.screen = "title";
        },
        this.currentFightConfig ? () => this.startReplay() : undefined
      );
    }

    // Update & render achievement notifications across any screen
    this.achievements.update(elapsed);
    this.achievements.render(this.ctx, w);

    requestAnimationFrame(this.loop.bind(this));
  }
}

// Boot game when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  const game = new EchoChainGame();
  game.init();
});
