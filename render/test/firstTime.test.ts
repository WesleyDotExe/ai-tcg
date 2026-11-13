// Render session 28: the first-time flow (owner 2026-10-18, slice 3 of the
// pack-opening work). The page is checked in a real browser by
// progress/render/evidence/first-time-check.mjs; these tests pin what can be
// pinned in Node:
//  1. the data is the store's: each faction's starter deck and its 3 packs
//     (NEW counted against that faction's starter copies), and every branch
//     of "Generate a new agent" was shown the same draft and made what the
//     store records (number, bound promo copy, art piece, flavour);
//  2. the signature face: full bleed, "1 OF 1", the art window empty until
//     the card is made, the menu option's full rules text;
//  3. the mint: its terminal prints the store's values, its beats run in
//     order, and it lasts what the checkpoint proposes;
//  4. the page ships the flow only when asked; the pack page is unchanged;
//  5. (session 29) the name field: the page runs the store's own name
//     rules (bundled), and what it shows for a typed name (the agent's
//     name, the card's flavour line, the avatar) is what confirmAgentDraft
//     makes.
import { describe, expect, it } from "vitest";
import { SHIPPED_DECK_LISTS, generateSignatureCandidates } from "@ai-tcg/engine";
import { signatureArtRef, STARTER_PACKS, customAgentNameProblem, tidyAgentName } from "@ai-tcg/economy";
import { FIRST_TIME_FACTIONS, FIRST_TIME_SEEDS, MINT_TIMINGS, SAMPLE_TYPED_NAMES, agentChoices, factionStart, firstTimeData, typedNameResults, type AgentChoice, type MintedSignature, type SignatureChoice } from "../src/firstTime.js";
import { nameRulesSource } from "../src/nameRules.js";
import { avatarSvg } from "../src/avatar.js";
import { FIRST_TIME_PURE_SOURCE } from "../src/firstTimePage.js";
import { PACK_PAGE_PURE_SOURCE, renderPackOpeningHtml } from "../src/packPage.js";
import { PACK_FX_SHADERS } from "../src/packFx.js";
import { visualSeedFor } from "../src/cardVisual.js";

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}\n${nameRulesSource()}\n${FIRST_TIME_PURE_SOURCE}; return { packFaceHtml, packFullBleed, packFinishLayerName, packFinishLabel, ftMintLines, ftBoundLine, ftMintSchedule, ftCandidate, ftMinted, ftConceptTail, ftRailIndex, FT_RAIL, ftNameCheck, ftNamedMint, FTN };`)() as {
  packFaceHtml: (c: unknown, opts: { settled: boolean }, setCode: string) => string;
  packFullBleed: (reveal: string) => boolean;
  packFinishLayerName: (reveal: string) => string;
  packFinishLabel: (finish: string) => string;
  ftMintLines: (setCode: string, agent: AgentChoice, choice: SignatureChoice, minted: MintedSignature) => [string, string][];
  ftBoundLine: (minted: MintedSignature) => [string, string];
  ftMintSchedule: (lines: [string, string][], mt: typeof MINT_TIMINGS) => { lines: number[]; ward: number; forge: number; stamp: number; settle: number; done: number; free: number };
  ftCandidate: (choice: SignatureChoice) => unknown;
  ftMinted: (minted: MintedSignature) => unknown;
  ftConceptTail: (name: string, concept: string) => string;
  ftRailIndex: (step: string) => number;
  FT_RAIL: string[];
  ftNameCheck: (n: Names, generated: string, raw: string) => { name: string; typed: boolean; problem: string | null };
  ftNamedMint: (m: MintedSignature, generated: string, name: string) => MintedSignature;
  FTN: Names;
};
interface Names {
  customAgentNameProblem: (s: string) => string | undefined;
  tidyAgentName: (s: string) => string;
  avatarSvg: (s: string) => string;
  AGENT_NAME_MIN_LENGTH: number;
  AGENT_NAME_MAX_LENGTH: number;
}

const data = firstTimeData();

describe("the starter collection, per faction (store: grantStarterCollection, openPack)", () => {
  it("offers the four factions, each with its fixed starter deck and the store's 3 packs", () => {
    expect(data.factions.map((f) => f.faction)).toEqual([...FIRST_TIME_FACTIONS]);
    for (const f of data.factions) {
      const list = SHIPPED_DECK_LISTS[f.faction];
      expect(f.deckSize).toBe(list.reduce((n, c) => n + c.copies, 0));
      expect(f.cards.map((c) => c.cardId).sort()).toEqual(list.map((c) => c.cardId).sort());
      expect(f.packs).toHaveLength(STARTER_PACKS);
      expect(f.packs.map((p) => p.reveal.seed)).toEqual([...FIRST_TIME_SEEDS.packs]);
      expect(f.heldAfter.copies).toBe(f.deckSize + f.packs.reduce((n, p) => n + p.reveal.cards.length, 0));
      // Rarest first: the plate and the fan lead with the Mythic.
      expect(f.cards[0]!.face.rarity).toBe("Mythic");
      for (const c of f.cards) expect(c.collectorNumber).toMatch(/^\d{3}\/\d{3}$/);
    }
  });

  it("counts NEW against the faction picked: a card already in its starter deck is never NEW", () => {
    for (const f of data.factions) {
      const inDeck = new Set(f.cards.map((c) => c.cardId));
      const seen = new Set<string>();
      for (const p of f.packs) {
        for (const c of p.reveal.cards) {
          if (c.finish === "standard" || c.finish === "foil") {
            expect(c.isNew, `${f.faction}: ${c.face.name}`).toBe(!inDeck.has(c.cardId) && !seen.has(c.cardId));
          }
          seen.add(c.cardId);
        }
      }
    }
    // Until game session 97 the same packs read differently per faction (a
    // pack card could be in the starter deck picked). Since S0-odds-3 a pack
    // holds booster cards only, never a starter card (owner 2026-11-14), so
    // no pack card is ever in any starter deck and the plain cards' badges
    // are the same for every faction.
    const starterCards = new Set(data.factions.flatMap((f) => f.cards.map((c) => c.cardId)));
    for (const f of data.factions) for (const p of f.packs) for (const c of p.reveal.cards) expect(starterCards.has(c.cardId), `${f.faction}: ${c.face.name}`).toBe(false);
  });
});

describe("the starter guarantee (game session 46; the note, render session 30)", () => {
  it("gives every faction a hit across its 3 starter packs, on the demo's seeds", () => {
    for (const f of data.factions) {
      const hits = f.packs.map((p) => p.reveal.cards.some((c) => c.hit));
      expect(hits.some(Boolean), f.faction).toBe(true);
      // Packs 1 and 2 hold none on these seeds, so the store upgraded pack 3.
      expect(f.packs.map((p) => p.reveal.starterHit), f.faction).toEqual([false, false, true]);
      // The tell stays honest: the upgraded pack throws sparks like any hit.
      expect(f.packs[2]!.reveal.sparks).toBe(true);
    }
  });

  it("marks only the pack the store upgraded, over many seeds (a hit already in pack 1 or 2 leaves pack 3 alone)", () => {
    let upgraded = 0;
    let natural = 0;
    for (let k = 0; k < 40; k++) {
      const seeds = { ...FIRST_TIME_SEEDS, packs: [5000 + 3 * k, 5001 + 3 * k, 5002 + 3 * k] as const };
      const f = factionStart("Swarm", seeds as unknown as typeof FIRST_TIME_SEEDS);
      const reveals = f.packs.map((p) => p.reveal);
      expect(reveals.some((r) => r.cards.some((c) => c.hit)), `seeds ${seeds.packs}`).toBe(true);
      expect(reveals[0]!.starterHit || reveals[1]!.starterHit).toBe(false);
      const earlier = reveals[0]!.sparks || reveals[1]!.sparks;
      expect(reveals[2]!.starterHit).toBe(!earlier && !reveals[2]!.pity.fullArt);
      if (reveals[2]!.starterHit) upgraded++;
      else natural++;
    }
    // Both cases occur on these seeds (about half each, as measured: 45.8% hit by chance).
    expect(upgraded).toBeGreaterThan(5);
    expect(natural).toBeGreaterThan(5);
  });

  it("shows the note on the summary only, after the reveal, worded like the pity note", () => {
    const html = renderPackOpeningHtml({ title: "t", packs: [], flow: data });
    expect(html.split("Starter guarantee: this pack was due a hit.").length - 1).toBe(1);
    const summary = html.slice(html.indexOf("function summary()"));
    const end = summary.indexOf("\n  function ", 10);
    expect(summary.slice(0, end > 0 ? end : undefined)).toContain("r.starterHit ? 'Starter guarantee: this pack was due a hit. '");
    // No other code reads it (the data carries it as "starterHit": ...): the
    // sealed pack, the tear and the reveals never change.
    expect(html.match(/\.starterHit\b/g)).toHaveLength(2);
    expect(summary.slice(0, end > 0 ? end : undefined).match(/\.starterHit\b/g)).toHaveLength(2);
  });
});

describe("Generate a new agent, every branch (store: startAgentDraft, pickDraftAgent, confirmAgentDraft)", () => {
  it("shows 3 agents, 3 cards each, and one made card per choice", () => {
    expect(data.agents).toHaveLength(3);
    for (const a of data.agents) {
      expect(a.signatures).toHaveLength(3);
      expect(a.minted).toHaveLength(3);
      expect(a.avatar).toMatch(/^<svg/);
    }
    // Each agent's pick draws its own seed, so the agents aren't offered the
    // same three cards.
    expect(new Set(data.agents.map((a) => a.signatures.map((s) => s.name).join())).size).toBe(3);
  });

  it("makes exactly what was picked: name, body, number, the bound promo copy, the art piece, the flavour", () => {
    for (const a of data.agents) {
      a.signatures.forEach((s, i) => {
        const m = a.minted[i]!;
        expect(m.agentName).toBe(a.name);
        expect(m.face.name).toBe(s.name);
        expect([m.face.cost, m.face.attack, m.face.health]).toEqual([s.face.cost, s.face.attack, s.face.health]);
        expect(m.face.text).toEqual(s.face.text);
        expect(m.face.rarity).toBe("Mythic");
        expect(m.face.faction).toBe("Neutral");
        expect(m.collectorNumber).toBe("PR-001");
        expect(m.cardId).toBe("sig-PR-001");
        expect(m.comboId).toBe(s.comboId);
        expect(m.copy).toMatchObject({ origin: "promo", bound: true, stamp: "SIGNATURE", seriesCode: "PR-001" });
        expect(m.face.flavor).toContain(a.name);
        expect(m.art.pool).toBe("S0");
        expect(m.art.slot).toBeGreaterThanOrEqual(1);
        expect(m.art.slot).toBeLessThanOrEqual(m.art.of);
        // The placeholder picture follows the art piece, not the card id.
        expect(m.face.visualSeed).toBe(visualSeedFor(signatureArtRef({ pool: m.art.pool, slot: m.art.slot })));
      });
    }
  });

  it("is reproducible: the same seeds give the same draft and the same cards", () => {
    const again = agentChoices();
    expect(again.map((a) => [a.name, a.signatures.map((s) => s.name), a.minted.map((m) => m.art.slot)])).toEqual(
      data.agents.map((a) => [a.name, a.signatures.map((s) => s.name), a.minted.map((m) => m.art.slot)]),
    );
    expect(factionStart("Swarm").packs.map((p) => p.reveal.cards.map((c) => `${c.cardId}:${c.finish}`))).toEqual(
      data.factions.find((f) => f.faction === "Swarm")!.packs.map((p) => p.reveal.cards.map((c) => `${c.cardId}:${c.finish}`)),
    );
  });
});

describe("the signature card's face", () => {
  const a = data.agents[1]!, choice = a.signatures[1]!, made = a.minted[1]!;
  const cls = (html: string) => /^<div class="([^"]+)"/.exec(html)![1]!.split(" ");

  it("is full bleed in white-gold with SIGNATURE, its number and 1 OF 1, once made", () => {
    const html = pure.packFaceHtml(pure.ftMinted(made), { settled: true }, "S0");
    expect(cls(html)).toEqual(expect.arrayContaining(["face", "faction-Neutral", "full", "sigface"]));
    expect(html).toContain(">SIGNATURE<");
    expect(html).toContain("PR-001");
    expect(html).toContain("1 OF 1");
    expect(html).toContain("Signature · S0");
    expect(html).not.toContain("ART PIECE");
    expect(pure.packFullBleed("signature")).toBe(true);
    expect(pure.packFinishLabel("signature")).toBe("SIGNATURE");
    expect(pure.packFinishLayerName("signature")).toBe("signature");
    expect(PACK_FX_SHADERS.signature).toContain("gl_FragColor");
  });

  it("has no art and no number yet on the pick screen (the store draws both when the card is made)", () => {
    const html = pure.packFaceHtml(pure.ftCandidate(choice), { settled: true }, "S0");
    expect(html).toContain("ART PIECE");
    expect(html).not.toContain("PR-001");
    expect(html).toContain(choice.face.name.replace(/'/g, "&#39;"));
  });

  it("prints the card's own rules text, the menu option's full wording (game session 45)", () => {
    // Every made card's face text is its built abilities' text (keywords as
    // every other card prints them), and the pick screen shows the same.
    for (const a of data.agents) {
      a.signatures.forEach((c, i) => {
        const m = a.minted[i]!;
        expect(c.face.text).toEqual(m.face.text);
        expect(m.face.text.join(" ").length, c.concept).toBeGreaterThan(5);
        // The pick screen's caption still reads from the concept: cost and
        // stats, then the same wording (a keyword-only card prints it bare).
        const tail = pure.ftConceptTail(c.name, c.concept);
        expect(tail.startsWith(`cost ${m.face.cost}, `), tail).toBe(true);
        expect(tail.replace(/\.$/, "").endsWith(m.face.text.join(" ").replace(/\.$/, "")), `${tail} | ${m.face.text.join(" ")}`).toBe(true);
      });
    }
    expect(data.agents.flatMap((x) => x.signatures).some((s) => /^(On arrival|At the start|When it)/.test(s.face.text[0]!))).toBe(true);
  });
});

describe("the mint", () => {
  it("prints what the store recorded, in order", () => {
    for (const a of data.agents) {
      a.signatures.forEach((s, i) => {
        const m = a.minted[i]!;
        const lines = pure.ftMintLines("S0", a, s, m);
        expect(lines.map((l) => l[0].trim())).toEqual(["> MINT SIGNATURE", "agent", "card", "fairness", "art", "number"]);
        expect(lines[1]![1]).toBe(m.agentName);
        expect(lines[2]![1]).toBe(s.name);
        expect(lines[3]![1]).toBe(`passed at ${s.measured.seeds.toLocaleString("en-US")} games · ${s.comboId}`);
        expect(lines[4]![1]).toBe(`pool S0 · piece ${m.art.slot} of 500`);
        expect(lines[5]![1]).toBe(m.collectorNumber);
      });
    }
    expect(pure.ftBoundLine(data.agents[0]!.minted[0]!)[1]).toContain("1 of 1");
  });

  it("runs its beats in order, the card turning only after the terminal and the ward", () => {
    for (const a of data.agents) {
      a.signatures.forEach((s, i) => {
        const lines = pure.ftMintLines("S0", a, s, a.minted[i]!);
        const p = pure.ftMintSchedule(lines, MINT_TIMINGS);
        expect(p.lines[0]).toBe(MINT_TIMINGS.gather);
        for (let k = 1; k < p.lines.length; k++) expect(p.lines[k]).toBeGreaterThan(p.lines[k - 1]!);
        const last = lines[lines.length - 1]!;
        expect(p.forge).toBeGreaterThanOrEqual(p.lines[p.lines.length - 1]! + last[1].length * MINT_TIMINGS.typePerChar);
        expect(p.forge).toBeGreaterThanOrEqual(p.ward + MINT_TIMINGS.wardIn);
        expect(p.ward).toBe(p.lines[1]);
        expect([p.forge, p.stamp, p.settle, p.done, p.free]).toEqual([p.forge, p.forge + MINT_TIMINGS.forge, p.forge + MINT_TIMINGS.forge + MINT_TIMINGS.stamp, p.done, p.done + MINT_TIMINGS.hold]);
        // The proposal: about 6.5 s to the settled card, under 8 s to "free".
        expect(p.done).toBeGreaterThan(5500);
        expect(p.done).toBeLessThan(7500);
        expect(p.free).toBeLessThan(8500);
      });
    }
  });

  it("stays under 8.5 s to free even with the longest names the generators allow (32 / 30 characters)", () => {
    const a = data.agents[0]!, s = a.signatures[0]!, m = a.minted[0]!;
    const long = pure.ftMintLines("S0", a, { ...s, name: "x".repeat(30), comboId: "sig7-4x6-commander.c3+dampen" }, { ...m, agentName: "y".repeat(32) });
    expect(pure.ftMintSchedule(long, MINT_TIMINGS).free).toBeLessThan(8500);
  });
});

describe("the page", () => {
  const flowPage = renderPackOpeningHtml({ title: "t", packs: [], flow: data });
  const packPage = renderPackOpeningHtml({ title: "t", packs: [] });

  it("ships the flow, the mint overlay, the ward generator and the timings only on the first-time page", () => {
    for (const s of ['id="mint"', 'id="ftbadge"', "function fallbackWardSheet", "function ftMintSchedule", "SEASON ZERO SIGN-UP", '"mint":{"gather"']) {
      expect(flowPage, s).toContain(s);
      if (s !== '"mint":{"gather"') expect(packPage, s).not.toContain(s);
    }
    expect(packPage).toContain("// PACK OPENING");
  });

  it("walks the rail in order", () => {
    expect(pure.FT_RAIL).toEqual(["Faction", "Packs", "Agent", "Signature"]);
    const steps = ["welcome", "faction", "starter", "packs", "agents", "sigs", "mint", "minted", "ready"];
    const at = steps.map(pure.ftRailIndex);
    for (let k = 1; k < at.length; k++) expect(at[k]).toBeGreaterThanOrEqual(at[k - 1]!);
  });

  it("embeds the store's results and nothing that rolls (no pack odds, no generator)", () => {
    const json = /<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(flowPage)![1]!;
    const d = JSON.parse(json);
    expect(d.flow.agents[0].minted[0].collectorNumber).toBe("PR-001");
    expect(flowPage).not.toMatch(/rollPack|generateSignatureCandidates|startAgentDraft\(/);
  });
});

describe("the name field (render session 29)", () => {
  const generated = data.agents[0]!.name;
  // Names an owner might type: the samples, each generated agent name, and
  // mangled versions of them (case, spaces, punctuation, length).
  const corpus = new Set<string>(SAMPLE_TYPED_NAMES);
  for (const a of data.agents) for (const n of [a.name, a.name.toUpperCase(), ` ${a.name}  `, a.name.replace(/ /g, "_"), a.name.replace(/ /g, ".."), `${a.name} Admin`, `${a.name}${"z".repeat(30)}`]) corpus.add(n);
  for (const w of ["mod", "Mod Squad", "modem", "System Shock", "Systemic", "Dev Null", "Devo", "gm", "Sussex Lane", "Cumulus", "Grapevine", "Analog Kid", "kys", "aitcg fan", "A I T C G", "Ünicode", "Аdmin", "Tab\tName", "99", "a1", "abc", "o'Neil", "O''Neil", "_lead", "end.", "Mid-Life_Crisis"]) corpus.add(w);

  it("runs the store's own rules: the bundle agrees with economy/src/agentNames.ts on every name", () => {
    expect(pure.FTN.AGENT_NAME_MIN_LENGTH).toBe(3);
    expect(pure.FTN.AGENT_NAME_MAX_LENGTH).toBe(32);
    for (const n of corpus) {
      expect(pure.FTN.tidyAgentName(n), n).toBe(tidyAgentName(n));
      expect(pure.FTN.customAgentNameProblem(n), n).toBe(customAgentNameProblem(n));
    }
    // The corpus reaches every kind of refusal and some allowed names.
    const kinds = new Set([...corpus].map((n) => customAgentNameProblem(n)?.split(" ").slice(0, 5).join(" ") ?? "ok"));
    expect(kinds.size).toBeGreaterThanOrEqual(8);
  });

  it("shows for a typed name exactly what confirmAgentDraft makes (name, flavour line) or refuses", () => {
    const results = typedNameResults([...corpus].filter((n) => n.trim() !== generated));
    const made = data.agents[0]!.minted[0]!;
    let refused = 0, renamed = 0;
    for (const r of results) {
      const c = pure.ftNameCheck(pure.FTN, generated, r.typed);
      if (r.refused) {
        refused++;
        expect(c.problem, r.typed).not.toBeNull();
        expect(c.problem!.toLowerCase(), r.typed).toBe(`${r.refused}.`.toLowerCase());
        continue;
      }
      expect(c.problem, r.typed).toBeNull();
      expect(c.name, r.typed).toBe(r.agentName);
      const shown = pure.ftNamedMint(made, generated, c.name);
      expect(shown.agentName).toBe(r.agentName);
      expect(shown.face.flavor, r.typed).toBe(r.flavor);
      expect(shown.face.name).toBe(made.face.name);
      expect(shown.face.text).toEqual(made.face.text);
      if (c.typed) renamed++;
    }
    expect(refused).toBeGreaterThan(10);
    expect(renamed).toBeGreaterThan(10);
    // The generated name is in the flavour line, so a typed name shows.
    expect(made.face.flavor).toContain(generated);
  });

  it("keeps the generated name when the field is blank or repeats it, and leaves the made card as it was", () => {
    for (const raw of ["", "   ", generated, `  ${generated} `]) {
      const c = pure.ftNameCheck(pure.FTN, generated, raw);
      expect(c).toEqual({ name: generated, typed: false, problem: null });
    }
    const m = data.agents[0]!.minted[0]!;
    expect(pure.ftNamedMint(m, generated, generated)).toBe(m);
  });

  it("draws the avatar a typed name's matches will draw (the replay's own avatar code)", () => {
    for (const n of ["Bit by Bit", "Night Shift 99", data.agents[1]!.name]) expect(pure.FTN.avatarSvg(n)).toBe(avatarSvg(n));
    for (const a of data.agents) expect(a.avatar).toBe(avatarSvg(a.name));
  });

  it("ships the bundled rules only on the first-time page", () => {
    const flowPage = renderPackOpeningHtml({ title: "t", packs: [], flow: data });
    const packPage = renderPackOpeningHtml({ title: "t", packs: [] });
    expect(flowPage).toContain("var FTN");
    expect(flowPage).toContain('id="ft-name"');
    expect(packPage).not.toContain("var FTN");
  });
});
