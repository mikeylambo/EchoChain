import { STARTER_TECHS } from "./data/techniques";
import type { FormId } from "./data/forms";
import {
  advance,
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
import { World, type Command } from "./sim/world";
import { ArenaRenderer } from "./render/arenaRenderer";
import { HudRenderer } from "./render/hudRenderer";
import { VfxEngine } from "./render/vfx";
import { SoundEngine } from "./audio/soundEngine";
import { FlowScreens, type ScreenState } from "./ui/screens";

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

  private screen: ScreenState = "title";
  private draftCards: DraftCard[] = [];
  private isOpeningDraft = false;
  private victorySoundPlayed = false;

  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60; // 60Hz authoritative sim tick
  private queuedCommands: Command[] = [];

  init(): void {
    const canvasEl = document.getElementById("game-canvas") as HTMLCanvasElement;
    if (!canvasEl) throw new Error("Missing #game-canvas in DOM");
    this.canvas = canvasEl;
    const context = canvasEl.getContext("2d");
    if (!context) throw new Error("Canvas 2D unavailable");
    this.ctx = context;

    this.setupResize();
    this.setupInputs();

    this.screen = "title";
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private startExpedition(form: FormId): void {
    this.sound.init();
    this.sound.uiClick();

    const seed = `run-${Date.now().toString(36)}`;
    this.run = newRun(seed, form, 0, "standard", [...STARTER_TECHS]);

    // Provide opening draft of 3 starter echoes that link to the fighter's form
    this.draftCards = makeOpeningDraft(this.run);
    this.isOpeningDraft = true;
    this.screen = "draft";
  }

  private loadCurrentFight(): void {
    const step = currentStep(this.run);
    const node = chooseFork(this.run, step.chosen >= 0 ? step.chosen : 0);
    this.world = new World(fightConfig(this.run, node));
    this.queuedCommands = [];
    this.victorySoundPlayed = false;
    this.screen = "combat";
  }

  private checkNextStep(): void {
    if (this.run.status === "won") {
      this.screen = "victory";
      this.sound.victory();
      return;
    }
    if (this.run.status === "lost") {
      this.screen = "game_over";
      return;
    }

    const step = currentStep(this.run);

    // If step has multiple choices, show fork selection screen
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
      advance(this.run);

      if (this.run.status === "won") {
        this.screen = "victory";
        this.sound.victory();
      } else {
        // Offer draft cards between fights
        this.draftCards = makeDraft(this.run);
        this.isOpeningDraft = false;
        this.screen = "draft";
      }
    } else if (this.world.outcome === "lost") {
      this.screen = "title";
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

      if (e.code === "Space") {
        e.preventDefault();
        this.handleSpaceKey();
      } else if (e.code === "KeyS" || e.code === "Enter" || e.code === "KeyK") {
        e.preventDefault();
        if (this.screen === "combat") this.triggerSync();
      } else if (e.code === "KeyM") {
        e.preventDefault();
        this.sound.toggleMute();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        this.screen = "title";
      }
    });

    // Pointer / Touch
    this.canvas.addEventListener("pointerdown", (e) => {
      this.sound.init();

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // First check screen UI interactive zones
      if (this.screen !== "combat") {
        const handled = this.screens.handlePointerDown(x, y);
        if (handled) return;
      }

      // In combat: check HUD buttons or arena tap
      if (this.screen === "combat") {
        const controls = this.hudRenderer.touchControls;

        if (this.world.outcome !== "running") {
          const btn = controls.nextBtn;
          if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
            this.sound.uiClick();
            this.advanceEncounter();
            return;
          }
        }

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
      this.startExpedition(this.screens.selectedForm);
    } else if (this.screen === "combat") {
      if (this.world.outcome !== "running") {
        this.advanceEncounter();
      } else {
        this.handleCombatAction();
      }
    } else if (this.screen === "organizer") {
      this.checkNextStep();
    }
  }

  private handleCombatAction(): void {
    if (this.world.outcome !== "running") {
      this.advanceEncounter();
      return;
    }

    if (this.world.chargeFull) {
      this.triggerSync();
    } else {
      this.world.fighterStrike(false);
      this.sound.slash();
      this.vfx.addSlash(this.world.fighter.x + 24, 50, 30);
    }
  }

  private triggerSync(): void {
    if (this.world.outcome === "running") {
      this.queuedCommands.push({ type: "sync" });
      this.sound.syncBreak();
      this.vfx.shake(this.arenaRenderer.camera, 14, 0.4);
      this.vfx.burst(this.world.fighter.x + 30, 50, "#fbbf24", 24, 200);
      this.vfx.addText(this.world.fighter.x + 20, 0, "⚡ SYNC BREAK!", "#fbbf24", 24, true);
    }
  }

  private loop(now: number): void {
    const elapsed = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.screen === "title") {
      this.screens.renderTitle(this.ctx, w, h, (form) => this.startExpedition(form));
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
        if (heal) this.run.hp = Math.min(this.run.maxHp, this.run.hp + this.run.maxHp * 0.35);
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
      this.accumulator += elapsed;

      // Fixed 60Hz sim tick
      while (this.accumulator >= this.fixedDt) {
        const cmds = [...this.queuedCommands];
        this.queuedCommands = [];
        this.world.step(cmds);
        this.accumulator -= this.fixedDt;
      }

      // Check victory sound
      if (this.world.outcome === "won" && !this.victorySoundPlayed) {
        this.victorySoundPlayed = true;
        this.sound.victory();
      }

      // Update presentation with audio routing
      this.arenaRenderer.update(this.world, elapsed, this.vfx, this.sound);
      this.vfx.update(elapsed, this.arenaRenderer.camera);

      // Render world & combat HUD
      this.arenaRenderer.render(this.ctx, this.world, this.vfx, w, h);
      this.hudRenderer.render(this.ctx, this.world, this.run, w, h);
    } else if (this.screen === "victory" || this.screen === "game_over") {
      // Victory / Game over return
      this.screens.renderTitle(this.ctx, w, h, (form) => this.startExpedition(form));
    }

    requestAnimationFrame(this.loop.bind(this));
  }
}

// Boot game when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  const game = new EchoChainGame();
  game.init();
});
