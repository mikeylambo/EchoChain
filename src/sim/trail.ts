import { TUNING } from "../data/tuning";
import type { FighterSample, Pose } from "./types";

const CAP = 512;

/** Ring buffer of fighter transform + pose at sim rate. Echoes sample it by slot × delay (Gradius Options model). */
export class TrailHistory {
  private xs = new Float64Array(CAP);
  private poses: Pose[] = new Array(CAP).fill("idle");
  private poseTs = new Float64Array(CAP);
  private head = -1;
  private count = 0;

  reset(x: number): void {
    this.head = -1;
    this.count = 0;
    for (let i = 0; i < CAP; i++) this.push({ x, pose: "idle", poseT: 0 });
  }

  push(s: FighterSample): void {
    this.head = (this.head + 1) % CAP;
    this.xs[this.head] = s.x;
    this.poses[this.head] = s.pose;
    this.poseTs[this.head] = s.poseT;
    this.count = Math.min(CAP, this.count + 1);
  }

  /** Sample `ticksAgo` (fractional ok, linear in x). */
  sample(ticksAgo: number, out: FighterSample = { x: 0, pose: "idle", poseT: 0 }): FighterSample {
    const t = Math.max(0, Math.min(this.count - 2, ticksAgo));
    const i0 = Math.floor(t);
    const f = t - i0;
    const a = (this.head - i0 + CAP * 4) % CAP;
    const b = (a - 1 + CAP) % CAP;
    out.x = this.xs[a]! * (1 - f) + this.xs[b]! * f;
    out.pose = this.poses[a]!;
    out.poseT = this.poseTs[a]!;
    return out;
  }
}

export function slotDelayTicks(slot: number, delayMult: number): number {
  return slot * TUNING.echoDelay * delayMult * TUNING.simHz;
}

export function slotSpacing(slot: number, delayMult: number): number {
  return slot * TUNING.echoSpacing * (0.55 + 0.45 * delayMult);
}
