# EFFECTS — the render visual language (spec the render lane builds against)

The reference the render lane builds toward, slice by slice. It defines ONE coherent visual language for match animation, so sessions compose from a shared system instead of accumulating one-off effects. Read it before adding or changing any FX. Owner-directed, 2026-09-26.

## Core idea: three axes, composed — never a hand-authored matrix

Every on-screen effect is (event category) × (faction skin) × (magnitude tier). Build these as composable INPUTS, not as bespoke per-combination animations. Adding a faction or an effect type must stay cheap. If you find yourself writing a fourth near-duplicate of the same animation, stop and make it a parameterised primitive instead.

## Axis 1 — event category = WHAT the animation does (the grammar; carries meaning)

The grammar is CONSTANT across every faction and tier — a viewer learns it once. Each category maps to a motion primitive:

- attack → travel (attacker → target) + impact on landing
- defence / block → interpose (a shield comes between the hit and the unit), absorb, and shatter when it breaks
- buff (positive) → rise + brighten, moving upward
- penalty / debuff (negative) → sink + desaturate, moving downward
- a temporary buff/debuff merely wearing off → a quiet settle (neither rise nor sink — it is not a new buff or penalty and must not read like one); always subtle
- power / ability activation → a cast flourish emanating from the source card
- enter / summon → materialise in
- death / destroy → exit (existing ghost); an unconditional destroy is louder than an ordinary combat death
- evolve → a transform pulse on the same unit

THE ONE INVARIANT (do not break): meaning is constant. A debuff always reads as a debuff, a shield always reads as a shield, regardless of faction or tier. Faction and tier change flavour and scale, never meaning. Where spectacle and legibility conflict, legibility wins.

## Axis 2 — faction = HOW it looks (skin: palette + particle character; never meaning)

Rides the existing faction palette now; real sprites/art arrive in the later art pass. Do NOT block the grammar on art — placeholders now, skin later (same approach as the card frames).

- Cortex — clean, networked, precise; data-packet motifs
- Swarm — many small, organic; spore / scatter motifs
- Aegis — chrome, solid, shield-forward
- Null — glitch, corruption, decay
- Neutral pool — a plain, faction-agnostic treatment

## Axis 3 — magnitude tier = HOW BIG (already built)

subtle / normal / spectacle, scored by render/src/fxMagnitude.ts from the effect’s own weight and the momentum swing. Reuse that module; every primitive takes a tier and scales duration / size / particle-count / autoplay-hold accordingly. The `normal` tier stays the approved session-2/3 baseline — do not regress it.

## The primitives (build once, parameterise by faction palette + tier)

A small set of motion primitives. Everything in Axis 1 composes from these:

- travel(from, to) — a projectile / beam along the path between two card elements
- impact(target) — burst on landing (reuse the existing burst-ring)
- interpose(target) — a shield appears between the incoming hit and the unit; plus a shatter variant
- rise(target) — upward brighten (buffs)
- sink(target) — downward desaturate (penalties)
- cast(source) — activation flourish from a card
- existing: enter, exit / ghost, evolve-pulse, float-number

Adding a faction = a palette + a particle style. Adding an effect type = one primitive, or a compose of existing ones. Never a faction × category × tier matrix of hand-made animations.

## Dependencies & guardrails

- attack `travel` needed reliable attacker→target pairing. Resolved in render session 7 without the event-log change: the combatDamage stack item carries the exact attacker and target, captured read-only. (Per-hit pairing for effect damage — which card's ability hit which unit — still needs the event-log instance-ID work.)
- All work stays under render/ and progress/render/ per RENDER.md. No engine / balance / card-pool / agent file edits.
- Verify at PLAY speed, not just single-step (2026-09-25 pacing feedback).
- Keep the `normal` tier visually stable so the approved baseline pacing is not regressed.

## Build order (one slice per render-lane turn; build each across ALL factions via the primitive, not one faction at a time)

1. Defence / shield — built render session 4: interpose + absorb + shatter on Barrier; a persistent shield badge on Guard units; a small deflect on base-armor damage reduction. No pairing dependency — do this FIRST; it immediately makes Aegis’s defensive identity legible.
2. Buff (rise) and penalty (sink) grammar, tier-scaled and faction-tinted. — built render session 5 (render/src/statFx.ts; persistent above/below-printed stat markers and penalty-status badges ride along).
3. Power / ability cast flourish — built render session 6 (render/src/castFx.ts attributes each fired power to its exact source instance; the page draws ring + sigil + rays in the source's faction tint, plus a fixed-colour trigger tag — ON PLAY / ON DEATH / ACTIVATE / CAST / RESPONSE ...).
4. Attack travel + impact — built render session 7 (render/src/attackFx.ts follows each combatDamage stack item by its engine id: declare -> an aim line + reticle that persists through the whole response window; redirect -> the old line fades in shield colour; resolve -> a bolt flies the same arc and the hit, burst, deaths and any triggered powers land when it does; a defender with attack returns a smaller bolt in its own colour; a fizzle says FIZZLED). No event-log change was needed. The same session added a Command's card flying from its caster's hand onto the stack (owner taste call 4) and the ~150ms "cast, then effect" beat for spectacle-tier powers only (taste call 1).
5. Faction skinning pass: give each primitive its per-faction particle character (still placeholder art; real art later).

Each slice: pick one item, build it for all factions via the primitive + palette, keep it inside the tier system, prove it at play speed, and checkpoint. Update this file if the model itself changes.
