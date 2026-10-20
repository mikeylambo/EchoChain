import { FORMS, type FormId } from "../data/forms";
import { TECH } from "../data/techniques";
import { drawInkFigure, rigFor } from "../render/figure";
import type { TrailSlot } from "../sim/chain";
import { analyzeTrail } from "../sim/links";
import type { ChainEventType } from "../sim/types";
import { el } from "./dom";
import { evIcon, techIcon } from "./icons";

export function famClass(tech: string): string {
  return `fam-${TECH[tech]?.family ?? "ink"}`;
}

export function pips(rank: number, next = false): string {
  let s = '<span class="pips">';
  for (let i = 1; i <= 3; i++) s += `<i class="pip ${i <= rank ? "on" : next && i === rank + 1 ? "next" : ""}"></i>`;
  return s + "</span>";
}

export function ioIcons(tech: string): string {
  const t = TECH[tech];
  if (!t) return "";
  const rec = t.receives.filter((r) => r !== "TICK").map((r) => evIcon(r)).join("");
  const em = t.emits.map((e) => evIcon(e)).join("");
  return `<span class="evs">${rec}</span><span class="arrow">→</span><span class="evs">${em}</span>`;
}

/** Render a figure portrait into a canvas. */
export function portrait(canvas: HTMLCanvasElement, form: FormId | "original" | "duplicate", w: number, h: number, scale: number, pose: Parameters<typeof rigFor>[0] = "idle", t = 0.3): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w * 0.46, h * 0.94);
  ctx.scale(scale, scale);
  drawInkFigure(ctx, rigFor(pose, t), { form, time: 1.2, speed: 20 });
}

export interface StripOpts {
  slots?: number;
  compact?: boolean;
  form: FormId;
}

export interface Strip {
  el: HTMLElement;
  tiles: HTMLElement[]; // index 0 = fighter
  links: HTMLElement[]; // links[j] connects j-1 → j
}

export function tileHtml(s: TrailSlot, j: number): string {
  const t = TECH[s.tech]!;
  return `<span class="slotno">${j}</span><div class="glyph">${techIcon(s.tech)}</div><div class="nm">${t.name}</div><div class="io">${ioIcons(s.tech)}</div>${pips(s.rank)}`;
}

export function buildStrip(trail: readonly TrailSlot[], o: StripOpts): Strip {
  const wrap = el("div", "trail");
  const tiles: HTMLElement[] = [];
  const links: HTMLElement[] = [null as unknown as HTMLElement];
  const info = analyzeTrail(trail, o.form);
  const f = el("div", "tile fighter fam-ink");
  f.innerHTML = `<span class="slotno">0</span><canvas></canvas><div class="nm">${FORMS[o.form].name}</div><div class="io"><span class="evs">${info.emits[0]!.filter((e) => e !== "KILL").map((e) => evIcon(e)).join("")}</span></div>`;
  portrait(f.querySelector("canvas")!, o.form, 48, 48, 0.42);
  wrap.appendChild(f);
  tiles.push(f);
  const total = Math.max(trail.length, o.slots ?? 0);
  for (let j = 1; j <= total; j++) {
    const lk = el("div", "link");
    const s = trail[j - 1];
    if (s) {
      const prev = j === 1 ? null : trail[j - 2]!;
      const sendFam = prev ? TECH[prev.tech]!.family : "ink";
      lk.classList.add(`fam-${sendFam}`);
      const t = TECH[s.tech]!;
      const world = t.receives.includes("ENEMY_ATTACK");
      const up = info.emits[j - 1]!;
      const matched: ChainEventType[] = t.receives.includes("ANY") ? up.slice(0, 2) : up.filter((e) => t.receives.includes(e));
      if (info.links[j]) {
        lk.classList.add("on");
        lk.innerHTML = `<span class="lk">${matched.slice(0, 2).map((e) => evIcon(e)).join("")}</span>`;
      } else if (world) {
        lk.classList.add("off", "fam-precision");
        lk.innerHTML = `<span class="lk" style="color:var(--gold)">${evIcon("ENEMY_ATTACK")}</span>`;
        lk.title = "Starts its own chain from enemy attacks";
      } else {
        lk.classList.add("off");
        lk.innerHTML = "";
        lk.title = "No link: this echo doesn't receive what the one ahead sends";
      }
      const tile = el("div", `tile ${famClass(s.tech)}`);
      tile.innerHTML = tileHtml(s, j);
      tile.dataset.tech = s.tech;
      wrap.appendChild(lk);
      wrap.appendChild(tile);
      tiles.push(tile);
    } else {
      lk.classList.add("off");
      const tile = el("div", "tile empty", `<span class="slotno">${j}</span><div>Empty</div>`);
      wrap.appendChild(lk);
      wrap.appendChild(tile);
      tiles.push(tile);
    }
    links.push(lk);
  }
  if (o.compact) wrap.classList.add("compact");
  return { el: wrap, tiles, links };
}
