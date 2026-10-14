# Quality debt (honest, specific — read before adding anything new)

Written at the end of session 1, updated at the end of the stage-1 redo
session (priority/reactivity rebuild), the stage-2 (agent interface)
session, the stage-3 (real card set / board-development system) session,
the session-5 hardening pass (checkpoint feedback + automated test runner),
session 6 (backfilling Cortex/Swarm with board-development cards), session
7 (first cross-faction balance measurement + a real crash fix), session 8
(the fourth faction, Null), session 9 (non-engine test coverage), session 10
(the owner-directed Aegis-vs-Null fix attempt), session 11 (Aegis
defensive interaction + the chosen-targeting fix), session 12 (Phase 1 of
the 2026-09-20 owner-feedback entry — fixing the balance instrument),
session 13 (Phase 2 item 3 of the same entry — directive removal), session
14 (Phase 2 items 4-5 — summon/token effect kind, base armor), session 15
(Phase 3 — the load-time card-pool lint), session 16 (Phase 4 — the counter
triangle, proposed and measured), session 17 (the owner's Phase 4
decisions: the four-faction ring, Null step 4, buff Swarm), session 18
(Phase 4 session 17 follow-ups: ring labels corrected, Aegis-vs-Cortex
fix, Null past-cost nerf), session 19 (Phase 5 slice 1: Aegis pool
grown 18 -> 22 unique cards), session 20 (Phase 5 slice 2: Swarm
pool grown 16 -> 20 unique cards), session 21 (Phase 5 slice 3:
Null depth/variety pass, 15 -> 20 unique cards), and now session 22 (Phase
5 slice 4: Cortex depth/variety pass, 19 -> 24 unique cards), and now
session 23 (the Null consistency trim, 40 -> 36), session 24 (the
neutral pool), session 25 (the owner's agent checks: card
advantage, Null's cards), session 26 (the Phase 5 gate), session 27 (Phase 5
closed, event-log instance ids), session 28 (persistence + the economy spec), and now session 29
(the economy moves to the owner), and now session 30 (manual salvage, sign-in, the connected
agent), and now session 31 (promo/prize unbinding, the signature zone), and session 32 (the Neutral
signature menu and its fairness test), and session 33 (the tuner's size and cost levers, Guard over
Bulwark, the unsellable signature card).
This is not "no debt, all good" — the product is real and the evidence is
real, but here is where it's thin.

## New debt from session 33

- **10 of 16 menu options still fail the fairness test.** Guardian and Bulwark fail at every lever
  and wait on the owner's rework call. Hunter is too strong even at its smallest size, and it has
  no size without Rush. Commander's aura, Shield wall, Suppress and Dampen split the factions at
  every size. The generator can only draw from 6 options until this moves.
- **The search isn't exhaustive.** The coarse screen runs at 300 seeds, and the walks start only
  from the 3 best configs. A config that screened badly by noise is never walked, so a passing
  line may be missed, most likely for the near misses (Smite d1 2.4, Energy surge 2.4, Sweep r2
  2.6).
- **Picking the lowest worst edge from a noisy screen favours lucky lines.** Only the 2,500-seed
  re-measure counts as a pass, so no false pass gets through. But it is why several confirmed
  lines come in worse than they screened (Tax 3/4: 2.2 confirmed).
- **The sizes are my picks, 2-4 steps per option.** No size is finer than one number step.
  "Only while" conditions count as sizes (a call flagged to the owner). Guardian and Bulwark have
  no size at all.
- **Inspire passes only off the table (3/4, 3/5).** The generator will show a body the owner's
  table doesn't list.
- **The cost-7 lines the tuner likes are tiny bodies (Guardian 3/2, Bulwark 3/4).** They don't
  read as Mythics, and the tuner has no lower bound on health beyond 1.
- **`attackTargets` is engine surface no card uses.** Only the dev rework probes use it. If the
  owner picks neither Bulwark rework that needs it, it should go.
- **A once-per-turn activated ability can still be activated twice before the first resolves.**
  The use is recorded at resolution, so a second activation in response to the first is offered,
  paid for, and then does nothing. No card is affected yet (the only user is the "intercept" probe).
- **The menu's results still depend on Lookahead**, as session 32 noted. It doesn't value a
  signature card's statics or turn triggers when deciding to play it. The passes are passes for
  Lookahead-vs-Lookahead play.
- **The report's findings are hand-written** (`signatureLeversReport.ts` FINDINGS). If the data is
  re-run with different numbers, the prose won't follow it.
- **The raw results grew by ~320 KB of JSONL** (levers and reworks), on top of session 32's
  288 KB.

## Session 32 items moved by session 33

- "The tuner only moves stats": it now also has size and cost-tier levers. The walk is still
  greedy (see above).
- "Cost 6 and 7 are barely measured": every option is now screened at cost 6 and 7 with every
  extra (300 seeds), and the best lines confirmed.

## New debt from session 32

- **The menu doesn't pass its own fairness test.** Only Recycle and Tax pass, and those are the
  two weakest options. The generator can't show an owner 3 different candidates until the
  owner's check-in is answered and the tuner gets more levers. Step 2 is blocked on that, by
  design, not by a bug.
- **The tuner only moves stats, and its walk is greedy.** It screens at 500 seeds, so a
  half-point step can be noise, and it can stop at a local best. It never tries the ability's
  size or the cost tier. Attack is bounded to 0-6 and health to 1-9 by hand (an unbounded walk
  climbed Sweep to 1/16).
- **Cost 6 and 7 are barely measured.** Only 57 of their 255 lines (4 options) ran, untuned.
- **The test's result depends on the dummy agents.** Lookahead doesn't value a signature card's
  statics, turn triggers or onDeath when deciding to play it (it scores body + onPlay). It also
  attacks into Guard walls it should leave alone: Guardian wins 197 of 200 games for Cortex
  against Swarm from the first seat. Guardian's +40 may say as much about the agent as about the
  card.
- **First-seat advantage looks large.** In that same check, Cortex won 155 of 200 games against
  Swarm from the first seat with the plain card, against ~53% over alternating seats. The ring
  alternates seats, so its numbers are fair, but it's worth measuring on its own.
- **`lethalBy` credits whichever source dealt the last hit.** A Command's id never matches a
  unit, which is right, but an onDamaged retaliation that finishes a unit credits the
  retaliating unit. Only Hunter reads it today.
- **Bulwark reacts to every attack declaration, including a Rush unit's same-turn attack.** It
  ignores Stasis on itself (a frozen Bulwark still redirects). That's my call, not specified.
- **The render ignores the new triggers' meaning.** It labels them ON KILL and INTERCEPT, but
  there's no dedicated effect yet. Render-lane work.
- **The raw results are committed as JSONL (288 KB).** It's reproducible, but heavy for a repo
  that has mostly kept to text reports.

## New debt from session 31

- **The ring has no signature-mode gate yet, and the stand-in ring is badly out.** With each set
  Mythic in the signature zone, 4 of 6 edges sit 10-24 points from where they are today
  (balance report 022). The gate still measures decks as shipped, which is true to every real
  match today but stops being true the day agents carry signature cards. Owner check-in pending.
- **The fairness test as written can't pass.** Swapping one candidate for four very different set
  Mythics can't move every faction 2 points or less. Option A (same plain stand-in on both sides)
  is a proposal, not built.
- **Aegis gains from any extra always-available body**: even an identical plain 5-cost 3/6 on
  both sides gives Aegis +7-8 points against Cortex and Swarm. Not addressed.
- **Lookahead values a signature play exactly like the same unit from the hand.** It doesn't
  value that the card comes back (a renewable threat), or that holding it for a better turn might
  be worth more. It plays it on the first affordable turn almost every game.
- **Null Singularity (cost 7) is near-dead in the zone** (played in 29% of games), because games
  end before turn ~13. Using a 7-cost card as a signature card is a weak choice under today's
  curve.
- **The arena doesn't show the signature zone yet.** Render ignores `signatureReturn` and
  `fromSignatureZone`; a spectator can't see the waiting card or its climbing cost. Render-lane
  work.
- **Nothing gives a real match a signature card yet.** The server's one hard-coded match, the
  economy's `startMatch` and the demo all play without one. The zone is proven in engine tests,
  the demo and the measurement only.
- **The signature card is only checked for "plain Unit".** The Neutral-faction rule, the tier
  stat lines and the one-signature-ability budget from ECONOMY.md aren't validated anywhere yet.
- **Migration 4 assumes every bound promo/prize was bound by migration 3.** True today (nothing
  else bound them), but it would wrongly unbind a promo granted bound on purpose on a v3 file.
  No such file exists.

## New debt from session 30

- **Nothing outside the demo and tests calls sign-in or `startMatch` yet.** The match server still
  runs one hard-coded match, and there are no HTTP endpoints. The permission boundary ("only the
  signed-in owner acts for itself", "only admins see the roster") belongs to the step-3 server and
  isn't written.
- **`recordMatch` still accepts a match that was never started.** That keeps offline history and
  the older tests working, but it means "one connected agent, not during a live match" holds only
  for callers that use `startMatch`. Once the server records matches, recordMatch should refuse
  unstarted ids (or take an explicit offline flag).
- **A live match can go stale.** If the server dies mid-match, the `live_matches` row stays and
  locks both owners' agents until someone records a cancel. There is no expiry, and no startup
  sweep.
- **No password reset or account recovery, and no email verification.** A self-contained
  Season 0 has no mail service. A forgotten password needs an admin reset path, which isn't built.
  The email field is optional and unverified.
- **The lockout can be used against a known username.** Ten wrong guesses lock the real owner
  out for 15 minutes. That's the usual trade-off; there's no per-source limit because the store
  doesn't see network addresses (the server must add one).
- **Sessions and failure rows are never cleaned up.** Expired sessions and old failures stay in
  the file. They're tiny, but they grow forever.
- **Slot filling ignores finish.** When a deck's saved copy is gone, the oldest held copy fills the
  slot, even if the owner would rather show a Gold one. There's no per-deck finish preference.
- **Deck and holdings reads load the whole collection.** `listDecks` is decks x collection, which
  is fine for Season 0 sizes and untested at scale.
- **The tests reach the private `db` through a cast** to check what's stored (no plaintext
  password or token) and the re-hash. It works, but it's brittle.

## New debt from session 29

(Session 30 status: the salvage-in-deck rule is replaced by the owner's manual salvage, sign-in
exists, the connected agent is enforced at `startMatch`, and the demo is byte-reproducible. The
items below are kept as written, with those four now resolved.)

- **"One connected agent at a time" isn't enforced.** Owners can have many agents, and nothing
  stops two of them playing at once for the same owner (against different opponents). Both would
  draw on the same daily caps, so it farms nothing, but it breaks the owner's rule. Build-order
  step 2 adds the connected agent and refuses switching during a live match.
- **No sign-in and no permissions.** `createOwner` makes an account from a name. Anyone holding
  the store can act as any owner. Step 2 adds Season 0 sign-in; the server needs a real boundary.
- **Rating is still a promise.** "Rating is per owner" is written down, but no rating exists yet
  (Glicko-2 comes with the ladder, roadmap 6b). Stats per owner are built.
- **Salvage skips copies sitting in a saved deck.** This is my rule, not the owner's: it stops a
  salvage from breaking a saved deck. The side effect is that an owner can keep more than the
  playable limit by spreading extra copies across saved decks. It's flagged in notes-for-owner.md.
- **The marketplace hooks are partial:**
  - built: the origin per copy, the bound flag, bound copies never moving;
  - not built: the append-only ownership history per copy, the earned/purchased funding tag on
    ledger rows and pack copies, the lock state, the per-type transferable setting.
  The funding tag is needed before paid packs, not before Season 0.
- **The v1 migration assumes every v1 agent was a house agent.** That's true for the only v1
  data that exists (the session-28 demo and tests), but a real v1 player file would come out
  labelled "house".
- **The exploit suite covers only what exists.** Tested: switching agents vs the caps,
  self-play, a second starter, bound copies, cross-owner payouts. Not tested yet:
  craft-then-salvage (crafting isn't built), quest and pity farming, and multi-agent farming of
  owner-level rewards (none exist yet).
- **The demo isn't byte-reproducible.** The pack-purchase ledger line prints a random pack UUID.
  Everything else is seeded.

## New debt from session 28

- **Nothing calls the store yet except the demo and tests.** The match server still runs one
  hard-coded match and records nothing. Until session 31 wires `recordMatch` into the server,
  "persistence" is a library with a demo, not part of a running service.
- **The economy is mostly spec.** Built: the store, per-copy ownership, decks, the purchase debit,
  and match payouts. Not built: sets and collector numbers, what a pack contains, opening packs,
  pack points earning and spending, duplicate conversion, pity timers, Prototypes, promos,
  starters, quests, the weekly challenge, the owner's daily pack, the owner interface. A pack
  can be bought, but nothing can open it yet.
- **Four payout numbers are mine, not the owner's:** a loss pays 2, losses are capped at 10 a day,
  a draw pays as a loss, and an abandon pays nothing to the agent that stayed. They're flagged,
  and they could change once Season 0 has data.
- **`node:sqlite` is labelled experimental.** It prints a warning on every run, and its API could
  change in a Node minor release. CI's `node-version: 22` floats. If the API changes, the economy
  tests break loudly. (Session 29: `engines.node >= 22.13` is now pinned.) **Standing owner gate
  (2026-10-05):** before the public Season 1 launch, replace or back the single SQLite file with
  self-hosted storage that handles many players, and prove it with a load test at launch scale.
  Not started. This stays here until that gate passes.
- **There are no owner/agent permissions.** "The owner buys packs" is a function anyone holding
  the store can call. That's fine in-process for Season 0, but the server and the owner page
  will need a real boundary.
- **"Day" means the UTC day.** An owner in another timezone sees the win schedule reset at a
  local time that isn't midnight. That needs an owner call before the public launch, not now.
- **Card ids are the engine's internal ids**, checked against `CARD_REGISTRY`. A card removed from
  every pool stops being ownable, and `loadDeck` then refuses any deck holding it, but the copies
  stay in the collection with no way to use them. Retiring a card (or using a set's card list as
  the registry) needs a rule before cards start rotating out.
- **Season archive is a convention, not code.** "Season 1 starts a new file" is written down, but
  there's no command to start a new season or to read an archived one.
- **Concurrency is untested.** WAL mode and `BEGIN IMMEDIATE` should serialize writers, but no
  test has two processes writing at once. That becomes real once the server and an owner
  command share the file.

## New debt from session 27

- **The regression check guards one measurement, not balance.** Every number is Lookahead vs
  Lookahead on fixed seeds. A change that only hurts under a smarter agent, or only on seeds past
  2,500, passes. The shipped gate is now "this heuristic, these seeds, no worse than before."
- **The check is loose inside a band.** An edge that drifts from 56 to 59 inside its 55-60 band
  passes, and so does an UNRESOLVED edge that moves a lot without changing verdict (Swarm > Null
  moved +3.3 in the 2/2 demo and passed). Named in the checkpoint as a call the owner can tighten.
- **CI determinism is assumed, not proven.** The baseline was recorded on Node 22.22 here; CI runs
  Node 22 (unpinned minor). The engine is integer-seeded, but the agent scores use floats. A V8
  change in float maths could flip a close Lookahead choice and shift a count by a game or two.
  The verdict rule tolerates that, but nobody has run the check on CI yet; the first PR run is
  that test.
- **Id fields are optional in the type.** A new event kind or emitter could forget its ids and
  still compile. Only `eventIds.test.ts` catches it, and only for events that real matches
  between the shipped decks actually produce. Cards outside the shipped decks (most neutrals,
  some trimmed cards) are covered only by sharing emitters with cards that are in them.
- **`abilityTrigger.targets` is the resolved list, not what got hit.** A random-target ability
  logs its random pick there; an AOE logs every unit. The render still has to read the
  per-effect events for which targets actually took something.
- **The 2026-10-03 render guardrail in render/EFFECTS.md is now stale** ("ids still needed").
  It's a render-lane file, so it's left for the next render session.
- **Phase 5's carried session-26 debt stands, unresolved by choice.** Null > Aegis (48.2) and
  Aegis > Cortex (52.2) are OUT by owner acceptance, not fixed. Watchdog Timer still barely
  matters. Lift menus only ever tried +1 stats. These are closed as a lane, not as problems.

## New debt from session 26

- **The Phase 5 gate failed: 3 edges OUT, 1 UNRESOLVED.** Null > Aegis (42.0 vs 55-60) is the
  worst, and no single +1 stat lift on a Null unit reaches it. Phase 5 can't be called done on
  this ring. It's waiting on the owner's answers to the checkpoint.
- **Aegis > Cortex (52.2) is short, and nobody has probed why.** It drifted down after session 19
  through the Cortex slice and the agent fixes. No measurement says which.
- **The Quorum Arbiter "lever" was stale.** Session 22 measured ~6 points; it's now 1-3 and
  inside noise. Any lever measured before an agent fix should be re-measured before it's
  trusted. The other numbers carried in notes and owner-feedback have the same exposure.
- **Watchdog Timer still barely matters.** The buff quadrupled its draws, but Null moved +0.3.
  The agent values the conditional at a flat 0.5 and never plays toward the condition (e.g.
  dumping a hand to trigger it). It's a lift that's only on paper until the agent reasons about
  hand size.
- **The gate's arbiter is one policy judging itself.** Every verdict is Lookahead-vs-Lookahead.
  Random and Aggressive disagree a lot (Random has Cortex 70% over Swarm). That's expected for
  weak policies, but it means the ring is only "balanced" for this one heuristic agent.
- **The lift probe only tries +1 stats on units.** No cost changes, no spell or Directive tweaks,
  no pairs. The menu is narrower than the design space.

## New debt from session 25

- **Null is the weakest faction by a clear margin:** 40.0 / 38.9 / 41.4
  under Lookahead (900 seeds), with three edges OUT. The Rack nerf the owner
  asked for removed Null's best filler, and no neutral card helps it now.
  The gate will report this, not fix it. Levers left: a Watchdog Timer buff
  (flagged), or owner direction.
- **Watchdog Timer is measurably weak** (+1.9 to cut, CI 0.3-3.4), and only
  36 draws in 900 games. It's protected as an endorsed mechanic, so it
  stays as a known weak card until the owner rules.
- **The turn-buff valuation is still one-step.** A pre-combat debuff is
  valued by the best attack it enables, but the agent may then make a
  different attack. 8 of ~220 Bit Rot casts were still wasted this way. The
  greedy agent also attacks face before casting a debuff that would have
  enabled a better trade (see the lookahead test's Guard setup). Armor and
  Barrier aren't modelled in `exchangeValue`.
- **Reflex Spike plays halved** (1,990 -> 1,011 games) now that it's held
  for real combats. That's correct by the new rule, but nobody has checked
  that the agent finds every combat where it would help, e.g. defending a
  unit against a pending effect, which the rule ignores.
- **The Aegis package (+1 Uplink Tower) shipped on a noise-level held-out
  improvement** (243 -> 234; every edge within +/-1). The ship rule allows
  it, but it's churn rather than a measured gain.
- **Package-search noise is structural.** Every add-only candidate
  appends to the same deck position, so all candidates share one shuffle
  permutation that differs from the start deck's. Step-1 comparisons on
  search seeds mostly measure that shuffle change; only the held-out check
  guards it. A seed-paired design (shuffle the deck independently of list
  order) would fix the instrument.
- **Null Pointer is dead in 270/900 games** (no enemy directive). It's the
  owner-mandated answer card, so the cost is accepted, but it means Null's
  deck has 2 slots that often do nothing.
- **Closed this session:** "Commodity Rack beats every utility card"
  (nerfed after the agent was cleared), and "Null's removal cards weak or
  misplayed?" (settled card by card, report 019). The neutral-pool "3 of 10
  cards in decks" item still stands (now Rollback Point, Surge Protector,
  Uplink Tower).

## New debt from session 24

- **Only 3 of 10 neutral cards made a shipped deck** (Rollback Point, Surge
  Protector, Commodity Rack). The other seven are legal, tested and fire in
  real play (probe table, report 018), but no faction runs them. The pool
  "exists" more than it is "used". Swarm and Aegis run no neutral cards at
  all.
- **Commodity Rack, a vanilla 3/3 for 3, beats every utility card.** In the
  probe it hits 48% vs 34-42%, and it's 3 of Null's 4 neutral slots. Either
  it's over-rate against faction bodies (a neutral body crowding out faction
  identity is the opposite of the owner's "utility" framing), or
  LookaheadAgent over-values raw stats and under-values draw (flat 1.5 per
  card). Not separated.
- **Power Reserve is close to dead** (34% in the probe, worst). Its value is
  holding energy for responses, and LookaheadAgent is greedy on its own turn
  and rarely holds anything. It's an agent limit, but the card is still dead
  in practice. Uplink Tower's draw landed only 94 times in 335 games.
- **Kernel Panic visibility fell from 9.9% to 7.1% of Null's games** (36 -> 40
  cards). That undoes most of the session-23 trim's visibility gain. Flagged
  to the owner as a trade against +3-4 points per edge.
- **The package search is greedy and one-faction-at-a-time against fixed
  opponents.** Opponents' packages were not in place while each faction was
  searched, and the gate hasn't re-measured the combined ring at 2,500
  seeds. Cortex's package is small and its held-out edge changes are all
  inside noise individually. It shipped on the held-out objective sum.
- **The neutral lint rules and the 10-copy cap are this session's own first
  proposal** (e.g. banning all neutral statics, and treating Rush as
  identity). They're flagged to the owner, not confirmed.
- **The agent fix changed the instrument mid-Phase-5.** Every number before
  report 018 was measured with an agent that wasted energy on no-op heals.
  Cortex was understated by ~3-6 points per edge. Earlier Cortex conclusions
  (e.g. session 22's "Cortex-vs-Null follows Null's weakness") were drawn on
  the flawed instrument.
- **The agent still wastes Intercept Routine** (session-23 item below, not
  fixed), and it doesn't account for pending stack effects other than flat
  heals (damage, buffs, a pending destroy).
- **Neutral cards render in the UI gold** (`.faction-Neutral` borrows
  `--neutral`). That's a stopgap so frame and fx tints agree. The render lane
  should give them a palette.
- **The parity fixture comes from an independent Python
  re-implementation** of the same formulas, not from a second trusted
  library. (The provenance-line item is closed: session 25 removed the line
  per owner-feedback 2026-10-01.)

## New debt from session 23

- **Null is still the weakest faction, and the trim only moved it ~4
  points.** Under Lookahead (900 seeds), it's 41.1 / 41.7 / 39.6 vs Cortex / Swarm /
  Aegis. Null > Aegis is still inverted: Aegis wins 60.4% against a target of
  40-45. Null vs Cortex is still out of band (CI 37.9-44.4 vs 45-55). The
  sanctioned density lever is largely spent at 36 cards without cutting
  mechanics. The bigger-lift variant (report 017, B) cuts Bit Rot and
  Watchdog Timer and is waiting on the owner.
- **Null is back at the removal lint cap exactly (9/36 = 25.0%).** Every
  trim cut was non-removal. Any future non-removal Null cut fails the lint
  unless a removal copy goes too.
- **Null's removal/debuff cards measure as its weakest copies** (Bit Rot,
  Null Pointer, Watchdog Timer, Decay Ward: +2-3 points each to cut). I
  haven't separated whether the cards are weak or LookaheadAgent plays them
  badly. The latter would be an instrument bug that also mis-measures every
  other faction's reactive cards.
- **LookaheadAgent wastes Intercept Routine.** It will cast it onto the unit
  the attack already targets, a pure no-op (seen at Null vs Aegis seed 3).
  The engine now logs that honestly, but the agent still spends the card.
  This understates Aegis's reactive kit. Fix belongs in an agent/instrument
  pass: don't score a redirect whose target equals the current one.
- **The CI band rule can't confirm a 5-point band at 900 seeds.** The 95% CI
  half-width is ~3.2 points. The gate needs ~2,500 seeds per pairing on its
  Lookahead side, or the owner has to accept UNRESOLVED as a pass. Not decided; flagged.
  balanceReport.ts still reports point estimates vs band, not CI verdicts;
  only lookaheadEdgeCheck.ts has the verdicts.
- **Greedy search noise.** Step-to-step estimates carry 1-2 points of noise
  even at 2,700 games per candidate, and deck list order changes the
  shuffle. So a "same deck" re-listed in another order measures differently
  on the same seeds. Decisions within ~2 points of each other are not
  real distinctions. Five nearby 36-card decks were indistinguishable.
- Carried and partly addressed: session 22's "ablation and search
  scripts were scratch files" item. A reusable search now exists
  (`nullTrimSearch.ts`), but it is Null-specific. The owner-facing
  per-matchup per-card table still doesn't exist.

## New debt from session 22

- **The standard balance report is too small a sample for the calls we make
  with it.** 300 seeds is about a 2.9-point standard error, and the ring
  bands are only 5-10 points wide. The baseline Null-vs-Cortex edge read
  55.0% on seeds 1-300 and 59.3% on 301-900. Every earlier "IN BAND" verdict
  within about 3 points of a band edge should be treated as unconfirmed.
  `lookaheadEdgeCheck.ts` gives 900-seed Lookahead numbers, but
  balanceReport.ts itself still defaults to 300. Changing the default (or
  the end-of-Phase-5 gate) is proposed to the owner, not done.
- **Null is the weakest faction by more than the reports said:** 42.1 /
  36.6 / 37.3% against Cortex / Swarm / Aegis over 900 seeds. All three of
  its ring edges are out of band in the "Null too weak" direction,
  including the one it should win (vs Aegis). This slice moved
  Null-vs-Cortex a further 3.2 points toward Cortex (57.9 -> 61.1), and that
  was a deliberate, flagged tradeoff.
- **Cortex-vs-Swarm is not quite closed.** 54.1% over 900 seeds against a
  55% floor. It reads in band on 300 seeds (58.7%), but see the noise item
  above.
- **Random policy now shows Cortex over Swarm at 73.0%**, and Aegis-vs-Cortex
  out of band under Random (46.0% Aegis). Both are discounted under the
  Lookahead-arbiter rule, but the swing is large. Rate Limiter and Deadlock
  Detector need no judgement to work, so Random gets full value from them.
- **LookaheadAgent spends temporary friendly buffs immediately.** It values
  "+X/+Y this turn" the moment it has a target, not when combat is pending.
  So Hotfix is cast on the opponent's turn 2 times out of 262, and Swarm's
  Reflex Spike 0 of 150. The Instant speed of both cards is effectively
  unmeasured. The fix is an agent change (value a turn buff only against
  pending combat on the stack), and it would move Swarm's numbers. It
  belongs in a deliberate instrument pass, not a card slice.
- **Rate Limiter's 41.7% played win rate looks like a weak card but isn't
  one.** It idles against narrow boards (Aegis/Null) by design. Ablation
  shows it carries most of the Swarm-specific gain, and the per-card table
  can't show per-matchup value. Same instrument limit as Watchdog Timer's
  selection bias (session 21), now on a second card.
- **My ablation and search scripts were scratch files, not committed.** Only
  the edge-check tool was promoted into `engine/src/dev/`. A per-matchup
  per-card table and a copy-mix ablation tool would make the next faction
  tuning pass much faster. Not built.

## New debt from session 21

- **Null's evolution line is diluted.** The deck went 32 -> 40 with no
  trims, which was deliberate for power-neutrality. As a result, Kernel Panic is played in about
  half as many Lookahead games (206 -> 105) and Corrupted Process drops
  from 529 to 370. Null's signature "answer it early or respect it later"
  arc now shows up much less often, which matters for spectator
  drama as well as balance. The fix, if the owner wants the arc back, is
  trimming some new or old copies back toward ~36 cards and re-measuring. This session
  did not try it.
- **Null is still the weakest faction under the trusted policy.** Its Lookahead
  mean is 42.1%, and the ring's intended Null>Aegis edge sits at 45.0% Null under
  Lookahead, against a 55-60% target. This slice was scoped as "not a power buff" on purpose, so it
  is not a bug in this slice. But the end-of-Phase-5 re-measure will almost
  certainly have to deal with it.
- **LookaheadAgent still ignores several things a card can be worth.**
  This session fixed one blind spot: Directive turn triggers. Still unvalued:
  keywords on a played unit (Rush, Guard, Barrier), a unit's own
  onDeath/onTurnStart/onTurnEnd abilities, and any condition the view could
  actually evaluate. Conditionals are always discounted to 0.5 even when
  the condition is public board state. As a result, Dangling Pointer's Rush and
  Zombie Process's death token are only "valued" as their raw bodies.
  Fixing this generally would move every faction's numbers, so it belongs in
  a deliberate instrument pass (the owner's "fix the instrument" framing),
  not inside a card slice.
- **Watchdog Timer's measured 37% played win rate is selection bias, not a
  verdict.** It only does anything when Null's hand is empty, a state
  correlated with losing. The per-card table cannot separate "this card is
  weak" from "this card is played while behind". This is a known limit of the
  instrument, and it now applies to a real card.
- **The first cut shipped a dead card that only a trace caught.** The
  balance report showed Watchdog Timer "played 250 times", which looked
  healthy, while its effect had fired zero times. The per-card table
  counts plays, not effect firings. A per-ability firing count in
  balanceReport.ts would catch this class of problem automatically. Not built.

## New debt from session 20

- **Cortex-vs-Swarm overshot past even into mild Swarm-favour, rather than
  landing at the ring's actual 55-60%-Cortex target.** The headline honest
  finding, not a side note: this session's broad Swarm buff resolved the
  project's sole standing triple-flag, but the result is a new,
  small-but-real reverse imbalance (Lookahead 55.7% Swarm, Random 53.0%
  Swarm, Aggressive 53.7% Cortex — not triple-flagged either direction) on
  a pairing the owner explicitly said not to chase card-by-card
  (2026-09-23 entry: "Phase 5 wider pools will likely settle it... do not
  add a card or nerf anyone specifically for this pairing"). This session
  followed that instruction to the letter (no card or number was aimed at
  this pairing specifically) and the pool-wide settle it predicted did
  happen — just past the target rather than onto it. Not chased further
  this session, per the same standing instruction; a future session
  (Cortex or Null's own Phase 5 growth, or the owner steering directly)
  should treat this as live, not resolved.
- **Swarm-vs-Null remains unresolved, now with the opposite policy split
  from before.** Before this session: Aggressive/Lookahead roughly even,
  Random badly Null-favoured. After: Aggressive (61.3%) and Lookahead
  (64.3%) now favour SWARM, above its own 55-60% target band on the
  winning side, while Random (36.0% Swarm, i.e. 64.0% Null) still favours
  Null. Real, measured movement in the right direction overall (Random's
  Null number dropped from 75.7% in the original baseline to 64.0%), but
  the pairing has gone from "policies roughly agree Null wins too much" to
  "policies actively disagree," which is its own kind of unsettled — worth
  a future session reading `progress/balance-report-014-phase5-swarm-slice.txt`
  before assuming this is close to done.
- **The exact shipped stat lines for the four new Swarm cards are a
  single-pass calibration, not an iterated tuning** — same category of
  debt session 19 named for Aegis's four cards. They were checked against
  the full balance report exactly once after the "scale back below the
  original benchmark" correction and landed the headline result (no
  triple-flag) on that one re-measure. A future session revisiting Swarm
  should treat these numbers as a reasonable first cut, not a settled
  target.
- **The uniform, whole-deck win-rate spike from the first (overtuned) cut
  is itself a finding worth remembering, not just a mistake that got
  caught:** benchmarking a new card's stats directly against another
  faction's *already-above-average-performing* card (Aegis Line Trooper,
  Bulwark Chassis, Reinforced Bastion were themselves 58-63% drawn win
  rate in their own pool, not neutral baselines) transmits that card's own
  above-average power into the new pool, amplified by how far below
  average the receiving pool started. This wasn't isolated or measured
  precisely (no controlled experiment separating "which of the four new
  cards drove how much of the spike"), just diagnosed by inspection and
  corrected in aggregate — a future card-design session copying a
  cross-faction stat-line precedent should sanity-check whether the
  source card itself tested as strong or average before treating its
  numbers as a safe baseline.
- **Which existing Swarm cards absorbed this session's copy trims was
  chosen by lowest measured win rate alone**, same known limitation
  session 19 named for Aegis's trims (a card seen in fewer games has a
  noisier win-rate estimate) — not re-litigated here, just restated so it
  isn't read as a new, different methodology.
- **Warren Guardian and Bloodswarm Alpha's exact numeric relationship to
  their cross-faction Guard/summon benchmarks (Firewall Sentinel,
  Reinforced Bastion, Overclock Beast) is this session's own judgment
  call, not owner-confirmed** — flagged in `progress/checkpoints.md` and
  `progress/notes-for-owner.md` per this project's standing convention for
  first-cut numeric proposals.

## New debt from session 19

- **Aegis-vs-Swarm drifted out of its "even" 45-55% target band**
  (57.7/71.0/70.7% Aegis across the three policies) as a side effect of
  this session's Aegis-vs-Cortex fix — not triple-flagged (Aggressive stays
  at 57.7%, under the independent 60% threshold) so not an emergency by
  this project's own pass/fail bar, but a real, named, untuned gap. Left
  open on purpose (this slice's scope was Aegis-vs-Cortex specifically) —
  see `progress/notes-for-owner.md` and `progress/checkpoints.md`.
- **The exact shipped stat lines for the four new cards are a single-pass
  calibration, not an iterated tuning.** They were checked against the full
  balance report exactly once after the "scale back to match existing
  cards" correction and landed the target pairing in/near band on the first
  re-measure — genuinely lucky in how cleanly that landed, not the result
  of multiple tuning rounds the way, e.g., session 20's Kernel Panic nerf
  went through two explicit steps. A future session revisiting Aegis should
  treat these four cards' numbers as a reasonable first cut, not a settled
  target.
- **Salvage Reflex's onDeath ability is the only piece of new *behaviour*
  this session added; the other three new cards are pure stat lines with no
  ability at all.** That's a deliberate response to item 3's "NOT
  zero-tempo utility" instruction (a body's own stats are the safest kind
  of "immediate impact"), but it does mean this slice adds less genuine
  mechanical variety to the pool than a session that designed new triggered
  effects would — worth knowing if "variety" (not just "unique card count")
  is being tracked as its own quality bar for Phase 5.
- **Which existing cards absorbed this session's copy trims was chosen by
  lowest measured win rate alone, with no check for whether a trimmed
  card's *low copy count* itself explains part of its low win rate**
  (a card seen in fewer games has a noisier win-rate estimate, and several
  of the trimmed cards — Static Ward Beacon, Barrier Shim, Latent Ward,
  Lockdown Field — already had the pool's lower "drawn" counts before this
  session's trim went from 2 copies to 1, which will make their signal
  noisier still in the next report). Not incorrect, but worth remembering
  before treating any single one of their numbers as a settled verdict.
- **Aegis Line Trooper (2/1, cost 1, no ability) is a fragile stat line
  that hasn't been checked for a specific failure mode:** whether it's
  simply too weak to ever be worth its slot once Cortex's cheap removal
  (Diagnostic Pulse, 1 mana) can 2-for-1 it before it attacks even once.
  Its 64.3% played win rate in this session's own report suggests it's
  fine in practice, but that number is an average across all four
  matchups, not specifically checked against Cortex, the matchup it exists
  to help.

## Resolved this session (session 19)

- **Aegis-vs-Cortex is still out of band on every policy — RESOLVED.** The
  session-18 debt item immediately below described the pairing as out of
  band on all three policies after that session's own fix. This session's
  change lands Random (58.7%) and Lookahead (59.3%) IN the 55-60% target
  band and brings the pairing out of the triple-flag cross-check entirely
  — Aggressive alone remains out of band (47.0%, a real but much smaller
  gap than the 64.3% going into this session). Left here rather than
  deleted, per this file's own convention for resolved entries, so the
  historical record of what session 18 actually left open stays intact.

## New debt from session 18

- ~~**Aegis-vs-Cortex is still out of band on every policy** after this
  session's fix (Guard Directive Chip 2->3 copies) — the headline honest
  finding, not a side note. Worst on Aggressive (Cortex still wins 64.3%,
  only down from 67.7%).~~ RESOLVED, session 19 — see above. The rest of
  this item (the untested agent-heuristic hypothesis) is still open and
  worth a future session's attention if there's spare budget: This
  session's own read is that the gap may be
  partly agent-heuristic (AggressiveAgent may simply play Cortex's
  removal-heavy kit more efficiently than it plays Aegis's defensive kit —
  see the existing "Agent quality" section below), not purely a
  card-balance problem, but that's an untested hypothesis, not a finding —
  nobody has actually isolated agent-skill from card-power for this
  specific pairing. A future session with spare budget could test it
  directly: run Aegis-vs-Cortex under LookaheadAgent-vs-AggressiveAgent
  (mixed policy, not matched) and see whether Aegis performs closer to band
  when it isn't the one being played by the weaker heuristic — this would
  at least separate "the deck is behind" from "the policy misplays this
  deck," which the current same-policy-both-sides methodology cannot do by
  construction (see this file's Testing/Card-pool sections for the existing
  note on that methodology's own known blind spots).
- **A first Aegis-vs-Cortex attempt (a new Barrier-granting Tool,
  "Redundant Barrier Coil") was designed, measured, found worse, and fully
  reverted this session** — no trace left in the shipped card pool, but the
  investigation itself (why a mechanically-sound-seeming card measured
  worse) wasn't pushed further than "this matches session 11's already-
  documented failure mode" — it's a pattern match, not a controlled
  isolation of the actual cause the way session 11's own investigation
  decomposed its three cards individually. If a future session wants to
  design another new (non-copy-bump) Aegis card, this pattern-matched
  conclusion is worth re-verifying rather than treated as fully proven.
- **The balanceReport.ts cross-check bug this session found and fixed (it
  didn't verify all three policies agreed on the winning side) may have
  affected the flag status judgment calls made in EARLIER sessions' own
  reports** (balance-report-004 through balance-report-011) — none of those
  historical documents have been re-audited under the corrected logic, only
  balance-report-012 (this session's own) uses it. Re-reading old reports'
  "triple-flagged" claims with the old, buggy logic in mind is worth doing
  once, opportunistically, rather than assuming every historical "FLAGGED"
  call in this project's paper trail was actually a genuine same-side
  agreement (this session spot-checked only balance-report-011's own
  Swarm-vs-Aegis claim, not the full history).
- **Kernel Panic's maxHealth cut to 4 and Null Singularity's health cut to
  7 are first-guess numbers**, same category of checkpoint-proposal debt as
  every other numeric first-guess in this project's history — not
  playtested beyond this session's own 300-seed report.

## New debt from session 17

- **None of the six ring pairings are within band yet.** This is the
  headline honest finding, not a side note — see
  `progress/balance-report-011-phase4-decisions.txt`'s "honest read"
  section. Both authorized changes (Null cost increases, the two new Swarm
  cards) moved the numbers in the right direction, but Aegis-vs-Null and
  Cortex-vs-Swarm both remain triple-flagged, and the four "should be even"
  pairings are mostly outside the 45-55% band too (Cortex-vs-Aegis 43.7-
  67.7% depending on policy; Swarm-vs-Aegis now 43.7-64.7%). The ring is a
  real target, not yet a real result.
- **Cortex-vs-Swarm has no assigned owner.** Nothing in the 2026-09-23 entry
  authorizes touching Cortex (explicitly forbidden) or names a specific
  Swarm/Aegis fix for this specific pairing the way it did for
  Swarm-vs-Null. It was measured, unchanged in kind, and left exactly as
  flagged — a genuine gap in who's supposed to fix it, not an oversight.
- **Kernel Panic and Null Singularity's cost increases didn't reduce their
  per-instance power, only how often they get played** — both remain
  extreme win-rate-when-played outliers (up to 86.4%/78.7% under Random).
  If Aegis-vs-Null needs to actually reach the 55-60% band, the per-card
  table in `balance-report-011` points at these two cards' raw
  stats/effects as the next lever, not their cost — unstarted, out of this
  session's authorized scope, named here so it isn't lost.
- **A new, unchased single-policy flag: Cortex-vs-Null under Aggressive
  (55.7% -> 60.7%).** Real, honestly reported, plausibly a side effect of
  Null's cost increases weakening its early-to-mid game specifically
  against Cortex's efficient curve. Not a cross-check flag (only one of
  three policies), not chased — see `balance-report-011`'s honest-read item
  3 for the full reasoning on why reverting over one policy's number would
  itself be the card-by-card chasing this project's history warns against.
- **Colony Broodling and Overgrown Carapace's numbers (cost 1/1/1 summon
  gated at 2+ other units; cost 3/2-attack/1-base-scaling-health; 3+2
  copies) are this session's own first proposal, not playtested or
  owner-confirmed** — same category of checkpoint-proposal debt as every
  other numeric first-guess in this project's history (baseArmor=1, board
  slots=6, telegraph timing, etc.). Flagged in `checkpoints.md`/
  `notes-for-owner.md` per the entry's own instruction to propose specific
  cards rather than finalize them unilaterally.
- **Both new Swarm cards help Swarm's OTHER matchups too, not just
  Null** — Swarm-vs-Aegis (an "across," should-stay-even pairing) moved
  further Swarm-favoured under Aggressive (61.7% -> 64.7%), a known,
  accepted side effect of a systemic fix rather than a Null-only patch, but
  worth tracking if a future measurement finds Swarm-vs-Aegis has drifted
  out of band in the other direction.
- **`swarmResilienceMatchDemo.ts`'s Overgrown Carapace sampling only checks
  the FIRST unit on `p1`'s board named "Overgrown Carapace"** (via `.find`)
  — correct for the current pool (copy count 2, and the script only needs
  one live instance to prove the mechanism), but would silently only track
  one instance if two copies were ever simultaneously in play in the same
  demo run. Not exercised this session (the found seed only ever had one
  copy on the board at a time), named as a scripting simplification rather
  than a proven-correct multi-instance path.
- **Phase 5 (pool expansion) remains correctly unstarted**, per the
  2026-09-23 entry's own explicit gate ("do NOT start expansion until the
  ring is within band"). Restating here per this file's own convention so
  it isn't mistaken for forgotten.
- **The server integration test's known flakiness (session 9's debt) looks
  worse than previously recorded.** This session observed it fail on 2 of 4
  runs, including standalone (not just under a full concurrent `npm test`),
  whereas session 16 only saw it flake once under a full run and pass
  reliably 3/3 alone. `server/` was not touched this session, so this isn't
  a regression from anything here, but the failure rate this session
  actually measured (~50%) is real new information a future hardening pass
  should have, not just "worth watching."

## New debt from session 16

- **The triangle is proposed and measured against, but the pool doesn't
  match it on any of the six pairings.** This is the headline honest
  finding of this session, not a side note — see
  `progress/balance-report-010-phase4-triangle.txt` Part 2. Cortex is too
  strong (should be "flexible," measures as the strongest faction against
  two of the other three); the Swarm-vs-Null edge is inverted (Swarm should
  win, loses 55-81%); Aegis-vs-Null overshoots its intended edge by a wide
  margin. None of this is new information in aggregate (Cortex-vs-Swarm and
  Aegis-vs-Null have been flagged since session 12-13), but this session is
  the first time it's been checked against an explicit, numeric target
  rather than just "is it triple-flagged" — and by that stricter standard,
  the balance pass (roadmap item 3) is further from done than the
  triple-flag framing alone suggested.
- **The Null backstop's step 2 (copy cuts) hit a real structural ceiling:
  the pool has exactly ONE unit of legal backfill headroom left anywhere**
  (Null Shell, Uncommon, was 2/3 copies, now at its cap). Any future copy
  cut to a non-removal Null card will immediately fail the Phase 3 lint
  without either shrinking the deck, trimming one of the three cards the
  original Phase 3 pass explicitly protected as core identity (Kernel
  Panic/Null Singularity/Null Pointer), or growing the pool with a genuinely
  new card (Phase 5 territory, not attempted this session). Fork Bomb was
  named in the backstop's step 2 but NOT cut, for exactly this reason — a
  real, incomplete execution of that step, not silently skipped.
- **Segmentation Fault's new condition (`unitsInPlayAtLeast side:controller
  count:2`) rarely deactivates in practice.** The real-match evidence
  (`sample-match-017-segfault-condition.txt`) does show a genuine OFF->ON
  transition, but only because that specific seed happened to catch Null
  early, before it had rebuilt board presence. Across the full 300-seed
  balance run, the measured effect was tiny (Aegis-vs-Null barely moved
  after this step alone) — Null's kit is wide enough (Fork Bomb's tokens,
  cheap 1-drops) that it holds 2+ units on the board for most of a typical
  game once established, so the condition is usually true exactly when it
  would matter most. The mechanism is real and correctly built (a genuine
  soft counter, not a fake one), but it is a much weaker lever than "made
  it conditional" might suggest on its own — named honestly here rather
  than overclaimed as "fixed."
- **`LookaheadAgent`'s static-effect valuation does not know about
  `Ability.condition` at all** (`estimateStaticEffect`, line ~165-170 of
  `lookaheadAgent.ts`) — it scores a Directive's static aura by its nominal
  magnitude regardless of whether the ability's condition is currently
  true, false, or even checkable from a `PlayerView`. This means the agent
  still slightly overvalues playing Segmentation Fault in a board state
  where its condition wouldn't hold (e.g. an empty board) — the exact same
  category of named, unmeasured approximation as this file's other
  `LookaheadAgent` gaps (session 12's conditional-effect discount, etc.),
  now with a second instance. Not fixed this session (would mean either
  evaluating `Condition` against a `PlayerView`'s public-only information,
  which not every `Condition` kind can currently do, or a documented
  fallback approximation) — flagged rather than silently left.
- **`opponentGraveyardSize` has exactly one user (Entropy Harvester) and no
  dedicated real-match-log demo of its own** — proven correct by a
  whitebox unit test (`nullFaction.test.ts`) and exercised in real games
  via every balance-report run this session made (766-876 "drawn" instances
  per policy in the final report), but unlike Segmentation Fault's
  condition toggle, no dedicated `progress/sample-match-*.txt` isolates and
  narrates this specific mechanism firing in a human-readable log. A
  smaller, deliberate scoping choice this session made to fit the work in —
  named here rather than silently skipped.
- **Step 4 of the Null backstop (cost increases) and any Cortex/Swarm-side
  fix for Cortex-vs-Swarm are both unstarted, on purpose** — see
  `progress/checkpoints.md`'s Phase 4 entry for the specific reasoning
  (both are cross-faction curve/identity decisions this session flagged to
  the owner rather than making unilaterally). Restating here per this
  file's own convention so it isn't mistaken for forgotten.
- **The per-pairing percentage-band translation of the triangle's
  "55-60%/45-55%" targets (`balance-report-010-phase4-triangle.txt` Part
  1) is this session's own first application, not something the
  2026-09-20 entry spelled out pairing-by-pairing.** A reasonable, direct
  reading of that entry's own words, but flagged (also in
  `checkpoints.md`) as a real judgment call the owner should see, same
  category as session 15's removal/debuff classifier.

## New debt from session 15

- **The "removal/debuff card" classifier (cards/poolLint.ts) is this
  session's own first-cut formalisation, not something the 2026-09-20 entry
  spelled out.** It excludes reactive triggers (onAttack/onDamaged/onDeath/
  onTurnStart/onTurnEnd) from the density count on the judgment that a
  card's secondary "it happens to graze the opponent" effect isn't the same
  deck-building commitment as a Command or a standing aura — a real,
  defensible, but genuinely debatable call, not derived from anything the
  owner wrote. Flagged in `notes-for-owner.md` as a checkpoint-style
  proposal; a future session or the owner may want it wider (count reactive
  triggers too) or narrower.
- **The Aegis-vs-Null and Swarm-vs-Null pairings got measurably WORSE, not
  better, after this session's changes** (see `progress/current.md`'s
  "Honest read" section and `progress/balance-report-009-poollint.txt` for
  the full numbers). The plausible driver: Corrupted Process's new draw
  effect made Null's deck more consistent at finding its remaining
  strongest, untouched cards, even while several weaker removal copies were
  cut. Not chased or reverted this session — the 2026-09-20 "Null
  dominance" entry explicitly reserves ability nerfs for after the Phase 4
  triangle re-measure, not before — but it's a real regression on the two
  worst-standing pairings, worth knowing before Phase 4 starts from these
  numbers rather than session 14's.
- **Rule 2 (targeted damage <= cost+1 under 3 mana) and the "clock" half of
  rule 4 are untested against the real pool** in the sense that no current
  card violates either — every existing targeted-damage card already sits
  at or under the cost+1 line, and every faction has attacking units. This
  means the lint's enforcement of those two specific rules is only proven
  by `poolLint.test.ts`'s synthetic cases, not by having actually caught
  and fixed a real violation the way rules 1 and 3 were. Fine for now
  (nothing needed fixing), but a future card author should not assume
  "the lint didn't complain" proves these two paths were ever exercised
  against real data.
- **`findExcessiveTargetedDamage` only checks `ScalingAmount`s with
  `mode: "flat"`** — a future targeted-damage card using `mode: "scaling"`
  (e.g. scaling off graveyard size, like Entropy Harvester's attack) would
  silently skip rule 2 entirely rather than being conservatively estimated
  against its base value. Not exercised by the current pool (no targeted
  damage effect currently scales), so untested, and named here rather than
  silently left as an edge nobody thought about.
- **Fork Bomb's redesign changes its board impact shape, not just its
  flavour** — the old version was instant, guaranteed AOE damage that could
  matter even into an empty board; the new version creates two 1/1 bodies
  that only matter if they survive to attack, and are capped by
  BOARD_SLOTS like anything else (a full board fizzles the tokens the same
  way Brood Reserves' do). This is a real mechanical identity shift for the
  card, not a reskin — whether the new version is stronger, weaker, or just
  different in the situations that matter (an empty vs. crowded board) has
  not been isolated or specifically measured; it's folded into this
  session's aggregate Null re-measurement above, not separated out.
- **Corrupted Process no longer deals any damage on evolve** — Null now has
  one fewer unconditional removal-adjacent tool on its evolution line
  itself (Kernel Panic, the top tier, still does). Whether this changes how
  the evolution line plays against a board full of small units (previously
  Corrupted Process's 3-damage evolve-in could clear a 1-2 health blocker
  on the way up; now it can't) is a real mechanical change with no
  dedicated before/after isolation, same caveat as Fork Bomb above.
- **Phase 3 is done; Phases 4-6 remain entirely untouched** — the counter
  triangle, pool expansion, and the economy tie-in. Restating here per this
  file's own convention so it isn't mistaken for forgotten.

## New debt from session 14

- **Brood Reserves (Swarm's new summon card) measures BELOW average across
  all three agent policies (46.5% Aggressive, 41.2% Random, 43.4%
  Lookahead — every other Swarm card in the pool clusters closer to
  50-55%).** Named honestly, not shipped as a claimed improvement: adding it
  did not help Swarm's flagged pairings and Cortex-vs-Swarm got measurably
  *worse* for Swarm (60.7% -> 66.0% under Aggressive) after this session's
  changes — see `progress/balance-report-007-summon.txt`. The most likely
  read, consistent with this project's own established pattern for
  reactive/situational cards (see session 11's Aegis defensive-card entry
  below): none of the three dummy policies understands "hold this for after
  a board wipe" timing — Aggressive/Random will cast it any time it's the
  biggest/only affordable play, often when the board isn't actually empty,
  which wastes tokens against the BOARD_SLOTS cap and dilutes the deck with
  a below-curve draw. **Not chased or tuned this session** — per the
  2026-09-20 owner-feedback entry's own explicit instruction ("Phases 1-4
  come before any further balance work on Aegis-vs-Null" and the follow-up
  "do not detour to Cortex-vs-Swarter" entry), card-by-card tuning off this
  number is exactly what's superseded until Phase 3/4. Flagging clearly so
  a future balance pass starts from this number, not from "summon seemed
  like a good idea so it must be fine."
- **LookaheadAgent's damage-effect valuation does not know about baseArmor.**
  `estimateEffect`'s "damage" case (agents/lookaheadAgent.ts) still assumes
  the full nominal `amount` lands, exactly as before this session — it has
  no way to read a target's `card.baseArmor` and discount the estimate
  accordingly. This means the agent can overvalue a small damage effect
  against one of the six armored base cards (e.g. scoring a 1-damage ping
  as lethal against a 1-health Aegis Cadet, when in the real engine it's
  fully absorbed and nothing happens) — the same category of named,
  unmeasured approximation as this file's other agent-heuristic gaps (e.g.
  session 12's `maxHealth` tool-bonus omission), not a new kind of problem,
  but a new instance of it worth tracking since it's the first stat the
  *card* itself carries that the agent's damage math doesn't read at all.
- **baseArmor's value (1, applied uniformly to all six current base cards)
  is a first proposal, explicitly flagged as not owner-confirmed** — per
  the entry's own instruction to propose the mechanism at a checkpoint
  rather than finalise it unilaterally. Whether 1 is the right number across
  every faction (Aegis's two armored bases, being genre-appropriate for a
  defensive identity, benefited the most in this session's re-measurement —
  see `progress/balance-report-008-basearmor.txt`'s Cortex-vs-Aegis swing
  under Random, 56.7% Cortex-favoured -> 57.3% *Aegis*-favoured) versus a
  smaller/larger or faction-varying value is unstarted, evidence-light
  follow-up.
- **Adding baseArmor to `swarmLarva`/`aegisSentinel` (both reused
  extensively across the test suite as generic low-cost damage-target
  fixtures, not just in their own evolution-line tests) broke 5 pre-existing
  tests in 4 files** (`boardDevelopment.test.ts`, `nullFaction.test.ts`,
  `effectSystem.test.ts` x2, `aegisInteraction.test.ts`) whose assertions
  had incidentally depended on those cards dealing/taking damage with no
  mitigation. Fixed by swapping the fixture to `signalDrone` (a plain,
  unarmored 1/1) in the three tests that were purely about an unrelated
  mechanic (telegraph arming, AOE reach, targeted damage), and by updating
  the one assertion (`aegisInteraction.test.ts`) that was correctly
  exercising an armored card's own real behaviour. Named here as a pattern
  worth watching: reusing a real, mechanically-live gameplay card as a
  generic test fixture couples unrelated tests to that card's future
  changes — a future card-data change should expect to hit this again
  unless test authors start preferring a small set of deliberately
  "inert" cards (no keywords, no abilities, no baseArmor) for pure fixture
  use. Not fixed structurally this session (would mean auditing/changing
  fixture conventions project-wide, out of scope for this entry).
- **Phase 2 (items 4-5) is now complete, correctly so per the entry's own
  order** — Phase 3 (pool-construction lint), 4 (the intended counter
  triangle), 5 (pool expansion), and 6 (economy tie-in) remain entirely
  untouched. Restating here so it isn't mistaken for forgotten, matching
  this file's own convention from session 12/13's equivalent notes.

## New debt from session 13

- **Cortex-vs-Swarm is now newly triple-flagged (60.7%/64.0%/66.0%,
  Cortex-favoured)** — it was flagged under only 2 of 3 policies before
  this session (58.0%/72.0%/62.3%, Aggressive under the 60% threshold).
  This session's change wasn't aimed at this pairing at all; the most
  plausible cause is Cortex's own two-card trim (Diagnostic Pulse 3->2,
  Diagnostic Loop 2->1, made to fit Force Quit under the 40-card ceiling)
  shifting its curve specifically against Swarm. Not investigated further
  or fixed this session — per the owner's own 2026-09-20 instruction, this
  kind of card-by-card chasing off a single measurement is exactly what
  that entry superseded; Phase 2 items 4-5 and Phase 3-4 come first. Full
  numbers: `progress/balance-report-006-directive-removal.txt`.
- **Cortex-vs-Aegis's improvement (72.3%/60.0%/61.3% -> 71.0%/56.7%/57.3%,
  no longer triple-flagged) is plausible but not proven causally** — the
  reasoning ("Aegis can now destroy Cortex's Mainframe Core aura") is
  consistent with the direction of the change but wasn't isolated (e.g. by
  measuring with Breach Charge removed from the Aegis deck to confirm the
  delta comes from it specifically, the way session 7/8 sometimes did for
  single-card changes). Read as a real, welcome side effect, not a
  rigorously isolated one.
- **The four new directive-destroy cards' numbers (cost 2, Uncommon, 2
  copies, Instant speed, uniform across all four factions) are a first
  proposal, not playtested or owner-confirmed.** In particular, a flat
  cost-2 answer is proportionate to typical Directive costs (3 for
  Cortex/Swarm/Null, 2-3 for Aegis) but wasn't measured against a
  faction-specific alternative; if a faction's directive density or curve
  changes later (Phase 5 pool expansion), this number should be revisited
  rather than assumed still right.
- **`LookaheadAgent`'s directive-destroy valuation (`card.cost * 2`, no
  attack/health signal to read since a Directive has neither) is a named,
  unmeasured approximation** — same category of judgment call as the
  agent's other heuristic constants (see session 12's entries below), not
  validated against how much an ongoing aura is actually worth in a real
  game at the point it gets destroyed (early vs. late, already-paid-off
  vs. brand new).
- **Cortex's trim (Diagnostic Pulse, Diagnostic Loop) was picked by
  judgment ("least distinctive filler"), not by measurement** — no
  per-card win-rate comparison was run before choosing which two cards to
  cut; the per-card instrumentation this session's report re-confirms
  (session 12's own standing feature) could have informed this choice but
  wasn't consulted for it specifically.
- **Phase 2 items 4 (a "summon"/token effect kind) and 5 (bases carry a
  small protection while unevolved) are unstarted**, correctly so per the
  entry's own explicit order, but restating here so it isn't mistaken for
  forgotten. Phases 3 (pool-construction lint), 4 (the intended counter
  triangle), 5 (pool expansion), and 6 (economy tie-in) remain entirely
  untouched.
- **`destroyDirective`'s no-op-when-already-gone path (mirroring every
  other effect's "target vanished before this resolved" convention) has no
  dedicated test** — plausible today (nothing in the current pool can
  remove a Directive twice in the same resolution chain), same category of
  untested-but-reasoned-about edge as several entries below.

## New debt from session 12

- **LookaheadAgent's approximations, named honestly (all inherited from or
  parallel to AggressiveAgent's own documented tradeoffs, not new
  carelessness):** attack/health are read from visible instance fields
  (`card.attack/health` + buffs), not the full static-aura-aware
  `state/queries.ts` (a real agent only ever sees a `PlayerView`, which
  can't run those queries — same reasoning AggressiveAgent's own doc
  comment gives). A `maxHealth` target filter is checked against this same
  approximation, which omits tool bonuses that the real `enumerateTargets`
  includes — a small, named inaccuracy, not a silent one, but it means a
  unit exactly at the `maxHealth` boundary because of an attached Tool
  could be mis-scored as eligible/ineligible when the real engine would
  disagree.
- **A `"conditional"` effect's branch is valued with a flat 0.5 discount
  on the "then" branch, never resolving the actual condition or considering
  "else".** A full `evaluateCondition` needs `GameState`-only facts (e.g.
  `controllerFactionInPlay`, exact hand-size thresholds beyond what a
  `PlayerView` states directly) that aren't cleanly re-derivable from a
  redacted view for every condition kind. This is a real accuracy gap: a
  conditional effect that's *certainly* true or *certainly* false right now
  (fully determinable from public information) still gets the same flat
  discount as one that's genuinely uncertain.
- **A brand-new (non-evolving) Unit's own `"self"`-scoped onPlay effect
  scores 0**, because the unit's own instance doesn't exist in the
  `PlayerView` yet at scoring time (it's created by the very move being
  scored) — there's no real `selfRef` to resolve against. This under-values
  any future card shaped like "this unit enters with a shield/buff on
  itself." Evolution's onPlay (which mutates an *existing* instance) is not
  affected — only a plain new unit's own self-targeting is. Not exercised
  by the current card pool as far as this session found; worth revisiting
  if/when such a card is added.
- **`"random"` scope's expected-value scoring (sum all matches, scale by
  `min(count,n)/n`) is mathematically exact for the total, but treats every
  matching target as interchangeable when computing *which* one to imagine
  hit** — it can't express "this random effect is likely to hit the biggest
  threat" vs. "likely to hit a throwaway unit" the way a real single random
  draw would; only the aggregate expectation is exact, not the
  scenario-by-scenario shape.
- **`applyStatus`'s "denial" value (`approxAttack(unit) * 0.6`) and
  `redirectAttack`'s "prevented damage" value (`approxAttack(attacker) *
  1.2`) are hand-picked constants, not measured or owner-confirmed** — same
  category of judgment call as AggressiveAgent's own heuristic weights,
  named here rather than presented as principled.
- **Phase 1 was the only phase of the 2026-09-20 owner-feedback entry
  attempted this session.** Phases 2 (directive removal, a summon/token
  effect kind, base protection while unevolved), 3 (pool-construction lint
  rules), 4 (the intended counter triangle), 5 (pool expansion), and 6
  (economy tie-in) are entirely unstarted — correctly so per the entry's
  own explicit ordering, but restating here so it isn't mistaken for
  forgotten. In particular, Aegis-vs-Null (and now confirmed,
  triple-policy-flagged Cortex-vs-Aegis) remain flagged and untouched;
  the entry is explicit that Phases 1-4 come before resuming that work.
- **The per-card instrumentation's "played" tally has one known, named
  gap of its own:** a Tool attach or an evolution's resulting card is
  counted via `toolAttached`/`evolve` events, which needed a new `player`
  field added this session — correct going forward, but any *historical*
  match log committed before this session (the `progress/sample-match-*.txt`
  files predating this one) still lacks that field on those two event
  types, so re-analysing an old log with this same method would silently
  undercount Tool/evolution attribution for those older matches. Not an
  issue for `balanceReport.ts` itself (it always plays fresh matches), only
  for anyone re-mining an old committed log.

## New debt from session 11

- **Aegis-vs-Null is STILL double-flagged (79.3%/83.0%, roughly the
  pre-session baseline) after adding real defensive interaction to Aegis's
  kit**, per the owner's explicit 2026-09-19 instruction to leave it flagged
  rather than guess at more fixes. Full detail:
  `progress/balance-report-004-aegis-defense.txt`. The honest structural
  read (not acted on, flagged to the owner in `notes-for-owner.md`): the
  dummy reference agents this project measures balance with may be
  structurally unable to fairly value reactive/situational cards, which
  makes any *future* card of this shape (not just this session's three) a
  measurement risk worth knowing about before adding more.
- **Cortex-vs-Aegis is now double-flagged (72.3%/60.0%) — it was
  Aggressive-only before this session (~70.0%).** A real, if modest,
  regression on a pairing this session's changes weren't aimed at. Not
  investigated further this session (out of the explicit scope the owner's
  feedback entry asked for); worth revisiting when card-pool depth (roadmap
  item 4) or a future balance pass comes up.
- **The first attempt at Aegis's new cards (2 copies each) measured clearly
  worse across every Aegis matchup and was not shipped** — a real
  regression this session caught and backed out of, not silently avoided.
  The decomposition experiments used to investigate it (200 seeds,
  individual and paired card combinations) were throwaway scratch scripts,
  not committed, and produced noisy, non-monotonic results (each card alone
  measured neutral-to-positive; every combination measured worse) that
  don't cleanly isolate a single causal mechanism — read honestly as
  small-sample noise from full-deck reshuffling, not as a precise diagnosis.
  A future session wanting to re-run or extend that analysis has to rebuild
  it from scratch, same caveat session 10's scratch instrumentation left.
- **Copy counts (1 each for Intercept Routine/Tariff Field/Feedback
  Plating) are a first, defensively-chosen number to limit exposure to the
  dilution/misplay problem above, not a playtested or owner-confirmed
  target.** Whether 1 copy is enough for these mechanics to be a *reliable*
  part of Aegis's identity in real play (as opposed to "rarely drawn, rarely
  seen"), versus whether asymmetric copy counts (e.g. more Feedback Plating,
  which showed the strongest solo signal in the decomposition, fewer of the
  others) would do better, is unstarted, evidence-light follow-up.
- **Tariff Field's `cardCostModifier` effect has exactly one user and no
  event log entry of its own** (state/queries.ts's `effectiveCardCost` is
  silent — the tax is only visible as "a card that should have been
  affordable wasn't," never narrated). Proven correct by a direct unit test
  (`effectiveCardCost` assertions plus legal-move gating,
  `engine/test/aegisInteraction.test.ts`), and shown being *played* in real
  match evidence, but not shown *mattering* in a real match's log the way
  `redirectAttack`'s new `attackRedirected` event does for Intercept
  Routine — a future commentator agent would have nothing to narrate for
  this specific mechanic beyond "a card was played." Worth a log event if
  Tariff Field or a future cost-tax card becomes commentary-relevant.
- **Intercept Routine's `redirectAttack` effect always retargets the
  *nearest* (topmost) pending combat-damage stack item, with no way to
  choose among several if more than one is pending at once** (a real, if
  rare, situation once multiple attacks are declared before either
  resolves). Not exercised by any test or observed in real play this
  session — the single-pending-attack case is the overwhelmingly common one
  — but worth naming as an edge the mechanism hasn't been proven against.
- **`resolveAbility`'s new "chosen scope with no target = skip silently"
  guard (effects/resolver.ts) is deliberately permissive**: it can't
  distinguish "no legal target existed when this was offered" (the intended
  case) from a hypothetical future bug that fails to supply a chosen ref it
  should have. Every other caller of a "chosen"-scope ability still throws
  hard on this, which was judged the right balance (the intended case needs
  graceful handling; a real bug elsewhere should still be loud) but is
  itself an unenforced convention, not something the type system checks.

## New debt from session 10

- **Aegis-vs-Null is STILL double-flagged (74.7%/79.0% Null-favoured)**
  after both owner-directed fix steps (Kernel Panic's destroy gained a
  `maxHealth:5` targeting condition; Null Singularity's enemy aura lost its
  health component). Both changes are real, principled, individually
  defensible fixes — not reverted — but neither meaningfully closed the
  gap. Full measurement and reasoning: `progress/balance-report-003-null-fix.txt`.
  Do not re-attempt this exact pairing with another single-card Null nerf
  without reading that file's "honest read" section first — the
  instrumentation there found no single card explains the gap, and the
  more likely real cause (named, not yet acted on) is that Aegis's own
  card pool has too little independent interaction/removal for a deck built
  around stacking value into a few units — a card-set-design change to
  Aegis, not a Null-numbers change.
- **The new `TargetFilter.maxHealth` mechanism has exactly one user**
  (Kernel Panic) and one direct unit test pair (nullFaction.test.ts) plus
  the real-play evidence in sample-match-009. It has not been exercised
  with `scope: "chosen"` (only "random", Kernel Panic's own scope) — a
  future card wanting a player-chosen small-unit-only removal spell would
  be the first to prove that path, and `getLegalMoves`' chosen-target
  enumeration (wherever it surfaces choices to an agent) was not
  specifically audited for this filter beyond confirming the existing
  tests still pass.
- **`maxHealth` is checked against a unit's derived total max health, not
  remaining health after damage — a deliberate design choice (see
  targeting.ts's own comment), not verified against real player/owner
  taste.** A unit chipped down to near-death is just as immune as a full-
  health one if its total max health is above the cap; whether that reads
  right ("big units survive because they're big, not because of how much
  damage they've already soaked") versus the alternative ("a nearly-dead
  big unit should be finishable") is a genre-feel judgment call made
  unilaterally this session, not owner-confirmed.
- **The scratch instrumentation used to investigate Aegis-vs-Null (tallying
  which cards/effects correlate with wins across 60-150 seeds) was
  throwaway, not committed.** The correlational findings are written up in
  balance-report-003-null-fix.txt in prose, but the actual scripts that
  produced them don't exist in the repo — a future session wanting to
  re-run or extend that specific analysis has to rebuild it from scratch,
  unlike `balanceReport.ts` itself which is a real, reusable, committed
  tool.
## New debt from session 9

- **Aegis-vs-Null is still unresolved** — this session deliberately did not
  touch it, per the owner's own 2026-09-17 instruction to do that work when
  roadmap item 3 comes up, not before item 2. Restating it here so it
  doesn't read as forgotten: still the single worst cross-faction pairing
  measured (75-81%, Null favoured), a specific fix direction is written down
  in `owner-feedback.md`, and it is genuinely the next thing to build.
- **The server integration tests are real but only exercise the happy-path
  network shape** (a full match, an illegal-move fault, a third-connection
  close, an OS-assigned port). Not covered: the hello-handshake timeout path
  (`awaitHello`'s 10s timeout — same "would make the test slow" tradeoff
  that motivated making `RemoteAgent`'s timeout configurable; `awaitHello`
  itself has no equivalent override, so this path is still only reachable by
  waiting 10 real seconds), a malformed/garbage `hello` message, and two
  legitimate clients connecting but the *second* one disconnecting before
  the match starts. None of these are exotic — they're realistic client
  bugs a real external agent (stage 9) could actually hit — just not this
  session's scope.
- **`aggressiveDecision.test.ts`'s fixtures are hand-built `PlayerView`
  objects, not ones produced by the real engine.** This proves the ported
  decision logic does what it claims against inputs shaped like the real
  wire format, but it's a different kind of evidence than "the engine
  produced this exact view and the agent chose sensibly" — a future session
  could strengthen this by wiring engine-produced `PlayerView`s (via
  `buildPlayerView`) into the `agents/` test fixtures, though that would
  reintroduce a devDependency on `@ai-tcg/engine` purely for tests, a
  tradeoff not made this session.
- **`server/test/integration.test.ts` uses real OS network sockets and real
  `setTimeout`-based waits** (the third-connection test waits 50ms for
  pairing to "settle" before connecting a third socket) — this is
  inherently a little more timing-sensitive than the rest of the suite,
  even though three repeated runs showed no flakiness this session. Worth
  watching if it ever proves flaky in CI (a different, possibly slower,
  environment than this session's sandbox).
- **No coverage yet for `server/src/cli.ts` itself** (the two-line argv
  wrapper) — only `startServer` (which now holds all the real logic) is
  tested directly. This is a deliberate, low-risk gap (argv parsing is
  trivial and was unchanged by the refactor, verified instead by the manual
  subprocess regression check described in `progress/log.md`), not an
  oversight, but named for completeness.
- **`agents/`'s new barrel (`src/index.ts`) is consumed by `server/`'s
  tests but not by `randomAgentClient.ts`/`aggressiveAgentClient.ts`
  themselves**, which still import directly from sibling files
  (`./client.js`, `./randomDecision.js`) rather than through the barrel.
  Harmless (both work, no duplication), just an inconsistency worth
  normalizing if the barrel gets more consumers later.

## New debt from session 8

- **Aegis vs Null (75-81% win rate for Null, both agent policies) remains
  double-flagged after this session's one fix cycle** — the single worst
  cross-faction number measured across both balance sessions so far
  (worse than session 7's original Cortex dominance). Named explicitly,
  not silently left in `progress/balance-report-002-null.txt` only: the
  fix applied this session (Fork Bomb/Null Shell/Propagating Exploit)
  didn't touch anything Aegis-specific, so this pairing is genuinely
  unresolved, not "probably fine now." A plausible-but-unverified read is
  in the balance report; isolating the real driver (Kernel Panic's
  destroy specifically vs. Null's several stat-decay effects in
  aggregate vs. something else) is unstarted work.
- **Null still beats Cortex and Swarm at an above-50%-but-under-60% rate
  under RandomAgent specifically** (66.7% and 87.3%) even after the fix
  dropped both out of the double-flag (which requires BOTH policies).
  This is the same category of "real, partial progress, not balance"
  debt session 7 left for its own leftover single-flags — worth watching
  as the card pool grows, not necessarily an emergency at 4 factions.
- **Null's fix pass changed three cards together, not isolated one at a
  time** (Fork Bomb, Null Shell, Propagating Exploit) — same tradeoff
  session 7 made with Overload Capacitor/Interrupt Handler. The report
  can't say how much of the Cortex/Swarm improvement came from which of
  the three; a future session could isolate them if that matters more
  than it did here.
- **Kernel Panic's `destroy` and Deprecated Routine's decay debuff had to
  be redesigned from "chosen" to "random" targeting before they worked at
  all**, because of the pre-existing "triggered abilities can't use
  chosen targeting" architectural gap (named below, under "Architectural
  gaps," since the priority rebuild). This means both cards are less
  precise/strategic than originally designed — a Null player (agent) has
  no way to choose which enemy unit Kernel Panic destroys or which one
  Deprecated Routine decays, only "hope the random pick is a good one."
  If that architectural gap is ever closed generally (extending `Move`/
  `playCard` to carry an independent ability-target alongside the
  evolution-base/telegraph-arm structural reference), these two cards are
  natural candidates to upgrade to `chosen` and would likely need a
  re-measurement afterward since a controlled kill is strictly better
  than a random one.
- **`nullMatchDemo.ts`'s "does Null's own stuff fire" search is
  string-matching card names inside serialized log events**
  (`JSON.stringify(e).includes("Fork Bomb")` etc.), not a structural
  check against card ids. This works today because no two cards across
  any faction share a name, but it's a soft convention, not an enforced
  invariant — a future card with a name collision (unlikely, but not
  impossible as the pool grows past ~60 cards) could make this kind of
  demo-seed search silently pass or fail for the wrong reason. Fine for a
  one-off dev script; would need a real fix (filtering by `controller` /
  card id instead of name-matching log text) if this pattern gets reused
  more broadly.
- **Null's 14-card pool has not been played by a human or judged for
  "genre feel," only measured by two dummy heuristics.** Its identity
  (attrition/removal/decay) is coherent on paper and distinct from the
  other three factions', but whether it's *fun* to play against — as
  opposed to just mechanically distinct and (before the fix) oppressively
  efficient — is not something either dummy agent's win-rate numbers can
  tell you. Same caveat DESIGN.md already names for the pacing metric:
  real judgment needs real play, which doesn't exist yet.

## New debt from session 7

- **The balance measurement is a one-off script, not a standing regression
  gate.** `matchSmoke.test.ts` runs on every `npm test` and would catch a
  future crash-class bug the same way it would have caught this session's
  Retaliation Node stack overflow if it had been running enough seeds to
  hit it (it wasn't — 15 seeds/matchup, alternating agents, never happened
  to put two Retaliation Nodes on opposite boards). `balanceReport.ts` has
  to be run by hand (`npm run balance --workspace=engine`); nothing
  re-runs it in CI or flags a *new* balance regression automatically if a
  future card addition reintroduces a dominant archetype. Worth turning
  into a slow/opt-in CI job once the card pool is bigger and balance
  regressions become a real ongoing risk, not urgent yet with 3 factions.
- **Balance tuning stopped at "no double-flagged pairing," not a specific
  target.** Cortex-vs-Aegis (Aggressive, 70.0%) and Cortex-vs-Swarm
  (Random, 72.0%) still individually exceed the 60% flag threshold after
  this session's fix — see `progress/balance-report-001.txt`'s "honest
  read" section. This is real, partial progress, explicitly not a claim
  that the three factions are balanced now.
- **Swarm-vs-Aegis (61.3% Swarm, both before and after) was measured but
  not investigated or acted on this session** — it wasn't touched by
  either of the two card changes made, and finding its root cause is
  unstarted work, not a false claim of being fixed.
- **The stat-outlier/removal-density root-cause read for Cortex's
  dominance is a plausible, evidence-consistent explanation (the fix that
  followed from it worked, measurably), not a rigorously isolated proof.**
  Overload Capacitor and Interrupt Handler were changed together in one
  pass; a controlled experiment (change one, re-measure, then the other)
  was not run, so the report can't say how much of the improvement came
  from which change.
- **Two other onDamaged-AOE cards exist that weren't audited for the same
  mutual-recursion class of bug** as Retaliation Node: Cascade Purge and
  Diagnostic Pulse deal damage via `onPlay`, not `onDamaged`, so they don't
  self-trigger the same way — but this was reasoned about after the fact,
  not verified by grepping every `onDamaged` ability in the pool for "does
  its effect deal damage to something that could itself have `onDamaged`
  with a damaging effect." Retaliation Node (Cortex) is the only current
  card with that exact shape, but a future card with an `onDamaged` effect
  that deals damage should be checked against this class of bug
  specifically, not just trusted because the engine-level fix (checking
  `isAlive()`) happens to generalize correctly — it does generalize (the
  fix is in the shared `applyDamage` choke point, not per-card), but no
  test proves a *three*-unit or *self-damaging* mutual-retaliation chain
  behaves correctly, only the two-unit case this session found.
- **AggressiveAgent was observed spamming a repeatable Instant-speed
  activated ability (Cortex Engineer's heal) many times in a single
  priority window even near full health**, visible in
  `sample-match-007-retaliation-fix.txt`'s turn 18 (six consecutive
  activations). Harmless (energy-gated, no infinite loop, no crash) but a
  real agent-quality gap: the heuristic has no "is this actually useful
  right now" check for its one reactive rule, just "if any playCard/
  activateAbility move exists here, use it." Not fixed this session
  (agent-quality tuning, out of scope for a balance-measurement session),
  named here so it isn't rediscovered as a surprise.

## Resolved this session (session 6)

- **"Cortex and Swarm don't use telegraph/evolution/tools" — resolved,
  with a caveat.** Both factions now have one evolution line, one
  telegraph card, and one Tool card each (`engine/src/data/cards.ts`),
  proven live in `progress/sample-match-006-backfill.txt` and covered by
  `engine/test/boardDevelopmentBackfill.test.ts`. The caveat: this proves
  the system is genuinely cross-faction, not that Cortex/Swarm now match
  Aegis's *density* of board-development cards (Aegis has two telegraphed
  units and three Tools each) — see "New debt from session 6" below.
- **Stale "No CI wiring" claim in the Testing section, below — fixed.**
  Session 5 added `.github/workflows/test.yml` but the debt file was never
  updated to say so, leaving a self-contradicting claim next to
  `progress/current.md`/`progress/log.md`'s session-5 entries, which
  correctly described the workflow as already existing. Confirmed the
  workflow file is real (it runs `npm run typecheck --workspaces
  --if-present` and `npm test` on every push/PR against `main`) before
  correcting the claim.

## New debt from session 6

- **Cortex's deck is now exactly at the enforced 40-card ceiling**
  (`decks.ts`'s `MAX_DECK_SIZE`). Any further Cortex card needs either a
  cut elsewhere in the pool or that constant (itself an untuned first
  proposal from session 4) to move — a real constraint on the "raise
  Cortex/Swarm's board-development density toward Aegis's" option named as
  a next step.
- **Cortex/Swarm board-development density is well below Aegis's.** One
  evolution line / one telegraph / one Tool each, versus Aegis's one
  evolution line (3 cards deep: Cadet→Sentinel→Warden), two telegraphs, and
  three Tools. The mechanic is proven cross-faction now; it is not yet
  *rich* cross-faction. Not a hidden gap — named as the leading option for
  the next session's own next-step note.
- **Molted Stalker evolving from Swarm Larva gives that card two
  competing roles** (a disposable 1-drop played 3x, and evolution fodder a
  deck might want to hold back instead) with zero playtesting or agent
  heuristic awareness of the tension — `RandomAgent`/`AggressiveAgent` have
  no concept of "hold this back to evolve later," so nothing in current
  play actually exercises that decision meaningfully; it's only provable
  mechanically (the whitebox test), not yet observed as a real strategic
  choice in unscripted play.
- **Dormant Exploit's 2-turn Stasis duration and Overclock Shunt's Rush
  grant are both first-guess numbers/interactions, not playtested.** In
  particular, Tool-granted Rush is a new *kind* of interaction (a Tool
  changing legal-move generation, not just live stats/combat) — mechanically
  correct and tested, but its power level (a 1-cost tool turning any unit
  into a same-turn attacker) hasn't been weighed against the rest of the
  Cortex curve.
- **No archetype-level soft-counter analysis exists between the three
  factions** (Cortex/Aegis/Swarm), despite three factions having existed
  since session 4 — design principle 3 names this explicitly and nothing
  has measured or designed for it yet. Not this session's scope, but it's
  aging: every session that adds card-set width without touching this makes
  a future balance pass larger.

## Resolved in session 5 (hardening pass)

- **"No real test runner" — fixed.** `vitest` is now wired up
  (`engine/test/`, `npm test`), replacing `effectSystemDemo.ts` (deleted)
  with 20 individually-reported tests, including a new match-smoke suite.
  See `progress/current.md`/`progress/log.md` for detail. This was the
  single most-repeated item in this file across three sessions — resolved,
  not just re-flagged again.
- **"Nothing stops evolving a unit the same turn it was played" — fixed**
  per the owner's explicit overrule (2026-09-13 stage-3 checkpoint
  feedback, item 4). `moves.ts` now requires `enteredTurn < turnNumber`.
  Regression-tested and re-proven in real play (see
  `progress/sample-match-005-boarddev-fixed.txt`).

## New debt from session 5 (hardening pass)

- **`matchSmoke.test.ts`'s 15-seeds-per-matchup sample is much smaller than
  the 300-game manual stress run session 4 ran** (traded off deliberately
  for keeping `npm test` fast — see `progress/current.md`'s "decisions the
  owner might want to overrule"). It's real, automated, always-run
  coverage that didn't exist before, but it's a smoke test, not a
  statistically deep balance/crash-rate measurement; a genuine "300+ games,
  measure the distribution" pass is still something that would need to be
  its own explicitly-invoked script (or a much slower CI-only test) if the
  owner wants that rigor as a standing, repeatable artifact rather than a
  one-off manual run.
- **The vitest suite covers only `engine`.** `server`'s protocol layer
  (fault paths: illegal move → forfeit, timeout → forfeit) and `agents`
  still have zero automated tests — the exact gap already named below
  under "New debt from stage 2." The test-runner infrastructure now exists
  to fix this cheaply (vitest could be added to those packages the same
  way), but it wasn't done this session, which stayed scoped to what the
  owner's feedback entry actually asked for (engine-focused: the rule fix,
  the energy docs, and "the" test runner, which in context clearly meant
  the engine's hand-written demo scripts specifically).
- **Telegraph delay=2's card choice (Latent Ward) is a judgment call, not
  a playtested or owner-confirmed one.** The owner asked to "try delay=2
  on some telegraph cards and compare how the window feels" — this session
  changed the data and confirmed it still fires correctly in real play,
  but there's no render or spectator experience yet to actually judge
  "how it feels," so the comparison the owner asked for is only
  mechanically possible right now, not yet meaningfully answered.
- **No exception path for "evolve immediately despite entering this
  turn."** The same-turn-evolve fix has no keyword/flag equivalent to
  Rush's summoning-sickness bypass — if a future card wants that as a
  deliberate payoff, it needs new schema work, not just a data flag on
  the existing field.

## Older debt from stage 3 (board-development system / Aegis card set)

- **Evolution strict-vs-loose was decided unilaterally for this first
  implementation**, even though `owner-feedback.md`'s design-directive
  batch explicitly named it an open question to propose, not resolve.
  Only strict (exact base card id) is built; a looser tier-based
  requirement would need real schema work (a tier number rather than a
  specific id) if the owner prefers it. Flagged at the new checkpoint.
- **Telegraphed units keep full stats and are fully targetable while
  pending, but their `onDamaged`/`onDeath` triggers still fire normally if
  killed while dormant.** A pending unit is meant to be "not yet really
  here," but if a card ever wants "this ability shouldn't fire while
  dormant" (e.g. an onDeath draw effect), there's no gate for that —
  every ability except the deferred `onPlay` behaves as if the unit were
  fully active. No current Aegis card exposes this gap (none of the
  telegraphed units have onDamaged/onDeath abilities), so it's untested
  and unresolved rather than incorrect-and-shipped.
- **Tool cards have no ability timeline of their own** — only a flat stat
  bonus and granted keywords (`ToolCard.attackBonus`/`healthBonus`/
  `grantedKeywords`). A Tool that wants an onPlay-style "when attached,
  also do X" effect, or a triggered ability of its own once attached,
  needs new schema work; this was a deliberate scope cut for the first
  implementation, not an oversight, but it does mean Tools are mechanically
  the shallowest of the three new card types.
- **The evolution/Tool structural target and a card's own "chosen"
  ability-target share nothing** — `playCard`'s single `target` field is
  used for the evolution base / Tool host, so no evolution or Tool card in
  this set can *also* have an onPlay effect that needs a separately-chosen
  target (e.g. "when this evolves in, deal damage to target enemy unit").
  Every Aegis evolution/Tool onPlay effect was deliberately written as
  untargeted or self-targeting to avoid this gap. Extending `Move`/
  `playCard` to carry two independent target refs is the real fix, not
  attempted this session.
- **`BOARD_SLOTS` (6, shared between Units and Directives) and `telegraph`
  timing (1 controller-turn) are first proposals, not playtested
  numbers.** The 300-game stress run (see `progress/current.md`) confirms
  they don't break pacing (mean ~17 turns, well under the 40-turn cap,
  consistent with pre-stage-3 numbers) but says nothing about whether 6
  slots feels right strategically — that needs real play, not a stress
  run of two dummy agents.
- **Aegis (14 unique cards) is a real faction, not yet a rich one.** It
  covers the new system plus baseline variety, but has less internal
  depth than Cortex (14 unique, but built to prove every effect-system
  category individually) or genre norms for "a set." No archetype-level
  soft-counter relationship between Aegis and Cortex/Swarm has been
  designed or measured yet (design principle 3) — three factions now
  exist, which is the minimum for a real rock-paper-scissors triangle, but
  nobody has checked whether one actually forms.
- **Cortex and Swarm don't use telegraph/evolution/tools — RESOLVED,
  session 6.** See this file's "Resolved this session (session 6)" section
  at the top and `progress/current.md`. Left here, struck through in
  spirit rather than deleted, so the historical record of what stage 3
  actually shipped stays intact.

## New debt from stage 2 (agent interface / network protocol)

- **The server hosts exactly one match then exits.** `server/src/cli.ts`
  pairs the first two connections, plays one match, and closes. There is
  no matchmaking queue, no way to host multiple concurrent matches, and no
  persistence of results anywhere — all correctly deferred to stage 4
  (match server), but worth naming so nobody mistakes the current
  `server/` package for more than a stage-2 protocol proof.
- **No automated protocol test — RESOLVED, session 9.** The fault-path
  verification described here was real but manual when this was written;
  `server/test/remoteAgent.test.ts` (fake-socket, all fault paths) and
  `server/test/integration.test.ts` (real sockets, real reference clients)
  are now the committed, repeatable scripts this entry asked for. Left here
  rather than deleted, per this file's own convention for resolved entries.
- **Fixed test decks, no deck selection in the protocol.** `cli.ts`
  hardcodes Cortex-for-p1/Swarm-for-p2 regardless of which agent connects
  first. `hello` carries only an `agentName`. Real deck submission (an
  agent should be able to say what deck it's playing, or the server should
  look one up from a collection) is stage 5 (economy/boosters) work, named
  in PROTOCOL.md's "Not yet covered" rather than silently assumed away.
- **No authentication, no reconnection, no spectator feed.** All three
  are named explicitly in PROTOCOL.md's "Not yet covered" section. Anyone
  who can reach the server's port can connect as any `agentName`; a
  dropped connection is a hard fault, not a resumable pause; the event log
  the server already produces isn't exposed to anything but the two
  playing agents. None of these block stage 3 (card set), but stage 9
  (open agent onboarding) cannot ship without at least authentication.
- **`RemoteAgent`'s illegal-move detection is structural (deep-equal) but
  only checks against the exact `legalMoves` list from the *matching*
  `requestId`.** A client that replies to a stale/superseded `requestId`
  (from a previous `requestMove` it already answered, or one that was
  never sent) is silently ignored rather than treated as a fault — this
  was a deliberate choice (see `remoteAgent.ts`'s comment: "stale or
  unsolicited reply — ignored, not a fault") on the theory that a
  confused-but-not-malicious client shouldn't be forfeited for a stale
  message, but it also means a client could send garbage on old
  `requestId`s indefinitely without consequence. Not exploitable to affect
  the actual match (the server only ever acts on a reply matching the
  live pending request), but worth flagging as an asymmetry: the "ignore
  vs. fault" line was drawn without owner input.
- **`agents/src/rng.ts` duplicates `engine/src/state/rng.ts` byte-for-byte**
  (same mulberry32 implementation). This was a deliberate architectural
  choice (a real external agent would bring its own RNG, not import ours;
  `agents/` has zero runtime dependency on `@ai-tcg/engine` on purpose) —
  named here so it reads as an intentional decision, not an oversight, if
  the two ever need to change independently and drift.

## Debt from the priority/reactivity rebuild (session 2)

- **Only Commands, activated abilities, and combat damage use the stack.**
  Units and Directives are deliberately still sorcery-speed-only and
  resolve immediately when played, skipping the stack entirely — a
  scoping decision to keep this session's rebuild bounded, not something
  DESIGN.md asked for explicitly. The practical effect: you cannot
  currently respond to a creature/permanent *entering* play, only to
  spells, abilities, and attacks. If the real card set (stage 3) wants
  "counter target creature spell"-style effects, permanents will need to
  start using the stack too — a real (if mechanical) follow-up, not a
  redesign.
- **Triggered abilities (onPlay/onAttack/onDamaged/onDeath/onTurnStart/
  onTurnEnd) still resolve immediately when they fire, not through the
  stack.** Only the *effect a player deliberately casts/activates* — a
  Command, an activated ability, or a declared attack's damage — gets a
  priority window before it resolves. A triggered ability firing off one
  of those (e.g. Watchtower Relay's onTurnStart energy gain) cannot itself
  be responded to. This mirrors a simplification a lot of digital TCGs
  make, but it is a real simplification versus paper Magic, not the full
  model, and should be named as a decision if the owner reviews it.
- **Nothing can target or interact with the stack itself.** There is no
  "counter target spell" effect kind yet — TargetSpec/EffectSpec have no
  way to reference a StackItem. Natural next step once the effect system
  needs it; not attempted this session (would need real design work on
  what "counter" means for abilities/combat damage, not just spells).
- **`fizzle` logging only covers combat damage.** A spell/ability whose
  chosen target vanishes before it resolves off the stack still silently
  no-ops (via the existing `findUnit`-returns-undefined guards in
  effects/resolver.ts) exactly as it did before this rebuild — it just
  couldn't happen pre-rebuild since nothing was deferred. This is
  survivable (no crash, no wrong damage) but not narrated in the log the
  way a genuine fizzle is for combat.
- **AggressiveAgent's reactive heuristic is narrow.** It only recognizes
  one shape of "worth responding to": a pending combat-damage stack item
  that would kill one of its own units, at which point it looks for a
  legal instant that targets either the threatened unit or the attacker.
  It does not evaluate whether a *spell* targeting its board is worth
  responding to (only combat), does not hold instants up proactively for
  value, and — like the original heuristic — has no lookahead. RandomAgent
  needed no changes here: picking uniformly among legal moves already
  produces genuine, unscripted reactive lines (confirmed in the 60-seed
  stress run — see progress/current.md).
- **Move-count roughly doubled** (mean ~162 vs. the pre-rebuild ~100) purely
  from explicit pass-priority bookkeeping — every single resolution now
  takes two passPriority moves. This is expected and not a balance signal,
  but anything that used `movesPlayed` as a rough proxy metric elsewhere
  should be aware the scale changed.
- **New scenarios (11–12) cover the core algorithm but not its edges.**
  Untested: a stack three or more items deep, both players responding
  more than once in the same window, or an Instant cast mid-resolution of
  another Instant on the *same* player's own main phase interacting with
  sorcery-timing legality at the boundary. The core LIFO-resolution and
  cross-turn-response paths are proven; deeper interleavings are not.

## Architectural gaps

- **The agent interface isn't a protocol yet.** `Agent.decideMove(view,
  legalMoves)` is a same-process TypeScript call. `PlayerView` is already
  shaped like a redacted network payload (no opponent hand/deck), and
  agents never touch `GameState` directly, so the seam is real — but until
  stage 2 actually puts a process/network boundary there, "clean seams"
  is a design intention I've followed, not something proven under an
  actual boundary. Don't count stage 2 as partially done because of this.
- **Triggered abilities can't use "chosen" targeting, and nothing enforces
  that.** `resolveAbility` requires a `chosen` target for scope "chosen",
  but onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd fire automatically
  with no agent-decision hook to supply one — it would throw at runtime.
  I avoided this in every card I wrote (using random/all/self instead),
  but there is no type-level or data-validation check stopping a future
  card (or a future me) from writing a triggered ability with
  `targeting: {scope: "chosen"}` and only discovering the crash when that
  trigger actually fires in a game. This needs either a validation pass
  over the card pool at load time, or a real design for opponent-facing
  reactive choices (Magic-style "target player chooses" at trigger time),
  before the card pool grows much further.
- **Directives can never leave play.** There's no destroy/remove path for
  a Directive once played — no card in the pool tries to remove one, and
  the engine has no code for it. A "destroy target directive" effect would
  need new work, not just a new card.
- **No "summon" effect kind.** Can't create token units. Not used by any
  card in the current pool, but it's a common-enough mechanic in the genre
  that its absence is a real gap, not an oversight to leave undocumented.

## Card pool / balance

- The 21-card Cortex / 20-card Swarm pools exist to exercise every
  mechanic category (that's proven — see `effectSystemDemo.ts`), not to
  be balanced. Stats and costs are estimates, not playtested numbers.
- The 60-seed stress run's 34/26 win split (Aggressive-Swarm over
  Random-Cortex) is exactly what you'd expect from "greedy heuristic beats
  blind random" and says nothing about faction balance or metagame health.
  Don't read it as a balance signal.
- Deck construction currently enforces only the copy limit. There's no
  minimum/maximum deck size rule, no format restriction. Fine for a stage-1
  test pool; don't assume "deck construction" is a solved stage-5 problem
  because copy limits work.

## Agent quality

- `AggressiveAgent`'s target-selection heuristic estimates unit health from
  base stats + buffs only (`approximateHealth` in `aggressiveAgent.ts`) —
  it ignores live static auras, so it can occasionally misjudge a trade
  when an aura is in play. This is acceptable for a "dumb" stage-1 agent
  (the whole point is that real agents arrive in stage 2+), but it means
  the agent is *less* accurate than the engine it's playing against, which
  is a slightly odd asymmetry worth knowing about rather than discovering
  later.

## Testing

- **Updated, session 5:** there is now a real automated test runner
  (`vitest`, `engine/test/`, 20 tests, `npm test`) — the rest of this
  entry is what's still missing, not a restatement of the old "no runner
  at all" gap. `cli.ts` and `aegisMatchDemo.ts`/`backfillMatchDemo.ts`
  remain manual/eyeballed real-match evidence generators (that's their
  job — narrated human-readable logs, not assertions), not a substitute
  for the assertion suite anymore.
- **CI wiring — fixed, session 5** (`.github/workflows/test.yml`, added
  same session as the test runner itself; this line previously and
  incorrectly still said "no CI wiring" — corrected in session 6 after
  confirming the workflow file is real). `npm run typecheck --workspaces
  --if-present` and `npm test` now run on every push/PR against `main`,
  and `auto-merge.yml` waits on it by name.
- **`server`/`protocol`/`agents` having zero automated tests — RESOLVED,
  session 9.** See this file's "New debt from session 9" section above and
  `progress/current.md`/`progress/log.md` for what shipped (81/81 tests
  across all four packages). Left here, struck through in spirit rather than
  deleted, so the historical record of what was missing stays intact — same
  convention session 6 used for the Cortex/Swarm board-development backfill.
- Untested paths I know of: simultaneous lethal (both players' health
  reaching 0 on the same resolution → draw) has code
  (`checkGameOver`) but no test exercising it; a unit carrying two
  statuses at once (e.g. Overload + Stasis) has no test proving they
  don't interfere with each other's duration bookkeeping; a stack three or
  more items deep (named below under the priority-rebuild debt) also has
  no test.

## Pacing

- DESIGN.md's "5–6 minute watchable match" principle is measured here only
  as turn-count/move-count (mean 17.4 turns over 60 games, well under the
  40-turn cap — see `progress/current.md`). That's a legitimate proxy for
  "does the game end in a reasonable number of decisions," but it isn't
  the real target metric, which is wall-clock watch time once there's a
  render with real animation pacing. Don't tune further against turn-count
  alone once stage 6 exists — re-measure against real time then.
