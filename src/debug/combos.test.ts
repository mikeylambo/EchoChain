/** `npm test` — verifies GDD §6 design-target combos form full-length chains (acceptance: "All four combos in §6 work"). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { GDD_COMBOS, runCombo } from "./combos";

for (const spec of GDD_COMBOS) {
  test(`${spec.name}: ${spec.trail.join(" → ")} chains the full trail`, () => {
    const r = runCombo(spec, 1);
    assert.equal(r.bestLinks, r.fullLength, `best chain ${r.bestLinks}/${r.fullLength}`);
    assert.ok(r.fullChains >= 3, `only ${r.fullChains} full-trail chains in 30s`);
  });
}

test("Counter Wall: a parry yields 3+ crits per full chain (4+ at rank III)", () => {
  const spec = GDD_COMBOS[0]!;
  assert.ok((runCombo(spec, 1).eventsPerFullChain.CRIT ?? 0) >= 3);
  assert.ok((runCombo(spec, 3).eventsPerFullChain.CRIT ?? 0) >= 4);
});

test("Converter: Inverse turns Flurry hits into launches the Juggler consumes", () => {
  const r = runCombo(GDD_COMBOS[2]!, 1);
  assert.ok((r.eventsPerFullChain.LAUNCH ?? 0) >= 3, JSON.stringify(r.eventsPerFullChain));
});

test("Juggle ends in a Shockline wave (STAGGER reaches the tail)", () => {
  const r = runCombo(GDD_COMBOS[1]!, 1);
  assert.ok((r.eventsPerFullChain.STAGGER ?? 0) >= 1);
});

test("combo harness is deterministic", () => {
  assert.deepEqual(runCombo(GDD_COMBOS[3]!, 1), runCombo(GDD_COMBOS[3]!, 1));
});
