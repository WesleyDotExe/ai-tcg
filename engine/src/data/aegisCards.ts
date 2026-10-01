// Stage-3 deliverable: the first *real* card set (see DESIGN.md's build
// order). Where Cortex/Swarm (cards.ts) exist to prove the effect system
// can express every mechanic category, Aegis exists to prove and exercise
// the owner's 2026-09-12 design-directive batch: the unified
// board-development system — finite face-up board slots (see
// state/init.ts's BOARD_SLOTS), telegraphed threats, evolution/upgrade
// cards, and tool/attachment cards, all sharing the same scarce-board-space
// spine and built to interact rather than as three isolated features (a
// telegraphed unit can be tooled up before it arms; an evolution base sitting
// on the board is itself a "will this get answered before it grows" threat;
// evolving carries an attached tool, accumulated damage, and statuses
// forward on the same instance rather than replacing it).
//
// Faction identity: Aegis is a hardened, defensive machine-guardian
// network — chrome plating, CRT-terminal diagnostics, the optimistic,
// synthetic "future as imagined in the 90s" the owner asked for (2026-09-11
// feedback, item 4) — the counterweight to Cortex's networked-intelligence
// control and Swarm's biological-mass aggression. Original names/flavour
// only; no reproduction of existing TCGs' card identities or keyword text.

import type { CommandCard, DirectiveCard, ToolCard, UnitCard } from "../cards/types.js";
import { uplinkTower } from "./neutralCards.js";

// --- Evolution line: Cadet -> Sentinel -> Warden ---------------------------

export const aegisCadet: UnitCard = {
  id: "AG-001",
  name: "Aegis Cadet",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: [],
  // Phase 2 item 5 (2026-09-20 owner-feedback entry): a base for
  // aegisSentinel below — see UnitCard.baseArmor's doc comment for what this
  // is and why. Every current evolution-line base in the pool gets the same
  // proposed value (1); this file's own header note on that first-proposal
  // status applies here too.
  baseArmor: 1,
  art: "placeholder:aegis/aegis-cadet",
  flavor: "Boots up green on a chrome shell three sizes too big.",
  abilities: [],
};

export const aegisSentinel: UnitCard = {
  id: "AG-007",
  name: "Aegis Sentinel",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 3,
  health: 4,
  keywords: [],
  // Also a base (for aegisWarden below), even though it's itself Cadet's
  // evolved form — baseArmor cares about "is some other card's evolvesFrom
  // pointing at this one," not tier position.
  baseArmor: 1,
  evolvesFrom: "AG-001",
  art: "placeholder:aegis/aegis-sentinel",
  flavor: "The plating thickens. So does the resolve.",
  abilities: [
    {
      id: "aegis-sentinel-evolve",
      trigger: "onPlay",
      text: "When this evolves in, recover 1 energy.",
      effects: [{ kind: "gainEnergy", amount: 1 }],
    },
  ],
};

export const aegisWarden: UnitCard = {
  id: "AG-013",
  name: "Aegis Warden",
  faction: "Aegis",
  rarity: "Rare",
  cost: 5,
  type: "Unit",
  attack: 5,
  health: 7,
  keywords: [],
  evolvesFrom: "AG-007",
  art: "placeholder:aegis/aegis-warden",
  flavor: "Every scar it kept becomes a weld line. Nothing gets through twice.",
  abilities: [
    {
      id: "aegis-warden-evolve",
      trigger: "onPlay",
      text: "When this evolves in, restore it to full health and it gains Barrier.",
      targeting: { scope: "self" },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 10 } },
        { kind: "applyStatus", status: "Barrier", duration: "untilConsumed" },
      ],
    },
  ],
};

// --- Telegraphed threats ----------------------------------------------------

export const perimeterTurret: UnitCard = {
  id: "AG-005",
  name: "Perimeter Turret",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  telegraph: 1,
  art: "placeholder:aegis/perimeter-turret",
  flavor: "Deployed cold. Arms itself once it trusts the perimeter.",
  abilities: [
    {
      id: "perimeter-turret-arm",
      trigger: "onPlay",
      text: "When this arms, deal 3 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    },
  ],
};

export const latentWard: UnitCard = {
  id: "AG-011",
  name: "Latent Ward",
  faction: "Aegis",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 5,
  keywords: [],
  // telegraph=2, not 1: the owner's stage-3 checkpoint feedback (item 3)
  // asked for a longer fuse tried on some telegraph cards, kept per-card so
  // a mix is possible — Perimeter Turret below stays at 1 as the other half
  // of that comparison. A 2-turn-fuse, board-wide Barrier payoff is also
  // the natural fit: it's the bigger swing of the two telegraphed units, so
  // it earning a longer "see it coming, answer it" window before it fires
  // reads right thematically, not just as an arbitrary A/B split.
  telegraph: 2,
  art: "placeholder:aegis/latent-ward",
  flavor: "Sits dark on the grid until the moment it lights every board at once.",
  abilities: [
    {
      id: "latent-ward-arm",
      trigger: "onPlay",
      text: "When this arms, your units gain Barrier.",
      targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
      effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }],
    },
  ],
};

// --- Tool / attachment cards -------------------------------------------------

export const platingModule: ToolCard = {
  id: "AG-003",
  name: "Plating Module",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 3,
  grantedKeywords: [],
  art: "placeholder:aegis/plating-module",
  flavor: "Bolt it on. It was never going to be pretty anyway.",
  abilities: [],
};

export const guardDirectiveChip: ToolCard = {
  id: "AG-006",
  name: "Guard Directive Chip",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 1,
  grantedKeywords: ["Guard"],
  art: "placeholder:aegis/guard-directive-chip",
  flavor: "One line of firmware, and it decides nothing gets past it.",
  abilities: [],
};

export const barrierShim: ToolCard = {
  id: "AG-010",
  name: "Barrier Shim",
  faction: "Aegis",
  rarity: "Rare",
  cost: 2,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 0,
  grantedKeywords: ["Barrier"],
  art: "placeholder:aegis/barrier-shim",
  flavor: "A single-use field, wired into whatever's standing closest.",
  abilities: [],
};

// --- Rest of the pool: keywords, commands, a directive, static, triggered --

export const barrierDrone: UnitCard = {
  id: "AG-002",
  name: "Barrier Drone",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 0,
  health: 3,
  keywords: ["Guard"],
  art: "placeholder:aegis/barrier-drone",
  flavor: "It has one job. It stands in front of things.",
  abilities: [],
};

export const diagnosticWard: CommandCard = {
  id: "AG-004",
  name: "Diagnostic Ward",
  faction: "Aegis",
  rarity: "Common",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:aegis/diagnostic-ward",
  flavor: "Green text scrolls: SYSTEMS NOMINAL. Mostly true.",
  abilities: [
    {
      id: "diagnostic-ward-cast",
      trigger: "onPlay",
      text: "Restore 2 health to yourself. If your hand has 1 or fewer cards, draw a card.",
      targeting: { scope: "self" },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 2 } },
        {
          kind: "conditional",
          condition: { kind: "not", condition: { kind: "handSizeAtLeast", side: "controller", count: 2 } },
          then: [{ kind: "drawCard", count: 1 }],
        },
      ],
    },
  ],
};

export const failoverCustodian: UnitCard = {
  id: "AG-009",
  name: "Failover Custodian",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:aegis/failover-custodian",
  flavor: "Every hit is just a diagnostic it failed and then patched.",
  abilities: [
    {
      id: "failover-custodian-damaged",
      trigger: "onDamaged",
      text: "Whenever this unit is damaged, restore 1 health to it.",
      targeting: { scope: "self" },
      effects: [{ kind: "heal", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const staticWardBeacon: DirectiveCard = {
  id: "AG-008",
  name: "Static Ward Beacon",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 3,
  type: "Directive",
  art: "placeholder:aegis/static-ward-beacon",
  flavor: "A steady chrome hum, and the whole line stands a little straighter.",
  abilities: [
    {
      id: "static-ward-beacon-aura",
      trigger: "static",
      text: "Your units get +0/+1.",
      staticEffect: { kind: "buffAllies", attack: 0, health: 1, filter: { side: "controller", kind: "unit" } },
    },
  ],
};

export const lockdownField: CommandCard = {
  id: "AG-012",
  name: "Lockdown Field",
  faction: "Aegis",
  rarity: "Rare",
  cost: 4,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:aegis/lockdown-field",
  flavor: "Every actuator on the far side of the field freezes mid-cycle.",
  abilities: [
    {
      id: "lockdown-field-cast",
      trigger: "onPlay",
      text: "Stun all enemy units for 1 turn.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "applyStatus", status: "Stasis", duration: 1 }],
    },
  ],
};

export const primeAegis: UnitCard = {
  id: "AG-014",
  name: "Prime Aegis",
  faction: "Aegis",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 4,
  health: 8,
  keywords: [],
  art: "placeholder:aegis/prime-aegis",
  flavor: "The reference implementation every other guardian was compiled from.",
  abilities: [
    {
      id: "prime-aegis-aura-ally",
      trigger: "static",
      text: "Your units get +1/+1.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 1, filter: { side: "controller", kind: "unit" } },
    },
    {
      id: "prime-aegis-aura-enemy",
      trigger: "static",
      text: "Enemy units get -1/-0.",
      staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: { side: "opponent", kind: "unit" } },
    },
  ],
};

// --- Defensive interaction (2026-09-19 owner feedback: "Aegis gets defensive
// answers, not removal") -----------------------------------------------------
//
// Session 10's balance investigation found Aegis's real problem wasn't that
// Null (or anyone) hits too hard — it's that Aegis's own kit has almost no
// independent interaction at all (Perimeter Turret's telegraphed random
// 3-damage hit and Lockdown Field's 1-turn AOE stun were close to its whole
// answer suite). The owner's direction: fix that with interaction that fits
// the hardened-guardian identity — intercepting/redirecting attacks, damage
// reflection, blunting or taxing what the opponent commits — explicitly NOT
// outright removal. Aegis should be able to survive a threat it can't
// answer, and still not be able to delete it; "outlast them," not "control
// them." Three cards below, each a genuinely different mechanic, none of
// them destroy/remove:

export const interceptRoutine: CommandCard = {
  id: "AG-015",
  name: "Intercept Routine",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 1,
  type: "Command",
  speed: "Instant",
  art: "placeholder:aegis/intercept-routine",
  flavor: "The hit was already routed. This just changes where it lands.",
  abilities: [
    {
      id: "intercept-routine-cast",
      trigger: "onPlay",
      // The headline "intercepting/redirecting attacks" answer. A new
      // generic effect kind, redirectAttack (cards/types.ts,
      // effects/resolver.ts's redirectTopAttack): cast at Instant speed in
      // response to a declared attack (a pending combatDamage stack item —
      // see engine.ts's declareAttack), it retargets that attack to a unit
      // you control instead. Nothing is destroyed or countered — the
      // attack still resolves in full, including the attacker taking
      // return damage from whoever it now hits — this is a Guard-style
      // interception made reactive instead of a standing keyword, not
      // removal by another name.
      text: "Instant. Redirect a pending attack to target unit you control.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [{ kind: "redirectAttack" }],
    },
  ],
};

export const tariffField: DirectiveCard = {
  id: "AG-016",
  name: "Tariff Field",
  faction: "Aegis",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:aegis/tariff-field",
  flavor: "Every packet that crosses the line pays a toll first.",
  abilities: [
    {
      id: "tariff-field-aura",
      trigger: "static",
      // The "taxing what the opponent commits" answer. A new generic
      // static-effect kind, cardCostModifier (cards/types.ts,
      // state/queries.ts's effectiveCardCost): every card the opponent
      // plays costs 1 more energy while this is in play. Doesn't stop
      // anything outright — a determined opponent can still pay it — but
      // it blunts their curve and makes their board development slower and
      // more constrained turn over turn, a genuinely different pressure
      // than damage or stat debuffs.
      text: "Enemy cards cost 1 more to play.",
      staticEffect: { kind: "cardCostModifier", side: "opponent", amount: 1 },
    },
  ],
};

export const feedbackPlating: UnitCard = {
  id: "AG-017",
  name: "Feedback Plating",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 4,
  keywords: [],
  art: "placeholder:aegis/feedback-plating",
  flavor: "Every impact bleeds current back down the line — just enough to hurt.",
  abilities: [
    {
      id: "feedback-plating-damaged",
      trigger: "onDamaged",
      // The "blunting" answer: every hit this unit takes saps the
      // opponent's whole board's offense for the rest of the turn — real
      // pressure back on whoever commits to attacking it, without killing
      // or permanently maiming anything. Untargeted (onDamaged has no
      // agent decision point to supply a chosen target — see
      // quality-debt.md's architectural-gaps note, unaffected by this
      // session's evolve/telegraph-specific chosen-targeting fix), so it
      // hits the whole enemy board rather than just the attacker, same
      // pattern as every other automatic-trigger effect in the pool.
      text: "Whenever this is damaged, enemy units get -1/-0 until end of turn.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "buff", attack: -1, health: 0, duration: "turn" }],
    },
  ],
};

// --- Directive removal (2026-09-20 owner-feedback entry, Phase 2 item 3:
// "Directives must be removable ... give every faction one answer") --------
//
// This does NOT reopen the 2026-09-19 "Aegis gets defensive answers, not
// removal" direction: that entry is about Aegis having no way to interact
// with the opponent's UNITS, and its identity stays "outlast them," never
// "delete their board." A Directive is not a unit — it's a standing aura
// with no health or combat presence of its own — so dismantling one reads
// as clearing an obstacle to survive by, not stacking removal onto Aegis's
// kit. Every faction needs this specific answer per the entry above; Aegis's
// take on it is a controlled demolition, not a strike.

export const breachCharge: CommandCard = {
  id: "AG-018",
  name: "Breach Charge",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:aegis/breach-charge",
  flavor: "Not aimed at anything that bleeds. Just the wall it's bolted to.",
  abilities: [
    {
      id: "breach-charge-cast",
      trigger: "onPlay",
      text: "Destroy target enemy directive. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "directive" } },
      effects: [{ kind: "destroy" }],
    },
  ],
};

// --- Phase 5, slice 1 (2026-09-25 owner-feedback entry: "accept the ring as
// directionally done; start Phase 5, carrying the two open pairings as watch
// items"): grow the pool toward the 30-40 unique-card target (roadmap item
// 8), with "some of Aegis's new cards... aimed at its Cortex matchup —
// immediate-board-impact cards, NOT zero-tempo utility" (item 3's explicit
// instruction, after two prior zero-tempo attempts — session 11's defensive
// batch and session 18's Barrier Tool — both measured worse, not better, for
// exactly that reason). All four below carry real stats/board presence the
// instant they land; none are reactive-only utility. -----------------------

export const bulwarkChassis: UnitCard = {
  id: "AG-019",
  name: "Bulwark Chassis",
  faction: "Aegis",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  // A stat-only wall: 3 health at cost 2 survives a single Cortex
  // point-removal spell (Diagnostic Pulse/Interrupt Handler both deal
  // exactly 2) with a point to spare, though not two in a row — the same
  // stat line as Cortex Engineer (CX-009, 1/3 cost 2) by design, a fair
  // print rather than a strict outlier. No ability: the immediate impact IS
  // the stat line, not a delayed payoff. (First cut, 1/5, measured badly
  // overtuned in this session's own balance re-run — see aegisCards.ts's
  // header note and progress/notes-for-owner.md; scaled back before
  // shipping, not left in.)
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:aegis/bulwark-chassis",
  flavor: "Nothing about it moves fast. Nothing about it falls over, either.",
  abilities: [],
};

export const reinforcedBastion: UnitCard = {
  id: "AG-020",
  name: "Reinforced Bastion",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  // A second, higher power-point on the "Guard wall" archetype Barrier
  // Drone (1-cost 0/3 Guard) started — the variation rule (2026-09-20 entry,
  // Phase 5 item 9) asks for 2-4 cards per archetype at different cost/power
  // points, not one card repeated. Deliberately printed at or below Cortex's
  // own Firewall Sentinel (CX-002, 2/5 Guard, cost 3) rather than above it —
  // same attack, 1 less health — so Aegis gets a second Guard-wall option
  // without a straight power-level outlier. (First cut, 2/6 — strictly
  // better than Firewall Sentinel — measured badly overtuned in this
  // session's own balance re-run, pushing Aegis over-strong against every
  // faction, not just Cortex; scaled back before shipping. See
  // progress/notes-for-owner.md.)
  attack: 2,
  health: 4,
  keywords: ["Guard"],
  art: "placeholder:aegis/reinforced-bastion",
  flavor: "It doesn't ask to be hit first. It just always is.",
  abilities: [],
};

export const salvageReflex: UnitCard = {
  id: "AG-021",
  name: "Salvage Reflex",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 3,
  keywords: [],
  art: "placeholder:aegis/salvage-reflex",
  flavor: "Strip it for parts and the parts go somewhere useful.",
  abilities: [
    {
      id: "salvage-reflex-death",
      trigger: "onDeath",
      // A genuinely new archetype for this pool: value-on-death defense,
      // not removal or a static wall. Converts a Cortex point-removal spell
      // spent on this into protection for a different ally — the same
      // "on-identity, not control" answer the 2026-09-19 direction asked
      // for, aimed squarely at a removal-heavy opponent. Fires after
      // processDeaths has already removed this unit from the board (see
      // resolver.ts's processDeaths), so "a random ally" can never target
      // itself, and a lone death with no allies left simply has zero legal
      // targets and no-ops (targeting.ts's enumerateTargets/resolveTargets).
      text: "When this dies, a random ally unit gains Barrier.",
      targeting: { scope: "random", filter: { side: "controller", kind: "unit" }, count: 1 },
      effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }],
    },
  ],
};

export const aegisLineTrooper: UnitCard = {
  id: "AG-022",
  name: "Aegis Line Trooper",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  // Aegis's existing 1-drops (Aegis Cadet 1/2, Barrier Drone 0/3 Guard) are
  // both passive/defensive — this is the pool's first 1-drop with real
  // attack pressure, giving Aegis an early proactive clock so a match
  // doesn't stall out while a removal-heavy opponent assembles its plan.
  // Costed as a genuine risk/reward pick (dies to any 1 damage, unlike the
  // sturdier Cadet) rather than a strictly-better 1-drop: matches Cortex's
  // own Signal Drone (CX-001, 1/1 Rush, cost 1) in raw combat math without
  // duplicating its Rush keyword.
  attack: 2,
  health: 1,
  keywords: [],
  art: "placeholder:aegis/aegis-line-trooper",
  flavor: "First one through the door. Replaceable, and it knows it.",
  abilities: [],
};

export const AEGIS_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: aegisCadet, copies: 3 },
  // 3 -> 2 (Phase 5 slice 1, below): played win rate 39.1-47.7% across the
  // three policies (progress/balance-report-012-ring-followups.txt), the
  // pool's weakest Guard body now that Reinforced Bastion exists at a
  // higher power point on the same archetype. Not cut to 1 — Guard's
  // cheap/early copy still matters on curve.
  { card: barrierDrone, copies: 2 },
  { card: platingModule, copies: 3 },
  // 3 -> 1 (Phase 5 slice 1): the pool's single weakest card by played win
  // rate in every one of the three balance-report-012 sections
  // (37.2-46.4%) — a slow self-heal-plus-conditional-draw Command with no
  // board impact, the exact "zero-tempo utility" pattern item 3 named as
  // already-failed against Cortex. Kept at 1, not cut entirely: it's still
  // the pool's only non-conditional self-heal and the deck's card-flow
  // source the pool lint's clock/card-flow check relies on.
  { card: diagnosticWard, copies: 1 },
  { card: perimeterTurret, copies: 3 },
  // 2 -> 3 (2026-09-23 "Phase 4 session 17 follow-ups" entry, item 3: fix
  // Aegis-vs-Cortex with an Aegis buff, never a Cortex nerf). A first
  // attempt at this fix (a brand-new 0/0-stat Barrier-granting Tool,
  // AG-019, at 1-2 copies) measured WORSE for Aegis-vs-Cortex under every
  // policy (Aggressive 73.7% Cortex, up from 67.7% going in) — the same
  // "reactive/zero-immediate-impact card crowds out real tempo plays"
  // failure mode session 11's Aegis defensive-card batch already discovered
  // (owner-feedback.md's 2026-09-19 entry), so it was not shipped. This
  // pool's own per-card table already names its single best-performing
  // card by played win rate: Guard Directive Chip (55.3%, well ahead of
  // every other Aegis card) — a Tool with a real stat bonus (+1/+1) AND
  // Guard (forces the equipped unit to be attacked first), which is exactly
  // the mechanism that blunts Cortex's flat-damage removal kit (Diagnostic
  // Pulse/Interrupt Handler/Cascade Purge all deal exactly 2): Guard lets
  // Aegis choose which body eats the removal, and a Guard unit built with
  // this Tool's own +1 health has real odds of surviving a 2-damage hit
  // outright. Rather than design an unproven new mechanic, this bumps the
  // pool's one card already evidenced to work up to its Uncommon copy
  // ceiling (3), using the pool's exact remaining headroom (39 -> 40, no
  // cut needed) — a smaller, evidence-led bet than a new untested card.
  { card: guardDirectiveChip, copies: 3 },
  { card: aegisSentinel, copies: 3 },
  // 2 -> 1 (Phase 5 slice 1): 37.8-38.1% played win rate, the pool's
  // weakest static aura (Prime Aegis's later +1/+1 aura, at Mythic, is the
  // pool's real payoff at that archetype). Kept at 1, not cut: still the
  // only non-Mythic ally-buff aura in the deck.
  { card: staticWardBeacon, copies: 1 },
  // 3 -> 2 (Phase 5 slice 1): 40.3-49.2% played win rate, middling — freed
  // headroom for the new immediate-impact bodies below without touching
  // anything measured as strong.
  { card: failoverCustodian, copies: 2 },
  // 2 -> 1 (Phase 5 slice 1): 38.6-39.6% played win rate, weakest of the
  // three Tools. Kept at 1 — still the pool's only stand-alone Barrier
  // grant a controller can hold for a specific moment.
  { card: barrierShim, copies: 1 },
  // 2 -> 1 (Phase 5 slice 1): 39.1-39.3% played win rate. The telegraph=2
  // trial (2026-09-13 checkpoint feedback) stays represented at 1 copy
  // rather than being reverted or cut outright — the "does a longer fuse
  // feel different" question is still genuinely open per that entry, and
  // this session's own scope is pool growth, not re-litigating it.
  { card: latentWard, copies: 1 },
  // 2 -> 1 (Phase 5 slice 1): 38.3-38.6% played win rate, and a 4-mana
  // board-wide stun is exactly the kind of high-commitment answer Cortex's
  // own cheap removal punishes on tempo. Kept at 1 as the pool's only
  // AOE-stun effect.
  { card: lockdownField, copies: 1 },
  { card: aegisWarden, copies: 2 },
  { card: primeAegis, copies: 1 },
  { card: interceptRoutine, copies: 1 },
  { card: tariffField, copies: 1 },
  { card: feedbackPlating, copies: 1 },
  // 2 -> 1 (Phase 5 slice 1): 40.9% played win rate and the pool's only
  // directive-destroy answer, which stays a dead card in most games (no
  // enemy directive to hit) — kept at 1 as the required per-faction answer
  // (2026-09-20 entry, Phase 2 item 3), not cut, but no longer worth a
  // second copy competing with cards that have board impact every game.
  { card: breachCharge, copies: 1 },
  // --- New this session (Phase 5 slice 1): immediate-board-impact bodies
  // aimed at the still-open Aegis-vs-Cortex pairing (see header comment
  // above and progress/checkpoints.md's new entry). Uses the exact 9 copies
  // of headroom the trims above freed, keeping the deck at its 40-card cap.
  { card: bulwarkChassis, copies: 3 },
  { card: reinforcedBastion, copies: 2 },
  // -1 Salvage Reflex, +1 Uplink Tower (session 25): the neutral package
  // search's pick on the fixed agent, kept because its 2,500-seed held-out
  // ring objective improved (243 -> 234; balance-report-019). Every per-edge
  // change is inside noise.
  { card: salvageReflex, copies: 1 },
  { card: aegisLineTrooper, copies: 2 },
  { card: uplinkTower, copies: 1 },
];
