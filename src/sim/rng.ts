import { DeterministicRng, stableHashString } from "@slu/web-shell";

export { DeterministicRng, stableHashString };

/** Derive an independent stream for a sub-system so draws in one never perturb another. */
export function streamFor(seed: string | number, name: string): DeterministicRng {
  return new DeterministicRng(stableHashString(`${seed}:${name}`));
}

/** Resume a stream from a saved state (DeterministicRng continues from its state value). */
export function resumeRng(state: number): DeterministicRng {
  return new DeterministicRng(state);
}

export function freshSeed(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY3479";
  let out = "";
  let n = (Date.now() ^ Math.floor((typeof performance !== "undefined" ? performance.now() : 0) * 1000)) >>> 0;
  for (let i = 0; i < 6; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.imul(n ^ (n >>> 13), 0x5bd1e995) >>> 0;
  }
  return out;
}
