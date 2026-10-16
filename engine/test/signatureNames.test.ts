// Signature card names (owner 2026-10-15: they must read as a real name and
// stay on theme; names never repeat; rarely the owner's username). Session 35.
// Session 36 (owner 2026-10-16): the username 1 in 100, the [Handle]'s and
// "of the [Place]" patterns favoured, and agent names from the same generator.

import { describe, expect, it } from "vitest";
import { Rng } from "../src/state/rng.js";
import { SIGNATURE_MENU } from "../src/data/signatureMenu.js";
import { CARD_REGISTRY } from "../src/data/registry.js";
import {
  AGENT_TEMPLATE_WEIGHTS,
  HANDLES,
  TEMPLATE_WEIGHTS,
  agentName,
  agentNameSpace,
  drawSignatureCardName,
  MAX_NAME_LENGTH,
  NAME_LISTS,
  USERNAME_HANDLE_ODDS,
  namingProblem,
  signatureCardName,
  signatureNameSpace,
  usernameHandle,
} from "../src/data/signatureNames.js";

// The template shapes, so every name is checked against a grammar, not just a length.
const HANDLE = "[A-Z][A-Za-z0-9_.-]*";
const SHAPES = [
  new RegExp(`^${HANDLE}'s [A-Z0-9][^ ]* .+$`), // [Handle]'s [Modifier] [Thing] / [Handle]'s [Thing]
  /^[A-Z0-9][^ ]* .+$/, // [Modifier] [Thing] ([Edition])
  /^.+ of the [A-Z].+$/, // [Thing] of the [Place]
];

describe("signature card names", () => {
  it("every menu option has ability-leaning things, and the space runs to millions per option", () => {
    for (const option of SIGNATURE_MENU) {
      expect(NAME_LISTS.groupOf[option.key], option.key).toBeDefined();
      expect(signatureNameSpace(option.key)).toBeGreaterThan(1_000_000);
    }
    // The handle slot has thousands of options, as asked.
    expect(HANDLES.length).toBeGreaterThan(1500);
    expect(new Set(HANDLES).size).toBe(HANDLES.length);
  });

  it("no curated word or generated handle trips the filter on its own", () => {
    for (const h of HANDLES) expect(namingProblem(h), h).toBeUndefined();
    for (const m of NAME_LISTS.modifiers) expect(namingProblem(m), m).toBeUndefined();
    for (const t of [...Object.values(NAME_LISTS.things).flat(), ...NAME_LISTS.generic]) expect(namingProblem(t), t).toBeUndefined();
    for (const p of NAME_LISTS.places) expect(namingProblem(p), p).toBeUndefined();
    for (const p of NAME_LISTS.programs) expect(namingProblem(p), p).toBeUndefined();
    // "[Thing] of the [Place]": every place carries its "the".
    for (const p of NAME_LISTS.places) expect(p, p).toMatch(/^the [A-Z]/);
  });

  it("2,000 names: all fit a template, pass the filter, fit the frame, and never repeat a taken name", () => {
    const rng = new Rng(35);
    const used = new Set([...CARD_REGISTRY.values()].map((c) => c.name));
    const setNames = new Set(used);
    for (let i = 0; i < 2000; i++) {
      const ability = SIGNATURE_MENU[i % SIGNATURE_MENU.length]!.key;
      const name = signatureCardName(rng, ability, used);
      expect(used.has(name), name).toBe(false);
      expect(setNames.has(name)).toBe(false);
      expect(namingProblem(name), name).toBeUndefined();
      expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      expect(SHAPES.some((s) => s.test(name)), name).toBe(true);
      used.add(name);
    }
  });

  it("leans the noun toward the ability: an attack card is never a Firewall, a guard card never a DDoS", () => {
    const rng = new Rng(1);
    const things = (group: string) => NAME_LISTS.things[group]!;
    for (let i = 0; i < 300; i++) {
      const smite = signatureCardName(rng, "smite", new Set());
      for (const t of things("guard")) expect(smite.endsWith(` ${t}`) || smite.includes(` ${t} of `), smite).toBe(false);
      const guard = signatureCardName(rng, "guardian", new Set());
      for (const t of things("strike")) expect(guard.endsWith(` ${t}`) || guard.startsWith(`${t} of `), guard).toBe(false);
    }
  });

  it("the filter refuses repeats, long names and blocked words", () => {
    expect(namingProblem("Zion's Midnight DDoS")).toBeUndefined();
    expect(namingProblem("Static Static Burst")).toMatch(/repeats/);
    expect(namingProblem("Turbo Turbo Button")).toMatch(/repeats/);
    expect(namingProblem("Staticwolf's Static Burst")).toMatch(/repeats/);
    expect(namingProblem("Recycle Bin of the Recycle Bin")).toMatch(/repeats/);
    expect(namingProblem("Battery-Powered Buffer Overflow 3000")).toMatch(/longer than/);
    expect(namingProblem("Nazi Firewall")).toMatch(/blocked/);
    // Short roots only as whole words: ordinary words stay.
    expect(namingProblem("Analog Cumulus Grapevine")).toBeUndefined();
  });

  it("an owner's username is a handle only when it reads as one", () => {
    expect(usernameHandle("zion")).toBe("Zion");
    expect(usernameHandle("Neon_Fan99")).toBe("Neon_Fan99");
    expect(usernameHandle(undefined)).toBeUndefined();
    expect(usernameHandle("ab")).toBeUndefined(); // too short
    expect(usernameHandle("a-very-long-username-indeed")).toBeUndefined(); // too long for the frame
    expect(usernameHandle("12345")).toBeUndefined(); // digits are not a name
    expect(usernameHandle("hitlerfan")).toBeUndefined(); // blocked
    expect(usernameHandle("bad name!")).toBeUndefined();
  });

  it("puts the username in the handle slot about 1 time in USERNAME_HANDLE_ODDS (100), and only there", () => {
    expect(USERNAME_HANDLE_ODDS).toBe(100); // owner 2026-10-16, option C
    const rng = new Rng(77);
    let hits = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const name = signatureCardName(rng, "tax", new Set(), { username: "zion" });
      if (name.includes("Zion")) {
        hits++;
        expect(name).toMatch(/^Zion's /);
      }
    }
    // Expected n / 100 = 100 (plus a few from the plain handle "Zion"); seeded, so fixed.
    expect(hits).toBeGreaterThan(n / USERNAME_HANDLE_ODDS / 2);
    expect(hits).toBeLessThan((n / USERNAME_HANDLE_ODDS) * 2);
  });

  it("is reproducible from the seed", () => {
    const a = Array.from({ length: 5 }, ((r) => () => signatureCardName(r, "rally", new Set()))(new Rng(9)));
    const b = Array.from({ length: 5 }, ((r) => () => signatureCardName(r, "rally", new Set()))(new Rng(9)));
    expect(a).toEqual(b);
  });

  it("favours the [Handle]'s and \"of the [Place]\" patterns: about 60 / 30 / 10 (owner 2026-10-16)", () => {
    expect(TEMPLATE_WEIGHTS.reduce((t, [, w]) => t + w, 0)).toBe(100);
    const rng = new Rng(16);
    const counts = new Map<string, number>();
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const { template } = drawSignatureCardName(rng, SIGNATURE_MENU[i % SIGNATURE_MENU.length]!.key, new Set());
      counts.set(template, (counts.get(template) ?? 0) + 1);
    }
    const share = (...t: string[]) => t.reduce((s, k) => s + (counts.get(k) ?? 0), 0) / n;
    expect(share("handleModThing", "handleThing")).toBeGreaterThan(0.57);
    expect(share("handleModThing", "handleThing")).toBeLessThan(0.64);
    expect(share("thingOfPlace")).toBeGreaterThan(0.27);
    expect(share("thingOfPlace")).toBeLessThan(0.33);
    expect(share("modThing", "modThingEdition")).toBeLessThanOrEqual(0.1);
  });
});

describe("agent names (owner 2026-10-16: the same themed treatment)", () => {
  const AGENT_SHAPES = [
    new RegExp(`^${HANDLE}'s [A-Z][A-Za-z-]+$`), // [Handle]'s [Program]
    new RegExp(`^${HANDLE} of the [A-Z].+$`), // [Handle] of the [Place]
    new RegExp(`^[A-Z0-9][^ ]* ${HANDLE}$`), // [Modifier] [Handle]
    new RegExp(`^${HANDLE} (${NAME_LISTS.editions.map((e) => e.replace(/[.']/g, "\\$&")).join("|")})$`), // [Handle] [Edition]
  ];

  it("2,000 agent names: all fit a template, pass the filter, fit 30 characters, never repeat", () => {
    const rng = new Rng(36);
    const used = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const name = agentName(rng, used);
      expect(used.has(name)).toBe(false);
      expect(namingProblem(name), name).toBeUndefined();
      expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      expect(AGENT_SHAPES.some((s) => s.test(name)), name).toBe(true);
      used.add(name);
    }
    expect(agentNameSpace()).toBeGreaterThan(100_000);
  });

  it("uses the same 60 / 30 / 10 split", () => {
    expect(AGENT_TEMPLATE_WEIGHTS.reduce((t, [, w]) => t + w, 0)).toBe(100);
    const rng = new Rng(61);
    const n = 10_000;
    let handles = 0;
    let places = 0;
    for (let i = 0; i < n; i++) {
      const name = agentName(rng, new Set());
      if (/^\S+'s /.test(name)) handles++;
      else if (/ of the /.test(name)) places++;
    }
    expect(handles / n).toBeGreaterThan(0.57);
    expect(handles / n).toBeLessThan(0.64);
    expect(places / n).toBeGreaterThan(0.27);
    expect(places / n).toBeLessThan(0.33);
  });
});
