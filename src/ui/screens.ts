import { audio } from "../audio/audio";
import { ASCENSIONS, BOSSES } from "../data/bosses";
import { FORM_LIST, FORMS, type FormId } from "../data/forms";
import { SEAL } from "../data/seals";
import { TECH, TECHNIQUES } from "../data/techniques";
import { THEMES } from "../render/background";
import type { TrailSlot } from "../sim/chain";
import { analyzeTrail, bestOrder } from "../sim/links";
import { arrange, currentStep, type DraftCard, type MapNode, type RunState } from "../sim/run";
import { goalFor, type CodexEntry, type Profile, type Unlocks } from "../meta/profile";
import { btn, el, frag, keys, mount } from "./dom";
import { evIcon, nodeIcon, techIcon, UI_ICON } from "./icons";
import { buildStrip, famClass, ioIcons, pips, portrait, tileHtml } from "./trailStrip";

const ROMAN = ["", "I", "II", "III"];

/** One number per technique. The icons are the rules; this is the size. */
export const STAT: Record<string, string> = {
  guard: "6s", read: "300%", needle: "30%", pinpoint: "150%", sunder: "−10%", executioner: "15%", lastlight: "CRIT", riposte: "140%",
  launcher: "↑", juggler: "×2", slam: "AoE", flurry: "×3", pursuit: "130%", shockline: "AoE", tempo: "3RD", overdrive: "+4%",
  mirror: "70%", amplifier: "+60%", prism: "×3", inverse: "⇄", doppel: "+1", bell: "AoE", harvest: "+8%", burning: "2s",
};

// ───────────────────────── Title
export function titleScreen(p: Profile): Promise<"continue" | "new" | "codex" | "settings"> {
  return new Promise((resolve) => {
    const s = el("div", "scr title-scr");
    s.innerHTML = `<div class="logo"><div class="word">ECHO CHAIN</div><div class="tag">ARMY OF ONE</div></div>`;
    const menu = el("div", "menu");
    let pop = () => {};
    const go = (r: Parameters<typeof resolve>[0]) => { pop(); resolve(r); };
    if (p.savedRun) {
      const c = btn(`Continue <span class="k">Act ${p.savedRun.mode === "endless" ? "∞" : ROMAN[p.savedRun.act]}</span>`, "btn primary", () => go("continue"));
      c.dataset.autofocus = "";
      menu.appendChild(c);
    }
    const n = btn("New Run", p.savedRun ? "btn" : "btn primary", () => go("new"));
    if (!p.savedRun) n.dataset.autofocus = "";
    menu.appendChild(n);
    menu.appendChild(btn("Codex", "btn", () => go("codex")));
    menu.appendChild(btn("Settings", "btn", () => go("settings")));
    s.appendChild(menu);
    s.appendChild(frag(`<div class="title-foot">${p.runs ? `Runs ${p.runs} · Wins ${p.wins} · Best chain ×${p.bestChain}` : "A Soulfire Legends Universe game"}</div>`));
    pop = keys((e) => {
      if (e.key === "Enter") go(p.savedRun ? "continue" : "new");
    });
    s.dataset.screen = "title";
    mount(s);
  });
}

// ───────────────────────── New run
export interface NewRunChoice { form: FormId; ascension: number; mode: "standard" | "endless" }

export function newRunScreen(p: Profile): Promise<NewRunChoice | null> {
  return new Promise((resolve) => {
    let form: FormId = p.forms.includes("duelist") ? "duelist" : p.forms[0]!;
    let asc = 0;
    let mode: "standard" | "endless" = "standard";
    const s = el("div", "scr dim");
    s.innerHTML = ``;
    const forms = el("div", "forms");
    const cards: HTMLElement[] = [];
    const lockText: Record<FormId, string> = { duelist: "", brawler: "Clear Act I", phantom: "Clear a run" };
    for (const id of FORM_LIST) {
      const f = FORMS[id];
      const locked = !p.forms.includes(id);
      const c = el("div", `form-card ${locked ? "locked" : ""}`);
      c.tabIndex = locked ? -1 : 0;
      c.innerHTML = `<canvas></canvas><div class="fn">${f.name}</div>
        <div class="fs"><span>${UI_ICON.heart.replace("<svg", '<svg style="width:12px;height:12px;vertical-align:-1px"')} ${f.hp}</span><span>${f.interval}s</span><span>${"◆".repeat(f.startSlots)}</span></div>
        ${locked ? `<div class="lockline">${UI_ICON.lock} ${lockText[id]}</div>` : ""}`;
      portrait(c.querySelector("canvas")!, id, 140, 150, 1.25, locked ? "idle" : "victory", locked ? 0.3 : 0.6);
      if (!locked) {
        c.addEventListener("click", () => { form = id; audio.ui("tick"); sync(); });
        c.addEventListener("dblclick", () => start());
      }
      cards.push(c);
      forms.appendChild(c);
    }
    s.appendChild(forms);
    const opts = el("div", "col");
    const modeCtl = el("div", "seg-ctl");
    modeCtl.innerHTML = `<button data-m="standard">Ascent</button><button data-m="endless" ${p.endless ? "" : "disabled"}>Endless</button>`;
    modeCtl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.m as typeof mode; audio.ui("tick"); sync(); }));
    opts.appendChild(modeCtl);
    const ascRow = el("div", "col");
    if (p.ascension > 0) {
      ascRow.innerHTML = `<div class="stepper"><button class="iconbtn" data-d="-1">−</button><div><div class="kicker" style="text-align:center">Ascension</div><div class="val"></div></div><button class="iconbtn" data-d="1">+</button></div><div class="asc-desc"></div>`;
      ascRow.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { asc = Math.max(0, Math.min(p.ascension, asc + Number(b.dataset.d))); audio.ui("tick"); sync(); }));
    }
    opts.appendChild(ascRow);
    s.appendChild(opts);
    const row = el("div", "row");
    row.style.marginTop = "22px";
    const back = btn("Back", "btn ghost", () => { pop(); resolve(null); }, "back");
    const go = btn("March", "btn primary", () => start());
    go.dataset.autofocus = "";
    row.append(back, go);
    s.appendChild(row);
    function sync() {
      cards.forEach((c, i) => c.classList.toggle("on", FORM_LIST[i] === form));
      modeCtl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
      const v = ascRow.querySelector(".val");
      if (v) v.textContent = String(asc);
      const d = ascRow.querySelector(".asc-desc");
      if (d) d.textContent = asc === 0 ? "" : ASCENSIONS[asc - 1]!.desc;
    }
    function start() { pop(); resolve({ form, ascension: mode === "endless" ? 0 : asc, mode }); }
    const pop = keys((e) => {
      if (e.key === "Escape") { pop(); resolve(null); }
      if (e.key === "Enter") start();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const av = FORM_LIST.filter((f) => p.forms.includes(f));
        const i = av.indexOf(form);
        form = av[(i + (e.key === "ArrowRight" ? 1 : av.length - 1)) % av.length]!;
        audio.ui("tick");
        sync();
      }
    });
    sync();
    s.dataset.screen = "newRun";
    mount(s);
  });
}

// ───────────────────────── Draft
export interface DraftOpts { title?: string; kicker?: string; banner?: string; sub?: string }

function cardEl(card: DraftCard, run: RunState, idx: number): HTMLElement {
  if (card.kind === "seal") {
    const d = SEAL[card.seal]!;
    const c = el("div", "card seal");
    c.innerHTML = `<span class="key">${idx + 1}</span><div class="glyph">${d.glyph}</div><div class="name">${d.name}</div><div class="chip-stat">${d.desc}</div>`;
    return c;
  }
  const t = TECH[card.tech]!;
  const c = el("div", `card ${famClass(card.tech)}`);
  const owned = run.trail.find((s) => s.tech === card.tech);
  let linked = false;
  if (card.kind === "rank") linked = true;
  else if (run.trail.length < run.slots) {
    const test = analyzeTrail([...run.trail, { tech: card.tech, rank: 1 }], run.form);
    linked = !!test.links[run.trail.length + 1] || t.receives.includes("ENEMY_ATTACK");
  }
  const rank = owned?.rank ?? 1;
  c.title = `${t.desc} · III: ${t.rank3}`;
  c.innerHTML = `<span class="key">${idx + 1}</span>
    <div class="glyph">${techIcon(card.tech)}</div>
    <div class="name">${t.name}</div>
    <div class="flow">${ioIcons(card.tech)}</div>
    <div class="cardfoot"><span class="chip-stat">${STAT[card.tech] ?? ""}</span>${card.kind === "rank" ? `<span class="rankup">${pips(rank, true)}</span>` : `<span class="linkdot ${linked ? "on" : ""}" title="${linked ? "Links" : "No link"}"></span>`}</div>
    <div class="desc">${t.desc}<br><b>III</b> ${t.rank3}</div>`;
  return c;
}

export function draftScreen(cards: DraftCard[], run: RunState, o: DraftOpts): Promise<number> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    if (o.banner) s.appendChild(frag(`<div class="reward-banner">${o.banner}</div>`));
    if (o.kicker) s.appendChild(frag(`<div class="kicker">${o.kicker}</div>`));
    const wrap = el("div", "cards");
    let done = false;
    const els = cards.map((c, i) => {
      const ce = cardEl(c, run, i);
      ce.tabIndex = 0;
      if (i === 0) ce.dataset.autofocus = "";
      ce.addEventListener("pointerenter", () => audio.ui("tick"));
      ce.addEventListener("click", () => pick(i));
      ce.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); } });
      wrap.appendChild(ce);
      return ce;
    });
    s.appendChild(wrap);
    if (run.trail.length) {
      const st = buildStrip(run.trail, { form: run.form, slots: run.slots });
      st.el.style.transform = "scale(0.82)";
      st.el.style.opacity = "0.8";
      s.appendChild(st.el);
    }
    function pick(i: number) {
      if (done) return;
      done = true;
      pop();
      audio.ui("card");
      audio.ui("confirm");
      els.forEach((e, k) => e.classList.add(k === i ? "picked" : "gone"));
      window.setTimeout(() => resolve(i), 380);
    }
    const pop = keys((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= cards.length) pick(n - 1);
    });
    s.dataset.screen = "draft";
    mount(s);
  });
}

// ───────────────────────── Place pending echo
export function placeScreen(run: RunState): Promise<number> {
  return new Promise((resolve) => {
    const t = TECH[run.pendingEcho!]!;
    const s = el("div", "scr dim");
    s.innerHTML = `<div class="kicker">Replace</div>`;
    const st = buildStrip(run.trail, { form: run.form });
    st.tiles.slice(1).forEach((tile, i) => {
      tile.classList.add("target");
      tile.tabIndex = 0;
      tile.addEventListener("click", () => { audio.ui("confirm"); pop(); resolve(i); });
    });
    const incoming = el("div", `tile ${famClass(run.pendingEcho!)}`);
    incoming.style.margin = "10px auto";
    incoming.innerHTML = tileHtml({ tech: run.pendingEcho!, rank: 1 }, 0).replace('<span class="slotno">0</span>', '<span class="slotno">NEW</span>');
    s.appendChild(incoming);
    s.appendChild(st.el);
    const b = btn("Release", "btn ghost", () => { pop(); resolve(-1); }, "back");
    s.appendChild(b);
    const pop = keys((e) => { if (e.key === "Escape") { pop(); resolve(-1); } });
    s.dataset.screen = "place";
    mount(s);
  });
}

// ───────────────────────── Arrange
export function arrangeScreen(run: RunState, opts: { cta?: string } = {}): Promise<void> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim arrange");
    s.innerHTML = ``;
    const holder = el("div");
    const meta = el("div", "trail-meta");
    s.append(holder, meta);
    let sel = -1;
    const render = () => {
      holder.innerHTML = "";
      const st = buildStrip(run.trail, { form: run.form, slots: run.slots });
      holder.appendChild(st.el);
      const info = analyzeTrail(run.trail, run.form);
      meta.innerHTML = `<span class="bigchain">×${info.longest}</span>`;
      st.tiles.slice(1, run.trail.length + 1).forEach((tile, i) => {
        tile.tabIndex = 0;
        if (i === sel) tile.classList.add("sel");
        tile.addEventListener("pointerdown", (e) => startDrag(e, tile, i, st.tiles.slice(1, run.trail.length + 1)));
        tile.addEventListener("keydown", (e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); move(i, e.key === "ArrowLeft" ? -1 : 1); }
        });
      });
    };
    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= run.trail.length) return;
      const order = run.trail.map((x) => x.tech);
      [order[i], order[j]] = [order[j]!, order[i]!];
      arrange(run, order);
      sel = j;
      audio.ui("drop");
      render();
      (holder.querySelectorAll<HTMLElement>(".tile")[j + 1])?.focus();
    };
    const startDrag = (e: PointerEvent, tile: HTMLElement, i: number, all: HTMLElement[]) => {
      e.preventDefault();
      const r = tile.getBoundingClientRect();
      const ghost = tile.cloneNode(true) as HTMLElement;
      ghost.classList.add("ghost");
      ghost.style.width = `${r.width}px`;
      ghost.style.left = `${r.left}px`;
      ghost.style.top = `${r.top}px`;
      document.body.appendChild(ghost);
      tile.classList.add("drag");
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      let moved = false;
      let target = i;
      const centers = all.map((t) => { const b = t.getBoundingClientRect(); return b.left + b.width / 2; });
      const onMove = (ev: PointerEvent) => {
        moved = moved || Math.abs(ev.clientX - e.clientX) > 4;
        ghost.style.left = `${ev.clientX - ox}px`;
        ghost.style.top = `${ev.clientY - oy}px`;
        let best = 0, bd = 1e9;
        centers.forEach((c, k) => { const d = Math.abs(c - ev.clientX); if (d < bd) { bd = d; best = k; } });
        if (best !== target) { target = best; audio.ui("tick"); }
        all.forEach((t, k) => t.classList.toggle("sel", k === target && k !== i));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        ghost.remove();
        if (!moved) {
          // tap-to-swap
          if (sel >= 0 && sel !== i) {
            const order = run.trail.map((x) => x.tech);
            [order[sel], order[i]] = [order[i]!, order[sel]!];
            arrange(run, order);
            audio.ui("drop");
            sel = -1;
          } else sel = sel === i ? -1 : i;
          render();
          return;
        }
        if (target !== i) {
          const order = run.trail.map((x) => x.tech);
          const [m] = order.splice(i, 1);
          order.splice(target, 0, m!);
          arrange(run, order);
          audio.ui("drop");
        }
        sel = -1;
        render();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };
    render();
    const row = el("div", "row");
    row.style.marginTop = "14px";
    const auto = btn(`${UI_ICON.auto.replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:8px"')}Auto`, "btn", () => {
      arrange(run, bestOrder(run.trail, run.form).map((x) => x.tech));
      render();
    }, "tick");
    const go = btn(`${opts.cta ?? "March"}<span class="k">ENTER</span>`, "btn primary", () => { pop(); resolve(); });
    go.dataset.autofocus = "";
    row.append(auto, go);
    s.appendChild(row);
    const pop = keys((e) => {
      if (e.key === "Enter" && !(document.activeElement as HTMLElement)?.classList.contains("tile")) { audio.ui("confirm"); pop(); resolve(); }
      if (e.key.toLowerCase() === "a") { arrange(run, bestOrder(run.trail, run.form).map((x) => x.tech)); render(); }
    });
    s.dataset.screen = "arrange";
    mount(s);
  });
}

// ───────────────────────── Map
const FAMILY_INFO: Record<string, [string, string]> = {
  husk: ["Husks", "Slow swarms. Area echoes like Bell and Shockline shine."],
  bulwark: ["Bulwarks", "Front shields block until Broken, launched, or staggered."],
  lancer: ["Lancers", "Ranged throws. Guard Ghost reads every one."],
  splitter: ["Splitters", "Split in two on death. Feed your kill chains."],
  mimic: ["Mimics", "Copy your most-used echo for 5s. Diversify."],
  mixed: ["Mixed Company", "A little of everything."],
};

export function nodeInfo(n: MapNode): [string, string] {
  if (n.type === "forge") return ["Forge", ""];
  if (n.type === "rest") return ["Rest", ""];
  if (n.type === "elite") return ["Twin Lancer", ""];
  if (n.type === "boss") {
    const b = n.plan?.boss === "original" ? "original" : "duplicate";
    return b === "duplicate"
      ? [BOSSES.duplicate.name, "Marches a copy of your own trail at you — in reverse."]
      : [BOSSES.original.name, "A perfect fighter. Only chains of 3+ links break its guard."];
  }
  return FAMILY_INFO[n.family ?? "mixed"] ?? FAMILY_INFO.mixed!;
}

export type MapAction = { pick: number } | { formation: true } | { menu: true };

export function mapScreen(run: RunState): Promise<MapAction> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim map-scr");
    const endless = run.mode === "endless";
    const theme = THEMES[Math.min(2, (endless ? Math.min(3, 1 + Math.floor(run.endlessDepth / 5)) : run.act) - 1)]!;
    s.innerHTML = `<div class="kicker">${endless ? `∞ ${run.endlessDepth + 1}` : ROMAN[run.act]}</div><div class="h1">${endless ? "Endless" : theme.name}</div>`;
    const stat = el("div", "statbar");
    stat.innerHTML = `<span class="chip">${UI_ICON.heart.replace("<svg", '<svg style="width:12px;height:12px"')} ${Math.ceil(run.hp)} / ${run.maxHp}</span><div class="hpbar"><i style="width:${(run.hp / run.maxHp) * 100}%"></i></div>${run.seals.map((id) => `<span class="chip" title="${SEAL[id]?.desc ?? ""}">${SEAL[id]?.glyph ?? ""} ${SEAL[id]?.name ?? id}</span>`).join("")}${run.ascension ? `<span class="chip">Ascension ${run.ascension}</span>` : ""}`;
    s.appendChild(stat);
    const road = el("div", "road");
    const steps = endless ? run.acts[0]!.slice(Math.max(0, run.step - 2), run.step + 1) : run.acts[run.act - 1]!;
    const offset = endless ? Math.max(0, run.step - 2) : 0;
    const info = el("div", "node-info");
    const nowNodes: HTMLElement[] = [];
    steps.forEach((st, si) => {
      const idx = si + offset;
      if (si > 0) road.appendChild(el("div", `seg ${idx <= run.step ? "done" : ""}`));
      const col = el("div", "step");
      st.options.forEach((n, oi) => {
        const state = idx < run.step ? "done" : idx === run.step ? "now" : "future";
        const ne = el("button", `node ${state} ${n.type} ${idx < run.step && st.chosen === oi ? "chosen" : ""}`);
        ne.innerHTML = `${nodeIcon(n.type)}<span class="lbl">${n.type === "fight" ? (FAMILY_INFO[n.family ?? "mixed"]?.[0] ?? "Fight") : n.type === "boss" ? "Boss" : n.type}</span>`;
        if (state === "now") {
          nowNodes.push(ne);
          ne.addEventListener("pointerenter", () => { audio.ui("tick"); showInfo(n); });
          ne.addEventListener("focus", () => showInfo(n));
          ne.addEventListener("click", () => { audio.ui("confirm"); pop(); resolve({ pick: oi }); });
        } else ne.tabIndex = -1;
        col.appendChild(ne);
      });
      road.appendChild(col);
    });
    s.appendChild(road);
    s.appendChild(info);
    const showInfo = (n: MapNode) => {
      const [a, b] = nodeInfo(n);
      info.innerHTML = `<b>${a}</b>`;
      void b;
    };
    const cur = currentStep(run);
    showInfo(cur.options[0]!);
    if (nowNodes[0]) nowNodes[0].dataset.autofocus = "";
    const st = buildStrip(run.trail, { form: run.form, slots: run.slots });
    st.el.style.transform = "scale(0.86)";
    s.appendChild(st.el);
    const row = el("div", "row");
    row.append(
      btn("Formation <span class='k'>F</span>", "btn", () => { pop(); resolve({ formation: true }); }, "tick"),
      btn("<span class='k' style='margin:0'>ESC</span>", "btn ghost small", () => { pop(); resolve({ menu: true }); }, "tick"),
    );
    s.appendChild(row);
    const pop = keys((e) => {
      if (e.key === "Escape") { pop(); resolve({ menu: true }); }
      if (e.key.toLowerCase() === "f") { pop(); resolve({ formation: true }); }
      if (e.key === "1" || e.key === "2") {
        const i = Number(e.key) - 1;
        if (i < cur.options.length) { audio.ui("confirm"); pop(); resolve({ pick: i }); }
      }
      if (e.key === "Enter" && cur.options.length === 1) { audio.ui("confirm"); pop(); resolve({ pick: 0 }); }
    });
    s.dataset.screen = "map";
    mount(s);
  });
}

// ───────────────────────── Forge / Rest
export function forgeScreen(run: RunState): Promise<number> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    s.innerHTML = `<div class="kicker">Forge</div>`;
    const st = buildStrip(run.trail, { form: run.form });
    let any = false;
    st.tiles.slice(1).forEach((tile, i) => {
      const slot = run.trail[i]!;
      if (slot.rank >= 3) { tile.style.opacity = "0.4"; return; }
      any = true;
      tile.classList.add("target");
      tile.tabIndex = 0;
      tile.title = `Rank ${ROMAN[slot.rank + 1]}${slot.rank + 1 === 3 ? ` — ${TECH[slot.tech]!.rank3}` : ""}`;
      tile.addEventListener("click", () => { audio.ui("unlock"); pop(); resolve(i); });
    });
    s.appendChild(st.el);
    if (!any) s.appendChild(btn("March", "btn", () => { pop(); resolve(-1); }));
    const pop = keys((e) => { if (e.key === "Escape" && !any) { pop(); resolve(-1); } });
    s.dataset.screen = "forge";
    mount(s);
  });
}

export function restScreen(run: RunState): Promise<boolean> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    s.innerHTML = `<div class="kicker">Rest</div>`;
    const c = el("div", "choice2");
    const heal = el("button", "bigchoice");
    heal.innerHTML = `${UI_ICON.heart.replace("<svg", '<svg style="color:var(--bone)"')}<div class="bc1">+${Math.round(run.maxHp * 0.4)}</div><div class="bc2">${Math.ceil(run.hp)} / ${run.maxHp}</div>`;
    const seal = el("button", "bigchoice");
    seal.innerHTML = `<div style="font-family:var(--display);font-size:40px">◎</div><div class="bc1">Seal</div>`;
    heal.dataset.autofocus = "";
    heal.addEventListener("click", () => { audio.ui("confirm"); pop(); resolve(true); });
    seal.addEventListener("click", () => { audio.ui("confirm"); pop(); resolve(false); });
    c.append(heal, seal);
    s.appendChild(c);
    const pop = keys((e) => { if (e.key === "1") { pop(); resolve(true); } if (e.key === "2") { pop(); resolve(false); } });
    s.dataset.screen = "rest";
    mount(s);
  });
}

// ───────────────────────── Pause
export function pauseScreen(): Promise<"resume" | "settings" | "abandon"> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    s.innerHTML = `<div class="kicker">Paused</div><div class="spacer"></div>`;
    const m = el("div", "menu");
    const r = btn("Resume <span class='k'>ESC</span>", "btn primary", () => { pop(); resolve("resume"); });
    r.dataset.autofocus = "";
    m.append(r, btn("Settings", "btn", () => { pop(); resolve("settings"); }), btn("Quit", "btn ghost", () => { pop(); resolve("abandon"); }, "back"));
    s.appendChild(m);
    const pop = keys((e) => { if (e.key === "Escape" || e.key.toLowerCase() === "p") { pop(); resolve("resume"); } });
    s.dataset.screen = "pause";
    mount(s);
  });
}

// ───────────────────────── Results
export function resultsScreen(run: RunState, won: boolean, unlocks: Unlocks, codexNew: CodexEntry[]): Promise<"again" | "title"> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    const p = el("div", "panel results");
    const endless = run.mode === "endless";
    const title = `×${run.stats.longestChain}`;
    const kick = endless ? `∞ ${run.endlessDepth}` : won ? "Whole" : `Fallen · ${ROMAN[Math.min(3, run.act)]}`;
    const st = run.stats;
    const mins = Math.floor(st.timeMs / 60000), secs = Math.floor((st.timeMs % 60000) / 1000);
    p.innerHTML = `<div class="kicker" style="text-align:center">${kick}</div><div class="h1 bigtitle">${title}</div>
      <div class="grid">
        <div class="stat"><div class="v">${st.fightsWon}</div><div class="l">Fights</div></div>
        <div class="stat"><div class="v">${st.kills}</div><div class="l">Kills</div></div>
        <div class="stat"><div class="v">${st.parries}</div><div class="l">Parries</div></div>
        <div class="stat"><div class="v">${st.crits}</div><div class="l">Crits</div></div>
        <div class="stat"><div class="v">${mins}:${String(secs).padStart(2, "0")}</div><div class="l">Time</div></div>
      </div>`;
    const dmg = Object.entries(st.techDamage).filter(([k]) => TECH[k]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (dmg.length) {
      p.appendChild(frag(`<div class="sect">Echoes</div>`));
      const max = dmg[0]![1];
      for (const [k, v] of dmg) {
        p.appendChild(frag(`<div class="dmgrow ${famClass(k)}"><div class="g">${techIcon(k)}</div><div>${TECH[k]!.name}</div><div><div class="b" style="width:${(v / max) * 100}%"></div></div><div class="n">${Math.round(v).toLocaleString()}</div></div>`));
      }
    }
    if (unlocks.techs.length || unlocks.forms.length || unlocks.endless || unlocks.ascension) {
      p.appendChild(frag(`<div class="sect">Unlocked</div>`));
      const ug = el("div", "unlocks");
      p.appendChild(ug);
      const add = (h: string) => ug.appendChild(frag(h));
      for (const t of unlocks.techs) add(`<div class="unlock ${famClass(t)}"><div class="g">${techIcon(t)}</div><div><b>${TECH[t]!.name}</b></div></div>`);
      for (const f of unlocks.forms) add(`<div class="unlock"><div class="g">◆</div><div><b>Form · ${FORMS[f].name}</b></div></div>`);
      if (unlocks.endless) add(`<div class="unlock"><div class="g">∞</div><div><b>Endless</b></div></div>`);
      if (unlocks.ascension) add(`<div class="unlock"><div class="g">▲</div><div><b>Ascension ${unlocks.ascension}</b></div></div>`);
      window.setTimeout(() => audio.ui("unlock"), 500);
    }
    if (codexNew.length) {
      p.appendChild(frag(`<div class="sect">Codex</div>`));
      for (const c of codexNew.slice(0, 4)) p.appendChild(chainRow(c));
    }
    p.appendChild(frag(`<div class="sub" style="margin:14px auto 0;font-size:13px">Seed ${run.seed} · ${FORMS[run.form].name}${run.ascension ? ` · Ascension ${run.ascension}` : ""}</div>`));
    const row = el("div", "row");
    row.style.marginTop = "16px";
    const again = btn("Again", "btn primary", () => { pop(); resolve("again"); });
    again.dataset.autofocus = "";
    row.append(btn("Title", "btn ghost", () => { pop(); resolve("title"); }, "back"), again);
    p.appendChild(row);
    s.appendChild(p);
    const pop = keys((e) => { if (e.key === "Enter") { pop(); resolve("again"); } });
    s.dataset.screen = "results";
    mount(s);
  });
}

function chainRow(c: CodexEntry): HTMLElement {
  const r = el("div", "chainrow");
  r.innerHTML = `<div class="cg fam-ink" style="color:var(--bone)">${evIcon("HIT")}</div>` + c.path.map((t) => `<span class="ca">›</span><div class="cg ${famClass(t)}" title="${TECH[t]?.name ?? t}">${techIcon(t)}</div>`).join("") + `<span class="cn">×${c.links}${c.count > 1 ? ` · seen ${c.count}` : ""}</span>`;
  return r;
}

// ───────────────────────── Codex
export function codexScreen(p: Profile): Promise<void> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    const box = el("div", "panel codex");
    box.innerHTML = `<div class="kicker" style="text-align:center">Codex</div>`;
    const tabs = el("div", "tabs seg-ctl");
    tabs.style.alignSelf = "center";
    tabs.innerHTML = `<button data-t="chains" class="on">Chains</button><button data-t="techs">Echoes</button>`;
    const body = el("div", "body");
    box.append(tabs, body);
    const show = (t: string) => {
      tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
      body.innerHTML = "";
      if (t === "chains") {
        if (!p.codex.length) body.appendChild(frag(`<div class="sub" style="margin:30px auto">×4</div>`));
        for (const c of p.codex.slice(0, 80)) body.appendChild(chainRow(c));
      } else {
        const g = el("div", "techgrid");
        for (const t of TECHNIQUES) {
          const locked = !p.techs.includes(t.id);
          const goal = goalFor(t.id);
          g.appendChild(frag(`<div class="techcell ${famClass(t.id)} ${locked ? "locked" : ""}"><div class="g">${techIcon(t.id)}</div><div><b>${t.name}</b><p>${locked ? `${UI_ICON.lock.replace("<svg", '<svg style="width:11px;height:11px;vertical-align:-1px"')} ${goal?.text ?? "Locked"}` : t.desc}</p><div class="io">${ioIcons(t.id)}</div></div></div>`));
        }
        body.appendChild(g);
      }
    };
    tabs.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { audio.ui("tick"); show(b.dataset.t!); }));
    show("chains");
    const row = el("div", "row");
    row.style.marginTop = "14px";
    const back = btn("Back <span class='k'>ESC</span>", "btn", () => { pop(); resolve(); }, "back");
    back.dataset.autofocus = "";
    row.appendChild(back);
    box.appendChild(row);
    s.appendChild(box);
    const pop = keys((e) => { if (e.key === "Escape") { pop(); resolve(); } });
    s.dataset.screen = "codex";
    mount(s);
  });
}

// ───────────────────────── Settings
export function settingsScreen(p: Profile, onChange: () => void): Promise<void> {
  return new Promise((resolve) => {
    const s = el("div", "scr dim");
    const box = el("div", "panel settings");
    box.innerHTML = `<div class="kicker" style="text-align:center">Settings</div>`;
    const st = p.settings;
    const slider = (label: string, key: "master" | "music" | "sfx") => {
      const r = el("div", "setrow");
      r.innerHTML = `<label>${label}</label><input type="range" min="0" max="1" step="0.05" value="${st[key]}">`;
      r.querySelector("input")!.addEventListener("input", (e) => { st[key] = Number((e.target as HTMLInputElement).value); onChange(); });
      r.querySelector("input")!.addEventListener("change", () => audio.ui("tick"));
      return r;
    };
    const toggle = (label: string, key: "reducedFlash" | "reducedShake" | "numbers") => {
      const r = el("div", "setrow");
      r.innerHTML = `<label>${label}</label><button class="toggle ${st[key] ? "on" : ""}" aria-pressed="${st[key]}"></button>`;
      const t = r.querySelector("button")!;
      t.addEventListener("click", () => { st[key] = !st[key]; t.classList.toggle("on", st[key]); audio.ui("tick"); onChange(); });
      return r;
    };
    const speed = el("div", "setrow");
    speed.innerHTML = `<label>Default battle speed</label><div class="seg-ctl"><button data-s="1">1×</button><button data-s="2">2×</button></div>`;
    const syncSp = () => speed.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.classList.toggle("on", Number(b.dataset.s) === st.speed));
    speed.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { st.speed = Number(b.dataset.s) as 1 | 2; syncSp(); audio.ui("tick"); onChange(); }));
    syncSp();
    const attire = el("div", "setrow");
    attire.innerHTML = `<label>Attire</label><div class="seg-ctl"><button data-o="coat">Coat</button><button data-o="cloak">Cloak</button><button data-o="scarf">Scarf</button></div>`;
    const syncAt = () => attire.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.classList.toggle("on", b.dataset.o === st.outfit));
    attire.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { st.outfit = b.dataset.o as typeof st.outfit; syncAt(); audio.ui("tick"); onChange(); }));
    syncAt();
    box.append(attire, slider("Master volume", "master"), slider("Music", "music"), slider("Effects", "sfx"), speed, toggle("Damage numbers", "numbers"), toggle("Reduce flashing", "reducedFlash"), toggle("Reduce screen shake", "reducedShake"));
    const keysHelp = frag(`<div class="sub" style="font-size:13px;margin:16px auto 0;text-align:left;line-height:1.7">SPACE Resound · TAB Speed · ESC Pause · F Formation · 1–3 Pick</div>`);
    box.appendChild(keysHelp);
    const row = el("div", "row");
    row.style.marginTop = "16px";
    const back = btn("Done <span class='k'>ESC</span>", "btn primary", () => { pop(); resolve(); });
    back.dataset.autofocus = "";
    row.appendChild(back);
    box.appendChild(row);
    s.appendChild(box);
    const pop = keys((e) => { if (e.key === "Escape") { pop(); resolve(); } });
    s.dataset.screen = "settings";
    mount(s);
  });
}

export { type TrailSlot };
