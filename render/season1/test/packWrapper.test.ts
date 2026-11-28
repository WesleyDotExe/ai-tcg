// The Season 1 pack-wrapper designs and the pick row (render session 95):
// the layout's rules, the set-name placeholder, the light's limits (held to
// the flash check's own measure), and the row's motion.
import { describe, expect, it } from "vitest";
import { analyse, blocksOf, FlashTracker } from "../src/flashScan.js";
import {
  CODE_RE, DESIGNS, inSafe, LIGHT, LIGHT_JS, lightAt, MASCOTS, overlaps, packHtml, PLACEHOLDER_NAME, S1_FIRST, SAFE, setTitle, TEXT_REGIONS,
  type LightInput,
} from "../src/packWrapper.js";
import { dragSlots, ease, PICK_JS, restingSlot, ROW_COUNT, slotPose } from "../src/packPick.js";
import { packPickPage, packWrappersPage } from "../src/packWrapperPage.js";

describe("the wrapper designs", () => {
  it("are three, each laying out the wordmark, the season line, the title, the symbol and the art once", () => {
    expect(DESIGNS.map((d) => d.id)).toEqual(["crest", "window", "bleed"]);
    for (const d of DESIGNS) expect(d.regions.map((r) => r.id).sort(), d.id).toEqual(["art", "season", "symbol", "title", "wordmark"]);
  });
  it("keep all print (text and symbol) inside the safe area, clear of the crimps", () => {
    for (const d of DESIGNS) for (const r of d.regions) if (r.id !== "art") expect(inSafe(r), `${d.id} ${r.id}`).toBe(true);
    // The art may run to the edges only in the full-bleed design.
    for (const d of DESIGNS) if (d.id !== "bleed") expect(inSafe(d.regions.find((r) => r.id === "art")!), d.id).toBe(true);
  });
  it("never let two pieces of print overlap; the print overlaps the art only on a scrim (the full bleed)", () => {
    for (const d of DESIGNS) {
      const print = d.regions.filter((r) => r.id !== "art"), art = d.regions.find((r) => r.id === "art")!;
      for (let i = 0; i < print.length; i++) for (let j = i + 1; j < print.length; j++) expect(overlaps(print[i]!, print[j]!), `${d.id}: ${print[i]!.id} / ${print[j]!.id}`).toBe(false);
      for (const p of print) if (TEXT_REGIONS.includes(p.id) && overlaps(p, art)) expect(d.scrim, `${d.id} ${p.id} on the art`).toContain(p.id);
    }
  });
  it("make the set's name the title: larger than the wordmark and the season line in every design", () => {
    for (const d of DESIGNS) {
      const size = (id: string) => d.regions.find((r) => r.id === id)!.size!;
      expect(size("title"), d.id).toBeGreaterThan(size("wordmark"));
      expect(size("season"), d.id).toBeLessThan(size("wordmark"));
    }
  });
  it("say \"Set name\" until the set is named, never a made-up name; Season 1 and the code S1-01 small", () => {
    expect(S1_FIRST.name).toBeNull();
    expect(setTitle(S1_FIRST)).toBe(PLACEHOLDER_NAME);
    expect(setTitle({ ...S1_FIRST, name: "  " })).toBe(PLACEHOLDER_NAME);
    expect(setTitle({ ...S1_FIRST, name: "Example" })).toBe("Example");
    expect(S1_FIRST.code).toMatch(CODE_RE);
    for (const d of DESIGNS) {
      const h = packHtml({ design: d.id, mascot: "Cortex", px: 250 });
      expect(h).toContain(">Set name<"); expect(h).toContain("Season 1"); expect(h).toContain("S1-01"); expect(h).toContain("AI<i>·</i>TCG");
      expect(h).toContain('class="ti placeholder"');
    }
  });
  it("drop the season line on a small pack (Store sizes), keeping the wordmark, title and symbol", () => {
    const h = packHtml({ design: "crest", mascot: "Aegis", px: 62 });
    expect(h).not.toContain('data-region="season"');
    for (const r of ["wordmark", "title", "symbol", "art"]) expect(h).toContain(`data-region="${r}"`);
  });
  it("draw a placeholder mascot for each faction (shapes on a circuit field, not a glyph), marked as placeholder art", () => {
    for (const m of MASCOTS) {
      const h = packHtml({ design: "crest", mascot: m, px: 200 });
      expect(h).toContain("PLACEHOLDER ART");
      expect((h.match(/<(path|rect|circle)/g) ?? []).length, m).toBeGreaterThan(10);
    }
  });
});

describe("the light", () => {
  it("stays within its turn, and the highlight stays on the face, for any input", () => {
    const inputs: LightInput[] = [{ mode: "still" }];
    for (let k = -4; k <= 4; k++) inputs.push({ mode: "pointer", px: k * 0.5, py: -k * 0.4 }, { mode: "tilt", beta: 40 + k * 20, gamma: k * 15 }, { mode: "sweep", t: k * 1100 });
    for (const i of inputs) {
      const p = lightAt(i);
      expect(Math.abs(p.turnY)).toBeLessThanOrEqual(LIGHT.maxTurnY); expect(Math.abs(p.turnX)).toBeLessThanOrEqual(LIGHT.maxTurnX);
      for (const v of [p.lx, p.ly, p.holo]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
  it("sweeps slowly (once across and back in no less than 4 s; FLASH.md: a slow sheen)", () => {
    expect(LIGHT.sweepMs).toBeGreaterThanOrEqual(4000);
    expect(lightAt({ mode: "sweep", t: 0 }).lx).toBeCloseTo(lightAt({ mode: "sweep", t: LIGHT.sweepMs }).lx, 5);
  });
  it("runs the same function in the page as here", () => {
    const f = new Function(`${LIGHT_JS}; return lightAt;`)() as typeof lightAt;
    for (const i of [{ mode: "still" }, { mode: "pointer", px: 0.3, py: -0.8 }, { mode: "tilt", beta: 10, gamma: -30 }, { mode: "sweep", t: 2345 }] as LightInput[]) expect(f(i)).toEqual(lightAt(i));
  });
  it("never makes a flash the check counts: the highlight crossing the dark foil, at the fastest a pointer moves it (render 96: brighter, owner call 3; at most one counted flash a second, none here)", () => {
    // The highlight drawn as the page draws it: alpha `specAlpha` at its
    // centre over the foil's darkest-to-lightest (sRGB 12-70), crossing a
    // 1024 x 768 screen's pack (300 x 480) once every 200 ms.
    const W = 512, H = 384, fps = 30, t = new FlashTracker();
    for (let f = 0; f < 90; f++) {
      const data = new Uint8Array(W * H * 4);
      const cx = 0.5 + 0.42 * Math.sin((2 * Math.PI * f) / (fps * 0.4));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const base = 12 + (58 * x) / W;
        const dx = (x / W - cx) / 0.38, dy = (y / H - 0.42) / 0.26, d = Math.sqrt(dx * dx + dy * dy);
        const a = d < 0.45 ? LIGHT.specAlpha - (LIGHT.specAlpha * 2 / 3) * (d / 0.45) : d < 0.75 ? (LIGHT.specAlpha / 3) * (1 - (d - 0.45) / 0.3) : 0;
        const v = Math.round(base + a * (255 - base)), i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
      }
      t.push(blocksOf({ w: W, h: H, data }));
    }
    const r = analyse(t, fps, W, H);
    expect(r.pass).toBe(true);
    expect(r.bigFlashes.length).toBe(0);
    expect(r.worst.changes).toBeLessThanOrEqual(2);
  });
});

describe("the pick row", () => {
  it("puts the centre pack large and facing the owner, its neighbours angled back and dimmer, and more behind", () => {
    const c = slotPose(0), n = slotPose(1), m = slotPose(-1), f = slotPose(2);
    expect(c).toMatchObject({ x: 0, rotY: 0, scale: 1, light: 1, opacity: 1 });
    expect(n.x).toBeGreaterThan(0); expect(m.x).toBeLessThan(0);
    expect(n.rotY).toBeLessThan(0); expect(m.rotY).toBeGreaterThan(0); // facing inward
    expect(n.scale).toBeLessThan(c.scale); expect(n.light).toBeLessThan(c.light); expect(n.z).toBeLessThan(c.z);
    expect(f.scale).toBeLessThan(n.scale); expect(f.light).toBeLessThan(n.light); expect(f.x).toBeGreaterThan(n.x); expect(f.opacity).toBe(1);
    expect(slotPose(3.5).opacity).toBe(0);
  });
  it("moves every pack smoothly as the row moves (no jump between fractional places)", () => {
    for (let r = -3; r < 3; r += 0.01) {
      const a = slotPose(r), b = slotPose(r + 0.01);
      expect(Math.abs(a.x - b.x)).toBeLessThan(0.02); expect(Math.abs(a.rotY - b.rotY)).toBeLessThan(0.6); expect(Math.abs(a.scale - b.scale)).toBeLessThan(0.01);
    }
  });
  it("carries a fling on a little, at most three packs, and snaps to a pack inside the row", () => {
    expect(restingSlot(3.2, 0)).toBe(3);
    expect(restingSlot(3.2, 0.003)).toBe(4);
    expect(restingSlot(3, 1)).toBe(6);
    expect(restingSlot(3, -1)).toBe(0);
    expect(restingSlot(0.2, -0.01)).toBe(0);
    expect(restingSlot(5.9, 0.05)).toBe(ROW_COUNT - 1);
    expect(dragSlots(-200, 270)).toBeCloseTo(1, 0);
  });
  it("eases to the pack without overshooting it and settles in under 0.8 s", () => {
    let s = { pos: 1.6, vel: 0.004 }, max = 0, settled = -1;
    for (let t = 0; t < 1500; t += 16) { s = ease(s.pos, s.vel, 2, 16); max = Math.max(max, s.pos); if (settled < 0 && Math.abs(s.pos - 2) < 0.01) settled = t; }
    expect(max).toBeLessThanOrEqual(2.02);
    expect(settled).toBeGreaterThan(0); expect(settled).toBeLessThan(800);
    expect(s.pos).toBe(2);
  });
  it("runs the same functions in the page as here", () => {
    const f = new Function(`${PICK_JS}; return { slotPose, restingSlot, ease };`)() as { slotPose: typeof slotPose; restingSlot: typeof restingSlot; ease: typeof ease };
    expect(f.slotPose(1.3)).toEqual(slotPose(1.3)); expect(f.restingSlot(2.4, 0.01)).toBe(restingSlot(2.4, 0.01)); expect(f.ease(1, 0, 2, 100)).toEqual(ease(1, 0, 2, 100));
  });
});

describe("the pages", () => {
  it("are self-contained (no outside requests) and fenced off", () => {
    for (const h of [packWrappersPage(), packPickPage()]) {
      expect(h).not.toMatch(/(src|href)="https?:/);
      expect(h).not.toMatch(/@import|url\(["']?https?:/);
    }
  });
  it("the pick page holds one pack per design and nothing that tells packs apart: no seed, no card, no odds line", () => {
    const h = packPickPage();
    expect((h.match(/<template id="tpl-/g) ?? []).length).toBe(3);
    expect(h).not.toMatch(/seed|same odds|\bodds\b/i);
  });
  it("the wrapper sheet shows each design large, in the four covers and at the Store's sizes", () => {
    const h = packWrappersPage();
    expect((h.match(/data-hero/g) ?? []).length).toBe(3);
    expect((h.match(/data-cover/g) ?? []).length).toBe(12);
    expect((h.match(/data-size/g) ?? []).length).toBe(9);
  });
});

void SAFE;
