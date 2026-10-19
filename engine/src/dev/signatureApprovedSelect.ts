// How the approved signature list picks its lines from raw fairness results
// (src/dev/signatureApprovedList.ts writes the list; this is its rule, kept
// apart so a test can run it on made-up lines).
//
// The largest measurement of a line decides (session 35, owner 2026-10-15);
// at equal seed counts the best result counts. Only results at 2,500 seeds
// or more count, and rework probes never do.
//
// Provenance (session 50): a result line written since session 50 carries
// the fingerprint of the card it measured and the stamp of the reference it
// was measured against. A stamped line whose card no longer builds to that
// fingerprint, or whose reference isn't today's, is stale: it is set aside
// and never decides, whatever its seed count. Lines written before carry
// neither stamp, but every edge records the reference's own win rate
// (`refRate`), so an unstamped line counts only when all twelve match
// today's reference at its seed count. That tells the two agents' results
// apart exactly (session 50: every line in agent41/ matches today's
// reference, every older line the session-37 one), so the folder is a
// filing convention, not something the list has to trust. The card of an
// unstamped line isn't checked here; the generated list's fingerprint test
// checks that every listed card builds as it did when listed.

import type { CandidateResult } from "./signatureFairness.js";
import { signatureComboId, type SignatureSpec } from "../data/signatureMenu.js";

export interface Decisive {
  spec: SignatureSpec;
  worst: number;
  seeds: number;
  pass: boolean;
  file: string;
}

export interface StaleResult {
  id: string;
  file: string;
  seeds: number;
  why: string;
}

export interface TodayStamps {
  /** The fingerprint the line's card builds to today. */
  fingerprint(spec: SignatureSpec): string;
  /** Today's reference's stamp at that seed count, or undefined when today's
   * reference has fewer games (such a stamped line can't be checked). */
  reference(seeds: number): string | undefined;
  /** Today's reference's win rate per "Self>Opponent" edge at that seed
   * count, or undefined when it has fewer games. */
  refRates(seeds: number): Record<string, number> | undefined;
}

/** Every full CandidateResult in a raw-results line, whatever command wrote
 * it (candidates: the line itself; tune: `best`; levers: `confirmed`). */
export function resultsIn(line: unknown): CandidateResult[] {
  const o = line as { factions?: unknown; best?: CandidateResult; confirmed?: CandidateResult[] };
  if (o.confirmed) return o.confirmed;
  if (o.best) return [o.best];
  return o.factions ? [line as CandidateResult] : [];
}

/** Why `r` can't count today, or undefined when it can. */
export function staleReason(r: CandidateResult, today: TodayStamps): string | undefined {
  if (r.fingerprint !== undefined) {
    const now = today.fingerprint(r.spec);
    if (r.fingerprint !== now) return `card changed since measured (fingerprint ${r.fingerprint}, today ${now})`;
  }
  if (r.reference !== undefined) {
    const now = today.reference(r.seeds);
    if (now === undefined) return `today's reference has fewer than ${r.seeds} games, can't check stamp ${r.reference}`;
    if (r.reference !== now) return `measured against another reference (stamp ${r.reference}, today ${now})`;
    return undefined;
  }
  const rates = today.refRates(r.seeds);
  if (rates === undefined) return `today's reference has fewer than ${r.seeds} games, can't check its reference rates`;
  for (const f of r.factions) {
    for (const e of f.edges) {
      const key = `${f.faction}>${e.opponent}`;
      if (e.change.refRate !== rates[key]) return `measured against another reference (${key} reference rate ${e.change.refRate}, today ${rates[key]})`;
    }
  }
  return undefined;
}

/** Per line id, its deciding measurement; the ids that ever passed (at 2,500
 * or more, not stale); and the stale results set aside. Files are read in
 * name order. */
export function selectApproved(
  files: readonly { name: string; text: string }[],
  today: TodayStamps,
): { decisive: Map<string, Decisive>; everPassed: Set<string>; stale: StaleResult[] } {
  const decisive = new Map<string, Decisive>();
  const everPassed = new Set<string>();
  const stale: StaleResult[] = [];
  for (const { name, text } of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const lineText of text.split("\n").filter(Boolean)) {
      for (const r of resultsIn(JSON.parse(lineText))) {
        if (r.seeds < 2500 || r.spec.ability.startsWith("rework:")) continue;
        const id = signatureComboId(r.spec);
        const why = staleReason(r, today);
        if (why) {
          stale.push({ id, file: name, seeds: r.seeds, why });
          continue;
        }
        if (r.pass) everPassed.add(id);
        const cur = decisive.get(id);
        if (!cur || r.seeds > cur.seeds || (r.seeds === cur.seeds && r.worst < cur.worst)) {
          decisive.set(id, { spec: r.spec, worst: r.worst, seeds: r.seeds, pass: r.pass, file: name });
        }
      }
    }
  }
  return { decisive, everPassed, stale };
}
