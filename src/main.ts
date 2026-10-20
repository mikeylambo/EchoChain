import "./ui/style.css";
import { audio } from "./audio/audio";
import { Game } from "./app/game";
import { pollGamepads } from "./ui/gamepad";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const game = new Game(canvas);

const unlock = () => {
  audio.unlock();
  game.applySettings();
};
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

const ro = new ResizeObserver(() => game.view.resize());
ro.observe(canvas);
window.addEventListener("orientationchange", () => window.setTimeout(() => game.view.resize(), 200));

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.fightWorld && game.fightWorld.outcome === "running" && !game.view.paused) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }
});

const loop = (now: number) => {
  game.frame(now);
  pollGamepads(() => !!game.fightWorld && !document.getElementById("hud")!.hidden);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

void (document.fonts?.ready ?? Promise.resolve()).then(() => game.start());
