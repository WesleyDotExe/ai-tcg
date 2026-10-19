# Render lane — notes for the owner

The render lane's own notes-for-owner (RENDER.md guardrail 4 — kept
separate from the shared `progress/notes-for-owner.md`).

---

## 2026-09-24 — Session 1

1. **Two small gaps in the engine's public barrel, found while wiring this
   lane, not fixed by it.** `engine/src/index.ts` doesn't export
   `buildNullDeck` (only `buildCortexDeck`/`buildSwarmDeck`/`buildAegisDeck`/
   the generic `buildDeck` are exported, even though `buildNullDeck` exists
   in `decks.ts` right next to them — looks like an oversight from whichever
   session added Null, not a deliberate omission) or the third reference
   agent, `LookaheadAgent` (only `RandomAgent`/`AggressiveAgent` are
   exported). This lane can't fix it — RENDER.md forbids editing any engine
   file, `index.ts` included — so `render/src/engineInternal.ts` deep-imports
   both directly from their source files instead, with a comment explaining
   why. Harmless as-is, but the balance lane (or whoever next touches
   `index.ts`) may want to add both to the barrel — it's a one-line-each,
   zero-risk fix, and would let this lane (and any future consumer) use the
   normal `@ai-tcg/engine` import instead of reaching past it.

2. **The telegraph-delay-feel question RENDER.md flagged as "parked" is now
   answerable.** Both committed replays (`render/output/*.html`) show a
   telegraphed unit sitting dormant on the board with a visible "ARMING /
   T<n>" countdown before it fires — e.g. `aegis-vs-cortex-seed1.html` has
   Latent Ward (telegraph=2) visibly dormant from move ~55 through its arm
   turn. Whoever wants to judge the 1-vs-2-turn fuse question from
   `progress/owner-feedback.md`'s 2026-09-13 entry can now actually watch it
   rather than infer it from a text log. Not judging it myself here — that's
   a taste call for whoever looks at the render, not something this session
   should decide unilaterally.

3. **Two placeholder-art decisions made without a checkpoint gate, flagged
   here for visibility rather than blocking on them:** the per-card
   generative pattern is a simple hash-driven hue-shift + one of 4 CSS
   background patterns (see `render/src/cardVisual.ts`) — distinct per card,
   consistent per faction, but obviously not "real art," and a rarity-driven
   frame treatment (inset highlight -> glow -> pulsing glow for Uncommon ->
   Rare -> Mythic) was added now rather than deferred whole-cloth to stage 8,
   reasoning that flat-identical-regardless-of-rarity cards would themselves
   read as a regression against this stage's own "genuine visual interest"
   bar. Both are cheap to change or remove later; flagged in
   `progress/render/checkpoints.md`'s "decisions to overrule" section too.

4. **The event log's `attacker`/`defender`/`target`/`unit` fields are card or
   player NAMES, not instance IDs — a real identity gap, found while
   building session 2's animations, not fixed (this lane can't touch engine
   files).** `engine/src/engine/engine.ts` (`attacker: attacker.card.name`)
   and `engine/src/effects/resolver.ts` (`target: player.name`,
   `target: unit.card.name`) confirm this directly in the source, not
   inferred. Consequence: whenever two units on the board share a card name,
   or (this project's own standard balance-testing shape) both players run
   the same agent name — e.g. Lookahead-vs-Lookahead, exactly what both
   committed sample replays use — the event log genuinely cannot say WHICH
   copy or WHICH player an effect applied to by name alone. This was already
   true of the plain scrolling text log (session 1 reused `formatEvent`
   as-is), just not previously named as an identity gap; session 2 avoided
   building on it for animation (used the frame snapshots' own instanceId
   diff instead, which is exact) specifically because of this. If the
   balance lane or a future engine session ever wants the log itself to be
   unambiguous (e.g. for a future commentator agent reading the event
   stream, per DESIGN's stage 7 — commentary needs to say WHICH unit, not
   just "a unit"), the fix is adding an optional instanceId alongside the
   existing name fields on the relevant `GameEvent` variants — not a
   breaking change, since `formatEvent` can keep using the name for prose.
   Flagged, not built, since it's an engine-file change this lane cannot
   make.
5. **The telegraph-arming question RENDER.md parked is now watchable in
   motion, not just inferable from a static frame.** Both committed replays
   show a telegraphed unit's dormant state end live — the card pulses gold
   the instant `pending` flips off — rather than session 1's "sits there
   with a countdown, no visual event when it actually arms." Still not
   judging the 1-vs-2-turn fuse question myself; flagging that it's now
   even more directly watchable than session 1 already made it.

6. **Match replays are fairly large committed files** (`render/output/
   *.html` run 580-640KB each — mostly the embedded per-move JSON snapshot
   for a 150-180-move match). Fine at this scale; worth knowing before this
   lane accumulates dozens of committed sample replays, in case the owner
   would rather this lane keep only 1-2 "current" evidence files and
   regenerate on demand instead of accumulating a growing binary-ish history
   the way `progress/sample-match-*.txt` does. Not changing the convention
   unilaterally — flagging the tradeoff.

## 2026-09-26 — Session 3 (scale animation magnitude to event magnitude)

7. **The browser-side magnitude-scoring logic is hand-duplicated, not
   imported, from its tested source.** `render/src/fxMagnitude.ts` is a
   real, unit-tested module (20 tests) — but `renderHtml.ts`'s inline
   `<script>` can't `import` it, since the replay page is a single
   dependency-free HTML file with no bundler in this lane's toolchain. The
   scoring logic (rarity weights, tier thresholds, per-effect formulas) is
   copied by hand into the template-literal JS, with a comment in both
   files pointing at the other. This is the same shape as the pre-existing
   `cardArtStyle`/`cardVisual.ts` split, just a second instance of it now —
   real drift risk if one side changes without the other, flagged rather
   than silently accepted. A bundler step for this lane's inline script
   would remove the risk entirely but is a real toolchain addition, not a
   small one — not taken unilaterally.

8. **The lethal-blow full-screen flash fires on any game-ending move, not
   only an actual killing hit** — a turn-cap or move-cap ending gets the
   same dramatic radial flash as a real lethal blow, since "the match just
   ended" is still arguably the single biggest beat of a replay either way.
   If a turn-cap ending should read differently (a duller "time's up" cue
   instead of the same red "lethal" flash), that's a small, easy follow-up
   — not done this session since the owner's feedback named "a lethal blow"
   specifically and didn't address non-lethal endings.

9. **Session 2's stacked-floating-number thin spot is still open, confirmed
   again.** When two FX land on the same card in the same move (e.g. a hit
   and a buff together), their floating numbers can visually overlap — seen
   again in this session's own screenshot evidence
   (`progress/render/log.md`'s session-3 entry). Not a magnitude-scaling
   problem, so out of scope for this session's slice; a real next
   micro-slice (offset each subsequent number spawned on the same card
   within a move) whenever picked up.

## 2026-09-26 — Session 4 (defence/shield primitives, EFFECTS.md slice 1)

10. **This dev/CI environment's headless Chromium has no colour-emoji font,
    and an unsupported codepoint can render as fully invisible rather than a
    visible "tofu" fallback box.** Found by screenshotting a real shield-emoji
    badge (U+1F6E1) and seeing nothing at all — not even the badge's own
    background — where the DOM inspector confirmed the element was present
    and correctly populated. Root cause: with no colour-emoji glyph
    available, the browser fell back to an ambient inherited text colour
    that happened to be near-black-on-near-black for this specific badge,
    so there was no visible fallback shape at all to notice as "broken." A
    real trap for any FUTURE render session tempted to reach for an emoji
    as a cheap placeholder icon (EFFECTS.md's build order has several
    upcoming slices — buff/penalty, cast flourish — where that's tempting).
    This session's fix: plain ASCII letter glyphs in a small badge (matches
    the existing single-letter rarity badge convention already in
    `renderCardEl`) instead of emoji, which render identically everywhere
    Courier New does. Worth a standing rule in `render/EFFECTS.md` or a
    comment near `renderCardEl` if this keeps coming up — not added
    unilaterally by this session since it's a style-guide-level call, not a
    single-slice one, but the concrete failure mode (screenshot to verify
    ANY new glyph choice; a DOM-presence check alone is not enough) is
    flagged here for whoever hits it next.

---

## 2026-09-26 — Session 5 (buff/penalty grammar, EFFECTS.md slice 2; avatars)

1. **Player avatars are in.** Each player now has a username-seeded
   placeholder avatar (HUD and match bar). `MatchReplay.identities[pid]`
   has an `avatarUrl` slot, and the page uses a real image there when one
   is provided. Nothing for you to do until the platform/onboarding stage
   supplies real profile images. The replay CLI now suffixes `-A`/`-B` on
   mirror matches so the two sides get distinct usernames, and therefore
   distinct avatars.

2. **A card interaction worth knowing about (balance lane's call, not
   this lane's).** Found by this session's real-match tests: Reflex Spike's
   +0/+3 buff on Overclock Beast (SW-004) does nothing visible. Overclock
   Beast's health comes from a stat-scaling override, which swallows the
   buff. The engine logs "grants +0/+3", but the board doesn't change, so
   the render correctly shows nothing. If that's intended, fine. If not,
   it's a wasted card that agents may keep playing.

3. **Small engine log cosmetic:** negative buffs format as "+-1/+0" in the
   event log (e.g. "Feedback Plating grants Aegis Cadet +-1/+0"). That's
   `engine/src/log/format.ts`, so it's off-limits to this lane. Commentators
   (stage 7) will read this text, so it's worth a one-line fix on a balance
   session.

4. **Still open from before:** slice 4 (attack travel + impact) needs
   instance IDs on attack/damage/buff events. As of this session only
   `play` and `summon` carry `instanceId`.


---

## 2026-09-26 — Session 6 (cast flourish, EFFECTS.md slice 3; slice-2 taste calls)

1. **Your three slice-2 taste calls and the negative-"grant" note are all
   done** (this lane records it here, not in owner-feedback.md, per
   RENDER.md guardrail 4). Multi-unit penalties are now spectacle.
   Source-faction tint and the label/particle split were already shipped,
   and the new cast flourish follows both. Feedback Plating's `+-1/+0` at
   aegis-vs-aegis seed 1 moves 29/40 sinks, since the stat delta's sign
   decides, never the event name. There's a regression test on that exact
   match.

2. **Slice 4 (attack travel) may no longer be blocked on the balance
   lane.** The engine's `combatDamage` stack item already carries
   `attackerInstanceId` and an instance-exact `target`, and the render can
   read those read-only, the same way this session reads an activated
   ability's source. The event-log instance-ID work is still worth doing
   for commentators (stage 7), but the render may not need to wait for it.

3. **Four taste calls on the cast flourish** are in
   `progress/render/checkpoints.md`: cause/effect stagger, tag wording,
   response loudness, and where a Command casts from. None of them block
   anything.

## 2026-09-27 — Session 7 (attack travel + impact, EFFECTS.md slice 4; your four cast-flourish calls)

1. **Your four cast-flourish taste calls are all applied.** Recorded here,
   not in owner-feedback.md (RENDER.md guardrail 4).
   - Call 1: the ~150ms "cast, then effect" beat now plays only on moves
     where a spectacle-tier power fired. Routine powers stay simultaneous,
     and the tick itself is unchanged.
   - Calls 2 and 3: tag wording and response loudness are kept as they
     were.
   - Call 4: a Command's card now flies from its caster's hand onto the
     stack, and its CAST/RESOLVE sigil plays on its stack entry, not the
     avatar. Your 2026-09-26 render entry can be marked handled whenever
     you next edit that file.

2. **Slice 4 needed no engine change, confirmed.** The capture now copies
   three read-only fields from each stack item: its engine id, plus a
   combat item's `attackerInstanceId` and `target`. The render follows
   each attack from declaration through any redirect to resolution by
   that id. The event-log instance-ID work is still worth doing for
   commentators, and for pairing *effect* damage (which card's power hit
   which unit). Attacks no longer need it.

3. **Taste calls for this slice** are in `progress/render/checkpoints.md`.
   Briefly:
   - the aim line stays up for the whole response window;
   - the bolt's flight comes out of the start of the move's own time;
   - a defender with attack sends a return bolt in its own colour;
   - on a strike move, *everything* (deaths, onDamaged/onDeath powers)
     waits for the bolt.
   None of these block anything.

4. **One existing thin spot got slightly more visible.** The board has no
   fixed slots, so when a unit dies the cards to its right slide left
   straight away. A dying unit's ghost now stays in place until the bolt
   that kills it lands (~200ms at normal speed), so for that moment it
   sits on top of the card that slid into its spot. It reads acceptably:
   the ghost is what's being hit. Fixed-slot layout is the real fix and is
   on the render debt list.

5. **The spectacle-only cast stagger (your call 1) almost never fires in
   real play.** No power reached spectacle tier on a move without a strike
   in 72 real matches. The behaviour is proven on a fixture: +150ms on
   spectacle, simultaneous otherwise. If you want the beat seen more
   often, lower the bar for a power to count as spectacle. That's your
   decision to make, not mine.

## 2026-09-29 — Session 8 (fixed-slot layout; the response beat)

1. **Your 2026-09-27 render entry is fully applied.** Item 1 (accept slice
   4) needed nothing. Item 2: the cast beat now fires on every response,
   on the move its effect lands. Item 3: fixed-slot layout is in. Your
   entry can be marked handled the next time you edit owner-feedback.md.
   This lane doesn't write to that file (RENDER.md guardrail 4).

2. **One real bug from session 7, now fixed.** The redirect's fading old
   aim line, which I described last session, never actually showed. A
   redraw erased it the instant it was drawn. It's visible now. The
   session 7 screenshot check missed it, because the fade was gone before
   any screenshot could catch it.

3. **Four layout and beat taste calls** are in
   `progress/render/checkpoints.md`: Directives on the right, keeping
   the ghost's spot clear, gaps staying open, and where the response beat
   plays. None of them block anything.

4. **Small render-only wish, not a blocker.** The engine logs a response
   as a `cast` event with no stack id. The render pairs it with its stack
   item by card name and controller, which is exact in all 48 test
   matches. A `stackId` on the `cast` event would make that pairing exact
   by construction. It belongs with the event-log instance-ID work, not
   on its own.


---

## 2026-10-02 — Session 9 (faction skins)

1. **The quickest way to judge slice 5 is `render/output/skin-sheet.html`.**
   It shows every particle primitive frozen mid-flight, one row per
   faction. The replays show the same skins in motion, but only one
   strike at a time for a few hundred ms. Five taste calls are listed in
   the new checkpoint. The two most likely to need your eye are dropping
   the arrow shape on skinned motes, and Null's stepped glitch motion.
2. **The owner-feedback 2026-10-02 entry (Watchdog Timer buff, Null
   accepted into the gate) is untouched.** It is a balance/card item, and
   RENDER.md bars this lane from card files and the shared feedback file.
   Under the alternation rule, the next session is balance and picks it
   up.
3. **No engine change was needed.** The per-hit effect-damage travel still
   waits on the event-log instance-ID work, as noted in earlier sessions.

## 2026-10-03 — Session 10 (EFFECTS.md v2 slice 1: canvas layers + sprite travel/impact)

1. **Quickest way to judge slice 1: `render/output/fx-sheet.html`.** It
   loops one volley per faction (subtle / normal / spectacle hit on a card,
   then a hit on a player), drawn by the replay's own canvas code. In a
   replay, any attack shows it. Stills are in `progress/render/evidence/`
   (`v2-s1-*.png`).

2. **Proposed `signatureAbilities` list (needs your approval before slice 5
   wires faction wards to it).** Your rule: a ward appears only when a Rare
   or Mythic uses an attack, buff or defence unique to its rarity. I read
   every Rare and Mythic in the pool (25 cards) and sorted their abilities.

   **Proposed IN** (each fires once, on arrival, and is an attack, buff or
   defence):

   | Card | Faction | Ability id | What it does | Kind |
   |---|---|---|---|---|
   | Dormant Egg Sac | Swarm | `dormant-egg-sac-hatch` | 3 damage when it hatches | attack |
   | Kernel Panic | Null | `kernel-panic-evolve` | destroy a unit | attack (removal) |
   | Deprecated Routine | Null | `deprecated-routine-arm` | -2/-2 permanent | attack (debuff) |
   | Retaliation Node | Cortex | `retaliation-node-damaged` | strikes back for 1 when damaged | attack |
   | Overload Capacitor | Cortex | `overload-capacitor-play` | Overload: 1 damage at end of turn, 3 turns | attack (damage over time) |
   | Aegis Warden | Aegis | `aegis-warden-evolve` | heal 10 + Barrier | buff + defence |
   | Latent Ward | Aegis | `latent-ward-arm` | Barrier | defence |
   | Lockdown Field | Aegis | `lockdown-field-cast` | Stasis 1 turn | defence |
   | Dormant Exploit | Cortex | `dormant-exploit-arm` | Stasis 2 turns | defence |

   **Proposed OUT, with the reason:**
   - **All four Mythics' abilities are statics** (Quorum Arbiter, Prime
     Aegis ×2, Hive Mother, Null Singularity). Their permanent unique wards
     already act these out all the time (slice 6), so nothing fires as an
     event that could flare the ward. As a result, no Mythic has a
     signature move in today's pool. If you want the Mythic ward to flare
     on something, the natural moment is when the aura first applies on
     arrival. That would be a render-only rule, not a signature ability.
   - **Rare statics/auras:** Mainframe Core, Overclock Beast, Recursive
     Construct, Tariff Field, Entropy Harvester, Segmentation Fault. These
     are always on, with no moment to call a ward.
   - **Recurring ticks:** Rate Limiter (1 damage every turn while the
     opponent has 3+ units). A ward every turn would be noise. It's the
     closest call; say if you want it in.
   - **Card draw:** Watchdog Timer, Uplink Tower. These aren't attack, buff
     or defence, and Uplink Tower is Neutral, which has no ward anyway.
   - **Arrival summon:** Bloodswarm Alpha. A summon is an arrival, and your
     rule says arrivals never show a ward.
   - **Tools with no ability id:** Barrier Shim, Decay Ward. Their effect is
     a keyword or stat grant, so there's nothing to key a ward to.

   Two calls are yours: whether a debuff (Deprecated Routine) counts as an
   "attack", and Rate Limiter. Once you approve, I'll write the list into
   `render/presentation/mythics.json` → `signatureAbilities`.

3. **Mythic ward previews: nothing new to check.**
   `progress/render/mythic-wards-log.md` doesn't exist yet. The action
   hasn't generated a ward since the four hand-run, already-approved ones
   (Quorum Arbiter, Prime Aegis, Hive Mother, Null Singularity), and no
   Mythic has been added since.

4. **Aegis is now orange on the whole page** (`--aegis: #ff7d24`, your
   2026-10-02 call in EFFECTS.md). The faction tag, card frames, HUD tint
   and v1 skins all changed with the effects. Aegis and Neutral (gold) are
   both warm colours now. They read as different in the replays I watched,
   but they are closer than teal vs gold was.

5. **No engine change was needed.** Spell and ability travel to an exact
   target still waits on the event-log instance IDs. The balance lane has
   that queued (your 2026-10-04 entry, section A item 6).

## 2026-10-04 — Session 11 (EFFECTS.md v2 slice 2: categories, kills, camera beats, grid)

1. **Your 2026-10-04 render answers are applied.**
   - The 10 `signatureAbilities` entries are in `render/presentation/mythics.json`.
   - EFFECTS.md's Wards section has "first fire only" and "the Mythic's own
     ward flares on arrival".
   - One interpretation to confirm: "first time" is per card instance, so a
     second copy of Rate Limiter gets its own first flare. Nothing is wired to
     it until slice 5.
   - Neutral gold vs Aegis orange is unchanged, waiting on your replay check.

2. **Quickest way to judge slice 2: `render/output/fx-sheet.html`, part 2.**
   - It shows every faction × category (spell, heal, buff, debuff, removal
     ending in a kill), looping.
   - In a real match, `aegis-vs-null-seed3.html` moves 57 (Bit Rot), 77
     (Perimeter Turret's shells kill Dangling Pointer) and 120 (Breach Charge
     destroys Segmentation Fault).
   - Stills are in `progress/render/evidence/v2-s2-*.png`; seven taste calls
     are in the render checkpoint.

3. **Telegraph and pacing note:** an ability's result now shows when its
   travel lands (~210 ms at normal speed) instead of the instant the move
   starts. The tick is unchanged. If the moves start to feel late, that's the
   number to shorten (`travelMs` in renderHtml.ts).

4. **Mythic ward previews: nothing new.** No Mythic has been added and
   `progress/render/mythic-wards-log.md` doesn't exist yet.

5. **No engine change was needed.** The game session 27 instance ids were
   enough for exact source → target travel on everything except Overload's
   end-of-turn tick, which has no source id and flies nothing.

## 2026-10-05 — Session 12 (player hits mid-board, Neutral white-gold, EFFECTS.md v2 slice 3: sound)

1. **Your three 2026-10-05 render entries are applied:**
   - attacks and effects aimed at a player land in the middle of their side of the board (EFFECTS.md Axis 1 updated);
   - Neutral is white-gold `#fff0c2`, and `mythic_ward.py` has a Neutral theme for the unique Mythics;
   - slice 3 (procedural sound) is built.

2. **The quickest way to judge the sound is `render/output/fx-sheet.html`, part 3** (scroll down).
   - Press "Sound: off" to switch it on.
   - Click a faction name to hear all 11 of its sounds, or a sound name to hear it in all five voices.
   - Then try a replay with sound on: `aegis-vs-null-seed3.html`.

3. **One taste call worth a look:** a spectacle face hit lands in the gap between slots 3 and 4, and its flash spills onto the cards either side (`progress/render/evidence/v2-s3-face-hit-spectacle-aegis-vs-cortex-seed6.png`). If it reads as hitting a card, the alternative is landing on the nearest empty slot. See checkpoint item 1.

4. **Mythic ward previews: nothing new.** No Mythic has been added since session 11, and `progress/render/mythic-wards-log.md` still doesn't exist.

5. **No engine change was needed.**

## 2026-10-07 — Session 13 (your slice-3 answers: number at the impact, sound on by default)

1. **Your 2026-10-07 render answers are built.** Calls 2 and 7 changed; 1, 3, 4, 5 and 6 are as built. Open any replay in `render/output/`: sound starts on your first click (Play counts), the "🔊 Sound on" button mutes, the slider sets the effects volume, and both are remembered next time.

2. **For the website (build-order step 3-4), one hook to wire:** the replay's sound control takes a store with `read()` / `write()`. The account's Sound setting should be that store, so a viewer muted on the website stays muted in every embedded replay. Nothing to decide now; it's recorded so the website session finds it.

3. **Four small calls are in the render checkpoint** (default volume 80%, where the number sits, the greyed slider while muted, the FX sheet sharing the setting).

4. **Mythic ward previews: nothing new.** `progress/render/mythic-wards-log.md` still doesn't exist.

5. **No engine change was needed.**

---

## 2026-10-09 — Session 14 (music)

1. **Music is in.** Open any replay in `render/output/`, click anywhere and
   it starts (on by default, like the sound). The FX sheet's part 4 is a
   music desk for judging it by ear. The six calls are in
   `progress/render/checkpoints.md`.
2. **For the website (build-order steps 3-5):** the account settings need a
   **Music** setting (muted + volume) beside Sound. The replay hands each
   one through its own `{ read, write }` store (`SND.mount`, `MUS.mount`).

---

## 2026-10-11 — Session 15 (Mythic wards behind the card; the arpeggio choice)

1. **Your 2026-10-11 "Mythic wards sit behind the card" is built:** in
   EFFECTS.md, the effects lab and the replays. In the replays the Mythic
   wards are new this session (slice 6), so they were built behind the card
   from the start.
   - **Quickest look:** open `render/output/null-vs-cortex-seed4.html`, drag
     to move 120, then press → once. Null Singularity's ward draws in over
     its card and sinks behind it about three seconds later. Quorum Arbiter's
     ward is already behind its card in the row above.
   - **For a death:** `cortex-vs-swarm-seed11.html`, move 98, then →.
   - The six calls, including "how long on top" and "how it stands out", are
     in `progress/render/checkpoints.md`.
   - Please mark the entry handled in `owner-feedback.md`, or have the next
     game-lane session do it (this lane doesn't write that file).
2. **Your 2026-10-10 render item 4 is built:** "arp: acting player /
   whoever is ahead" sits next to the music control and is remembered. Item
   6 (the website's Music setting, menu music and the music widget) waits
   for build-order steps 4-5.
3. **One look change you didn't ask for directly:** Mythic cards are now
   "obsidian + foil" (dark, rimmed in their colour, with a light sweep), as
   EFFECTS.md and the lab specify. Without it, a ward behind a bright card
   barely stood out. It's call 4 in the checkpoint.
4. **Mythic ward previews: nothing new.** No Mythic has been added, and
   `progress/render/mythic-wards-log.md` still doesn't exist.
5. **No engine change was needed.**

---

## 2026-10-13 — Session 16 (EFFECTS.md v2 slice 5: faction wards for signature abilities)

1. **Slice 5 is built:** the first fire of each of your ten signature
   abilities calls its faction's ward in the replays.
   - **Quickest look:** open `render/output/aegis-vs-cortex-seed1.html`,
     drag to move 134, then press → once. Latent Ward's orange ring flares,
     and copies fly onto the four units it shields and settle behind them.
     Drag to move 149 and press → again: Rate Limiter's hit lands on the
     four Barriers and the four guards crack.
   - **An attack:** `null-vs-cortex-seed4.html`, move 69, then →
     (Kernel Panic's removal leaves from its Null ring).
   - The six calls are in `progress/render/checkpoints.md`. The two
     likeliest to want your eye: guards staying behind the card until the
     Barrier breaks (call 2), and Overload Capacitor, whose "signature" is
     its own drawback (call 6).
2. **Three new committed replays** (each about 1.2 MB) cover what the
   older nine didn't: every Cortex signature, Latent Ward and Retaliation
   Node. The older nine were regenerated; their match data is unchanged.
3. **Mythic ward previews: nothing new.** No Mythic has been added.
4. **The signature card (game sessions 31-32) gets no ward:** it's a Neutral
   unit, and Neutral has no ward. If you want the signature card to look
   special in the replays, that's a new call.
5. **No engine change was needed.**


---

## 2026-10-14 — Session 17 (EFFECTS.md v2 slice 7: fallback wards)

1. **Session 16's note 4 is superseded.** Signature cards now get a ward:
   the Mythic ward, drawn by code from the card's name (white-gold,
   Neutral's own rune material). The checkpoint (call 1) asks whether
   that's what you want.
2. **Signature cards never get Replicate art** as things stand: the art
   action only reads `mythics.json`, and generated agents' cards aren't in
   it. If you want art for them, the cost is about $0.15 per agent through
   the existing pipeline (checkpoint call 2). Nothing to set up until then.
3. **Ask for the game lane, not a blocker:** when `generateAgent` lands,
   its signature card names feed the ward seed directly. A name change
   changes that agent's ward, so names should be fixed once given.
4. **No engine change was needed.** `buildSignatureCard` is read through
   `render/src/engineInternal.ts`, like the other deep imports.


---

## 2026-10-15 — Session 18 (the signature zone)

1. **Quickest look:** open `render/output/cortex-vs-aegis-sig-seed5.html`,
   drag to move 102, then press → once. Cinder Uplink dies and a white-gold
   card shape flies back into its zone, which now says 7. Drag to move 116
   and press → to see it played again for 7.
2. **Six calls are in `progress/render/checkpoints.md`.** The two likeliest
   to want your eye: where the zone sits (call 1) and the waiting card
   showing its next cost instead of its printed cost (call 2).
3. **Your 500-piece signature art pool (2026-10-15, game lane) fits
   straight in.** When it exists, the card in the zone and on the board
   can show its piece; the ward stays code-drawn, as you accepted. Nothing
   for the render lane to do until the pool and its assignment exist.
4. **Names feed the ward seed.** When the game lane switches to template
   names, both demo agents in the replays get new names and new wards.
   That's expected: I'll regenerate the two signature replays then.
5. **No engine change was needed.** `signatureCost` is read through
   `render/src/engineInternal.ts`, like the other deep imports.


---

## 2026-10-15 — Session 19 (hardening pass)

1. **The board's cost circles now show the card's cost.** They all said 0
   before. A signature card on the board shows its printed cost. What the
   replay charged stays in its zone, next to the red climb.
2. **The replay works on a phone without sideways scrolling.** Below 900 px
   the momentum gauge moves under the two players; below 560 px everything
   stacks in one column. Measured on all 14 replays at six widths. A still
   is at `progress/render/evidence/v2-s19-narrow-sig-seed5-390.png`. One
   small taste call: on a phone the gauge sits under both players rather
   than between them. Say if you want it elsewhere.
3. **The two signature replays now carry the generated names:** Wren Mk II
   plays Proxyviper's Twilight Download, Tamsin of the Long Queue plays
   Wireburner's Anthem (seed 5); Vesper Zero plays Unpatched Encore, and
   Zephan of the Long Queue plays Data Heist of the Recycle Bin (seed 2).
   Their wards changed with the names, as expected. Quickest look: open
   `render/output/cortex-vs-aegis-sig-seed5.html`, drag to move 102, press →.
4. **The render lane now keeps its own debt list,**
   `progress/render/quality-debt.md`.
5. **No engine change was needed.**

---

## 2026-10-18 — Session 22 (the match feed, tightened)

1. **The game lane's two fixes are now used by the render** (game session
   38). Rules text is looked up by ability id alone. The end of the game
   and attack fizzles are worded from `cause`. The "'s" problem is gone:
   "X wins: Y's health reached 0".
2. **A small engine ask for the game lane, not urgent.** The other fizzle,
   Intercept Routine finding nothing to redirect, still has no structured
   cause. Its reason text reads "Intercept Routine: Garbage Collector's
   attack is already aimed at Barrier Drone", so the feed prints "fizzles:
   Intercept Routine: Garbage Collector's attack ...". It reads, but
   clumsily. The fix would be the same shape as the attack fizzles: a
   `cause` (`alreadyAimed` / `noPendingAttack`) plus the source and attacker
   names. I haven't touched the engine. Seen in Null vs Aegis seed 3, move
   33 (`progress/render/evidence/v2-s22-feed-summary.txt`).
3. **No engine change was made.** The soundness test wraps the engine's
   resolver inside the test only; no engine file changed.

---

## 2026-10-17 — Session 23 (the board agrees with the feed)

1. **Quickest look:** open `render/output/aegis-vs-cortex-seed1.html` at
   a narrow window (about 580 px) and step with →. The hit numbers and
   "ON PLAY" tags now match the smaller cards. At full width nothing
   changed.
2. **Three calls are in `progress/render/checkpoints.md`.** The one most
   likely to want your eye: a trigger that changed nothing now gets no
   flourish at all on the board (call 1), the same rule you kept for the
   feed.
3. **The game lane's Intercept Routine cause (game session 39) is used.**
   The feed reads "Intercept Routine fizzles: Garbage Collector's attack
   was already aimed at Barrier Drone". Nothing more is needed from the
   game lane for fizzles.
4. **No engine change was made.**

## 2026-10-17 — Session 24 (pack opening, slice 1: one pack and every finish)

1. **The render now reads the economy, read-only.** `render/package.json`
   depends on `@ai-tcg/economy` (one line in `package-lock.json`). The
   pack page is built from real `EconomyStore.openPack` results in an
   in-memory database (`render/src/packDemo.ts`). No economy file was
   changed, and no data hook was needed from the game lane: `openPack`
   already returns everything the reveal shows (finish, slot, collector
   number, NEW, owned count, Prototype serial, secret code, pity, pack
   points).
2. **One small ask for the game lane, not blocking:** the store's pack and
   copy ids are random (`randomUUID`), so the committed
   `render/output/pack-opening.html` changes its ids every time it is
   rebuilt, even though the packs are the same. A seedable id source for
   demos would make it byte-stable. The test compares everything but the ids.
3. **The 3 Zero-Day cards show their reserved entry**, as you asked, until
   they go live. When `ZERO_DAY_CARDS` joins the registry, the same page
   shows the real card with no render change (`cardFaceOf` reads the
   registry).
4. **The side task is done:** the match feed names a mode ("plays Patient
   Zero (Outbreak)", "casts Kill Switch, choosing Wipe"). Building it found
   two render bugs on modal cards, both fixed: the resolve line named the
   card "Kill Switch (Wipe)" (so the rules text didn't fold in and an extra
   "on entry" line appeared), and a mode's own rules text was missing from
   the feed's text table. No committed replay has a modal card, so none
   changed.
5. **No engine change was made.**

---

## 2026-10-18 — Session 27 (hold to tilt)

1. **Hold to tilt is built and waiting for your hands.** The 8 calls are in `checkpoints.md`. The two that most need a real phone are the 0.2 s hold (call 1) and the lean direction (call 2). The recordings are `progress/render/evidence/v2-s27-tilt-*.webm`.
2. **For the art pass (from your correction):** one flat image per card is enough. The tilt never moves the art inside the frame, so no foreground/background layers or cut-outs are needed.
3. **Nothing needed from the game lane** for this.

---

## 2026-10-18 — Session 28 (pack opening, slice 3: the first-time flow)

1. **Quickest look:** open `render/output/first-time.html`, press Begin and
   go through to the end. Or watch `progress/render/evidence/v2-s28-first-time-desktop.webm`.
   The 10 calls are in `checkpoints.md`. The ones that most need your eye:
   the order (call 1), no art on the pick screen (call 2), and the starter
   packs (call 9).
2. **Something to know about the starter packs (game lane, your call):**
   measured over 2,000 fresh sign-ups through the store, 55% of new owners
   see no hit (Full Art or better) in their 3 starter packs, and 15% see
   only Standard cards. The demo's fixed seeds happen to be such an opening.
   If the first packs are meant to be a high point, the store would need a
   rule for it (for example, one hit guaranteed across the 3 starter packs).
   The render shows whatever the store rolled.
3. **Ask for the game lane, not blocking: signature ability text.** The
   engine builds a signature card's abilities with a shorter text than the
   menu option prints. Inspire's is "A random unit of yours gets +0/+1." for
   "At the start of your turn, a random ally gets +0/+1 permanently.";
   Supply Line's is "Draw a card." for "On arrival, if you have 2 or fewer
   cards in hand, draw a card." The first-time page prints the option's own
   wording (taken from the generator's concept). The replays and anything
   else that prints `card.abilities[].text` still show the short one. The
   fix would be in `engine/src/data/signatureMenu.ts`: give each ability the
   option's (or size's) text.
4. **Ask for the game lane, your call first: the art piece at pick time.**
   ECONOMY.md says each of the 3 candidates comes with its art, but
   `confirmAgentDraft` draws the art-pool piece only when the card is made.
   The page follows the store: the art window is empty on the pick screen
   and the art arrives during the mint (call 2). If you want the art on the
   pick screen, `pickDraftAgent` would draw a piece for each candidate and
   `confirmAgentDraft` would keep the chosen one's.
5. **No engine or economy file was changed.** The render reads the store
   (in-memory databases, fixed seeds) and the engine's public generators.

---

## 2026-10-19 — Session 30: [OWNER CHECK-IN] the render lane's plan for victory boasts (not built)

Your 2026-10-19 entry asks each lane to propose its half before building. The game lane's half
(catalogue, ownership, loadout, the loadout saved on the match record, the close-win slot) is
approved. This is the render half: the boast animations, the end-of-match moment, and the loadout
picker. Nothing below is built yet.

**How a boast fits the effects language (EFFECTS.md).** A boast is a new event category,
**victory**, with its own grammar, the same for every boast: it *rises and radiates from the
winner's side of the board* and ends on the winner's name. It never moves toward the loser and never
touches the loser's cards or panel. This matters because some starter themes borrow shapes that
already mean something: Null's vortex means removal, Aegis's breach charge means a kill. In a boast
they play outward and upward (the Null void collapses, then blooms out of the winner's side), so a
viewer never reads a boast as "the loser's cards are being destroyed". Each boast is data over the
existing primitives (faction material kit, wards, particles, the background grid), not a
hand-drawn clip, as your entry asks ("code-drawn and self-contained").

**The 4 starter boasts (first drafts of the idea):**
- **Aegis, shield slam:** hex plates slam down in a wall along the winner's row, embers off each
  plate, then the wall locks into a crest over the winner's name.
- **Swarm, hive burst:** egg sacs bloom in every slot of the winner's row and burst into a rising
  spore column that spells out the name.
- **Null, void collapse:** a dark star pulls the winner's side's light in, holds a beat, and blooms
  out in glitch bars that settle into the name.
- **Cortex, data cascade:** columns of pixels rain onto the winner's row and assemble into the name
  as wireframe blocks.

**The end-of-match moment, in order:** the lethal hit and its existing full-screen beat play as now;
the winner's HP bar settles; then the boast (about 3 s); then the existing "X WINS" result lands
where the boast ends. A tap, Escape or a Skip button jumps straight to the result.

**Where the render reads it from:** each side's loadout on the match record (the game lane's
schema change). Until that lands, and for matches recorded before it, the render uses the
winner's faction starter boast. With the close-win slot, the render plays whichever boast the
record says played; it never picks one itself.

**The loadout picker:** an owner page in the same family as the pack page. It shows the agent's 4
slots (boast, card back, avatar, arena), each owned item with a looping preview, and a locked
"in the store" plate for items the owner doesn't own. Saving goes through the store's loadout call,
which refuses unowned items. This page comes last.

**Build order (one slice per render session):**
1. EFFECTS.md "victory" grammar; a boast spec format; the Aegis boast in the replays, with a sheet
   of it on a full and an empty winning board; skip; reduced motion. Checkpoint.
2. The other 3 starter boasts; the "hide cosmetics" toggle.
3. Read the loadout from the match record once the game lane's schema lands; the close-win slot.
4. The loadout picker.

**Decisions I'd like (suggested defaults in brackets):**
1. **When it plays** [after the lethal beat and the HP bar settle, before the result line, which
   lands as the boast ends].
2. **Length** [about 3 s; skippable by tap, Escape or a Skip button; it plays every time a replay
   reaches its end, not only the first time].
3. **Space** [the winner's half of the board and the winner's panel; the loser's side dims to
   about 70% but nothing moves on it].
4. **A draw** [no boast; the result line only].
5. **A turn-cap win** [still a win: the boast plays. With the close-win slot, a turn-cap win on 5
   health or less plays the close-win boast, as the store records].
6. **Old matches and missing loadouts** [the winner's faction starter boast. Alternative: none].
7. **The "hide cosmetics" toggle** [one "Cosmetics: on / off" switch for spectators that hides both
   sides' boasts, card backs, avatars and arenas; your entry says "a viewer can hide the other
   side's cosmetics", which for a spectator watching two agents I read as both sides. On the owner's
   own pages it hides only the other side's].
8. **Sound** [a short sting in the faction's procedural voice, with the music ducked under it; muted
   when sound is off].
9. **Reduced motion** [the boast's final pose as a still, with the name, for about 1 s].

Nothing for the game lane here beyond what's already approved: the render needs each side's loadout
(boast id) on the match record and the catalogue item's id to look up the boast's spec.

## 2026-10-19 — Session 32: victory boasts, slice 2 (the other three starter boasts; the cosmetics switch)

Nothing is blocking. The calls for this slice are in `progress/render/checkpoints.md` (newest entry).

**For the game lane (small, optional):** the store descriptions of two starter boasts in
`economy/src/cosmetics.ts` describe the first drafts, not what is drawn. Shield Slam's says "Hex plates
slam down" (they slam up; you kept that call in session 31), and Data Cascade's says "Columns of pixels
rain onto the winner's row" (they stream up out of it, for the same reason). This session only flipped
`drawn` on the three new starter boasts, as the catalogue's test asks. It left the wording alone because
the file is the game lane's. Suggested wording: "Hex plates slam up along the winner's row and lock into
a crest over the name." and "Columns of pixels stream up out of the winner's row and snap into a stack
of wireframe blocks over the name." Also `progress/economy-demo-013.txt` now regenerates with "drawn:
yes" on those three rows (nothing else changes); the game lane can refresh it when it next touches it.

## 2026-10-19 — Session 33: victory boasts, slice 2b (the two Season 0 boasts)

Nothing is blocking. The calls for this slice are in `progress/render/checkpoints.md` (newest entry).

**For the game lane (small):**
- This session flipped `drawn: true` on Boot Sequence and Dial-Up Fireworks in
  `economy/src/cosmetics.ts`, in the same change that adds their specs, as the catalogue's test asks.
  **Both are now on sale in Season 0 at 300 credits each** (your sale window: the whole season).
- One economy test assumed the Season 0 boasts were undrawn ("sells the Season 0 boasts only once
  drawn"). It now marks a copy of Boot Sequence undrawn for the "never on sale" half, so the rule
  stays tested; and the store tests' own catalogue (`CATALOGUE` in `economy/test/cosmetics.test.ts`)
  now holds the starter boasts and the test items only, so what the shipped seasons sell can't move
  those tests again. No store code changed.
- `progress/economy-demo-013.txt` step 2 ("both boasts are refused: the render lane hasn't drawn
  it") describes the shipped catalogue as it was. Rerunning `season0BoastsDemo.ts` now would show
  both on sale. I left the demo and its output alone (the game lane's files); you may want to pin
  the demo's step 2 to an undrawn copy of the catalogue, as the test now does.

**For you:** the new boasts only play in a replay once slice 3 reads the match record (until then
a replay plays the winner's faction starter). To see them now, open `render/output/boast-sheet.html`
and press Play on any Season 0 scene.
