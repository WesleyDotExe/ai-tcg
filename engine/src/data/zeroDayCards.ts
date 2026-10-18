// The 3 Season 0 Zero-Day cards (owner 2026-10-18, "the 3 Season 0 Zero-Day
// cards (designs)"; built session 40 as the first users of the generic
// "choose one" mechanic, cards/modes.ts).
//
// Three stages of a hack: infect, take over, shut down. In each card the two
// modes pull in different directions, so the agent has to read the board to
// choose. All three are Neutral (three cards can't cover four factions
// evenly). Fixed by the owner: the names, the faction, the card types and
// what each mode does. Tunable: the numbers. These are the owner's starting
// numbers, unchanged; the fairness test (with a strength cap above the
// 2-point band, to be proposed with the measurements) decides them.
//
// LIVE since session 42 (owner 2026-10-18, answers to session 41: "go live
// at the proposed numbers"). They are in data/registry.ts's CARD_REGISTRY,
// so a pulled copy plays (a Zero-Day copy's card id is its code, which is
// the card's id, so copies pulled while the entries were reserved became
// these cards with no migration) and Zero-Day crafting is open at 3,000
// pack points (economy/src/store.ts craftSecret).
//
// Numbers as measured and approved (progress/balance-report-028): Carrier
// is +1/+0 (designed +1/+1) and Privilege Escalation counts the other units
// in play (designed 1 plus that), each trimmed to pass the 4-point cap;
// Kill Switch as designed.
//
// They are not neutral-pool cards: the pool's identity rules (no removal, no
// statics) would refuse all three, and the owner made them Neutral knowing
// what they do. cards/poolLint.ts's zeroDayCardViolations holds them to
// their own rules instead (two modes, a Mythic for copy limits: 1 per deck),
// checked at load below.

import type { CommandCard, UnitCard, Card } from "../cards/types.js";
import { zeroDayCardViolations } from "../cards/poolLint.js";

/** Zero-Day 1 (226/096). */
export const patientZero: UnitCard = {
  id: "S0-ZD1",
  name: "Patient Zero",
  faction: "Neutral",
  rarity: "Mythic",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  topTier: "zeroDay",
  art: "placeholder:zero-day/S0-ZD1",
  flavor: "Every outbreak has a first host. Nobody remembers it was a test.",
  abilities: [],
  modes: [
    {
      id: "outbreak",
      name: "Outbreak",
      text: "When this dies, deal 2 damage to all enemy units.",
      abilities: [
        {
          id: "patient-zero-outbreak",
          trigger: "onDeath",
          text: "When this dies, deal 2 damage to all enemy units.",
          targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
          effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
        },
      ],
    },
    {
      id: "carrier",
      name: "Carrier",
      text: "Your other units get +1/+0.",
      abilities: [
        {
          id: "patient-zero-carrier",
          trigger: "static",
          text: "Your other units get +1/+0.",
          // Session 41: +1/+1 measured 5.37 points on its worst edge, over
          // the owner's 4-point cap (balance-report-028); +1/+0 measured 2.73.
          staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" }, excludeSelf: true },
        },
      ],
    },
  ],
};

/** Zero-Day 2 (227/096). */
export const rootAccess: UnitCard = {
  id: "S0-ZD2",
  name: "Root Access",
  faction: "Neutral",
  rarity: "Mythic",
  cost: 5,
  type: "Unit",
  attack: 3,
  health: 6,
  keywords: [],
  topTier: "zeroDay",
  art: "placeholder:zero-day/S0-ZD2",
  flavor: "Permissions are a suggestion to anyone holding the right string.",
  abilities: [],
  modes: [
    {
      id: "privilege-escalation",
      name: "Privilege Escalation",
      text: "This unit's attack equals the number of other units in play.",
      abilities: [
        {
          id: "root-access-privilege-escalation",
          trigger: "static",
          text: "This unit's attack equals the number of other units in play.",
          // Both sides count. allUnitsInPlay includes this unit, so the
          // others are all units less 1. Session 41: "1 plus the other
          // units" measured 4.18 points on its worst edge, over the owner's
          // 4-point cap (balance-report-028); one less measured 3.52.
          staticEffect: { kind: "selfStatFromScaling", attack: { mode: "scaling", base: -1, multiplier: 1, per: "allUnitsInPlay" } },
        },
      ],
    },
    {
      id: "lockout",
      name: "Lockout",
      text: "Enemy cards cost 1 more to play.",
      abilities: [
        {
          id: "root-access-lockout",
          trigger: "static",
          text: "Enemy cards cost 1 more to play.",
          staticEffect: { kind: "cardCostModifier", side: "opponent", amount: 1 },
        },
      ],
    },
  ],
};

/** Zero-Day 3 (228/096). Sorcery speed: a board-wide answer on its
 * controller's own turn (the owner's design names no speed; session-40 call,
 * in notes-for-owner.md). */
export const killSwitch: CommandCard = {
  id: "S0-ZD3",
  name: "Kill Switch",
  faction: "Neutral",
  rarity: "Mythic",
  cost: 7,
  type: "Command",
  speed: "Sorcery",
  topTier: "zeroDay",
  art: "placeholder:zero-day/S0-ZD3",
  flavor: "Somebody always builds the off switch. Somebody else always finds it.",
  abilities: [],
  modes: [
    {
      id: "lights-out",
      name: "Lights Out",
      text: "Stun all enemy units for 2 turns.",
      abilities: [
        {
          id: "kill-switch-lights-out",
          trigger: "onPlay",
          text: "Stun all enemy units for 2 turns.",
          targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
          effects: [{ kind: "applyStatus", status: "Stasis", duration: 2 }],
        },
      ],
    },
    {
      id: "wipe",
      name: "Wipe",
      text: "Deal 3 damage to all enemy units, then draw a card.",
      abilities: [
        {
          id: "kill-switch-wipe",
          trigger: "onPlay",
          text: "Deal 3 damage to all enemy units, then draw a card.",
          targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
          effects: [
            { kind: "damage", amount: { mode: "flat", value: 3 } },
            { kind: "drawCard", count: 1 },
          ],
        },
      ],
    },
  ],
};

/** Season 0's Zero-Day cards, in number order (live: in the card registry,
 * see the header). */
export const ZERO_DAY_CARDS: readonly Card[] = [patientZero, rootAccess, killSwitch];

{
  const bad = ZERO_DAY_CARDS.flatMap(zeroDayCardViolations);
  if (bad.length > 0) throw new Error(`Zero-Day card lint failed:\n  - ${bad.join("\n  - ")}`);
}
