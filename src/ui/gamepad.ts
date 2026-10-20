/**
 * Controller support: maps a standard gamepad onto the same keyboard handlers the game already uses,
 * plus spatial focus navigation for menus. A = confirm / Resound, B = back, Start = pause,
 * X = auto-arrange, Y = formation, LB/RB = battle speed.
 */
const prev: boolean[] = [];

function key(k: string, code = k): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, code, bubbles: true }));
}

function focusables(): HTMLElement[] {
  const scr = [...document.querySelectorAll<HTMLElement>("#screen > .scr:not(.out)")].pop();
  if (!scr) return [];
  return [...scr.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']")].filter((e) => e.offsetParent !== null);
}

function moveFocus(dx: number, dy: number): void {
  const list = focusables();
  if (!list.length) return;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !list.includes(cur)) { list[0]!.focus(); return; }
  const r0 = cur.getBoundingClientRect();
  const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const e of list) {
    if (e === cur) continue;
    const r = e.getBoundingClientRect();
    const vx = r.left + r.width / 2 - c0.x;
    const vy = r.top + r.height / 2 - c0.y;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.2;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  best?.focus();
}

export function pollGamepads(inFight: () => boolean): void {
  const pads = navigator.getGamepads?.() ?? [];
  const p = [...pads].find((g) => g && g.connected);
  if (!p) return;
  const b = (i: number) => !!p.buttons[i]?.pressed;
  const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
  const now = [
    b(0), b(1), b(2), b(3), b(4), b(5), b(9), b(8),
    b(12) || ay < -0.6, b(13) || ay > 0.6, b(14) || ax < -0.6, b(15) || ax > 0.6, b(7),
  ];
  const edge = (i: number) => now[i] && !prev[i];
  const fight = inFight();
  if (edge(0)) {
    if (fight) key(" ", "Space");
    else {
      const a = document.activeElement as HTMLElement | null;
      if (a && a !== document.body && a.closest("#screen")) a.click();
      else key("Enter");
    }
  }
  if (edge(12) && fight) key(" ", "Space");
  if (edge(1)) key("Escape");
  if (edge(6) || edge(7)) key("Escape");
  if (edge(2)) key("a");
  if (edge(3)) key("f");
  if ((edge(4) || edge(5)) && fight) key("Tab");
  if (!fight) {
    if (edge(8)) moveFocus(0, -1);
    if (edge(9)) moveFocus(0, 1);
    if (edge(10)) moveFocus(-1, 0);
    if (edge(11)) moveFocus(1, 0);
  }
  now.forEach((v, i) => (prev[i] = v));
}
