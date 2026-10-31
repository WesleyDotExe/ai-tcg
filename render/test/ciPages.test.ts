// The CI browser check (ci/browser-check.mjs) drives the pages ciPages()
// builds by their ids, hooks and classes. These pin that those still exist,
// so a rename fails here, in vitest, with a clear message, rather than as a
// browser timeout in CI.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STARTER_BOASTS } from "@ai-tcg/economy";
import { BOAST_CLEAR_MS, BOAST_LEAD_MS, boastFromRecord } from "../src/boastFx.js";
import { SKIP_HINT_KEY, SKIP_HINT_TAP } from "../src/skipHint.js";
import { CI_REPLAY, ciPages } from "../src/ciPages.js";
import { renderBoastSheet } from "../src/boastSheet.js";

const here = dirname(fileURLToPath(import.meta.url));
const check = readFileSync(resolve(here, "../ci/browser-check.mjs"), "utf8");
const pages = await ciPages();

describe("the CI browser check's pages", () => {
  it("builds the boast sheet and the one replay the check opens", () => {
    // Not compared with render/output: a game-lane card change may change
    // the replay, and must not fail the render's tests.
    expect(Object.keys(pages).sort()).toEqual(["boast-sheet.html", CI_REPLAY.file].sort());
    expect(check).toContain(`const REPLAY = '${CI_REPLAY.file}'`);
  });

  it("the boast sheet has every scene the check plays, with its sides", () => {
    const sheet = pages["boast-sheet.html"]!;
    const list = /const BOASTS = \[([^\]]+)\]/.exec(check)![1]!;
    const boasts = [...list.matchAll(/'(boast-[a-z0-9-]+)'/g)].map((m) => m[1]!);
    expect(boasts).toHaveLength(6);
    for (const id of boasts) for (const where of ["full", "top"]) for (const part of ["", "-side-w", "-side-l", "-hud-l"]) {
      expect(sheet, `${id}-${where}${part}`).toContain(`id="${id}-${where}${part}"`);
    }
    expect(sheet).toContain('id="boast-aegis-shield-slam-phone"');
    for (const hook of ["window.playBoastScene", "fx-top", "__boast", "__cfx", "boast-skip"]) expect(sheet, hook).toContain(hook);
  });

  it("the replay has the intro's hooks", () => {
    const replay = pages[CI_REPLAY.file]!;
    for (const hook of ['id="btn-play"', "window.__boot", "__music", "__cfx", "boot-skip"]) expect(replay, hook).toContain(hook);
  });

  it("the replay's end has the hooks section D reads", () => {
    const replay = pages[CI_REPLAY.file]!;
    for (const hook of ['id="scrubber"', 'id="turnbar"', 'id="match-data"', "fx-lethal-overlay", "GAME OVER: ", "boast-who", "boast-panel", "boast-skip", "fx-top"]) expect(replay, hook).toContain(hook);
    for (const part of ["side-", "hud-", "hand-"]) for (const p of ["p1", "p2"]) expect(replay, part + p).toContain(`id="${part}${p}"`);
  });

  it("the replay ends in a win with no record, so the winner's faction starter plays", () => {
    // If a game-lane change ever turns seed 6 into a draw, this names it
    // (the check would only see no boast).
    const json = /<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/.exec(pages[CI_REPLAY.file]!)![1]!;
    const data = JSON.parse(json) as { record?: unknown; frames: { winner: string | null; players: Record<string, { faction: string }> }[] };
    const last = data.frames[data.frames.length - 1]!;
    expect(data.record ?? null).toBeNull();
    expect(["p1", "p2"]).toContain(last.winner);
    const pick = boastFromRecord(null, last.winner, last.players[last.winner!]!.faction);
    expect(pick?.id).toBe(STARTER_BOASTS[last.players[last.winner!]!.faction as keyof typeof STARTER_BOASTS].itemId);
  });

  it("section D's starter map and timings are the render's own", () => {
    const map = /const STARTER = (\{[^}]+\})/.exec(check)![1]!;
    const parsed = JSON.parse(map.replace(/(\w+):/g, '"$1":').replace(/'/g, '"')) as Record<string, string>;
    expect(parsed).toEqual(Object.fromEntries(Object.entries(STARTER_BOASTS).map(([f, b]) => [f, b.itemId])));
    for (const [f, id] of Object.entries(parsed)) expect(boastFromRecord(null, "p1", f)?.id, f).toBe(id);
    expect(check).toContain(`const LEAD_MS = ${BOAST_LEAD_MS}, CLEAR_MS = ${BOAST_CLEAR_MS};`);
  });

  it("section E's hint words are the render's own (render session 43)", () => {
    const m = /const HINT_KEY = '([^']+)', HINT_TAP = '([^']+)';/.exec(check)!;
    expect(m, "the words line in browser-check.mjs").toBeTruthy();
    expect(JSON.parse(`"${m[1]}"`)).toBe(SKIP_HINT_KEY);
    expect(m[2]).toBe(SKIP_HINT_TAP);
  });

  it("the sheet has the 30 scenes section E counts, each with its winner's side", () => {
    expect(check).toContain("keys.length === 30");
    const sheet = renderBoastSheet();
    const scenes = [...sheet.matchAll(/<section class="scene[^"]*" id="([^"]+)"/g)].map((x) => x[1]!);
    expect(scenes.length).toBe(30);
    for (const k of scenes) expect(sheet, k).toContain(`id="${k}-side-w"`);
  });
});
