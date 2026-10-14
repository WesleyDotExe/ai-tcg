# EFFECTS — the render visual and audio language (spec the render lane builds against)

The reference the render lane builds toward, slice by slice. It defines ONE coherent language for match animation and sound, so sessions compose from a shared system instead of accumulating one-off effects. Read it before adding or changing any FX, sound or music.

- v1: owner-directed 2026-09-26 (three axes, five slices; all built, see "v1 build history" at the end).
- **v2: owner-directed 2026-10-03.** Geometry Wars-quality canvas effects with AI-made textures, faction wards, unique Mythic wards, procedural sound and adaptive procedural music. The working reference is **`render/reference/effects-lab.html`** (open it in a browser; it runs offline). Where this file and the lab disagree, this file wins; where this file is silent, match the lab.

## Core idea: three axes, composed — never a hand-authored matrix

Every on-screen effect is (event category) × (faction material) × (magnitude tier). Build these as composable INPUTS, not as bespoke per-combination animations. Adding a faction or an effect type must stay cheap. If you find yourself writing a fourth near-duplicate of the same animation, stop and make it a parameterised primitive instead.

## Axis 1 — event category = WHAT the animation does (the grammar; carries meaning)

The grammar is CONSTANT across every faction and tier — a viewer learns it once.

- attack → travel from the acting card to the target card, or **to the centre of the opponent's side of the board when the target is the player** (the middle of their row of slots, never their portrait/HUD; owner 2026-10-05) + impact on landing, with a ground mark there. The player's HP bar then reacts on their panel, timed to the impact: it flashes and drops, scaled by tier (a spectacle hit also flashes the whole panel and jolts the bar). The damage (or heal) number appears at the impact point on the board, placed as a hit on a card places its number (owner 2026-10-07); only a player health change with no visual landing on them (a self-cost) shows its number at the end of the HP bar's fill. The same rule holds for spells, heals and anything else whose target is a player; a card is still hit on the card itself.
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

Colours (Aegis is ORANGE, owner 2026-10-02): Cortex `#35c9ff`, Aegis `#ff7d24`, Swarm `#8bff5c`, Null `#d565ff`, Neutral **white-gold `#fff0c2`** (owner 2026-10-05: the old gold `#ffcf5c` nearly merged with Aegis orange under deuteranopia; CIEDE2000 from Aegis 26 → 33, deuteranopia 12 → 22). White-gold is text only on dark backgrounds; on a white-gold fill, text is dark, or sits on a dark strip (the card name and stats strips are darker on Neutral cards).

Textures: three 4×4 greyscale-on-black sprite atlases, `render/assets/fx/atlas-{a,b,c}.webp` (cell names in `render/assets/manifest.json`). Draw them ADDITIVELY on a canvas, tinted per faction with a small white core (lab: `tex()`). Black must become transparent over the DOM cards: alpha = brightest channel (lab: the tint loop). Pre-tint and cache per (sprite, colour); never tint per frame.

| Faction | Debris / material | Trail | Ground mark | Spell damage | Removal | Heal | Buff | Debuff |
|---|---|---|---|---|---|---|---|---|
| Cortex | pixels, data shards, wireframe cubes, circuit traces; arcs | pixels | circuit trace | instant laser lines | target lock, then an orbital beam | repair scanlines + pixels gather | wireframe blocks stack up | lock, pixels fall away |
| Aegis | shrapnel, hex plates, cracked hex, molten drops; embers | embers | scorch | lobbed molten shells | breach charge sticks, beeps, detonates | plates welded back on in sparks | armour plates slam on | plates crack and drop |
| Swarm | chitin, wings, claws, spores; goo | spores | goo splat | cloud of homing spores | tendrils erupt from below and devour | egg sacs bloom, spores lift | tendrils grow up | acid drips eat in |
| Null | glitch bars, shattered glass, pixels; dark star | glitch bars | rift tear | packets that teleport along the path | vortex swallows it into a dark star | vortex runs backwards | dark star pulses | glitch bars eat the card |
| Neutral | glints, sparkle dust, feathers; light rays | dust | rune ring | straight lances of light | rune seals it, light smites it | crosses of light rise | chevrons + glints | **acid drips, same look as Swarm, in white-gold** (owner 2026-10-03) |

Adding a faction = one colour + one material kit (the lab's `K` block) + one procedural sound voice. Nothing else.

## Axis 3 — magnitude = HOW BIG

Keep `render/src/fxMagnitude.ts` (subtle / normal / spectacle). Magnitude scales particle count, debris size, shake, hit-stop and volume. v2 adds, for kills and other spectacle moments: a hit-stop freeze (~120ms), a brief colour split at the edges, a small camera punch-in, and debris + scorch/goo/rift marks that linger on the table for a few seconds and fade. A warping background grid reacts to impacts. Keep the `normal` tier readable at play speed; do not regress the approved pacing.

## Wards (v2)

- **Faction wards** (`render/assets/wards/faction/<faction>.webp`, 2×2 layers): appear ONLY when a Rare or Mythic uses an attack, buff or defence that is unique to its rarity — a "signature" ability (owner 2026-10-03). Rare = the single-ring ward (cell 3); a Mythic without its own ward uses its code-generated fallback. The ward draws itself in, spins up, the effect leaves from it, then it collapses. For a signature defence a copy of the ward moves onto the ally, takes the hit and cracks apart. Ordinary attacks, arrivals and deaths NEVER show a faction ward. Neutral has no ward.
- **Which abilities are signature** is presentation data: `render/presentation/mythics.json` → `signatureAbilities` (card name → ability ids). Owner-approved 2026-10-04, 10 entries: Dormant Egg Sac, Kernel Panic, Deprecated Routine, Retaliation Node, Overload Capacitor, Rate Limiter, Aegis Warden, Latent Ward, Lockdown Field, Dormant Exploit. A debuff on an enemy counts as an attack. Statics/auras, card draw, Bloodswarm Alpha's summon and tools with no ability id stay out.
- **First fire only** (owner 2026-10-04): a signature ability's faction ward flares only the FIRST time that ability fires on a card instance, never on repeats (recurring ticks, later triggers of the same ability). This is what lets Retaliation Node, Overload Capacitor and Rate Limiter be signature without a ward every turn.
- **Mythic arrival** (owner 2026-10-04, render-only rule, not a signature ability): when a Mythic first arrives, its OWN unique ward flares. Arrival is the biggest moment on the board. It is the Mythic's ward, not the faction ward, so "arrivals never show a faction ward" still holds.
- **Mythic unique wards** (permanent): every Mythic carries its own one-of-a-kind ward for as long as it is on the board, layered (outer / middle / core counter-rotating) with a dark "obsidian + foil" Mythic card.
  - **The ward sits BEHIND the card** (owner 2026-10-11; this replaced "layered over the card"). On arrival it draws in on top of the card, holds there a few seconds, then fades back behind it. From then on it stays behind for as long as the Mythic is on the board: the card art, name and stats strip stay fully visible, and only the parts of the ward that reach past the card's edges show (e.g. Quorum Arbiter's outer ring and seats, Hive Mother's outer membrane and pulse). The core no longer shows in the card's centre. Signature-move flares and the live behaviour (seats lighting, heartbeat, tethers, pointers) play behind the card too. To keep a Mythic standing out, the outer layers are brightened and slightly enlarged while behind.
  - The ward acts out the card's ability via its `behaviour` in `mythics.json`:
  - Quorum Arbiter — `seats`: one seat lights per enemy unit; its attack shows 1 + that count, live.
  - Prime Aegis — `aura`: tethers and shield crests on every ally (+1/+1); a pressure ring rolls over the enemy line (−1/−0).
  - Hive Mother — `heartbeat`: beats like a heart and sends larvae out to her brood (+1/+0).
  - Null Singularity — `gravity`: bends the grid toward itself and drags pointers in (+1/+0).
  - A Mythic's own ward (not the faction ward) flares for its signature moves (behind the card), and shatters into spinning pieces over the board when the Mythic dies.
- **Fallback ward**: a Mythic with no art yet gets a ward drawn by code, seeded from its name and faction, so the same name always gives the same ward (lab: `genWardAtlas()`). It must never block a card from rendering. Every agent's **signature card** is a Neutral Mythic with a generated name that is never in `mythics.json`, so its ward is always the fallback, with the `generic` behaviour (rotation plus a slow pulse).

## Sound and music (v2): procedural only

Owner 2026-10-03: the code-made sound is preferred over every AI sound model tested; **no audio files, no sound samples, no network**. Everything is synthesised with WebAudio at play time (lab: `SFX`, `tone()`, `noise()`).

- **Effects**: one sound per event, panned by the card's position, through a limiter, with a voice cap. Each faction has a voice: Cortex clean square-wave blips; Aegis heavy metal clangs (inharmonic partials); Swarm wet chitters and squelches; Null broken pitch and glitch blips; Neutral bells. Magnitude scales volume and weight. Ward moments have their own rising chord, pulse and shatter.
- **Music** (lab: the "adaptive procedural music" block): A minor, 104 BPM, i–VI–III–VII (Am–F–C–G), scheduled ahead on the audio clock. It starts calm (pad + bass); hits, kills and Mythic arrivals raise an intensity value that brings in kick + arpeggio, then hats, then snare and four-on-the-floor, and decays back over a few seconds. The arpeggio takes the acting faction's voice. A Mythic on the acting side adds a bell motif every other bar. Effects dip the music only slightly (to ~80%, back within ~0.2s). **Never drop the music out or muffle it on a kill** (owner 2026-10-03: "good theory, but not in practice").
- Sound and music are each ON by default and armed until the viewer's first click or key press (browser autoplay rules; owner 2026-10-07 for sound, the same pattern for music), each with its own toggle and volume control, each remembered.

## Canvas layers as built (slice 1)

- `render/src/canvasFx.ts` holds the kit table (`FX_KITS`, the lab's `K` block; slice 2 added the category variants to the same rows), the tint, the tier recipes (`FX_TRAVEL`, `FX_IMPACT`, `FX_KILL`) and the canvas runtime (`CFX.travel`, `CFX.impact`, `CFX.effect`, `CFX.kill`, `CFX.clear`).
- Two fixed, full-viewport canvases: `.fx-floor` (z 0, under `#app`; the warping grid at its bottom) and `.fx-top` (z 89, over the cards and the aim line, under `.fx-layer`'s floating numbers). Particles live in document coordinates so a ground mark stays put when the page scrolls. The loop only runs while something is alive.
- **Lab correction:** the lab's `spr()`/`addP()` used `layer: o.layer || 1`, which turned layer 0 into 1, so its "floor" decals actually drew on the top canvas. The port uses `!= null`; marks really sit under the cards. Render session 15 fixed the lab the same way (its ward behaviour needs the floor).
- **Ground marks under a card** are sized past the card's larger side (`fxDecalCover`: normal 1.3×, spectacle 1.6×, subtle none) so the card stands in its scorch / goo / rift / rune / circuit trace instead of hiding it. A hit on a player lands mid-board on their side and leaves its mark on the floor there (owner 2026-10-05; until then a face hit went to the portrait and left none).
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

## Slice 3 as built (render session 12)

- `render/src/soundFx.ts`: `sfxRecipe(kind, faction, tier, rand, o)` turns an event into a list of voices (oscillators and filtered noise, as plain data); `SND.play(kind, faction, tier, rect, o)` plays it. Same single-source rule as the canvas: the page embeds the exact text the tests run, and the tests drive the runtime against a recording fake `AudioContext`.
- **Eleven sounds:** `launch` (a strike leaves), `impact` (it lands; a spell's landing too), `bolt` (a spell's shot leaves), `heal`, `buff`, `debuff`, `lock` (a removal locks on), `beam` (the removal strikes), `kill`, `block` (a Barrier takes the hit), `cast` (a power's cast flourish). The page fires each at the same moment as the visual it belongs to, through the same `later()` timeline, so a sound never runs ahead of what it describes.
- **Meaning stays constant across voices:** an impact always has the same low falling thump under the faction's colour (lower and longer when it lands on a player's side), a heal always ends higher than it starts, a buff sweeps up, a debuff falls in a detuned pair, a block always rings (a 1760 Hz triangle), a kill is the killer's impact at 1.5× plus a deep drop and glass pings.
- **Voices (axis 2):** Cortex square-wave blips; Aegis inharmonic partials (1, 2.76, 5.4: struck metal); Swarm high-Q noise chitters and squelches; Null stepped, randomised pitch; Neutral sine/triangle bells only. An unknown faction gets the Neutral voice.
- **Magnitude (axis 3)** scales every voice's gain: subtle 0.55, normal 1, spectacle 1.4.
- **Mix:** master gain 0.6 into a hard compressor (threshold −16 dB, ratio 10, 2 ms attack) as the limiter; each voice panned by where it happens (±0.75 at the screen edges); at most 30 voices alive (more are dropped, never queued); the same sound in the same voice within 28 ms is dropped, so a Swarm volley reads as one chitter cloud.
- **On by default, armed** (owner 2026-10-07, call 7; replaces "off by default"). Browsers refuse audio before a gesture, so the page arms sound at load (`SND.arm`) and the viewer's first pointer press or key press anywhere starts the `AudioContext` (`SND.unlock`; pressing Play counts). No context exists before that gesture.
- **The control** (`SND.mount(button, slider, store)`): a "🔊 Sound on" button (dashed border while armed, waiting for the first gesture) that mutes in one click ("🔇 Sound off" suspends the context), and an effects volume slider beside it (0-100, default 80; it scales the master bus, 0.6 × volume, ahead of the limiter). A press on the mute button never starts sound first.
- **Remembered:** `{ muted, volume }` (`sfxPrefParse` / `sfxPrefSerialize`), saved on every change. A standalone replay keeps it in browser storage under `ai-tcg.sound`; the owner website will pass its own store (the account's Sound setting) through the same `{ read, write }` seam. Only an explicit mute is remembered as off, so missing or broken storage means sound on. A muted viewer stays muted on the next page until they switch it back on.
- **A hidden tab goes quiet:** the context is suspended while the tab is hidden and resumes when the viewer returns, if sound was on.
- **Ward sounds** (slice 6, render session 15): `ward` (a run of ticks, the faction's rising chord, the landing thump and the deep swell under it), `wardPulse` (the chord's upper notes), `wardBreak` (glass pings, then the chord falling). They are kinds 12-14 of `SFX_KINDS`. The music still listens to every sound, but these don't bump it: the Mythic arrival already bumps it by 1.3.

## Slice 4 as built (render session 14)

- `render/src/musicFx.ts`: `musStep(step, I, faction, mythic, rand)` turns one sixteenth into a list of voices (plain data); `MUS` schedules and plays them. Same single-source rule: the page embeds the text the tests run, after the sound sources.
- **The lab's arrangement:** A minor, 104 BPM, Am–F–C–G a bar each. Calm (I ≈ 1): a detuned-saw pad and a pulsing bass, a kick on the one. Then, as intensity I rises: kick on 1 and 3 (1.2), the arpeggio in eighths (1.3), a driving eighth-note bass (1.45), hats (1.6), the arpeggio in sixteenths (2.2), four on the floor (2.3), off-beat hats (2.4), snare on 2 and 4 (2.5). All thresholds live in `MUS_AT`.
- **Intensity:** rests at 1, or 1.35 with a Mythic in play on the acting side; capped at 3.2; relaxes toward rest with a 6 s time constant. Bumps (`MUS_BUMP`): a strike leaving or a spell shot 0.04, an impact 0.2 × its tier weight, a kill 1.1, a Mythic arriving 1.3. Heals, buffs, debuffs, blocks and casts don't move it: the music follows violence.
- **Whom it follows** (owner 2026-10-10): a "arp: acting player / whoever is ahead" choice beside the music control, remembered with the music setting (`follow` in `ai-tcg.music`). "Whoever is ahead" takes the momentum leader; when the match is even it falls back to the acting player (`musSceneSide`). The Mythic bells follow the same side.
- **The scene:** each frame tells the music the followed player's faction (by default the acting player's) (the arpeggio's voice: Cortex square, Aegis low filtered saw, Swarm detuned triangle that drops notes, Null square with broken octaves, Neutral bells) and whether that side has a Mythic unit or Directive in play (a three-note bell motif every other bar). A Mythic entering bumps it on its entrance beat.
- **Mixing with the effects:** music shares SND's context, limiter and noise buffer (`SND.core()`). Every `SND.play` call reaches the music (`SND.listen`), played or not, so intensity follows the match even with effects muted. An effect that actually sounds dips the music to 80% and it recovers within ~0.2 s, at most once per 60 ms. **The lab's `muDrop` low-pass sweep on kills is not ported** (owner 2026-10-03): there is no filter on the music's way out at all, and nothing ever takes it below 80% while it is on.
- **Scheduling:** a 25 ms timer queues every step starting within the next 0.12 s on the audio clock. After a stall (a hidden tab) it restarts just ahead of now instead of firing the missed steps. The context runs while effects or music is on and the tab is visible (`SND.hold`).
- **The control** (`MUS.mount(button, slider, meter, store)`): "♫ Music on" / "♪ Music off", a music volume slider (default 60, matching the lab's default mix) and a small intensity meter. Armed until the first gesture like the effects; a press on either audio control (marked `data-audio-ctl`) only does what that control does, so muting effects never starts the music. Remembered as `{ muted, volume }` under `ai-tcg.music` (`musPrefParse` / `musPrefSerialize`), through the same `{ read, write }` store seam the website will fill from the account's Music setting.
- **The FX sheet's music desk** (part 4): pick a voice, tick "Mythic in play", push intensity with hit / big hit / kill / Mythic arrives, and watch the layers readout.

## Slice 6 as built (render session 15)

- `render/src/wardFx.ts`: `WARD_FX_PURE_SOURCE` (timing, layering, look, geometry, which units get a ward) and `WARD_FX_RUNTIME_SOURCE` (`WARDS`, the canvas runtime). Same single-source rule: the page embeds the text the tests run.
- **A plug-in on the slice-1 canvases** (`CFX.plug`, `CFX.kit`): `update`, `drawFloor` (under the cards, after the ground marks), `drawTop` (over the cards, before rings and projectiles), `alive`, `clear`, and `hasTop`. A resting ward keeps the loop alive but draws only on the floor; while nothing is over the cards the top canvas isn't cleared or repainted.
- **Over, then behind** (`wardLayering`, `WARD_T`): an arriving ward draws in over the card (`drawIn` 0.45 s), holds there until `onTop` (2.6 s after it arrived), then crossfades behind over `sink` (0.8 s; smoothstep, the two copies always sum to 1). At rest (`perm`) and while flaring (`pulse`) it is only ever behind. A ward waiting for its arrival cue is invisible, and shows behind on its own after `waitMax` (4 s) if the cue never comes.
- **Behind the card** (`WARD_BEHIND`): resting opacity 0.82 (the lab's over-the-card rest was 0.52); outer / middle / core opacity ×1.45 / ×1.3 / ×1 and size ×1.16 / ×1.08 / ×1. `R` = 0.98 × the card's height (the lab's 122 on a 123 px card). On the replay's 118×158 card the core (radius 57) fits inside the card and is hidden; the middle (124) and outer (180) reach past its corners (99). The tests check that geometry.
- **The four behaviours**, read from `mythics.json` (`behaviour`, `behaviourParams`), all on the floor: `seats` lights one seat per enemy unit (`wardSeatsLit`, up to `seats`) and rings when the count changes; `aura` draws tethers with travelling motes and a crest over each ally, and rolls a flattened pressure ring every 2.6 s; `heartbeat` beats (`wardBeat`) and sends a larva to a random ally every `spawnEverySeconds`; `gravity` pulls the grid in every frame and spirals pointers into the core.
- **The page** (`renderHtml.ts`): `WARDS.sync(wardsOnBoard(frame.players, specs), { stepping })` on every frame. Stepping one move forward, a new Mythic's ward waits and `runFx` cues `WARDS.arrive` on the card's own entrance beat (`causeT`), and a dying Mythic's ward is kept one step so `runFx` shatters it at the kill (`unitT(id)`, the same moment as `spawnGhost`). A jump just places or removes wards. `CFX.clear()` clears the ward particles, not the wards.
- **Arrival:** the ward draws in, the grid is pulled in and tinted, a shockwave and sparks; sound `ward` (the lab's wardIn + mythicIn swell). **Shatter:** 8 wedges per layer cut from the ward's own tinted sheet spin out over the board, with a shockwave and flare; sound `wardBreak`. **Flare** (`WARDS.pulse`): brighter, swells, a ring, behind the card; sound `wardPulse`. Slice 5's detector calls it when a Mythic with its own ward fires a signature ability; none of the ten approved entries is a Mythic yet, so no replay shows it.
- **The Mythic card** is obsidian + foil: near-black with a faint glow of its faction, a faction-coloured rim and header, and a slow light sweep (still under `prefers-reduced-motion`).
- **Only the sheets a replay needs are embedded** (`wardDataFor`): a Mythic that reaches the board in this match gets its 2×2 sheet as a data URI (~110-125 KB); the specs of all four are always there.
- `prefers-reduced-motion`: the ward doesn't rotate and the grid isn't pulled.

## Slice 5 as built (render session 16)

- `render/src/sigWardFx.ts`: `SIG_WARD_PURE_SOURCE` (which fires get a ward, their role, the guard timeline, the look over time) and `SIG_WARD_RUNTIME_SOURCE` (`FWARDS`, a second `CFX.plug` plug-in). Same single-source rule; Node evaluates the pure half together with `EFFECT_FX_SOURCE`.
- **Detection** (`signatureFires`, over the whole replay): an `abilityTrigger` whose card and ability id are in `signatureAbilities`, paired by `sourceId` with the effects `resolveEffects` found for it on that move. **First fire** is per card instance and ability (a Command's id is its stack id, so each copy cast is its own first fire). A fire that did nothing (no effect event) doesn't count: the ward goes with the first fire a viewer can see land.
- **The role comes from what the fire did, never the name** (`sigRole`): anything aimed at the other side (damage, removal, a debuff or a stun) is an **attack**; a Barrier given is a **defence**; an effect only on its own card is **self**; anything else that helps its side is a **buff**. On the ten approved abilities: seven attacks, two defences (Aegis Warden, Latent Ward), one self (Overload Capacitor). None is a buff, so the buff copy is built but no replay shows it.
- **The flare** (Rare = the faction sheet's single-ring cell 3, R = 0.75 × card height): draws in over the source (the card, or a Command's stack entry, sized as a card), then **leads the effect** by `sigLeadMs` (0.75 × the tick, 200-600 ms: 525 ms at normal speed). As the effect leaves, the ring spins up and pulses (a ring, a grid push, sound `wardPulse`); it collapses after the effect lands. On a strike move (Retaliation Node's onDamaged) it starts when the strike lands and the effects leave after it. The move counts as spectacle, so playback holds it (+900 ms).
- **The ward is that power's flourish:** the move's cast sigil, rays and `cast` sound stand down for it; the trigger tag ("ON PLAY", "TURN START", "ON HIT", "RESOLVE") still names it.
- **Defence = guard copies** (`signatureGuards`): a copy flies from the source onto each unit the fire gave a Barrier (R = 0.72 × card height), sinks behind the card over 0.5 s and **stays behind it for as long as that Barrier stands**, resting quietly (opacity 0.5). When the Barrier takes its hit, or the unit leaves, the copy cracks into 8 spinning wedges at the same beat as the BLOCKED shield or the card's death (sound `wardBreak`). A self-defence (Aegis Warden) guards its own card. A jump places or removes guards to match the frame.
- **Buff = a smaller copy** (R = 0.5 × card height) settles on each ally it reached, rests 0.9 s, and goes.
- **Only the sheets a replay needs are embedded** (`sigWardDataFor`, ~85-125 KB per faction); a replay with no signature fire carries none.
- Neutral has no ward, and an unknown faction has none either. Without the canvas or the sheet, nothing changes: the v1 cast flourish plays as before.

## Slice 7 as built (render session 17)

- `render/src/fallbackWard.ts`: `FALLBACK_WARD_PURE_SOURCE` (`fwHash`, the seeded generator, `fallbackWardPlan`, `fallbackWardLook`, `fallbackWardsNeeded`) and `FALLBACK_WARD_RUNTIME_SOURCE` (`fallbackWardSheet`). Same single-source rule; the page and the FX sheet embed the text the tests run.
- **Plan, then draw.** `fallbackWardPlan(name, faction)` makes every random choice up front (FNV-1a of `faction:name`, then mulberry32) and returns plain data: the outer ring's ticks, node count and glyph strokes, the middle pattern and its numbers, the core polygon, the ornament. `fallbackWardSheet(plan)` draws it into a 2×2 greyscale-on-black sheet of 512 px cells in the Replicate layout (outer / middle / core / ornament), so `WARDS` tints, spins, flares, acts out behaviours with and shatters it exactly like art.
- **Faction = material** (`FW_KITS`): Cortex chips and straight glyphs (spokes / polys / orbits); Aegis plates, thick lines (polys / spokes / plates); Swarm eggs and curved glyphs (curl / spokes / orbits); Null broken nodes with torn cuts in the rings (orbits / curl / polys); Neutral rune tablets and arc glyphs (runes: concentric rings broken into notched arcs / orbits / polys). An unknown faction draws in the Neutral kit.
- **Symbol rules** (as `_howToAddAMythic`): nested polygons share one orientation (never two turned against each other, which reads as a star), no triangle in the core or the ornament, spokes are 16 or more (never a cross). Tested over 2,000 names.
- **Variety, measured:** all 303 signature menu combination ids get a distinct plan, and 299 of them a distinct coarse look (pattern and counts; the test floor is 95%); every kit uses all its middle patterns over 300 names. A distinct coarse look is not the same as easy to tell apart at a glance: the silhouette is always a ring.
- **In the page:** `wardsOnBoard` now lists every Mythic unit; one not in `mythics.json`, or naming a behaviour the runtime doesn't know, is `generic`. `WARDS.prepare(fallbackWardsNeeded(frames, atlases))` draws every sheet the replay needs at load (3-9 ms each in headless Chromium); `sync` still draws one lazily if needed. A Mythic with art always uses its art. Drawing is wrapped in try/catch: a sheet that fails means no ward, never a broken card.
- **`generic` behaviour:** the layers counter-rotate and a soft ring leaves the ward every 3.2 s (`WARD_GENERIC_EVERY`), behind the card.
- **The turn line got its own backing** (90% of the page background): a ward behind a top-row card reaches up past it, and with a signature card on each side that is common.
- **FX sheet part 5:** the generator's gallery, three wards per faction, spinning (each faction's set Mythic as it would look without art, and for Neutral the two demo signature cards and a menu id).
- **Demo signature cards** (`render/src/demoSignatures.ts`, CLI `--signatures`): Consensus Lantern (Rally +0/+1, 3/6) and Tollgate Daemon (Tax, 3/6), two lines that pass the owner's fairness test, standing in until the engine's agent generator hands out real ones.

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
3. Procedural sound effects with faction voices (port the lab's `SFX`); on by default and armed until the first gesture, mute remembered, effects volume (owner 2026-10-07). **Built, render sessions 12-13** (`render/src/soundFx.ts`; see "Slice 3 as built"; audition grid in the FX sheet).
4. Adaptive procedural music (port the lab's music block), no kill dropout. **Built, render session 14** (`render/src/musicFx.ts`; see "Slice 4 as built"; music desk in the FX sheet).
5. Faction wards for signature abilities, driven by `signatureAbilities`. **Built, render session 16** (`render/src/sigWardFx.ts`; see "Slice 5 as built").
6. Mythic unique wards: permanent layered ward, the four behaviours, Mythic card treatment, shatter on death; read everything from `mythics.json`. The ward sits behind the card (owner 2026-10-11). **Built, render session 15, ahead of slice 5** because the owner's 2026-10-11 entry was about these wards (`render/src/wardFx.ts`; see "Slice 6 as built").
7. Fallback ward generator, so any Mythic without art still gets a unique ward. **Built, render session 17** (`render/src/fallbackWard.ts`; see "Slice 7 as built"; gallery in the FX sheet). With it, every v2 slice is built.

Each slice: build it for all factions, keep meaning constant, prove it at play speed, checkpoint, and update this file if the model itself changes.

## v1 build history (still in use; v2 builds on it)

Render sessions 4–9 built the v1 primitives on the DOM: defence/shield (s4), rise/sink stat FX (s5, `statFx.ts`), cast flourish with exact source attribution (s6, `castFx.ts`), attack travel + aim line + redirect + fizzle from the combatDamage stack item (s7, `attackFx.ts`), fixed slots (s8), and the placeholder faction skins (s9, `factionSkin.ts`, `npm run skin-sheet -w @ai-tcg/render`). v2 replaces the placeholder particle look with the sprite materials and canvas layer; keep the v1 timing, attribution and response-window behaviour.
