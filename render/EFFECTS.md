# EFFECTS — the render visual and audio language (spec the render lane builds against)

The reference the render lane builds toward, slice by slice. It defines ONE coherent language for match animation and sound, so sessions compose from a shared system instead of accumulating one-off effects. Read it before adding or changing any FX, sound or music.

- v1: owner-directed 2026-09-26 (three axes, five slices; all built, see "v1 build history" at the end).
- **v2: owner-directed 2026-10-03.** Geometry Wars-quality canvas effects with AI-made textures, faction wards, unique Mythic wards, procedural sound and adaptive procedural music. The working reference is **`render/reference/effects-lab.html`** (open it in a browser; it runs offline). Where this file and the lab disagree, this file wins; where this file is silent, match the lab.

## Core idea: three axes, composed — never a hand-authored matrix

Every on-screen effect is (event category) × (faction material) × (magnitude tier). Build these as composable INPUTS, not as bespoke per-combination animations. Adding a faction or an effect type must stay cheap. If you find yourself writing a fourth near-duplicate of the same animation, stop and make it a parameterised primitive instead.

## Axis 1 — event category = WHAT the animation does (the grammar; carries meaning)

The grammar is CONSTANT across every faction and tier — a viewer learns it once.

- attack → travel from the acting card to the target card (or to the centre of the opponent's side when no card is targeted) + impact on landing
- spell / ability damage → travel from the card that used it; the faction decides the projectile form (see Axis 2)
- defence / block → a shield takes the hit, ripples, deflects, and shatters when it breaks; "no effect" must always read as blocked
- buff → rise + brighten, moving upward
- penalty / debuff → sink + desaturate, moving downward
- heal → flows in and gathers into the healed card
- a temporary buff/debuff wearing off → a quiet settle; always subtle
- power / ability activation → a cast flourish from the source card
- enter / summon → materialise in
- death / destroy → the card shatters; an unconditional destroy (removal) locks on first and is louder than a combat death
- evolve → a transform pulse on the same unit

THE ONE INVARIANT (do not break): meaning is constant. A debuff always reads as a debuff, a shield always reads as a shield, regardless of faction or tier. Faction and tier change material and scale, never meaning. Where spectacle and legibility conflict, legibility wins.

## Axis 2 — faction = WHAT IT IS MADE OF (material; never meaning)

Colours (Aegis is ORANGE, owner 2026-10-02): Cortex `#35c9ff`, Aegis `#ff7d24`, Swarm `#8bff5c`, Null `#d565ff`, Neutral `#ffcf5c`.

Textures: three 4×4 greyscale-on-black sprite atlases, `render/assets/fx/atlas-{a,b,c}.webp` (cell names in `render/assets/manifest.json`). Draw them ADDITIVELY on a canvas, tinted per faction with a small white core (lab: `tex()`). Black must become transparent over the DOM cards: alpha = brightest channel (lab: the tint loop). Pre-tint and cache per (sprite, colour); never tint per frame.

| Faction | Debris / material | Trail | Ground mark | Spell damage | Removal | Heal | Buff | Debuff |
|---|---|---|---|---|---|---|---|---|
| Cortex | pixels, data shards, wireframe cubes, circuit traces; arcs | pixels | circuit trace | instant laser lines | target lock, then an orbital beam | repair scanlines + pixels gather | wireframe blocks stack up | lock, pixels fall away |
| Aegis | shrapnel, hex plates, cracked hex, molten drops; embers | embers | scorch | lobbed molten shells | breach charge sticks, beeps, detonates | plates welded back on in sparks | armour plates slam on | plates crack and drop |
| Swarm | chitin, wings, claws, spores; goo | spores | goo splat | cloud of homing spores | tendrils erupt from below and devour | egg sacs bloom, spores lift | tendrils grow up | acid drips eat in |
| Null | glitch bars, shattered glass, pixels; dark star | glitch bars | rift tear | packets that teleport along the path | vortex swallows it into a dark star | vortex runs backwards | dark star pulses | glitch bars eat the card |
| Neutral | glints, sparkle dust, feathers; light rays | dust | rune ring | straight lances of light | rune seals it, light smites it | crosses of light rise | chevrons + glints | **acid drips, same look as Swarm, in gold** (owner 2026-10-03) |

Adding a faction = one colour + one material kit (the lab's `K` block) + one procedural sound voice. Nothing else.

## Axis 3 — magnitude = HOW BIG

Keep `render/src/fxMagnitude.ts` (subtle / normal / spectacle). Magnitude scales particle count, debris size, shake, hit-stop and volume. v2 adds, for kills and other spectacle moments: a hit-stop freeze (~120ms), a brief colour split at the edges, a small camera punch-in, and debris + scorch/goo/rift marks that linger on the table for a few seconds and fade. A warping background grid reacts to impacts. Keep the `normal` tier readable at play speed; do not regress the approved pacing.

## Wards (v2)

- **Faction wards** (`render/assets/wards/faction/<faction>.webp`, 2×2 layers): appear ONLY when a Rare or Mythic uses an attack, buff or defence that is unique to its rarity — a "signature" ability (owner 2026-10-03). Rare = the single-ring ward (cell 3); a Mythic without its own ward uses its code-generated fallback. The ward draws itself in, spins up, the effect leaves from it, then it collapses. For a signature defence a copy of the ward moves onto the ally, takes the hit and cracks apart. Ordinary attacks, arrivals and deaths NEVER show a faction ward. Neutral has no ward.
- **Which abilities are signature** is presentation data: `render/presentation/mythics.json` → `signatureAbilities` (card name → ability ids). Owner-approved 2026-10-04, 10 entries: Dormant Egg Sac, Kernel Panic, Deprecated Routine, Retaliation Node, Overload Capacitor, Rate Limiter, Aegis Warden, Latent Ward, Lockdown Field, Dormant Exploit. A debuff on an enemy counts as an attack. Statics/auras, card draw, Bloodswarm Alpha's summon and tools with no ability id stay out.
- **First fire only** (owner 2026-10-04): a signature ability's faction ward flares only the FIRST time that ability fires on a card instance, never on repeats (recurring ticks, later triggers of the same ability). This is what lets Retaliation Node, Overload Capacitor and Rate Limiter be signature without a ward every turn.
- **Mythic arrival** (owner 2026-10-04, render-only rule, not a signature ability): when a Mythic first arrives, its OWN unique ward flares. Arrival is the biggest moment on the board. It is the Mythic's ward, not the faction ward, so "arrivals never show a faction ward" still holds.
- **Mythic unique wards** (permanent): every Mythic carries its own one-of-a-kind ward for as long as it is on the board, layered (outer / middle / core counter-rotating) over a dark "obsidian + foil" Mythic card. The ward acts out the card's ability via its `behaviour` in `mythics.json`:
  - Quorum Arbiter — `seats`: one seat lights per enemy unit; its attack shows 1 + that count, live.
  - Prime Aegis — `aura`: tethers and shield crests on every ally (+1/+1); a pressure ring rolls over the enemy line (−1/−0).
  - Hive Mother — `heartbeat`: beats like a heart and sends larvae out to her brood (+1/+0).
  - Null Singularity — `gravity`: bends the grid toward itself and drags pointers in (+1/+0).
  - A Mythic's own ward (not the faction ward) flares for its signature moves, and shatters into spinning pieces when the Mythic dies.
- **Fallback ward**: a Mythic with no art yet gets a ward drawn by code, seeded from its name and faction, so the same name always gives the same ward (lab: `genWardAtlas()`). It must never block a card from rendering.

## Sound and music (v2): procedural only

Owner 2026-10-03: the code-made sound is preferred over every AI sound model tested; **no audio files, no sound samples, no network**. Everything is synthesised with WebAudio at play time (lab: `SFX`, `tone()`, `noise()`).

- **Effects**: one sound per event, panned by the card's position, through a limiter, with a voice cap. Each faction has a voice: Cortex clean square-wave blips; Aegis heavy metal clangs (inharmonic partials); Swarm wet chitters and squelches; Null broken pitch and glitch blips; Neutral bells. Magnitude scales volume and weight. Ward moments have their own rising chord, pulse and shatter.
- **Music** (lab: the "adaptive procedural music" block): A minor, 104 BPM, i–VI–III–VII (Am–F–C–G), scheduled ahead on the audio clock. It starts calm (pad + bass); hits, kills and Mythic arrivals raise an intensity value that brings in kick + arpeggio, then hats, then snare and four-on-the-floor, and decays back over a few seconds. The arpeggio takes the acting faction's voice. A Mythic on the acting side adds a bell motif every other bar. Effects dip the music only slightly (to ~80%, back within ~0.2s). **Never drop the music out or muffle it on a kill** (owner 2026-10-03: "good theory, but not in practice").
- Sound and music start OFF and are switched on by the viewer (browser autoplay rules); keep separate toggles and a music volume control.

## Canvas layers as built (slice 1)

- `render/src/canvasFx.ts` holds the kit table (`FX_KITS`, the lab's `K` block; slice 2 added the category variants to the same rows), the tint, the tier recipes (`FX_TRAVEL`, `FX_IMPACT`, `FX_KILL`) and the canvas runtime (`CFX.travel`, `CFX.impact`, `CFX.effect`, `CFX.kill`, `CFX.clear`).
- Two fixed, full-viewport canvases: `.fx-floor` (z 0, under `#app`; the warping grid at its bottom) and `.fx-top` (z 89, over the cards and the aim line, under `.fx-layer`'s floating numbers). Particles live in document coordinates so a ground mark stays put when the page scrolls. The loop only runs while something is alive.
- **Lab correction:** the lab's `spr()`/`addP()` use `layer: o.layer || 1`, which turns layer 0 into 1, so its "floor" decals actually draw on the top canvas. The port uses `!= null`; marks really sit under the cards.
- **Ground marks under a card** are sized past the card's larger side (`fxDecalCover`: normal 1.3×, spectacle 1.6×, subtle none) so the card stands in its scorch / goo / rift / rune / circuit trace instead of hiding it. A face hit leaves no mark: the HUD panel is opaque.
- **Fallback:** if the atlases don't decode or there is no 2D canvas, `CFX.travel`/`CFX.impact` return false and the page draws the v1 DOM bolt and burst.
- The atlases are embedded in each replay as data URIs (~300 KB per page) to keep the single-file, offline replay.

## Slice 2 as built (render session 11)

- **Pairing comes from the event log's instance ids** (`render/src/effectFx.ts`, `resolveEffects`). An ability's effects follow its `abilityTrigger` and carry the same `sourceId`; combat damage never follows one, so it is never read as a spell. Categories: `spell` (ability/Command damage), `heal`, `buff` (+stats or Barrier), `debuff` (−stats, Stasis, Overload), `removal` (a unit the ability targeted that died with no damage this move, or a destroyed Directive). The source is a unit (or where it stood, for onDeath) or a Command's stack entry; the target is a unit, a Directive or a player. Same card on both ends = `self`: it plays in place, no travel. Events with no `sourceId` (Overload's tick) fly nothing.
- **One call per effect:** `CFX.effect(category, fromRect, toRect, faction, tier, ms, { self, targetKind })`. The variant comes from the kit row (`FX_KITS[f].spell / removal / heal / buff / debuff`), so the table above is data, not code paths. The effect wears its SOURCE card's faction.
- **Timing:** what travels gets a window carved out of the move, like an attack's bolt (`travelMs` of the move's loudest effect; a removal ×1.45 because it locks on first). Everything the effects cause (numbers, flashes, deaths) waits for them to land. On a strike move the effects are the strike's consequences: they leave when the strike lands, and only the cards they reach wait for them. Spell volleys are scheduled (`fxVolleySchedule`) so the last shot lands exactly when the number shows and no shot lands after it. Pacing (the tick) is unchanged.
- **Removal = lock + strike + shatter:** the variant's lock plays on the target from the start, the strike lands at the end of the window, and the death's `CFX.kill` shatters the card at that same moment.
- **Kills:** every death now shatters on the canvas (`CFX.kill`: triangles in the victim's colour, the killer's and the victim's debris, a crater + the killer's mark on the floor). The killer is the attacker (or, for a counter-kill, the defender), else the effect that reached the card, else the card's own faction. The ghost card is hidden the instant it shatters. Hit-stop (120 ms), colour split and the strong camera punch are **spectacle-only** (`FX_KILL`); a normal kill gets a small punch and shake. A spectacle impact (a big face hit) gets a shorter hit-stop, punch and shake.
- **Hit-stop freezes the particles only.** The page's timeline, flights and timers keep real time, so nothing lands late.
- **Camera beats** move `#app` (punch, shake, colour split as a red/blue `drop-shadow` pair). The floating numbers, aim lines and canvases are body children, so they don't move with it.
- **Warping grid:** the lab's spring grid, drawn at the bottom of the floor canvas in viewport coordinates. At rest it is one faint path and stays on screen when the loop stops; impacts push and tint it, then it settles. It shares the floor canvas because a third full-viewport canvas measurably cost frame rate to composite.
- **prefers-reduced-motion:** no hit-stop, shake, punch, colour split or grid motion. The particles still show what happened.
- **v1 DOM paths retired behind the canvas:** a canvas buff/debuff stands down the v1 motes and burst (the rise/sink flash and the gold/slate label stay, they carry the meaning); a canvas kill replaces the v1 red burst. Both still run if the canvas can't draw.
- **Still v1 (DOM):** the shield/Barrier block, the cast flourish, the armor deflect, evolve and arrival pulses. These belong to slices 5-6 (wards) or a later polish pass.

## Board layout (infrastructure every primitive relies on)

Fixed slots (render session 8, `render/src/slotLayout.ts`). A card keeps its slot until it leaves. Effects anchor to card rectangles; a canvas FX layer sits above the cards and a "floor" canvas below them for ground marks and lingering debris.

## Dependencies & guardrails

- **Self-contained runtime** (owner 2026-09-30): the game and its replays make no network calls. All textures and ward art are committed static files under `render/assets/`. Only the build-time `mythic-wards` GitHub Action talks to Replicate.
- **Instance IDs in the event log: available since game session 27 (2026-10-04).** Every event naming a board card carries `sourceId` / `targetRef` / `stackId` etc. (see the GameEvent doc comment in `engine/src/state/types.ts`). Spells and abilities travel from their exact source to their exact target; where an event still carries no id (e.g. an Overload tick), aim at the best available target and never invent pairings.
- All render work stays under `render/` and `progress/render/` per RENDER.md. No engine / balance / card-pool / agent file edits.
- Verify at PLAY speed. Check frame rate with several Mythic wards on the board.

## New Mythics: the asset pipeline (owner 2026-10-03)

1. Whichever lane designs a Mythic adds an entry to `render/presentation/mythics.json` (faction, behaviour, motif, sound) — see `_howToAddAMythic` in that file. No art, no network.
2. `.github/workflows/mythic-wards.yml` runs after each auto-merge, daily, or by hand. `render/tools/mythic_ward.py` asks Replicate (Nano Banana Pro, secret `REPLICATE_AI_TCG`) for the 2×2 ward sheet, slices/centres/masks it, and commits the `.webp`, a preview PNG and a line in `progress/render/mythic-wards-log.md`. At most 3 cards per run (about $0.15 each), 3 attempts per card.
3. Until the art lands the renderer uses the fallback ward. The render session that next runs surfaces any new ward preview in `notes-for-owner.md` so the owner can check it for unwanted symbols; deleting the `.webp` makes the action redo it.

## v2 build order (one slice per render-lane turn; each across ALL factions)

1. Canvas FX layer + floor layer over/under the existing DOM board; atlas loader with the tint cache; additive drawing with correct alpha. Port travel + impact to sprite materials. **Built, render session 10** (`render/src/canvasFx.ts`, sheet: `npm run fx-sheet -w @ai-tcg/render`).
2. Faction material kits for every category in the table above (spell damage, removal, heal, buff, debuff variants included), plus magnitude polish: hit-stop, colour split, camera punch, lingering debris and ground marks, warping grid. **Built, render session 11** (`render/src/effectFx.ts` + `canvasFx.ts`; see "Slice 2 as built").
3. Procedural sound effects with faction voices (port the lab's `SFX`), toggles off by default.
4. Adaptive procedural music (port the lab's music block), no kill dropout.
5. Faction wards for signature abilities, driven by `signatureAbilities`.
6. Mythic unique wards: permanent layered ward, the four behaviours, Mythic card treatment, shatter on death; read everything from `mythics.json`.
7. Fallback ward generator, so any Mythic without art still gets a unique ward.

Each slice: build it for all factions, keep meaning constant, prove it at play speed, checkpoint, and update this file if the model itself changes.

## v1 build history (still in use; v2 builds on it)

Render sessions 4–9 built the v1 primitives on the DOM: defence/shield (s4), rise/sink stat FX (s5, `statFx.ts`), cast flourish with exact source attribution (s6, `castFx.ts`), attack travel + aim line + redirect + fizzle from the combatDamage stack item (s7, `attackFx.ts`), fixed slots (s8), and the placeholder faction skins (s9, `factionSkin.ts`, `npm run skin-sheet -w @ai-tcg/render`). v2 replaces the placeholder particle look with the sprite materials and canvas layer; keep the v1 timing, attribution and response-window behaviour.
