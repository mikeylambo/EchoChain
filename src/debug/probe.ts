import { STARTER_TECHS } from "../data/techniques";
import { newRun, currentStep, fightConfig, chooseFork } from "../sim/run";
import { World } from "../sim/world";
const run = newRun("P1", "duelist", 0, "standard", [...STARTER_TECHS]);
for (const trail of [[], [{ tech: "launcher", rank: 1 }, { tech: "juggler", rank: 1 }]] as any[]) {
  run.trail = trail;
  const node = chooseFork(run, 0);
  const w = new World(fightConfig(run, node));
  let last = 0;
  while (w.outcome === "running" && w.tick < 60 * 120) {
    w.step(w.chargeFull ? [{ type: "sync" }] : []);
    if (w.tick - last >= 180) { last = w.tick; console.log(`t=${(w.tick/60).toFixed(0)} hp=${w.fighter.hp.toFixed(0)} x=${w.fighter.x.toFixed(0)} alive=${w.aliveSorted().length} kills=${w.stats.kills} charge=${w.charge.toFixed(0)} front=${w.front()?.kind}@${w.front() ? (w.front()!.x - w.fighter.x).toFixed(0) : '-'}`); }
  }
  console.log(trail.length, "outcome", w.outcome, (w.tick/60).toFixed(1), "s", JSON.stringify(node.plan!.groups.map(g=>g.kind)), "dmg", JSON.stringify(w.stats.techDamage));
}
