// Where the approved signature list's lines come from (session 50): result
// lines carry their own provenance, and the list reads it instead of
// trusting which folder a file sits in.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPROVED_SIGNATURE_LINES } from "../src/data/signatureApproved.js";
import { buildSignatureCard, signatureComboId, signatureFingerprint, type SignatureSpec } from "../src/data/signatureMenu.js";
import { selectApproved, type TodayStamps } from "../src/dev/signatureApprovedSelect.js";
import {
  FAIRNESS_LIMIT,
  loadReference,
  measureReference,
  referenceRates,
  referenceStamp,
  testCandidate,
  type CandidateResult,
  type Reference,
} from "../src/dev/signatureFairness.js";

const RESULTS = fileURLToPath(new URL("../../progress/signature-fairness/", import.meta.url));
const filesIn = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((name) => ({ name, text: readFileSync(dir + name, "utf8") }));

/** What the generator checks against: the cards as built now and the
 * committed reference. */
const today: TodayStamps = {
  fingerprint: (spec) => signatureFingerprint(buildSignatureCard(spec, { anyStats: true })),
  reference: (seeds) => referenceStamp(loadReference(seeds)),
  refRates: (seeds) => referenceRates(loadReference(seeds)),
};

describe("the approved list's selection over the committed results", () => {
  it("today's agent's folder regenerates the committed list exactly, with nothing set aside", () => {
    const { decisive, stale } = selectApproved(filesIn(RESULTS + "agent41/"), today);
    expect(stale).toEqual([]);
    const passes = [...decisive].filter(([, d]) => d.pass).sort(([a], [b]) => a.localeCompare(b));
    expect(passes.map(([id, d]) => ({ id, worst: d.worst.toFixed(4), seeds: d.seeds, source: `progress/signature-fairness/agent41/${d.file}` }))).toEqual(
      APPROVED_SIGNATURE_LINES.map((l) => ({ id: l.id, worst: l.worst.toFixed(4), seeds: l.seeds, source: l.source })),
    );
  });

  it("the older agent's results are all set aside by their recorded reference rates, not by their folder", () => {
    const old = filesIn(RESULTS);
    const { decisive, stale } = selectApproved(old, today);
    expect(decisive.size).toBe(0);
    expect(stale.length).toBeGreaterThan(50);
    for (const s of stale) expect(s.why, `${s.file} ${s.id}`).toMatch(/^measured against another reference \(.+ reference rate /);
  });
});

/** A made-up result line at 2,500 seeds whose edges all record today's
 * reference rates. */
function fakeResult(spec: SignatureSpec, worst: number, extra: Partial<CandidateResult> = {}): CandidateResult {
  const rates = today.refRates(2500)!;
  const factions = (["Cortex", "Swarm", "Aegis", "Null"] as const).map((faction) => ({
    faction,
    edges: (["Cortex", "Swarm", "Aegis", "Null"] as const)
      .filter((o) => o !== faction)
      .map((opponent) => ({ opponent, change: { rate: 0.5, refRate: rates[`${faction}>${opponent}`]!, diff: worst, lo: worst, hi: worst } })),
    worst,
    pass: worst <= FAIRNESS_LIMIT,
  }));
  return { id: signatureComboId(spec), spec, seeds: 2500, factions, worst, pass: worst <= FAIRNESS_LIMIT, ...extra };
}
const line = (r: CandidateResult) => JSON.stringify(r);

describe("stamped results", () => {
  const spec: SignatureSpec = { ability: "tax", tier: 5, attack: 3, health: 6 };
  const fp = today.fingerprint(spec);
  const stamp = today.reference(2500)!;

  it("a line stamped with today's card and reference counts", () => {
    const { decisive, stale } = selectApproved([{ name: "a.jsonl", text: line(fakeResult(spec, 0.01, { fingerprint: fp, reference: stamp })) }], today);
    expect(stale).toEqual([]);
    expect(decisive.get(signatureComboId(spec))?.pass).toBe(true);
  });

  it("a line whose card changed since it was measured is set aside, even when it has the most seeds", () => {
    const changed = { ...fakeResult(spec, 0.05, { fingerprint: "deadbeef", reference: stamp }), seeds: 10000 };
    // The 10,000-game result would otherwise decide (and fail the line).
    const { decisive, stale } = selectApproved(
      [{ name: "a.jsonl", text: [line(fakeResult(spec, 0.01, { fingerprint: fp, reference: stamp })), line(changed)].join("\n") }],
      { ...today, reference: (seeds) => (seeds === 10000 ? stamp : today.reference(seeds)) },
    );
    expect(stale.map((s) => s.why)).toEqual([`card changed since measured (fingerprint deadbeef, today ${fp})`]);
    expect(decisive.get(signatureComboId(spec))).toMatchObject({ seeds: 2500, pass: true });
  });

  it("a line measured against another reference is set aside, by its stamp or, unstamped, by its rates", () => {
    const stamped = fakeResult(spec, 0.01, { fingerprint: fp, reference: "00000000" });
    const unstamped = fakeResult(spec, 0.01);
    unstamped.factions[2]!.edges[0]!.change.refRate += 1 / 2500; // one game differs on one edge
    const { decisive, stale } = selectApproved([{ name: "a.jsonl", text: [line(stamped), line(unstamped)].join("\n") }], today);
    expect(decisive.size).toBe(0);
    expect(stale.map((s) => s.why)).toEqual([
      `measured against another reference (stamp 00000000, today ${stamp})`,
      expect.stringMatching(/^measured against another reference \(Aegis>Cortex reference rate /),
    ]);
  });

  it("an unstamped line matching today's reference rates still counts (the committed files)", () => {
    const { decisive, stale } = selectApproved([{ name: "a.jsonl", text: line(fakeResult(spec, 0.01)) }], today);
    expect(stale).toEqual([]);
    expect(decisive.size).toBe(1);
  });

  it("a stamped line longer than today's reference can't be checked, so it doesn't count", () => {
    const long = { ...fakeResult(spec, 0.01, { fingerprint: fp, reference: stamp }), seeds: 20000 };
    const { decisive, stale } = selectApproved([{ name: "a.jsonl", text: line(long) }], { ...today, reference: () => undefined });
    expect(decisive.size).toBe(0);
    expect(stale[0]!.why).toMatch(/fewer than 20000 games/);
  });
});

describe("testCandidate stamps what it measured", () => {
  it("the card's fingerprint and the reference's stamp, which changes when any one game differs", async () => {
    const ref: Reference = await measureReference(2);
    const spec: SignatureSpec = { ability: "tax", tier: 5, attack: 3, health: 6 };
    const card = buildSignatureCard(spec, { anyStats: true });
    const r = await testCandidate(card, spec, ref);
    expect(r.fingerprint).toBe(signatureFingerprint(card));
    expect(r.reference).toBe(referenceStamp(ref));
    for (const f of r.factions) for (const e of f.edges) expect(e.change.refRate).toBe(referenceRates(ref)[`${f.faction}>${e.opponent}`]);
    const flipped: Reference = { ...ref, results: { ...ref.results, "Null>Aegis": ref.results["Null>Aegis"]![0] === "1" ? "0" + ref.results["Null>Aegis"]!.slice(1) : "1" + ref.results["Null>Aegis"]!.slice(1) } };
    expect(referenceStamp(flipped)).not.toBe(referenceStamp(ref));
  }, 60_000);
});
