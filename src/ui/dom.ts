import { audio } from "../audio/audio";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function frag(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

const root = () => document.getElementById("screen")!;
let current: HTMLElement | null = null;

/** Replace the current overlay screen with a crossfade. */
export function mount(e: HTMLElement): HTMLElement {
  const r = root();
  if (current) {
    const old = current;
    old.classList.add("out");
    window.setTimeout(() => old.remove(), 280);
  }
  r.appendChild(e);
  current = e;
  const first = e.querySelector<HTMLElement>("[data-autofocus]");
  if (first && matchMedia("(pointer: fine)").matches) first.focus({ preventScroll: true });
  return e;
}

export function unmount(): void {
  if (!current) return;
  const old = current;
  old.classList.add("out");
  window.setTimeout(() => old.remove(), 280);
  current = null;
}

type KeyH = (e: KeyboardEvent) => void;
const stack: KeyH[] = [];
window.addEventListener("keydown", (e) => {
  const h = stack[stack.length - 1];
  if (!h) return;
  const a = document.activeElement as HTMLElement | null;
  const onControl = !!a && a !== document.body && (a.tagName === "BUTTON" || a.tabIndex >= 0) && !!a.closest("#screen");
  // Enter/Space on a focused control belongs to that control; never double-fire.
  if ((e.key === "Enter" || e.key === " ") && onControl) return;
  h(e);
  if (e.key === "Enter") e.preventDefault();
});

/** Push a keyboard handler; returns a pop function. */
export function keys(h: KeyH): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Button helper with UI sound. */
export function btn(label: string, cls = "btn", onClick?: () => void, sound: "confirm" | "tick" | "back" = "confirm"): HTMLButtonElement {
  const b = el("button", cls, label);
  b.addEventListener("pointerenter", () => audio.ui("tick"));
  if (onClick) b.addEventListener("click", () => { audio.ui(sound); onClick(); });
  return b;
}

export function toast(text: string): void {
  const t = el("div", "t", text);
  document.getElementById("toast")!.appendChild(t);
  window.setTimeout(() => t.remove(), 2900);
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
