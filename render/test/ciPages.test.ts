// The CI browser check (ci/browser-check.mjs) drives the pages ciPages()
// builds by their ids, hooks and classes. These pin that those still exist,
// so a rename fails here, in vitest, with a clear message, rather than as a
// browser timeout in CI.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CI_REPLAY, ciPages } from "../src/ciPages.js";

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
    const ids = [...check.matchAll(/'(boast-[a-z0-9-]+)'/g)].map((m) => m[1]!);
    const boasts = ids.filter((id) => !id.endsWith("-phone"));
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
});
