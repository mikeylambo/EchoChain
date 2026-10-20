import { audio } from "../audio/audio";
import { BOSSES } from "../data/bosses";
import { FORMS } from "../data/forms";
import { SEAL } from "../data/seals";
import { TECH } from "../data/techniques";
import { evaluateUnlocks, loadProfile, recordCodex, saveProfile, type CodexEntry, type Profile } from "../meta/profile";
import { THEMES } from "../render/background";
import { FightView } from "../render/view";
import { freshSeed } from "../sim/rng";
import {
  advance, applyCard, applyFight, betweenFights, chooseFork, currentStep, fightAct, fightConfig, forge, makeDraft, makeOpeningDraft, makeSealDraft,
  newRun, placePending, rest, type FightReward, type MapNode, type RunState,
} from "../sim/run";
import { World } from "../sim/world";
import { keys, toast, unmount, wait } from "../ui/dom";
import { Hud } from "../ui/hud";
import {
  arrangeScreen, codexScreen, draftScreen, forgeScreen, mapScreen, newRunScreen, nodeInfo, pauseScreen, placeScreen, restScreen, resultsScreen,
  settingsScreen, titleScreen,
} from "../ui/screens";
import { DevOverlay } from "./dev";

const ROMAN = ["", "I", "II", "III"];
const TITLE_TRAIL = ["sunder", "launcher", "juggler", "slam", "shockline", "prism"];

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export class Game {
  profile: Profile = loadProfile();
  readonly view: FightView;
  readonly hud = new Hud();
  readonly dev: DevOverlay;
  private onFrame: ((now: number) => void) | null = null;
  fightWorld: World | null = null;
  run: RunState | null = null;
  private pausing = false;
  private pauseReq: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.view = new FightView(canvas);
    this.dev = new DevOverlay(this);
    this.applySettings();
  }

  applySettings(): void {
    const s = this.profile.settings;
    audio.setVolumes(s.master, s.music, s.sfx);
    this.view.settings = { reducedFlash: s.reducedFlash, reducedShake: s.reducedShake, numbers: s.numbers };
  }

  frame(now: number): void {
    this.view.frame(now);
    this.onFrame?.(now);
    this.dev.frame();
  }

  /** Background world: a live demo on the title, the marching trail between fights. */
  private backdrop(kind: "title" | "camp"): void {
    const run = this.run;
    const camp = kind === "camp" && run;
    const w = new World({
      seed: camp ? `${run.seed}:camp` : "TITLE",
      form: camp ? run.form : "duelist",
      trail: camp ? run.trail.map((s) => ({ ...s })) : TITLE_TRAIL.map((tech) => ({ tech, rank: 2 as const })),
      act: camp ? fightAct(run) : 1 + (Math.floor(Date.now() / 1000) % 3),
      plan: { family: "husk", groups: [] },
      hp: 9999, maxHp: 9999, ascension: 0, sandbox: true, startCharge: 40,
    });
    this.view.setWorld(w, w.cfg.act);
    this.view.attract = !camp;
    this.view.speed = 1;
    this.view.paused = false;
    this.view.tutorial = false;
    this.view.hooks = {};
    this.fightWorld = null;
  }

  async start(): Promise<void> {
    for (;;) {
      this.run = null;
      this.backdrop("title");
      audio.setMusic("title");
      const c = await titleScreen(this.profile);
      if (c === "settings") { await settingsScreen(this.profile, () => { this.applySettings(); saveProfile(this.profile); }); continue; }
      if (c === "codex") { await codexScreen(this.profile); continue; }
      if (c === "continue" && this.profile.savedRun) {
        this.run = clone(this.profile.savedRun);
      } else {
        const ch = await newRunScreen(this.profile);
        if (!ch) continue;
        this.run = newRun(freshSeed(), ch.form, ch.ascension, ch.mode, this.profile.techs);
        this.profile.runs++;
        this.saveRun();
      }
      let again = true;
      while (again && this.run) {
        const outcome = await this.playRun(this.run);
        if (outcome === "quit") { again = false; break; }
        again = outcome === "again";
        if (again) {
          const ch = await newRunScreen(this.profile);
          if (!ch) { again = false; break; }
          this.run = newRun(freshSeed(), ch.form, ch.ascension, ch.mode, this.profile.techs);
          this.profile.runs++;
          this.saveRun();
        }
      }
    }
  }

  private saveRun(): void {
    this.profile.savedRun = this.run && this.run.status === "map" ? clone(this.run) : null;
    saveProfile(this.profile);
  }

  private async playRun(run: RunState): Promise<"again" | "title" | "quit"> {
    const codexNew: CodexEntry[] = [];
    audio.setAct(fightAct(run));
    if (run.fightIndex === 0 && run.trail.length === 0 && run.step === 0 && run.act === 1 && run.endlessDepth === 0) {
      this.backdrop("camp");
      audio.setMusic("map");
      const cards = makeOpeningDraft(run);
      const i = await draftScreen(cards, run, { kicker: "Your first echo", title: "Choose a Technique", sub: `It will follow behind your ${FORMS[run.form].name}, replaying your strikes — and reacting to them.` });
      run.choices.push({ t: "draft", i });
      applyCard(run, cards[i]!);
      this.saveRun();
    }
    while (run.status === "map") {
      audio.setAct(fightAct(run));
      this.backdrop("camp");
      audio.setMusic("map");
      const step = currentStep(run);
      let node: MapNode | null = step.chosen >= 0 ? step.options[step.chosen]! : null;
      while (!node) {
        const a = await mapScreen(run);
        if ("formation" in a) { await arrangeScreen(run, { cta: "Back to the Road" }); this.backdrop("camp"); continue; }
        if ("menu" in a) {
          const r = await this.pauseMenu(false);
          if (r === "abandon") { this.saveRun(); unmount(); return "quit"; }
          continue;
        }
        node = chooseFork(run, a.pick);
      }
      if (node.type === "forge") {
        const slot = await forgeScreen(run);
        if (slot >= 0) { forge(run, slot); toast(`${TECH[run.trail[slot]!.tech]!.name} · Rank ${ROMAN[run.trail[slot]!.rank]}`); }
      } else if (node.type === "rest") {
        const heal = await restScreen(run);
        rest(run, heal);
        if (!heal) await this.sealDraft(run, "Rest", "Take a Seal");
      } else {
        const res = await this.fight(run, node);
        if (res === "quit") { unmount(); return "quit"; }
        const w = res;
        codexNew.push(...recordCodex(this.profile, w.stats.codex, run.form));
        const reward = applyFight(run, node, w.stats, w.fighter.hp, w.outcome === "won", w.fighter.x);
        if (run.status !== "map") break;
        await this.postFight(run, reward);
      }
      advance(run);
      if (run.status === "map") this.saveRun();
    }
    return this.finish(run, codexNew);
  }

  private async postFight(run: RunState, reward: FightReward): Promise<void> {
    this.backdrop("camp");
    audio.setMusic("map");
    const banners: string[] = [];
    if (reward.actCleared) banners.push(`Act ${ROMAN[reward.actCleared]} cleared`);
    if (reward.slotGained) banners.push("+1 echo slot");
    const cards = makeDraft(run);
    if (cards.length) {
      const i = await draftScreen(cards, run, { title: "Claim a Technique", banner: banners.join(" · ") || undefined });
      run.choices.push({ t: "draft", i });
      applyCard(run, cards[i]!);
      const c = cards[i]!;
      if (c.kind === "rank") toast(`${TECH[c.tech]!.name} · Rank ${ROMAN[run.trail.find((s) => s.tech === c.tech)?.rank ?? 1]}`);
      if (c.kind === "seal") toast(`Seal · ${SEAL[c.seal]!.name}`);
    }
    if (run.pendingEcho) placePending(run, await placeScreen(run));
    if (reward.sealDraft) await this.sealDraft(run, `Act ${ROMAN[reward.actCleared]} cleared`, "Choose a Seal");
    betweenFights(run);
    this.backdrop("camp");
    await arrangeScreen(run);
  }

  private async sealDraft(run: RunState, kicker: string, title: string): Promise<void> {
    const seals = makeSealDraft(run);
    if (!seals.length) return;
    const i = await draftScreen(seals, run, { kicker, title });
    run.choices.push({ t: "seal", i });
    applyCard(run, seals[i]!);
  }

  private fight(run: RunState, node: MapNode): Promise<World | "quit"> {
    unmount();
    const w = new World(fightConfig(run, node));
    const act = fightAct(run);
    const v = this.view;
    v.setWorld(w, act);
    v.attract = false;
    v.paused = false;
    v.speed = this.profile.settings.speed;
    v.tutorial = !this.profile.seenTutorial;
    this.fightWorld = w;
    const [label] = nodeInfo(node);
    const where = run.mode === "endless" ? `Depth ${run.endlessDepth + 1} · ${label}` : `Act ${ROMAN[run.act]} · ${label}`;
    const cb = {
      sync: () => { v.requestSync(); },
      pause: () => this.pauseReq?.(),
      speed: () => { v.speed = v.speed === 1 ? 2 : 1; this.hud.setSpeed(v.speed); audio.ui("tick"); },
    };
    this.hud.mount(run, w, where, cb, v.speed);
    v.hooks = {
      onTrigger: (s) => this.hud.fire(s),
      onTutorial: (k) => this.hud.tutorial(k),
    };
    audio.setAct(act);
    audio.setMusic(node.type === "boss" ? "boss" : "fight", Math.min(5, run.trail.length));
    if (node.type === "boss" && node.plan?.boss) { v.banner(BOSSES[node.plan.boss].name.toUpperCase()); audio.boss("intro"); }
    else if (node.type === "elite") v.banner("ELITE · TWIN LANCER");
    else if (run.fightIndex === 0) v.banner(THEMES[act - 1]!.name.toUpperCase());

    return new Promise((resolve) => {
      let endAt = -1;
      let syncTut = false;
      let done = false;
      const finish = (r: World | "quit") => {
        if (done) return;
        done = true;
        popKeys();
        this.onFrame = null;
        this.pauseReq = null;
        this.hud.hide();
        this.fightWorld = null;
        for (const t of v.syncTicks) run.choices.push({ t: "sync", fight: run.fightIndex, tick: t });
        resolve(r);
      };
      const doPause = async () => {
        if (this.pausing || w.outcome !== "running") return;
        v.paused = true;
        const r = await this.pauseMenu(true);
        v.paused = false;
        if (r === "abandon") { this.saveRun(); finish("quit"); }
      };
      this.pauseReq = () => void doPause();
      const popKeys = keys((e) => {
        if (this.pausing) return;
        if (e.code === "Space") { e.preventDefault(); cb.sync(); }
        else if (e.key === "Escape" || e.key.toLowerCase() === "p") void doPause();
        else if (e.key === "Tab") { e.preventDefault(); cb.speed(); }
      });
      this.onFrame = (now) => {
        this.hud.update(w, v.syncing);
        if (!syncTut && w.chargeFull && !this.profile.seenTutorial && w.outcome === "running") {
          syncTut = true;
          this.hud.tutorial("sync");
        }
        if (w.outcome !== "running") {
          if (endAt < 0) {
            endAt = now;
            if (w.outcome === "won") {
              const big = node.type === "boss" || node.type === "elite";
              v.banner(big ? (node.type === "boss" ? "DEFEATED" : "ELITE FALLS") : "CLEARED");
              if (big) audio.victory(); else audio.ui("confirm");
              if (!this.profile.seenTutorial) { this.profile.seenTutorial = true; saveProfile(this.profile); }
            } else {
              v.banner("THE LINE BREAKS");
              audio.defeat();
            }
          }
          if (now - endAt > (w.outcome === "won" ? 1500 : 2600)) finish(w);
        }
      };
    });
  }

  private async pauseMenu(inFight: boolean): Promise<"resume" | "abandon"> {
    this.pausing = true;
    for (;;) {
      const r = await pauseScreen();
      if (r === "settings") {
        await settingsScreen(this.profile, () => { this.applySettings(); saveProfile(this.profile); });
        continue;
      }
      unmount();
      this.pausing = false;
      if (r === "abandon") return "abandon";
      if (!inFight) return "resume";
      return "resume";
    }
  }

  private async finish(run: RunState, codexNew: CodexEntry[]): Promise<"again" | "title"> {
    const won = run.status === "won";
    const p = this.profile;
    const unlocks = evaluateUnlocks(p, run);
    if (won) p.wins++;
    if (run.mode === "endless") p.bestEndless = Math.max(p.bestEndless, run.endlessDepth);
    p.bestChain = Math.max(p.bestChain, run.stats.longestChain);
    p.savedRun = null;
    saveProfile(p);
    this.backdrop("title");
    audio.setMusic("title");
    await wait(200);
    return resultsScreen(run, won, unlocks, codexNew);
  }

  // ───── dev hooks
  forceOutcome(won: boolean): void {
    const w = this.fightWorld;
    if (!w) return;
    if (won) {
      for (const e of w.enemies) { e.hp = 0; e.state = "dead"; }
      w.aliveCache = null;
      w.outcome = "won";
    } else {
      w.fighter.hp = 0;
      w.outcome = "lost";
    }
  }
}
