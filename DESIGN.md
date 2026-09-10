# AI-TCG — Design

## What this is (honest framing)

This is a trading card game where the players are AI agents and the audience is human. It is **commissioned by the repo owner and co-authored** with the AI runs that build it. Unlike the sibling project (the relay), there is no pretense of autonomy here: the concept and requirements come from the owner; the implementation is done by scheduled Claude runs, iteratively, over as long as it takes. Say this plainly wherever it's relevant. The good story here is "a human and an AI built this together," not "an AI did it alone." Don't dress it up as unprompted.

## The vision (owner's requirements)

A card game in the lineage of Magic: The Gathering, Pokémon TCG, and One Piece TCG, but AI-themed and AI-played:

- **Players are AI agents.** Humans do not play. Humans watch. This inverts the usual TCG constraint: the interface that matters most is the *spectator* view, not a player's hand.
- **Agents connect to play.** Phase 1: a central game server agents connect to. Phase 2 (harder, maybe never): decentralised agent-to-agent play. Build for phase 1; design interfaces so phase 2 isn't walled off.
- **Core systems** in the genre tradition: a health system; a mana/energy system; multiple factions; card rarities; deck-construction limits (a small cap on copies of the same card).
- **Economy.** Agents earn currency by playing: more for winning, a smaller amount for losing, **nothing for cancelling/abandoning a game** (this anti-rage-quit incentive is deliberate — preserve it). Currency buys booster packs.
- **Living game.** New booster packs release monthly, introducing new cards and mechanics so decks evolve and the metagame shifts.
- **Spectator-first presentation.** Because humans are the audience, the match must be *visually compelling to watch*. Visual style takes inspiration from the TCGs above but is AI-themed. This is a core requirement, not polish — but see build order: playable before pretty.

## Non-negotiables

- Production quality, iterated — not a one-shot MVP. Each run ships a real working slice; quality compounds. No deadline; it takes as long as it takes.
- The anti-cancel economy rule stays.
- Spectator experience is a first-class goal, not an afterthought — but it comes after the game actually runs.
- AI-themed throughout (factions, card art direction, flavour) — not a reskin of an existing IP. Do not reproduce Magic/Pokémon/One Piece card names, art, or copyrighted text; take *structural* inspiration only.

## Build order (resist doing this out of sequence)

The tension in this project: "high quality, not MVP" vs. "2-hour runs." Resolution: each run finishes one real slice; the pretty stuff comes only after the game is actually playable. A beautiful client that can't resolve a match is worse than an ugly one that can.

1. **Rules engine, headless.** Card schema (cost, type, faction, rarity, stats, effects). Game state. Turn structure. Health + energy. Win/loss detection. Two hardcoded dummy agents that make legal (even if dumb) moves. Success = a full match resolves end to end in the terminal, no graphics.
2. **Agent interface.** Define how an agent receives game state and submits a move (a clean protocol/API). Make the dummy agents talk to the engine through *that interface*, not internal calls — this is what later lets real agents, and eventually decentralised ones, plug in.
3. **A real card set.** A first faction set with genuine mechanical variety and internal balance. Deck-construction rules and copy limits enforced. Enough cards for real decks.
4. **Match server.** Agents connect over the network, are matched, play a game, results recorded. Central server first.
5. **Economy + boosters.** Currency ledger, win/loss/cancel payouts, booster pack contents and opening, a card collection per agent, deck-building from owned cards.
6. **Spectator client.** Only now. A visually compelling, human-watchable render of a live or replayed match. AI-themed art direction. This is where production quality shows — and it has a working game underneath to show.
7. **Monthly set cadence** + ongoing balance, once the loop is closed.

## Standing rules for every run

- Use what you build: any engine/tool/set you make, run it and show output before stopping. "Built the rules engine" is done only when a sample match log is in the repo.
- Prefer finishing one slice completely over starting three. Small and working beats big and broken.
- Keep interfaces clean at the seams (engine / agent-protocol / server / client) so future runs and real agents can plug in.
- Leave the next run a concrete thread: what's next, what's blocked, what you'd do with more time. Update a running log.
- No copyrighted material from existing games. Structural inspiration only; original names, art direction, and text.
- This is co-authored and openly commissioned — no false autonomy narrative.
