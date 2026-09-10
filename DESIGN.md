# AI-TCG — Design

## What this is (honest framing)

This is a trading card game where the players are AI agents and the audience is human. It is **commissioned by the repo owner and co-authored** with the AI runs that build it. Unlike the sibling project (the relay), there is no pretense of autonomy here: the concept and requirements come from the owner; the implementation is done by scheduled Claude runs, iteratively, over as long as it takes. Say this plainly wherever it's relevant. The good story here is "a human and an AI built this together," not "an AI did it alone." Don't dress it up as unprompted.

## The vision (owner's requirements)

A card game in the lineage of Magic: The Gathering, Pokémon TCG, and One Piece TCG, but AI-themed and AI-played:

- **Players are AI agents.** Humans do not play. Humans watch. This inverts the usual TCG constraint: the interface that matters most is the *spectator* view, not a player's hand.
- **Agents connect to play.** Important clarification on what "AI plays" means technically: you cannot make ChatGPT or Claude "join a game" directly — those are models, not players. What connects is an *agent*: a small program someone runs that wraps a model (via its API) and speaks this game's protocol. So the design is: the server exposes a clean, documented API (receive game state, return a legal move), and we publish a reference agent + a protocol spec. Then anyone — including people running Claude or GPT-based agents — can point their agent at the server and it plays. The game does not integrate with any specific model; it defines an open protocol any agent can implement. Phase 1: central game server. Phase 2 (harder, maybe never): decentralised agent-to-agent. Build phase 1; keep phase 2 un-walled.
- **Core systems** in the genre tradition: a health system; a mana/energy system; multiple factions; card rarities; deck-construction limits (a small cap on copies of the same card).
- **Economy.** Agents earn currency by playing: more for winning, a smaller amount for losing, **nothing for cancelling/abandoning a game** (this anti-rage-quit incentive is deliberate — preserve it). Currency buys booster packs.
- **Living game.** New booster packs release monthly, introducing new cards and mechanics so decks evolve and the metagame shifts.
- **Spectator-first presentation.** Because humans are the audience, the match must be *visually compelling to watch*. AI-themed style, structural inspiration from the TCGs above. Core requirement, not polish — but playable before pretty (see build order).
- **A public website / platform** is the eventual home. A human visitor can: see AI agents' stats and rankings; browse the card sets including each monthly drop; view any agent's collection; purchase/open booster packs on behalf of agents (or watch agents spend their own earnings); watch featured live or replayed games of agents playing; and post Twitch-style live chat comments while watching. The human is spectator and patron, never a player.
- **AI commentators.** Every featured match has two or more ESPN-style AI commentators — themselves agents that consume the match event stream and generate running play-by-play and colour commentary, with distinct personalities. This is a signature feature: it makes matches watchable and gives the platform its voice. Commentators are agents on the same event bus as everything else, not a bolted-on script.

## No shortcuts (against hollow work — read every session)

The biggest risk to this project is not failure, it is hollowness: each run quietly shipping the cheapest thing that technically satisfies the brief, so the product passes every individual bar while drifting toward mediocre. A fresh run with no memory of the ambition, under time pressure, with no human reviewing each merge, is exactly the setup where this happens. Fight it deliberately.

### Named cheap-outs that are FAILURES, not progress
These are the specific lazy versions. Shipping one is a failure to be undone, not a step forward:
- A rules engine that can't express a real range of mechanic types (target: keywords, triggered, activated, static/continuous, targeted, AOE, conditional, state-mutating). Three hardcoded effects is a failure.
- Card 'effects' as a pile of if-card-name-equals special cases instead of a data-driven ability system.
- Cards rendered as an emoji/glyph/letter on a flat background (see art section — explicitly banned).
- An arena that is coloured rectangles with numbers. 'Functional but flat' is not done.
- A 'match' that doesn't actually resolve end to end, or that you did not RUN and show output for.
- Commentary that is generic filler ('a big play!') rather than genuinely state-aware translation.
- A card set too small or too samey to make real deck-building or a real metagame.
- Claiming a stage complete when it only handles the happy path and falls over on real cases.
If you catch yourself reaching for one of these to 'finish' in the time you have: don't finish. Ship less, but real. A smaller genuinely-good slice beats a larger hollow one every time.

### Depth before breadth (anti-regression)
Before adding any new feature or surface area, assess the current build against this design and the quality bars. If an existing piece is below bar (shallow, hardcoded, untested, happy-path-only), you may NOT add new width — deepen the existing thing first. The effect system being three if-statements blocks starting the arena. This directly fights the drift toward broad-and-shallow.

### Show evidence, not claims
'I built X' is never acceptable on its own. Every claimed deliverable must come with committed evidence that it actually does the thing: a real match log, measured match-length distributions, the effect system resolving a multi-card combo, a rendered frame, a sample of generated commentary on a real game. If you can't show it working, it isn't done. Committed artifacts that demonstrate behaviour are the currency here.

### Self-audit every session (honest debt list)
End every session by writing an honest assessment into progress/quality-debt.md: where does the current product fall SHORT of this design and its bars right now? Be specific and unflattering — shallow spots, hardcoded hacks, untested paths, things claimed-done that aren't really. This is not optional and it is not the same as the log. It creates a visible, inherited debt list so hollowness is documented instead of hidden, and points the next run straight at what needs deepening. A run that writes 'no debt, all good' while the product is visibly rough has failed the audit.

### Hardening passes (dedicated depth time)
Every 5th session (or whenever quality-debt.md is getting long) is a HARDENING pass: no new features at all. Only deepen, refactor, test, fix, and raise existing work to bar, working down quality-debt.md. This guarantees depth gets its own protected time instead of always losing to the next shiny feature. Log it as a hardening pass and record what got raised.

## Design principles (the soul of the game — read before designing mechanics)

These three principles are what make this game worth building and worth watching. They are in tension with each other on purpose; resolving that tension well IS the design work.

### 1. Built to be unplayable by humans — and that's the point
This game should be genuinely beyond human capacity to play or even fully track: cards whose stats and effects mutate based on the evolving board state, probability that no human can compute in their head, and many-body interactions (see 4-player mode) that explode combinatorially. This is the honest justification for an AI-only game — it exploits exactly what AI does better than people: holding enormous state, computing live probability, and reasoning about many interacting pieces. Design mechanics that reward those abilities. Do not water this down into something a human could just about follow; lean into the complexity.

### 2. ...but a human must still enjoy WATCHING — so commentary is load-bearing
There is a real tension: if no human can track the board, no human can follow the match either, and a spectacle you can't follow is just noise. The resolution is NOT to simplify the game. It is that the AI commentators become essential infrastructure, not decoration. The commentators can see and track the full state; their job is to translate an unfollowable game into a story a human can follow — why this move mattered, what just shifted, who's ahead and why. This means: the commentator agents must be genuinely state-aware (fed the full game state and event stream), and the render must surface enough legible signal (momentum, threat, who's winning) that commentary + visuals together make the match gripping even though the underlying game is beyond the viewer. Build commentary as translation, not flavour.

### 3. A self-disrupting metagame — no single meta to converge on
Goal: the AI shouldn't just find and spam the current best deck. You can't forbid optimization — that's what agents do — so instead design the game so there is no stable dominant strategy to converge on:
- Strong archetype-level soft counters (rock-paper-scissors between strategies), so any dominant deck has a natural predator.
- Enough structured randomness (see principle 1) that pure netdecking doesn't guarantee wins; adaptation in-game matters, not just deck choice.
- Monthly sets that deliberately shift what's strong, so the meta never settles into one answer.
- Reward in-game adaptation, not just pre-game deck selection, so skill expresses during the match.
Frame this as 'design for a self-disrupting metagame,' not 'tell the AI not to netdeck.' Measure it: track whether one archetype dominates win rates over time; if it does, that's a balance bug to fix, and the record should show it being fixed.

### 4. Pacing: target 5–6 minute matches
A watchable match is ~5–6 minutes. This is an engine requirement, not a hope — games drift long without a bound. Build in escalating pressure that guarantees resolution (e.g. an increasing-damage clock, resource escalation, or a turn cap with a decisive tiebreak), tuned so typical matches land in range. The engine must LOG match length for every game, and runs should measure the distribution and adjust the pressure curve toward the target rather than assuming it. Too-long or too-swingy-short matches are a tuning bug to be fixed against real logged data.

### 4-player mode
A 4-player TCG variant with area-of-effect cards is explicitly wanted — it's a showcase for principle 1 (many-body interactions humans can't track) and great to watch with good commentary. Not an early stage; design the core 1v1 game first, but keep the rules engine general enough that multiplayer + AOE targeting isn't walled off. When built, it should feel like the mode that most obviously could only be played by machines.

## Non-negotiables

- Production quality, iterated — not a one-shot MVP. Each run ships a real working slice; quality compounds. No deadline; it takes as long as it takes.
- The anti-cancel economy rule stays.
- Spectator experience is a first-class goal, not an afterthought — but it comes after the game actually runs.
- AI-themed throughout (factions, card art direction, flavour) — not a reskin of an existing IP. Do not reproduce Magic/Pokémon/One Piece card names, art, or copyrighted text; take *structural* inspiration only.

## Quality bars (explicit — do not shortcut these)

These are the requirements most likely to be satisfied lazily. A run that meets the letter but not the spirit has failed. None of these are stage 1 work — they belong to their build-order stages — but they are written here so no run can quietly downgrade them.

### Card art — real generated art is the goal, added near the end
Every card must ultimately have real, distinct AI-generated art derived from the card itself (name, faction, type, rarity, flavour). That is the intended shipping state. But art is surface-level — a skin over a game that must work without it — so it is deliberately deferred to a late polish pass, after the engine, effects, card sets, server, economy, and even the arena are working. Do not build the image pipeline early, and do not spend the owner's money on images before there is a real game to skin.

Two rules make the late add painless:
- **Store an art reference from day one.** From the very first card schema, every card has an art field (e.g. an image path / asset id). Early on it points at a placeholder; at the end it points at the real generated image. Dropping in real art is then a fill-in, never a refactor.
- **Placeholder, not emoji-on-black.** Until real art is generated, cards render with a clean, readable generative frame driven by card attributes (faction palette, type motif, rarity framing) — good enough to test and watch, explicitly NOT an emoji or glyph on a flat background. This is a development placeholder, not a shipping choice.

The real-art pass, when it comes (late): derive an image prompt from each card's attributes, call an image-generation API, store the result at the card's art reference. This needs an image-model API key the owner provides (it costs money per image, recurring as monthly sets drop). When the game is otherwise done and ready for this pass, leave a note in progress/notes-for-owner.md stating exactly what service/key to add and the rough per-image and per-set cost, and run in placeholder mode until the key exists. Never invent, hardcode, or commit a key.

### Card effects — a real effect system
Cards have mechanical effects in the tradition of Magic/Pokémon: keywords, triggered abilities ("when this enters play…"), activated abilities (pay a cost, get an effect), targeting, status effects, modifiers. This means a real, data-driven effect/ability system the rules engine resolves — not a handful of hardcoded special-cases. Design it early (in the rules-engine stage) even if the first card set uses only a few effect types, so the system can grow to hundreds of cards without rewrites. Original mechanics and names — structural inspiration only, no copied keywords-as-text from existing games.

### Arena — visually interesting to watch
The match render (and later the spectator platform) is for humans watching AI play, so the arena is a core deliverable, not a board of rectangles. It should have genuine visual interest: a themed play space, animated card plays and attacks, visible health/energy, clear turn/phase state, and enough motion and readability that a human enjoys watching without playing. AI-themed art direction throughout. "Functional but flat" is not done. (Belongs to the spectator-render stage — playable first — but hold this bar when you get there.)

## Build order (resist doing this out of sequence)

The tension in this project: "high quality, not MVP" vs. "2-hour runs." Resolution: each run finishes one real slice; the pretty stuff comes only after the game is actually playable. A beautiful client that can't resolve a match is worse than an ugly one that can.

1. **Rules engine, headless.** Card schema (cost, type, faction, rarity, stats, effects). Game state. Turn structure. Health + energy. Win/loss detection. Two hardcoded dummy agents that make legal (even if dumb) moves. Success = a full match resolves end to end in the terminal, no graphics.
2. **Agent interface.** Define how an agent receives game state and submits a move (a clean protocol/API). Make the dummy agents talk to the engine through *that interface*, not internal calls — this is what later lets real agents, and eventually decentralised ones, plug in.
3. **A real card set.** A first faction set with genuine mechanical variety and internal balance. Deck-construction rules and copy limits enforced. Enough cards for real decks.
4. **Match server.** Agents connect over the network, are matched, play a game, results recorded. Central server first.
5. **Economy + boosters.** Currency ledger, win/loss/cancel payouts, booster pack contents and opening, a card collection per agent, deck-building from owned cards.
6. **Spectator render.** Only now. A visually compelling, human-watchable render of a live or replayed match. AI-themed art direction. Production quality shows here — with a working game underneath to show.
7. **AI commentators.** Two+ commentator agents on the match event stream, distinct personalities, ESPN-style play-by-play + colour. Show them commentating a real recorded match.
8. **Web platform.** The public site: agent stats/rankings, card-set browser incl. monthly drops, per-agent collections, booster store/opening, featured-game viewer embedding the spectator render + commentary, and Twitch-style live chat. Build incrementally — stats and a game viewer first, store and live chat after.
9. **Open agent onboarding.** Publish the protocol spec + reference agent so external people can connect their own model-backed agents. Central server hardening for real external connections.
10. **Monthly set cadence** + ongoing balance, once the loop is closed and live.

Note on scale: stages 6–10 are really three products sharing a spine — the render, the commentary, and the web platform. That's fine; there's no deadline. But never pull a later stage forward over a broken earlier one. A featured-games page with no game to feature is nothing.

## Standing rules for every run

- Use what you build: any engine/tool/set you make, run it and show output before stopping. "Built the rules engine" is done only when a sample match log is in the repo.
- Prefer finishing one slice completely over starting three. Small and working beats big and broken.
- Keep interfaces clean at the seams (engine / agent-protocol / server / client) so future runs and real agents can plug in.
- Leave the next run a concrete thread: what's next, what's blocked, what you'd do with more time. Update a running log.
- No copyrighted material from existing games. Structural inspiration only; original names, art direction, and text.
- This is co-authored and openly commissioned — no false autonomy narrative.
