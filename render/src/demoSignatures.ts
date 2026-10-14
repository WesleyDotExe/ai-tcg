// Demo signature cards for render replays (EFFECTS.md v2 slice 7 evidence).
//
// An agent's signature card is a Neutral Mythic Unit with a generated name
// (built from the engine's signature menu). It is never in mythics.json, so
// it never gets Replicate art: its ward is always the code-drawn fallback,
// seeded from its name. The engine's agent generator (generateAgent) isn't
// built yet, so these two stand in for what it will hand out: two lines
// that pass the owner's fairness test at 2,500 seeds
// (progress/balance-report-024-signature-levers.txt), with names written
// for the demo. Render-only presentation; nothing here changes play.
import { buildSignatureCard } from "./engineInternal.js";
import type { SignatureSpec } from "./engineInternal.js";
import type { UnitCard } from "@ai-tcg/engine";

export const DEMO_SIGNATURES: { name: string; spec: SignatureSpec }[] = [
  { name: "Consensus Lantern", spec: { ability: "rally", tier: 5, attack: 3, health: 6, size: "a0" } },
  { name: "Tollgate Daemon", spec: { ability: "tax", tier: 5, attack: 3, health: 6 } },
];

/** The demo signature card for seat k (0 = player one). */
export function demoSignatureCard(k: 0 | 1): UnitCard {
  const d = DEMO_SIGNATURES[k]!;
  return buildSignatureCard(d.spec, { name: d.name });
}
