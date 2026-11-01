// The "tap to skip" hint (render session 43): its words, where it may go,
// and how the boast's runtime shows it (the exact text the page embeds,
// on the fake page the boast's other runtime tests use).
import { describe, expect, it } from "vitest";
import { SKIP_HINT_BOARD_KEY, SKIP_HINT_BOARD_TAP, SKIP_HINT_GAP, SKIP_HINT_KEY, SKIP_HINT_PAD, SKIP_HINT_SOURCE, SKIP_HINT_TAP, skipHintPlace, skipHintText } from "../src/skipHint.js";
import { BOAST_CSS, BOAST_PURE_SOURCE, BOAST_RUNTIME_SOURCE } from "../src/boastFx.js";
import { MATCH_BOOT_RUNTIME_SOURCE } from "../src/matchBootFx.js";
import { readFileSync } from "node:fs";
import { BAND, page, type FakeEl } from "./boastPage.js";

const BOX = { l: 20, t: 180, r: 1120, b: 354 };
const SK = { l: 1040, t: 186, r: 1112, b: 208 };

describe("the words", () => {
  it("a touch screen taps anywhere; a desktop clicks anywhere or presses Escape", () => {
    expect(skipHintText(true)).toBe(SKIP_HINT_TAP);
    expect(skipHintText(false)).toBe(SKIP_HINT_KEY);
    expect(SKIP_HINT_TAP).toBe("or tap anywhere");
    expect(SKIP_HINT_KEY).toBe("or click anywhere · Esc");
  });

  it("the intro names the board, on a mouse and on a touch screen (owner, session 43 call 4)", () => {
    expect(skipHintText(false, "board")).toBe(SKIP_HINT_BOARD_KEY);
    expect(skipHintText(true, "board")).toBe(SKIP_HINT_BOARD_TAP);
    expect(SKIP_HINT_BOARD_KEY).toBe("or click the board · Esc");
    expect(SKIP_HINT_BOARD_TAP).toBe("or tap the board");
  });
});

describe("where it goes (skipHintPlace)", () => {
  it("right under the button, right-aligned with it", () => {
    const r = skipHintPlace(SK, 90, 14, BOX, [])!;
    expect(r).toEqual({ l: SK.r - 90, t: SK.b + SKIP_HINT_GAP, r: SK.r, b: SK.b + SKIP_HINT_GAP + 14 });
  });

  it("is left out rather than leave its box: too wide, or too low", () => {
    // Wider than the room left of the button's right edge.
    expect(skipHintPlace(SK, SK.r - BOX.l - SKIP_HINT_PAD + 1, 14, BOX, [])).toBeNull();
    expect(skipHintPlace(SK, SK.r - BOX.l - SKIP_HINT_PAD, 14, BOX, [])).not.toBeNull();
    // A short box: the hint's bottom would pass the box's (less the pad).
    const shortBox = { ...BOX, b: SK.b + SKIP_HINT_GAP + 14 + SKIP_HINT_PAD - 1 };
    expect(skipHintPlace(SK, 90, 14, shortBox, [])).toBeNull();
    expect(skipHintPlace(SK, 90, 14, { ...shortBox, b: shortBox.b + 1 }, [])).not.toBeNull();
    // A button already past the box's right edge.
    expect(skipHintPlace({ ...SK, r: BOX.r + 10, l: BOX.r - 60 }, 90, 14, BOX, [])).toBeNull();
  });

  it("is left out rather than touch the name plate (or anything else it must avoid)", () => {
    const plate = { l: 900, t: 205, r: 1100, b: 240 };
    expect(skipHintPlace(SK, 90, 14, BOX, [plate])).toBeNull();
    // Just clear of it: fine.
    expect(skipHintPlace(SK, 90, 14, BOX, [{ ...plate, t: SK.b + SKIP_HINT_GAP + 14 }])).not.toBeNull();
    expect(skipHintPlace(SK, 90, 14, BOX, [{ ...plate, r: SK.r - 90 }])).not.toBeNull();
    expect(skipHintPlace(SK, 90, 14, BOX, [null, plate])).toBeNull();
  });

  it("nothing to place (no size, no button, no box) is no hint", () => {
    expect(skipHintPlace(SK, 0, 14, BOX, [])).toBeNull();
    expect(skipHintPlace(SK, 90, NaN, BOX, [])).toBeNull();
    expect(skipHintPlace(null as never, 90, 14, BOX, [])).toBeNull();
    expect(skipHintPlace(SK, 90, 14, null as never, [])).toBeNull();
  });
});

describe("on the page", () => {
  it("every page with a boast or the intro carries it: inside the boast's sources, with its CSS", () => {
    expect(BOAST_PURE_SOURCE).toContain(SKIP_HINT_SOURCE);
    expect(BOAST_CSS).toContain(".skip-hint {");
    expect(BOAST_RUNTIME_SOURCE).toContain("skipHintShow(sk, geom.band");
    expect(BOAST_RUNTIME_SOURCE).toContain("skipHintSeen(); finish('skip')");
    expect(MATCH_BOOT_RUNTIME_SOURCE).toContain("skipHintShow(sk, A, avoid, 'board')");
    expect(MATCH_BOOT_RUNTIME_SOURCE).toContain("skipHintSeen(); finish('skip')");
  });

  it("the loadout picker, which hides the Skip button, hides the hint with it", () => {
    const src = readFileSync(new URL("../src/loadoutPicker.ts", import.meta.url), "utf8");
    expect(src).toMatch(/\.boast-skip, \.skip-hint \{ display: none !important; \}/);
  });
});

function hints(body: FakeEl): FakeEl[] { return body.children.filter((c) => c.className === "skip-hint"); }
function skipBtn(body: FakeEl): FakeEl { return body.children.filter((c) => c.className === "boast-skip").pop()!; }
function rectOf(e: FakeEl) { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }

describe("the boast shows it (the runtime, on the fake page)", () => {
  it("under Skip, inside the winner's side, clear of the name plate; the desktop words; the button's label says it too", () => {
    const p = page();
    const plan = p.BOAST.play("boast-aegis-shield-slam", p.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 })!;
    const [h] = hints(p.body);
    expect(h, "a hint").toBeTruthy();
    expect(h!.textContent).toBe(SKIP_HINT_KEY);
    expect(p.BOAST.stats().hint).toBe(SKIP_HINT_KEY);
    const sk = rectOf(skipBtn(p.body)), hr = rectOf(h!);
    expect(hr.r).toBe(sk.r);
    expect(hr.t).toBe(sk.b + SKIP_HINT_GAP);
    expect(hr.l).toBeGreaterThanOrEqual(BAND.l); expect(hr.b).toBeLessThanOrEqual(BAND.b);
    const nm = (plan as unknown as { marks: { k: string; x: number; y: number; w: number; h: number }[] }).marks.find((m) => m.k === "name")!;
    const plate = { l: nm.x - nm.w / 2, t: nm.y - nm.h / 2, r: nm.x + nm.w / 2, b: nm.y + nm.h / 2 };
    expect(hr.r <= plate.l || hr.l >= plate.r || hr.b <= plate.t || hr.t >= plate.b, "clear of the plate").toBe(true);
    expect(skipBtn(p.body).attrs["aria-label"]).toBe("Skip, " + SKIP_HINT_KEY);
    expect(h!.attrs["aria-hidden"]).toBe("true");
  });

  it("a touch screen gets the tap words", () => {
    const p = page();
    p.media.coarse = true;
    p.BOAST.play("boast-swarm-hive-burst", p.els, { who: "Bastion Relay", faction: "Swarm", seed: 7 });
    expect(hints(p.body)[0]!.textContent).toBe(SKIP_HINT_TAP);
  });

  it("goes with the button when the boast ends, and isn't shown again once the viewer has skipped", () => {
    const p = page();
    p.BOAST.play("boast-aegis-shield-slam", p.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    for (let k = 0; k < 400 && p.BOAST.active(); k++) p.frame(16);
    expect(p.BOAST.active()).toBe(false);
    expect(hints(p.body)[0]!.classList.contains("gone"), "faded with Skip at the boast's own end").toBe(true);
    expect(p.BOAST.stats().hintSeen, "an ending isn't a skip").toBe(false);
    // The next boast on this page shows it again; a tap skips that one.
    p.BOAST.play("boast-null-void-collapse", p.els, { who: "Bastion Relay", faction: "Null", seed: 7 });
    expect(hints(p.body).length).toBe(2);
    p.down();
    expect(p.BOAST.stats().last!.reason).toBe("skip");
    expect(hints(p.body)[1]!.classList.contains("gone")).toBe(true);
    expect(p.BOAST.stats().hintSeen).toBe(true);
    // From now on: no hint, the Skip button still there.
    p.BOAST.play("boast-cortex-data-cascade", p.els, { who: "Bastion Relay", faction: "Cortex", seed: 7 });
    expect(hints(p.body).length).toBe(2);
    expect(p.BOAST.stats().hint).toBeNull();
    expect(skipBtn(p.body).classList.contains("gone")).toBe(false);
    expect(skipBtn(p.body).attrs["aria-label"]).toBeUndefined();
  });

  it("Escape counts as a skip too; a cancel (a jump, a restart) doesn't", () => {
    const a = page();
    a.BOAST.play("boast-aegis-shield-slam", a.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    a.BOAST.cancel();
    expect(a.BOAST.stats().hintSeen).toBe(false);
    a.BOAST.play("boast-aegis-shield-slam", a.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    a.key("Escape");
    expect(a.BOAST.stats().hintSeen).toBe(true);
  });

  it("the reduced-motion still shows it the same way", () => {
    const p = page();
    p.BOAST.play("boast-swarm-hive-burst", p.els, { who: "Bastion Relay", faction: "Swarm", seed: 7, reduced: true });
    expect(hints(p.body)[0]!.textContent).toBe(SKIP_HINT_KEY);
  });

  it("a winner's side too short to hold it under Skip: no hint, the button stays", () => {
    const p = page();
    // A band only as tall as Skip plus a little: the hint would pass its bottom.
    (p.els as { band: FakeEl }).band = { ...p.els.band, getBoundingClientRect: () => ({ left: BAND.l, top: BAND.t, right: BAND.r, bottom: BAND.t + 34, width: BAND.r - BAND.l, height: 34 }) };
    p.BOAST.play("boast-aegis-shield-slam", p.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    expect(hints(p.body).length).toBe(0);
    expect(p.BOAST.stats().hint).toBeNull();
  });
});
