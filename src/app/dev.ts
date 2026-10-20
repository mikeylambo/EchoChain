import { TECH, TECHNIQUES } from "../data/techniques";
import { FORM_LIST } from "../data/forms";
import { saveProfile } from "../meta/profile";
import type { EnemyKind } from "../sim/types";
import { World } from "../sim/world";
import type { Game } from "./game";

/** F1 debug overlay + window.__dev hooks for bots and screenshots. */
export class DevOverlay {
  private box: HTMLElement | null = null;
  private n = 0;

  constructor(private readonly g: Game) {
    window.addEventListener("keydown", (e) => {
      if (e.key === "F1") { e.preventDefault(); this.toggle(); }
    });
    (window as unknown as { __dev: unknown }).__dev = {
      game: g,
      view: () => g.view,
      world: () => g.fightWorld,
      run: () => g.run,
      hq: () => { g.view.lockQuality = true; },
      win: () => g.forceOutcome(true),
      lose: () => g.forceOutcome(false),
      charge: () => { const w = g.fightWorld; if (w) w.charge = 999; },
      unlockAll: () => {
        g.profile.techs = TECHNIQUES.map((t) => t.id);
        g.profile.forms = [...FORM_LIST];
        g.profile.endless = true;
        g.profile.ascension = 10;
        saveProfile(g.profile);
      },
      reset: () => { localStorage.removeItem("echochain.profile.v1"); location.reload(); },
      /** Sandbox: any trail vs any enemies in the live view. */
      sandbox: (trail: string[], enemies: EnemyKind[] = ["husk", "husk", "bulwark"], act = 1, rank: 1 | 2 | 3 = 1, form: "duelist" | "brawler" | "phantom" = "duelist") => {
        const w = new World({
          seed: "SANDBOX", form, trail: trail.filter((t) => TECH[t]).map((tech) => ({ tech, rank })), act, hp: 9999, maxHp: 9999, ascension: 0, sandbox: true,
          plan: { family: "mixed", groups: enemies.map((kind, i) => ({ at: i * 0.6, kind, count: 1 })) },
        });
        g.view.setWorld(w, act);
        g.view.attract = true;
        g.fightWorld = w;
        return w;
      },
    };
  }

  toggle(): void {
    if (this.box) { this.box.remove(); this.box = null; return; }
    this.box = document.createElement("div");
    this.box.className = "overlay-dev";
    document.getElementById("app")!.appendChild(this.box);
  }

  frame(): void {
    if (!this.box || ++this.n % 10) return;
    const w = this.g.fightWorld ?? this.g.view.world;
    if (!w) { this.box.textContent = "no world"; return; }
    const trail = w.cfg.trail.map((s, i) => {
      const t = TECH[s.tech]!;
      return `${i + 1}. ${t.name} r${s.rank}  [${t.receives.join(",")}] → [${t.emits.join(",")}]`;
    }).join("<br>");
    const log = w.log.slice(-20).map((e) => `t${e.tick} s${e.slot} ${e.type} c${e.chainId} L${e.links}`).join("<br>");
    this.box.innerHTML = `<b>seed</b> ${w.cfg.seed} <b>tick</b> ${w.tick} <b>alive</b> ${w.aliveSorted().length} <b>charge</b> ${w.charge.toFixed(0)}<br><b>longest</b> ${w.stats.longestChain} <b>dropped</b> ${w.stats.dropped} <b>violations</b> ${w.stats.violations}<br><br>${trail}<br><br>${log}`;
  }
}
