// Rework proposals for the menu options no lever can make pass (session 33;
// owner 2026-10-13: "options that still fail come back with rework
// proposals at the next check-in (Guardian and Bulwark are the likely
// ones)"). These are NOT menu options: each is a different ability, which
// only the owner can choose. They are measured with the same fairness test
// so the check-in can show numbers next to each proposal.
//
// For each proposal: a small grid of bodies at its cost (attack 2-4, the
// owner's floor of 2 kept) at 500 seeds, then the 2 lines with the smallest
// worst edge re-measured at 2,500 seeds. One JSON line per proposal.
//
// Usage (from engine/):
//   npx tsx src/dev/signatureReworkProbe.ts [--only key,...] [--shard i/k] [--out file]

import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { netChange, testCandidate, type CandidateResult, type Reference } from "./signatureFairness.js";
import type { Ability, Keyword, UnitCard } from "../cards/types.js";
import type { SignatureSpec } from "../data/signatureMenu.js";

export interface Rework {
  key: string;
  /** Which failing option it would replace. */
  replaces: "guardian" | "bulwark";
  text: string;
  cost: 5 | 6 | 7;
  keywords: Keyword[];
  abilities: Ability[];
  /** Bodies to try, [attack, health]. */
  bodies: [number, number][];
}

const self = { scope: "self" } as const;
const grid = (attacks: number[], healths: number[]): [number, number][] => attacks.flatMap((a) => healths.map((h): [number, number] => [a, h]));
const redirect = (condition?: Ability["condition"]): Ability => ({
  id: "sig-bulwark",
  trigger: "onEnemyAttack",
  limit: "oncePerTurn",
  ...(condition ? { condition } : {}),
  text: "",
  targeting: self,
  effects: [{ kind: "redirectAttack" }],
});
const noGuard = { kind: "not", condition: { kind: "guardInPlay", side: "controller" } } as const;

export const REWORKS: Rework[] = [
  {
    key: "guard-only",
    replaces: "guardian",
    text: "Guard. (Barrier dropped.)",
    cost: 5,
    keywords: ["Guard"],
    abilities: [],
    bodies: grid([2, 3], [3, 4, 5, 6]),
  },
  {
    key: "barrier-only",
    replaces: "guardian",
    text: "Barrier. (Guard dropped.)",
    cost: 5,
    keywords: ["Barrier"],
    abilities: [],
    bodies: grid([2, 3, 4], [4, 5, 6]),
  },
  {
    key: "bulwark-units",
    replaces: "bulwark",
    text: "Takes the first attack aimed at one of your units each turn (never one aimed at you), unless a Guard unit is protecting your side.",
    cost: 5,
    keywords: [],
    abilities: [redirect({ kind: "all", conditions: [noGuard, { kind: "attackTargets", target: "unit" }] })],
    bodies: grid([2, 3], [3, 4, 5, 6]),
  },
  {
    key: "bulwark-face",
    replaces: "bulwark",
    text: "Takes the first attack aimed at you each turn, unless a Guard unit is protecting your side.",
    cost: 5,
    keywords: [],
    abilities: [redirect({ kind: "all", conditions: [noGuard, { kind: "attackTargets", target: "player" }] })],
    bodies: grid([2, 3], [3, 4, 5, 6]),
  },
  {
    key: "intercept",
    replaces: "bulwark",
    text: "Once per turn, Instant, pay 1 energy: redirect the pending attack to this.",
    cost: 5,
    keywords: [],
    abilities: [
      {
        id: "sig-bulwark",
        trigger: "activated",
        speed: "Instant",
        cost: { energy: 1 },
        limit: "oncePerTurn",
        // Offered only while an attack is pending.
        condition: { kind: "any", conditions: [{ kind: "attackTargets", target: "unit" }, { kind: "attackTargets", target: "player" }] },
        text: "Redirect the pending attack to this.",
        targeting: self,
        effects: [{ kind: "redirectAttack" }],
      },
    ],
    bodies: grid([2, 3], [3, 4, 5, 6]),
  },
];

function card(r: Rework, attack: number, health: number): { card: UnitCard; spec: SignatureSpec } {
  const id = `rework${r.cost}-${attack}x${health}-${r.key}`;
  return {
    card: {
      id,
      name: id,
      faction: "Neutral",
      rarity: "Mythic",
      cost: r.cost,
      type: "Unit",
      attack,
      health,
      keywords: r.keywords,
      art: `placeholder:signature/${id}`,
      flavor: "",
      abilities: r.abilities.map((a) => ({ ...a, text: a.text || r.text })),
    },
    // testCandidate only uses the spec for the result's id and spec fields.
    spec: { ability: `rework:${r.key}`, tier: r.cost, attack, health },
  };
}

export interface ReworkResult {
  key: string;
  replaces: string;
  text: string;
  screened: { id: string; net: number; worst: number }[];
  confirmed: CandidateResult[];
}

const REFERENCE_FILE = fileURLToPath(new URL("./signatureReference.json", import.meta.url));
function reference(seeds: number): Reference {
  const ref = JSON.parse(readFileSync(REFERENCE_FILE, "utf8")) as Reference;
  return { seeds, results: Object.fromEntries(Object.entries(ref.results).map(([k, v]) => [k, v.slice(0, seeds)])) };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const only = arg("only")?.split(",");
  const [shard, shards] = (arg("shard") ?? "0/1").split("/").map(Number) as [number, number];
  const out = arg("out");
  const screen = reference(500);
  const confirm = reference(2500);
  const pct = (x: number) => (x * 100).toFixed(1);
  for (const [i, r] of REWORKS.entries()) {
    if (only ? !only.includes(r.key) : i % shards !== shard) continue;
    const screened: { id: string; net: number; worst: number; attack: number; health: number }[] = [];
    for (const [attack, health] of r.bodies) {
      const { card: c, spec } = card(r, attack, health);
      const res = await testCandidate(c, spec, screen);
      screened.push({ id: c.id, net: netChange(res), worst: res.worst, attack, health });
      console.error(`  ${c.id.padEnd(36)} net ${pct(netChange(res))}  worst ${pct(res.worst)}`);
    }
    const confirmed: CandidateResult[] = [];
    for (const s of [...screened].sort((a, b) => a.worst - b.worst).slice(0, 2)) {
      const { card: c, spec } = card(r, s.attack, s.health);
      const res = await testCandidate(c, spec, confirm);
      res.id = c.id;
      confirmed.push(res);
      console.error(` confirm ${c.id.padEnd(36)} net ${pct(netChange(res))}  worst ${pct(res.worst)}  ${res.pass ? "PASS" : "fail"}`);
    }
    confirmed.sort((a, b) => a.worst - b.worst);
    const result: ReworkResult = { key: r.key, replaces: r.replaces, text: r.text, screened: screened.map(({ id, net, worst }) => ({ id, net, worst })), confirmed };
    if (out) appendFileSync(out, JSON.stringify(result) + "\n");
    else console.log(JSON.stringify(result));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
