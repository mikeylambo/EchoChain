import { GDD_COMBOS, runCombo } from "./combos";
for (const spec of GDD_COMBOS) for (const rank of [1, 3] as const) {
  const r = runCombo(spec, rank);
  console.log(`${spec.name} r${rank}: best ${r.bestLinks}/${r.fullLength} links, full-trail chains ${r.fullChains}, per full chain ${JSON.stringify(r.eventsPerFullChain)}  path=${r.bestPath.join(">")}`);
}
