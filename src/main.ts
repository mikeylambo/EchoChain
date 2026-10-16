import { STARTER_TECHS } from "./data/techniques";
import {
  advance,
  applyFight,
  chooseFork,
  currentStep,
  fightConfig,
  newRun,
  type RunState,
} from "./sim/run";
import { World, type Command } from "./sim/world";
import { ArenaRenderer } from "./render/arenaRenderer";
import { HudRenderer } from "./render/hudRenderer";
import { VfxEngine } from "./render/vfx";

class EchoChainGame {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private run!: RunState;
  private world!: World;
  private arenaRenderer = new ArenaRenderer();
  private hudRenderer = new HudRenderer();
  private vfx = new VfxEngine();

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
    this.startNewRun();

    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private startNewRun(): void {
    const seed = `run-${Date.now().toString(36)}`;
    this.run = newRun(seed, "duelist", 0, "standard", [...STARTER_TECHS]);

    // Equip starter trail echoes: Needle (rank 1), Read (rank 1), Guard (rank 1)
    this.run.trail = [
      { tech: "needle", rank: 1 },
      { tech: "read", rank: 1 },
      { tech: "guard", rank: 1 },
    ];

    this.loadCurrentFight();
  }

  private loadCurrentFight(): void {
    const step = currentStep(this.run);
    const node = chooseFork(this.run, step.chosen >= 0 ? step.chosen : 0);
    this.world = new World(fightConfig(this.run, node));
    this.queuedCommands = [];
    console.info(`[EchoChain] Loaded Act ${this.world.cfg.act} Encounter:`, node.plan?.boss ?? node.family);
  }

  private advanceToNext(): void {
    if (this.world.outcome === "won") {
      const step = currentStep(this.run);
      const node = step.options[step.chosen]!;
      applyFight(this.run, node, this.world.stats, this.world.fighter.hp, true, this.world.fighter.x);
      // Advance step / act
      advance(this.run);
      if (this.run.status === "won" || this.run.status === "lost") {
        this.startNewRun();
      } else {
        this.loadCurrentFight();
      }
    } else if (this.world.outcome === "lost") {
      this.startNewRun();
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
      if (e.code === "Space") {
        e.preventDefault();
        this.handleActionClick();
      } else if (e.code === "KeyS" || e.code === "Enter" || e.code === "KeyK") {
        e.preventDefault();
        this.triggerSync();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        this.startNewRun();
      }
    });

    // Touch / Mouse Click
    this.canvas.addEventListener("pointerdown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const controls = this.hudRenderer.touchControls;

      // Check Next / Retry button
      if (this.world.outcome !== "running") {
        const btn = controls.nextBtn;
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          this.advanceToNext();
          return;
        }
      }

      // Check Sync button
      const sync = controls.syncBtn;
      if (x >= sync.x && x <= sync.x + sync.w && y >= sync.y && y <= sync.y + sync.h) {
        this.triggerSync();
        return;
      }

      // Default Canvas Tap: Strike action or continue
      this.handleActionClick();
    });
  }

  private handleActionClick(): void {
    if (this.world.outcome !== "running") {
      this.advanceToNext();
      return;
    }

    if (this.world.chargeFull) {
      this.triggerSync();
    } else {
      // Manual strike attempt
      this.world.fighterStrike(false);
      this.vfx.addSlash(this.world.fighter.x + 24, 50, 30);
    }
  }

  private triggerSync(): void {
    if (this.world.outcome === "running") {
      this.queuedCommands.push({ type: "sync" });
      this.vfx.shake(this.arenaRenderer.camera, 14, 0.4);
      this.vfx.burst(this.world.fighter.x + 30, 50, "#fbbf24", 24, 200);
      this.vfx.addText(this.world.fighter.x + 20, 0, "⚡ SYNC BREAK!", "#fbbf24", 24, true);
    }
  }

  private loop(now: number): void {
    const elapsed = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.accumulator += elapsed;

    // Fixed 60Hz authoritative simulation step
    while (this.accumulator >= this.fixedDt) {
      const cmds = [...this.queuedCommands];
      this.queuedCommands = [];
      this.world.step(cmds);
      this.accumulator -= this.fixedDt;
    }

    // Smooth visual updates & VFX
    this.arenaRenderer.update(this.world, elapsed, this.vfx);
    this.vfx.update(elapsed, this.arenaRenderer.camera);

    // Render Canvas
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.arenaRenderer.render(this.ctx, this.world, this.vfx, w, h);
    this.hudRenderer.render(this.ctx, this.world, this.run, w, h);

    requestAnimationFrame(this.loop.bind(this));
  }
}

// Boot application
window.addEventListener("DOMContentLoaded", () => {
  const game = new EchoChainGame();
  game.init();
});
