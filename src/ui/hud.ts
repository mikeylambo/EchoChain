import { BOSSES } from "../data/bosses";
import { SEAL } from "../data/seals";
import { TUNING } from "../data/tuning";
import type { RunState } from "../sim/run";
import type { World } from "../sim/world";
import { el } from "./dom";
import { UI_ICON } from "./icons";
import { buildStrip, portrait, type Strip } from "./trailStrip";

const RING = 2 * Math.PI * 29;

export interface HudCallbacks {
  sync(): void;
  pause(): void;
  speed(): void;
}

export class Hud {
  readonly root = document.getElementById("hud")!;
  private strip: Strip | null = null;
  private hpI!: HTMLElement;
  private hpU!: HTMLElement;
  private hpN!: HTMLElement;
  private ring!: SVGCircleElement;
  private portraitEl!: HTMLElement;
  private syncBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private bossbar: HTMLElement | null = null;
  private bossI: HTMLElement | null = null;
  private last = { hp: -1, charge: -1, full: false, boss: -1 };
  private tut: HTMLElement | null = null;

  mount(run: RunState, w: World, where: string, cb: HudCallbacks, speed: number): void {
    this.root.innerHTML = "";
    this.root.hidden = false;
    const tl = el("div", "tl");
    tl.innerHTML = `<div class="portrait" title="Sync Break (Space)"><svg viewBox="0 0 66 66"><defs><linearGradient id="syncgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc94a"/><stop offset=".5" stop-color="#ff3b4e"/><stop offset="1" stop-color="#3ff0ff"/></linearGradient></defs><circle class="ringbg" cx="33" cy="33" r="29" fill="none" stroke-width="3"/><circle class="ring" cx="33" cy="33" r="29" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg><canvas></canvas></div>
      <div class="hp"><div class="nums"></div><div class="bar"><u></u><i></i></div><div class="seals">${run.seals.map((s) => `<span title="${SEAL[s]?.name}: ${SEAL[s]?.desc}">${SEAL[s]?.glyph}</span>`).join("")}</div></div>`;
    this.portraitEl = tl.querySelector(".portrait")!;
    portrait(tl.querySelector("canvas")!, run.form, 48, 48, 0.46);
    this.portraitEl.addEventListener("click", () => cb.sync());
    this.hpI = tl.querySelector(".bar > i")!;
    this.hpU = tl.querySelector(".bar > u")!;
    this.hpN = tl.querySelector(".nums")!;
    this.ring = tl.querySelector(".ring")!;
    const tr = el("div", "tr");
    tr.innerHTML = `<div class="where">${where}</div>`;
    this.speedBtn = el("button", "iconbtn") as HTMLButtonElement;
    this.speedBtn.title = "Battle speed (Tab)";
    this.speedBtn.addEventListener("click", () => { cb.speed(); this.speedBtn.blur(); });
    const pause = el("button", "iconbtn", UI_ICON.pause) as HTMLButtonElement;
    pause.title = "Pause (Esc)";
    pause.addEventListener("click", () => { pause.blur(); cb.pause(); });
    tr.append(this.speedBtn, pause);
    this.setSpeed(speed);
    this.syncBtn = el("button", "syncbtn", `Sync Break<span class="k">SPACE</span>`) as HTMLButtonElement;
    this.syncBtn.hidden = true;
    this.syncBtn.addEventListener("click", () => { this.syncBtn.blur(); cb.sync(); });
    const trail = el("div", "hud-trail");
    this.strip = buildStrip(w.cfg.trail, { form: run.form });
    trail.appendChild(this.strip.el);
    this.root.append(tl, tr, this.syncBtn, trail);
    this.bossbar = null;
    if (w.boss) {
      const def = BOSSES[w.boss.id];
      const bb = el("div", `bossbar ${w.boss.id}`);
      bb.innerHTML = `<div class="bn">${def.name}</div><div class="bb"><i style="width:100%"></i>${def.phaseAt.map((p) => `<em style="left:${p * 100}%"></em>`).join("")}</div><div class="rule">${w.boss.id === "original" ? "Only chains of 3+ links break its guard" : "It marches your trail — reversed"}</div>`;
      this.bossI = bb.querySelector(".bb > i");
      this.bossbar = bb;
      this.root.appendChild(bb);
    }
    this.last = { hp: -1, charge: -1, full: false, boss: -1 };
  }

  setSpeed(s: number): void {
    this.speedBtn.innerHTML = `<b style="font-family:var(--display);font-size:11px">${s}×</b>`;
    this.speedBtn.classList.toggle("on", s === 2);
  }

  update(w: World, syncing: boolean): void {
    const f = w.fighter;
    const hp = Math.max(0, Math.ceil(f.hp));
    if (hp !== this.last.hp) {
      const pct = `${(Math.max(0, f.hp) / f.maxHp) * 100}%`;
      this.hpI.style.width = pct;
      this.hpU.style.width = pct;
      this.hpN.innerHTML = `${hp} <span>/ ${f.maxHp}</span>`;
      this.last.hp = hp;
    }
    const c = Math.round((w.charge / TUNING.syncChargeMax) * 100);
    if (c !== this.last.charge) {
      this.ring.style.strokeDashoffset = String(RING * (1 - c / 100));
      this.last.charge = c;
    }
    const full = w.chargeFull && w.outcome === "running" && !syncing;
    if (full !== this.last.full) {
      this.portraitEl.classList.toggle("full", full);
      this.syncBtn.hidden = !full;
      this.last.full = full;
    }
    if (this.bossI && w.boss) {
      const b = w.enemyById(w.boss.enemyId);
      const pct = b ? Math.max(0, b.hp / b.maxHp) : 0;
      const k = Math.round(pct * 1000);
      if (k !== this.last.boss) {
        this.bossI.style.width = `${pct * 100}%`;
        this.last.boss = k;
      }
    }
  }

  fire(slot: number): void {
    const t = this.strip?.tiles[slot];
    if (t) { t.classList.remove("fire"); void t.offsetWidth; t.classList.add("fire"); }
    const l = this.strip?.links[slot];
    if (l) { l.classList.remove("fire"); void l.offsetWidth; l.classList.add("fire"); }
  }

  tutorial(kind: "link" | "sync"): void {
    this.tut?.remove();
    const t = el("div", "tut");
    t.innerHTML = kind === "link"
      ? `<div class="t1">Echoes follow you</div><div class="t2">Each one reacts to the echo directly ahead of it.</div>`
      : `<div class="t1">Sync Break ready</div><div class="t2">Press Space or tap your portrait — every echo strikes at once.</div>`;
    this.root.appendChild(t);
    this.tut = t;
    window.setTimeout(() => { t.style.transition = "opacity .6s"; t.style.opacity = "0"; window.setTimeout(() => t.remove(), 700); }, kind === "link" ? 3200 : 3800);
  }

  hide(): void {
    this.root.hidden = true;
    this.root.innerHTML = "";
    this.strip = null;
  }
}
