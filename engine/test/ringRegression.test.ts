// The standing balance regression check (dev/ringRegression.ts, owner
// 2026-10-04 A.5). The measuring itself runs in CI; these pin the judging
// rules and that the committed baseline covers exactly the six ring edges.

import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RING_EDGES, DECK_MODES, edgeName, judgeEdge } from "../src/dev/ringRegression.js";
import { APPROVED_SIGNATURE_CARDS, approvedSignatureFor } from "../src/dev/edgeMeasure.js";

const NULL_AEGIS = RING_EDGES[0]!; // W edge, band 55-60
const NULL_CORTEX = RING_EDGES[4]!; // even edge, band 45-55
const m = (edge: string, selfWins: number, games: number) => ({ edge, selfWins, games });

test("the baseline file records each of the six ring edges at its gate seed count", () => {
  const base = JSON.parse(readFileSync(new URL("../src/dev/ringBaseline.json", import.meta.url), "utf8"));
  expect(base.edges.map((e: { edge: string; games: number }) => [e.edge, e.games])).toEqual(
    RING_EDGES.map((e) => [edgeName(e), e.seeds]),
  );
  expect(RING_EDGES.map(edgeName)).toEqual(["Null > Aegis", "Aegis > Cortex", "Cortex > Swarm", "Swarm > Null", "Null ~ Cortex", "Aegis ~ Swarm"]);
});

test("the signature-zone baseline covers the same six edges and says which decks it played", () => {
  const base = JSON.parse(readFileSync(new URL("../src/dev/ringBaselineSignature.json", import.meta.url), "utf8"));
  expect(base.decks).toBe("set Mythic as signature card");
  expect(base.edges.map((e: { edge: string; games: number }) => [e.edge, e.games])).toEqual(
    RING_EDGES.map((e) => [edgeName(e), e.seeds]),
  );
});

test("the real-match baseline covers the same six edges and says which decks it played", () => {
  const base = JSON.parse(readFileSync(new URL("../src/dev/ringBaselineReal.json", import.meta.url), "utf8"));
  expect(base.decks).toBe(DECK_MODES.approved.label);
  expect(base.edges.map((e: { edge: string; games: number }) => [e.edge, e.games])).toEqual(
    RING_EDGES.map((e) => [edgeName(e), e.seeds]),
  );
});

test("the real-match draw gives each seat every approved line twice per 28 seeds, once going first and once second", () => {
  const n = APPROVED_SIGNATURE_CARDS.length;
  expect(n).toBe(14);
  for (const seat of [0, 1] as const) {
    for (const start of [1, 29, 2493]) {
      const odd = new Map<string, number>(), even = new Map<string, number>();
      for (let seed = start; seed < start + 2 * n; seed++) {
        const tally = seed % 2 === 1 ? odd : even;
        const id = approvedSignatureFor(seed, seat).id;
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      expect(odd.size, `seat ${seat} from seed ${start}, odd seeds`).toBe(n);
      expect(even.size, `seat ${seat} from seed ${start}, even seeds`).toBe(n);
    }
  }
  for (let seed = 1; seed <= 2500; seed++) expect(approvedSignatureFor(seed, 0).id).not.toBe(approvedSignatureFor(seed, 1).id);
  // Session 43's draw, (seed * 7 + seat * 3) % 14, reached 2 lines per seat. Pinned so it can't come back.
  expect(new Set(Array.from({ length: 2500 }, (_, i) => approvedSignatureFor(i + 1, 0).id)).size).toBe(n);
});

test("an IN edge that slips to OUT fails; one that stays IN passes", () => {
  const base = m("Null ~ Cortex", 450, 900); // 50%, IN
  expect(judgeEdge(NULL_CORTEX, m("Null ~ Cortex", 360, 900), base).pass).toBe(false); // 40%, OUT
  expect(judgeEdge(NULL_CORTEX, m("Null ~ Cortex", 440, 900), base).pass).toBe(true); // 48.9%, IN
});

test("an accepted-OUT edge fails only on a real move further out, never on a move toward its band", () => {
  const base = m("Null > Aegis", 1200, 2500); // 48%, OUT below 55-60
  expect(judgeEdge(NULL_AEGIS, m("Null > Aegis", 1050, 2500), base).pass, "42%: real, further out").toBe(false);
  expect(judgeEdge(NULL_AEGIS, m("Null > Aegis", 1190, 2500), base).pass, "47.6%: within noise").toBe(true);
  expect(judgeEdge(NULL_AEGIS, m("Null > Aegis", 1300, 2500), base).pass, "52%: real, toward the band").toBe(true);
});

test("an unchanged measurement always passes", () => {
  for (const e of RING_EDGES) {
    const same = m(edgeName(e), Math.round(e.seeds * 0.3), e.seeds);
    expect(judgeEdge(e, same, same).pass).toBe(true);
  }
});
