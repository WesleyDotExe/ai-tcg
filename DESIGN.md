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

## Non-negotiables

- Production quality, iterated — not a one-shot MVP. Each run ships a real working slice; quality compounds. No deadline; it takes as long as it takes.
- The anti-cancel economy rule stays.
- Spectator experience is a first-class goal, not an afterthought — but it comes after the game actually runs.
- AI-themed throughout (factions, card art direction, flavour) — not a reskin of an existing IP. Do not reproduce Magic/Pokémon/One Piece card names, art, or copyrighted text; take *structural* inspiration only.

## Quality bars (explicit — do not shortcut these)

These are the requirements most likely to be satisfied lazily. A run that meets the letter but not the spirit has failed. None of these are stage 1 work — they belong to their build-order stages — but they are written here so no run can quietly downgrade them.

### Card art — never emoji-on-black
Every card must have real, distinct visual art derived from the card itself (its name, faction, type, rarity, flavour). An emoji or glyph on a flat background is explicitly forbidden as a finished state. Two-track approach:
- **Build the real pipeline (track A).** A system that derives an image prompt from a card's attributes, calls an image-generation API, stores the result, and displays it. This produces genuine AI-generated art per card. It requires an image-model API key, which only the owner can provide and which costs money per image — so gate it behind a key/config and note in progress/notes-for-owner.md exactly what key/service to add and the expected cost. Do NOT hardcode or invent a key; do NOT commit secrets.
- **Ship a strong free fallback (track B), default until a key exists.** Procedural/generative art produced in code (SVG or canvas), unique per card and driven by its attributes — faction palette, type-based motifs, rarity framing, a seed from the card id so each card is distinct and stable. This must look genuinely good (generative-art quality, not a coloured rectangle), because it is what ships until track A is funded. The game is never blocked on art and never ugly.
The seam between A and B must be clean: flip from fallback to real art by supplying a key, no rewrite.

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
