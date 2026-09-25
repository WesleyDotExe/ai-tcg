# RENDER — spectator render lane (parallel to the balance/card work)

A SEPARATE work lane from the main TASKS.md loop. Its job: build the spectator render (DESIGN.md stage 6) — a watchable view of a match, driven by the engine event stream. It runs IN PARALLEL with the balance/card work, so the #1 rule is: do not touch anything the balance lane touches.

## Read first, every session

- DESIGN.md — especially spectator-first, principle 1 (built to be unplayable by humans) and principle 2 (a human must still enjoy WATCHING; legibility is load-bearing). The render makes an unfollowable game followable.
- progress/owner-feedback.md — respect any render-specific direction; IGNORE balance/card entries, not this lane job.
- progress/render/ — this lane OWN log/notes/checkpoints. Read prior entries to continue, not restart.

## Hard guardrails (parallel-safety — non-negotiable)

1. NEVER modify any balance/engine/card file: engine/src/data/**, any decks.ts, engine/src/cards/poolLint.ts, engine/src/dev/balanceReport.ts, agents/**, or any rules/effect/card-pool file. READ the engine to learn its event/state shapes; never change it.
2. If you need an engine change to render something, STOP. Do not make it. Write the need into progress/render/notes-for-owner.md and work around it or pick another slice.
3. Work only inside a new top-level render/ directory (and its own tests). Nothing else.
4. Keep your OWN progress files under progress/render/ (log.md, checkpoints.md, notes-for-owner.md). Do NOT write to the shared progress/log.md, current.md, roadmap.md, checkpoints.md, notes-for-owner.md, or owner-feedback.md — appending to those causes merge conflicts with the balance lane.
5. Consume the engine as a fixed upstream: render from committed sample match logs / the public event stream, not internal state.

## Way of working (same discipline as TASKS.md / DESIGN.md)

- Own branch per session; PR to main; auto-merge. No session URLs/identifiers in the PR body.
- Small vertical slices, each with committed evidence — a rendered frame (committed HTML/screenshot), a real sample match played back — not claims. Coloured rectangles with numbers is a FAILURE per DESIGN; aim for legible, watchable structure.
- Art is deferred (DESIGN late owner-funded pass): clean placeholders only, never final art. Structure and legibility now; skin later.
- Taste calls (layout, how momentum/threat/who-is-winning is surfaced) are OWNER CHECK-INs: build a first version, checkpoint it in progress/render/checkpoints.md, keep going — do not block.

## Suggested first slice

A match player that ingests a committed progress/sample-match-*.txt log (or the event stream) and renders board state turn by turn as a self-contained HTML page: both boards, slots, unit stats, telegraph/evolution/tool state, health/energy, and a legible per-turn who-is-ahead-and-why signal (principle 2). Placeholder art. Checkpoint the look-and-feel.

## A parked question this lane unblocks

Telegraph delay feel (1 vs 2 turns) has been unanswerable twice — nothing to watch it in. Once a render can play back a telegraph arming, note in progress/render/notes-for-owner.md that it is now judgeable; do not force it, just flag the win.


## Effects language (read before touching any FX)

render/EFFECTS.md is the standing spec for the render visual language — the three-axis model (event category = the meaning-carrying grammar; faction = skin; magnitude tier = size), the small set of parameterised primitives, the one invariant (meaning stays constant across factions and tiers), and the slice-by-slice build order. Build every animation against it and compose from the primitives rather than hand-authoring per-combination effects. Update it if the model itself changes.
