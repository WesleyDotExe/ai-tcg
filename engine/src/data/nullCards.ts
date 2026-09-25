// Stage-3 continuation (progress/roadmap.md item 1): the fourth faction.
// "Null" is reserved in cards/types.ts's Faction union since stage 3 but
// was never built — this is that build. Like Aegis, Null is designed to
// exercise the unified board-development system (finite board slots,
// telegraphed threats, evolution, tools — see aegisCards.ts's header for
// the system itself) on a faction with its own distinct mechanical
// identity, not a reskin of an existing one.
//
// Faction identity: Null is corruption/deletion/entropy — crashed
// processes, segfaults, memory that was never freed. Where Cortex plays a
// reactive control game and Aegis plays a defensive stacking game, Null's
// answer to both is attrition: it is the first faction to use the
// `destroy` effect kind (unconditional removal, ignoring stats entirely —
// nothing else in the pool has used it before this) and the first to apply
// *negative* permanent buffs to an opponent's unit (a "decay" debuff,
// where every other faction's `buff` effect so far only ever added stats).
// It also introduces `controllerGraveyardSize` as a live scaling source for
// a unit's own stats (only `controllerUnitsInPlay`/`opponentUnitsInPlay`
// were exercised before this) — a unit that gets stronger the more things
// have already died under its controller, the mechanical expression of
// "feeds on what it deletes." Cyberpunk + 1990s-retro-futurism flavour
// throughout (2026-09-11 owner feedback, item 4), expressed here as
// terminal-crash / kernel-panic / bit-rot imagery rather than Aegis's
// chrome-guardian angle or Cortex's networked-intelligence angle. Original
// names/flavour only; no reproduction of existing TCGs' card identities.

import type { CommandCard, DirectiveCard, ToolCard, UnitCard } from "../cards/types.js";

// --- Evolution line: Glitch Seed -> Corrupted Process -> Kernel Panic -----

export const glitchSeed: UnitCard = {
  id: "NL-001",
  name: "Glitch Seed",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: [],
  // Phase 2 item 5 (2026-09-20 owner-feedback entry) — see
  // cards/types.ts's UnitCard.baseArmor and data/aegisCards.ts's matching
  // note: a base for corruptedProcess below.
  baseArmor: 1,
  art: "placeholder:null/glitch-seed",
  flavor: "A single flipped bit, and the whole process forgets what it was doing.",
  abilities: [],
};

export const corruptedProcess: UnitCard = {
  id: "NL-006",
  name: "Corrupted Process",
  faction: "Null",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  // Also a base (for kernelPanic below), even though it's Glitch Seed's own
  // evolved form — same rule as Aegis Sentinel above.
  baseArmor: 1,
  evolvesFrom: "NL-001",
  art: "placeholder:null/corrupted-process",
  flavor: "It kept running. It just stopped running the program it was given. What it recovers from the wreck is anyone's guess.",
  abilities: [
    // Phase 3 pool lint (cards/poolLint.ts): redesigned from "deal 3 damage
    // to a random enemy unit" — the whole Null pool measured at 50%
    // removal/debuff density (18/36 copies), double the lint's 25% cap, and
    // this faction had zero card-flow (no drawCard anywhere), a separate
    // lint failure of its own. Converting this card's evolve payload from
    // damage to a draw fixes both at once: it's one fewer removal effect in
    // the density count, and it's the card-flow Null was missing entirely.
    // Not an arbitrary dodge — the same "middle-evolution-tier card draws a
    // card" shape already exists in the pool (Swarm's Molted Stalker,
    // data/cards.ts), so this reuses an established pattern rather than
    // inventing a new one, and "a crashed process spits out whatever
    // fragment of data it still had queued" is a reasonable read of
    // "corrupted" that doesn't require inventing new flavour.
    {
      id: "corrupted-process-evolve",
      trigger: "onPlay",
      text: "When this evolves in, draw a card.",
      effects: [{ kind: "drawCard", count: 1 }],
    },
  ],
};

export const kernelPanic: UnitCard = {
  id: "NL-013",
  name: "Kernel Panic",
  faction: "Null",
  rarity: "Rare",
  // Cost 5 -> 6 (2026-09-23 owner-feedback entry, Phase 4 decisions, item
  // 2: "Null step 4 — yes, raise costs" — the played-win-rate outlier the
  // 2026-09-20 backstop named but session 16 declined to touch unilaterally
  // since it already cost exactly what its faction-mirror equivalent
  // (Aegis Warden) costs. The owner's own steer resolves that: "it's fine
  // for them to cost more than other factions' top cards; Null is the
  // attrition faction, so a premium on its best pieces is on-identity, not
  // a curve violation." This is now the first cost-6 Rare in the pool
  // (every other faction's top-end premium sits at Mythic) — a deliberate
  // consequence of that steer, not an oversight.
  cost: 6,
  type: "Unit",
  attack: 4,
  health: 6,
  keywords: [],
  evolvesFrom: "NL-006",
  art: "placeholder:null/kernel-panic",
  flavor: "STOP: everything else on the machine halts so this can finish.",
  abilities: [
    {
      id: "kernel-panic-evolve",
      trigger: "onPlay",
      // "chosen" targeting, as originally written — restored 2026-09-19.
      // It was built as "random" instead because evolveUnit's onPlay
      // resolution never supplied a `chosen` ref (the "triggered abilities
      // can't use chosen targeting" architectural gap, quality-debt.md).
      // That gap is now closed generally (engine/moves.ts's evolution
      // branch enumerates the ability's own chosen target alongside which
      // base is evolving, carried in Move.abilityTarget; engine.ts's
      // evolveUnit threads it through to resolveAbility) — see the
      // 2026-09-19 owner-feedback entry. A controlled kill is strictly
      // stronger than a random one among the same eligible pool, so this
      // was re-measured, not assumed safe — see
      // progress/balance-report-004-chosen-targeting.txt.
      //
      // maxHealth: 5 -> 4 (2026-09-23 owner-feedback entry, "Phase 4 session
      // 17 follow-ups", item 4: "Null step 4 — go past cost to power ...
      // reduce their impact (stats/effect), not just cost ... e.g. Kernel
      // Panic's ... destroy reach." Session 17's cost raise (5->6) changed
      // how OFTEN this lands, not how strong it is once it does (still
      // ~86% win rate when played, per balance-report-011) — this narrows
      // WHAT it can kill instead. Session 10 originally set the cap at 5 so
      // only Aegis Warden/Prime Aegis reliably escaped it; that left Latent
      // Ward (5 health, Aegis's own board-wide Barrier payoff) exactly on
      // the eligible edge. Tightening to 4 pulls Latent Ward out of reach
      // too, a real reduction in what this card answers, targeted at the
      // exact Aegis-vs-Null pairing this backstop step is scoped to — not a
      // blanket rewrite of the soft-counter shape session 10/19 already
      // settled. "Destroy ignores Barrier and stat buffs" is unchanged —
      // this only restricts *what* it can target, not how it kills once it
      // connects.
      text: "When this evolves in, destroy target enemy unit with 4 or less health.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit", maxHealth: 4 } },
      effects: [{ kind: "destroy" }],
    },
  ],
};

// --- Telegraphed threats ----------------------------------------------------

export const forkBomb: UnitCard = {
  id: "NL-005",
  name: "Fork Bomb",
  faction: "Null",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  telegraph: 1,
  art: "placeholder:null/fork-bomb",
  flavor: ":(){ :|:& };: — it never stops calling itself, and now there are two of it.",
  abilities: [
    // Phase 3 pool lint (cards/poolLint.ts): redesigned from "deal 1 damage
    // to all enemy units" as part of bringing Null's pool-wide removal/
    // debuff density down from 50% to the lint's 25% cap (see
    // corruptedProcess above for the other half of that fix). This one is a
    // flavour upgrade, not just a density dodge: a fork bomb's actual
    // mechanism is a process that spawns copies of itself until the system
    // is overwhelmed — "creates tokens" is a more literal reading of "fork
    // bomb" than "deals damage" ever was. Mechanically this also gives Null
    // a genuine rebuild tool (the 2026-09-20 entry's own Phase 2 item 4
    // motivation, "so wide decks can rebuild after board-wide damage") that
    // its own AOE-heavy identity had never given it.
    {
      id: "fork-bomb-arm",
      trigger: "onPlay",
      text: "When this arms, create two 1/1 Fork Child tokens.",
      effects: [
        {
          kind: "summon",
          count: 2,
          token: {
            name: "Fork Child",
            faction: "Null",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:null/fork-child",
            flavor: "Another copy, spawned before the last one finished spawning.",
          },
        },
      ],
    },
  ],
};

export const deprecatedRoutine: UnitCard = {
  id: "NL-009",
  name: "Deprecated Routine",
  faction: "Null",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 5,
  keywords: [],
  // telegraph=2, matching the owner's request (2026-09-13 checkpoint
  // feedback) to keep a mix of fuse lengths per card rather than one
  // global number — Fork Bomb above stays at 1 as the short-fuse half of
  // that split for this faction.
  telegraph: 2,
  art: "placeholder:null/deprecated-routine",
  flavor: "Still callable. Nobody remembers why, and it's forgetting too.",
  abilities: [
    {
      id: "deprecated-routine-arm",
      trigger: "onPlay",
      // "chosen" targeting, as originally written — restored 2026-09-19,
      // same fix as Kernel Panic above. processTelegraphArming fires this
      // automatically, turns after the card was played, with no agent
      // decision point of its own — the target is chosen when this card is
      // *played* (telegraph placement) and captured on the unit instance
      // (UnitInstance.armChosenTarget) for engine.ts's
      // processTelegraphArming to replay when it actually fires. If the
      // chosen unit is no longer on the board by arm time, this no-ops
      // harmlessly rather than picking a substitute — a deliberate
      // consequence of choosing 2 turns in advance, not a bug; see
      // progress/quality-debt.md.
      text: "When this arms, target enemy unit chosen when this was deployed gets -2/-2 permanently.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "buff", attack: -2, health: -2, duration: "permanent" }],
    },
  ],
};

// --- Tool / attachment cards -------------------------------------------------

export const corruptionPatch: ToolCard = {
  id: "NL-003",
  name: "Corruption Patch",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 1,
  grantedKeywords: [],
  art: "placeholder:null/corruption-patch",
  flavor: "It doesn't fix the bug. It just makes the bug hit harder.",
  abilities: [],
};

export const nullShell: ToolCard = {
  id: "NL-007",
  name: "Null Shell",
  faction: "Null",
  rarity: "Uncommon",
  cost: 1,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 3,
  grantedKeywords: [],
  art: "placeholder:null/null-shell",
  flavor: "Wraps whatever's underneath in nothing at all. Nothing is very hard to hurt.",
  abilities: [],
};

export const decayWard: ToolCard = {
  id: "NL-010",
  name: "Decay Ward",
  faction: "Null",
  rarity: "Rare",
  cost: 2,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 0,
  grantedKeywords: ["Barrier"],
  art: "placeholder:null/decay-ward",
  flavor: "One clean read before the sector goes bad.",
  abilities: [],
};

// --- Rest of the pool: keywords, commands, a directive, static, triggered --

export const strayFragment: UnitCard = {
  id: "NL-002",
  name: "Stray Fragment",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: ["Guard"],
  art: "placeholder:null/stray-fragment",
  flavor: "Leftover from a deallocation that never quite finished.",
  abilities: [],
};

export const segfaultHandler: CommandCard = {
  id: "NL-004",
  name: "Segfault Handler",
  faction: "Null",
  rarity: "Common",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:null/segfault-handler",
  flavor: "Access violation at address zero. Whatever was there, isn't anymore.",
  abilities: [
    {
      id: "segfault-handler-cast",
      trigger: "onPlay",
      text: "Deal 3 damage to target enemy unit.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    },
  ],
};

export const propagatingExploit: UnitCard = {
  id: "NL-008",
  name: "Propagating Exploit",
  faction: "Null",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:null/propagating-exploit",
  flavor: "Every machine it touches teaches it something it keeps.",
  abilities: [
    {
      id: "propagating-exploit-attack",
      trigger: "onAttack",
      text: "Whenever this attacks, it gains +1/+0 permanently.",
      targeting: { scope: "self" },
      effects: [{ kind: "buff", attack: 1, health: 0, duration: "permanent" }],
    },
  ],
};

export const entropyHarvester: UnitCard = {
  id: "NL-011",
  name: "Entropy Harvester",
  faction: "Null",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 4,
  keywords: [],
  art: "placeholder:null/entropy-harvester",
  flavor: "It doesn't grow on its own losses. It grows on everyone else's.",
  abilities: [
    // 2026-09-22 (Phase 4 backstop, step 3 of the owner's priority list,
    // after steps 1-2 above both measurably failed to move Aegis-vs-Null):
    // "make Entropy Harvester scale off the enemy graveyard." Was
    // controllerGraveyardSize — Null's OWN graveyard fills fast as a direct
    // side effect of its normal attritional play (trading units, cycling
    // through its own losses), so the old version snowballed for free off
    // exactly the thing Null was already doing every game, no matter how
    // the match was going. opponentGraveyardSize (new generic ScalingSource,
    // cards/types.ts/effects/scaling.ts — the opponent's graveyard is a
    // public zone, so this needed no new redaction rule) ties its growth to
    // actually having killed the OPPONENT's stuff instead, which is slower
    // early and denies the free ramp entirely in a match Null is losing the
    // attrition race — a real power reduction, not just a reflavor.
    {
      id: "entropy-harvester-static",
      trigger: "static",
      text: "This unit's attack equals 1 plus the number of cards in the enemy graveyard.",
      staticEffect: {
        kind: "selfStatFromScaling",
        attack: { mode: "scaling", base: 1, multiplier: 1, per: "opponentGraveyardSize" },
      },
    },
  ],
};

export const segmentationFault: DirectiveCard = {
  id: "NL-012",
  name: "Segmentation Fault",
  faction: "Null",
  rarity: "Rare",
  // Cost raised 3 -> 4 in the Phase 3 pool lint pass (cards/poolLint.ts
  // rule 3, "no permanent enemy-stat aura under 4 mana"). Left at 4 here —
  // this session's change (2026-09-22 owner-feedback backstop, step 1 of
  // the priority list: "redesign Segmentation Fault so its effect is
  // conditional or temporary") is a genuine nerf, not a price cut to
  // compensate for it.
  cost: 4,
  type: "Directive",
  art: "placeholder:null/segmentation-fault",
  flavor: "A standing violation, live only while the process that wrote it keeps running.",
  abilities: [
    {
      id: "segmentation-fault-aura",
      trigger: "static",
      // Redesigned from an unconditional permanent aura to a conditional
      // one: it only debuffs the opponent's units while Null itself
      // controls 2+ units. This is the "conditional" half of the owner's
      // instruction, not "temporary" (a duration-based flicker didn't fit a
      // Directive's always-recomputed static model without new schema
      // work) — and it's a genuine soft counter, not just a weaker number:
      // clearing Null's board (already something every faction can do
      // through ordinary combat/removal, not a new mechanic) turns this off
      // without needing the one directive-destroy answer specifically. Uses
      // the effects/statics.ts condition-gate this session also added
      // generically (Ability.condition now applies to "static" triggers,
      // not just onPlay/activated) — the first user of it, not a one-off.
      text: "While you control 2 or more units, enemy units get -1/-0.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 2 },
      staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: { side: "opponent", kind: "unit" } },
    },
  ],
};

export const nullSingularity: UnitCard = {
  id: "NL-014",
  name: "Null Singularity",
  faction: "Null",
  rarity: "Mythic",
  // Cost 6 -> 7 (2026-09-23 owner-feedback entry, Phase 4 decisions, item
  // 2 — same steer and reasoning as Kernel Panic above: the other
  // played-win-rate outlier the 2026-09-20 backstop named, raised now that
  // the owner has confirmed a Null-top-end premium is on-identity. Energy
  // caps at 10 (see this file's own comment on the resource model in
  // DESIGN.md), so 7 is still reachable mid-to-late game, not a dead card.
  //
  // Health 8 -> 7 (2026-09-23 "Phase 4 session 17 follow-ups" entry, item 4:
  // "Null step 4 — go past cost to power ... Null Singularity's aura/stats
  // ... measure after each." The cost raise alone didn't move its
  // played-win-rate (still ~79% per balance-report-011) — this is a direct
  // "stats" cut, the other of the two candidate axes the entry names,
  // deliberately picked over touching either aura: both auras are this
  // card's whole point as the Mythic capstone (and the enemy-aura's health
  // component was already removed in an earlier session specifically to
  // protect Aegis's stacking identity — cutting the ally aura too would
  // gut the design rather than trim it). One fewer point of health means
  // one less turn of the auras surviving an attacker that couldn't quite
  // finish it before, without changing what it does once it's out.
  cost: 7,
  type: "Unit",
  attack: 3,
  health: 7,
  keywords: [],
  art: "placeholder:null/null-singularity",
  flavor: "Not a process anymore. Just the address where every dangling pointer eventually leads.",
  abilities: [
    {
      id: "null-singularity-aura-ally",
      trigger: "static",
      text: "Your units get +1/+0.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" } },
    },
    {
      id: "null-singularity-aura-enemy",
      // Second-step fix (roadmap item 3, following the Kernel Panic
      // targeting fix above, which measurably did NOT move Aegis-vs-Null:
      // re-measured at 75.3%/81.0%, essentially unchanged from
      // balance-report-002-null.txt's 75.0%/81.3% — see
      // progress/balance-report-003-null-fix.txt). Investigated with a
      // scratch instrumentation pass (60-150 seeds, tallying which Null
      // effects correlate with wins) rather than guessing: no single card
      // explained the gap, but Null's win rate conditional on having a
      // persistent enemy-debuff aura in play (this card or Segmentation
      // Fault) was ~84% vs. ~60% without one — a real, measured
      // contributor, not the whole story. Comparing this card side by side
      // with its own faction-mirror precedent (Prime Aegis, the other
      // 6-cost Mythic with a dual ally-buff/enemy-debuff aura):
      // Segmentation Fault (this faction's OTHER enemy-aura card) and
      // Prime Aegis both debuff enemy ATTACK only, never health. This was
      // the one persistent, un-cleansable (no debuff-removal or Directive-
      // destroy exists anywhere in the current card pool) enemy-HEALTH
      // reduction in the whole pool — a specific, structural hard counter
      // to Aegis's stacking-health identity that has no in-game answer,
      // not just a strong effect. -1/-1 -> -1/-0 removes the health
      // component, matching the Segmentation Fault/Prime Aegis precedent,
      // while leaving the ally buff and this card's own 3/8 body untouched.
      trigger: "static",
      text: "Enemy units get -1/-0.",
      staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: { side: "opponent", kind: "unit" } },
    },
  ],
};

// --- Directive removal (2026-09-20 owner-feedback entry, Phase 2 item 3:
// "Directives must be removable ... give every faction one answer") --------

export const nullPointer: CommandCard = {
  id: "NL-015",
  name: "Null Pointer",
  faction: "Null",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:null/null-pointer",
  flavor: "It dereferences whatever's still standing at that address.",
  abilities: [
    {
      id: "null-pointer-cast",
      trigger: "onPlay",
      text: "Destroy target enemy directive. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "directive" } },
      effects: [{ kind: "destroy" }],
    },
  ],
};

// Phase 3 pool lint (cards/poolLint.ts): this pool measured at 50% (18/36
// copies) removal/debuff density, double the lint's 25% cap, plus zero card
// flow — the exact outcome the 2026-09-20 owner-feedback entry predicted
// ("the lint will require cutting or redesigning Null cards to make the
// deck load ... that's intended"). Fixed with both tools the entry
// mentions, not just one: corruptedProcess and forkBomb above were
// redesigned off damage entirely (fixing card flow as a side effect, not a
// coincidence — see their own comments), and the remaining removal cards
// (Segfault Handler, Deprecated Routine, Segmentation Fault) were trimmed
// to the copy counts below. Kernel Panic (the evolution line's finisher),
// Null Singularity (the Mythic capstone), and Null Pointer (the
// structurally-required per-faction directive-destroy answer from Phase 2
// item 3) were left at their original counts — cutting those specific three
// further would have gutted Null's actual identity rather than just its
// oversaturation. Result at the time: 8/32 = 25.0%, exactly at the cap.
//
// 2026-09-22 (Phase 4 backstop, step 2 of the owner's priority list, after
// step 1 — Segmentation Fault's own conditional redesign above — measurably
// failed to move Aegis-vs-Null): the entry named three cards to cut to 2
// copies (Fork Bomb, Segfault Handler, Corrupted Process); Segfault Handler
// was already at 1, below that, so nothing to do there. Of the other two,
// only Corrupted Process is cut this round (3 -> 2) — the pool was already
// sitting exactly at the Phase 3 lint's 25% removal/debuff cap (8/32), so
// cutting a non-removal copy without backfill immediately fails the lint
// (fewer total copies, same removal numerator, higher percentage); Null
// Shell is the only card in the pool under its rarity's copy cap
// (Uncommon, 2 -> 3) and absorbs exactly one cut, keeping the pool at 32
// total / 8 removal copies / 25.0%, unchanged and still passing. That
// headroom is now used up: a second cut (Fork Bomb) has no legal backfill
// left without either shrinking the deck below its current size or
// trimming a removal card the original Phase 3 pass explicitly protected
// (Kernel Panic/Null Singularity/Null Pointer) — left as a named option for
// a future session, not attempted here. The 2026-09-22 owner-feedback entry
// also named Corrupted Process's draw specifically as "on the table," which
// is exactly what this cut targets.
export const NULL_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: glitchSeed, copies: 3 },
  { card: strayFragment, copies: 3 },
  { card: corruptionPatch, copies: 3 },
  { card: segfaultHandler, copies: 1 },
  { card: forkBomb, copies: 3 },
  { card: corruptedProcess, copies: 2 },
  { card: nullShell, copies: 3 },
  { card: propagatingExploit, copies: 3 },
  { card: deprecatedRoutine, copies: 1 },
  { card: decayWard, copies: 2 },
  { card: entropyHarvester, copies: 2 },
  { card: segmentationFault, copies: 1 },
  { card: kernelPanic, copies: 2 },
  { card: nullSingularity, copies: 1 },
  { card: nullPointer, copies: 2 },
];
