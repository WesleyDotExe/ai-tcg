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

## 2026-10-19 — Session 34: victory boasts slice 3 built; [OWNER CHECK-IN] the plan for Match Boot (not built)

Nothing is blocking. Slice 3's calls are in `progress/render/checkpoints.md` (newest entry).

### Match Boot: the render lane's plan (your 2026-10-19 feature)

Nothing below is built. Your defaults are kept throughout. These are the details I'd add, with the
calls I'd like at the end.

**What it is in the effects language (EFFECTS.md).** A new event category, **intro**, with its own
grammar: *symmetric and centre-out*. Whatever happens on one half happens on the other at the same
moment, mirrored across the centre line, and the only thing that isn't mirrored is the saying, which
sits on the centre line itself. That keeps it neutral (your "favours neither side") and makes it the
opposite of a boast, which rises from one side only. Like the boasts, it is data over a few
primitives drawn by code (the CRT power-on and the dot font already exist from Boot Sequence), not a
clip.

**The beats (about 2.6 s, every match and every replay from its start):**
1. **0-0.5 s, power on:** both halves of the board are dark. Each half switches on like a CRT, at the
   same instant: a dot, a line along that half's centre, the picture opening from it, a flicker. Each
   in its own faction's colour (a mirror match: both the same colour). One shared tube thump.
2. **0.5-1.5 s, the handshake:** each half prints its own agent's line in a terminal type, at the
   same time and at the same speed, a key at a time: `LOADING AGENT: <name> [<FACTION>]`. The shorter
   name pads its line so both finish together. Then `HANDSHAKE OK` prints once on the centre line,
   in neutral white, with a two-tone modem-style chirp (much shorter than Dial-Up Fireworks' screech).
3. **1.6 s, the saying:** the centre line flashes and the saying slams in across it in the chunky dot
   font, white-chrome (neither faction's colour), with a hit and a short rising chord. Both halves'
   readouts clear at the same time.
4. **2.2-2.6 s:** the saying fades upward, the scanlines go, and the first board appears. The match
   starts (on a replay, the first move plays).

**How it stays different from the Boot Sequence boast:** two halves, not one; each half in its
faction's colour, not phosphor green; one line per agent, not five BIOS lines; no "SYSTEM READY";
no typed name in a plate; the ending is the saying on the centre line, not the winner's name.

**The saying.** Picked from the match's own seed by a fixed hash: 1 in 100 matches is `> SUDO FIGHT`,
the other 99 are spread evenly over the eight others. Every viewer and every replay of a match sees the
same one. No card names, no "JACK IN". Long sayings (`> RUN MATCH.EXE`, `LINK ESTABLISHED`) shrink to fit
on a phone, or break onto two lines (as Boot Sequence's SYSTEM READY does).

**When it plays.** When playback starts from the first move: pressing Play at move 0, or the page
playing on its own from the start. Not when the page opens without playing, not on a jump or a scrub, and
not when Play resumes mid-match. `|<` and then Play shows it again. Skippable (a tap, Escape or Skip),
and the first move starts at once. The "Cosmetics: on / off" switch doesn't touch it.

**Reduced motion:** a still for about 1 s: both halves lit, both agent lines, `HANDSHAKE OK` and the
saying. Then the match.

**Phone:** the same layout (the halves are already stacked); the agent lines shrink to fit; the saying
breaks onto two lines when that makes it larger.

**Live matches:** the same intro at the start of a live broadcast, when the site has one. Nothing to
build now.

**Does the game lane need to do anything?** Not for the plan as written. The saying comes from the
seed, which the replay already has. One thing to know: a saying taken from the seed is only stable while
the list stays the same. If you ever add, remove or reorder a saying, old replays would show a
different one. So I'd freeze this list as "list 1", and if it ever changes, the game lane stores the
saying (or the list's version) on the match record. Nothing is needed until then.

**Build order (one slice per render session):**
1. EFFECTS.md "intro" grammar, the saying picker (seeded, with the 1-in-100 rate tested over many
   seeds), the power-on, the agent lines, `HANDSHAKE OK` and the saying in the replays; skip; reduced
   motion; a sheet of all nine sayings over all four factions and a mirror match. Checkpoint.
2. Sound polish and a phone pass, from your notes on slice 1.

**Calls I'd like (suggested defaults in brackets):**
1. **Length** [about 2.6 s, within your 2-3 s].
2. **Neutral colour for `HANDSHAKE OK` and the saying** [white-chrome; each half's own line in its
   faction's colour].
3. **Both agents' lines print at the same time, one in each half** [yes, so nobody goes first.
   Alternative: the top agent's line, then the bottom's, which reads like a real terminal but puts
   one side first].
4. **Line format** [`LOADING AGENT: <name> [<FACTION>]`, your example, unchanged].
5. **When it plays** [Play from move 0, or the page starting playback on its own; not on page open
   without play, a jump, a scrub or a resume].
6. **Skip** [a tap, Escape or Skip, as the boasts do; the first move starts at once].
7. **The rare saying** [exactly 1 in 100 by the seed's hash; the other eight equally likely].
8. **Sound** [a tube thump, the key clicks, a short chirp for `HANDSHAKE OK`, a hit and a rising
   chord under the saying; music starts after; muted when sound is off].
9. **The sayings are frozen as list 1** [yes; any later change to the list asks the game lane to
   store the saying on the match record].
10. **Name** ["Match Boot" in the code and the notes; viewers never see the name].

---

## 2026-10-19 — Session 35: Match Boot slice 1 built, and the two end-of-match fixes

Nothing is blocking. The calls are in `progress/render/checkpoints.md` (newest entry, 8 calls, each
with the default I built).

**Worth watching, with sound on:** any replay from move 0 (Play at the start), and
`render/output/match-boot-sheet.html` ("Play all in turn" runs all nine sayings). No one has heard the
chirp, the hit and its rising chord, or seen the 2.6 s at full speed: the headless browser drops frames.

**For the game lane, nothing now:** the saying comes from the seed, as you agreed (list 1). If the list
ever changes, the saying (or the list's version) needs storing on the match record first; a render test
pins the list so a change can't slip through.


## 2026-10-20 — Session 36: victory boasts, slice 4 (the loadout picker)

Nothing is blocking. The calls for this slice are in `progress/render/checkpoints.md` (newest entry).

1. **One question for later (no default needed now): which side's arena does a match show?** The
   store keeps an arena slot per agent, but a match has two agents. Nothing can be equipped there yet
   (Season 0 sells no arenas), so this only matters when the first arena ships. Options: the home side's
   (whoever the server lists first), each half of the board in its own agent's arena, or the arena of
   the agent the viewer follows. The picker says only "the background behind the board in this agent's
   matches".
2. **For the game lane (when it builds roadmap 2b step 3, the settings endpoints):** the picker is ready
   to send its choices to a loadout endpoint. Today it carries the store's answer to every choice,
   computed when the page is built (`render/src/loadoutDemo.ts`, `outcomesFor`), because there is no
   endpoint. The page's model (`loadoutApply`) takes the answer in the same shape the endpoint would
   return: the slot's new value, or the store's refusal message.

## 2026-10-23 — Session 37: the boast's win message

Nothing is blocking. The 8 calls are in `progress/render/checkpoints.md` (newest entry), each with the
default I built. The quickest look: `progress/render/evidence/v2-s37-forced-aegis-shield-slam-close-c-close.jpg`
then `-close-d-name.jpg` (a close win: CLOSE CALL, then "Lookahead-Aegis WINS"), or step onto the last
move of `render/output/recorded-close-win.html`.

I picked **CLOSE CALL** of your two wordings, because "CLOSE WIN" followed by "<NAME> WINS" says win
twice. A close win's boast now runs 3.6 s (CLOSE CALL holds 0.6 s first) so the winner's line stays up
as long as in any other win.

**For the game lane, nothing.**

## 2026-10-24 — Session 38: Match Boot slice 2 (sound and the phone)

Nothing is blocking. The 8 calls are in `progress/render/checkpoints.md` (newest entry), each with the
default I built.

**Worth hearing, with sound and music on:** any replay from move 0. The music now waits for the intro and
starts as it ends. Then `render/output/match-boot-sheet.html`, the `> SUDO FIGHT` scene, for the rare
flourish. On a phone, `render/output/cortex-vs-swarm-seed6.html` shows the agent lines on two rows. The
timing was measured from the page's real audio output in a headless browser; nobody has listened yet.

**For the game lane, nothing.** (Your 2026-10-24 question on the minimum deck size is the game lane's,
for its next session.)


---

## 2026-10-28 — Session 40 (hardening pass)

1. **The render's browser checks don't run in CI, and that's how the halo spill went unseen.** Every
   visual claim (nothing drawn on the loser's side, Skip sizes, sound timing) is proven by a committed
   Playwright script run by hand in the session (`progress/render/evidence/*.mjs`); the test workflow
   runs only vitest. This session found the boast's halo had been lighting the loser's side since
   slice 1, with a debt line saying it never had. Running a small set of these checks on every push
   would need a headless Chromium in `.github/workflows/test.yml` (about 1-2 extra minutes per run).
   That file is shared with the game lane, so it's your call: say if you want it, and the render lane
   will build a CI-sized check (the six boasts' "nothing past the winner's side", the Skip sizes, one
   replay's intro) as its own slice.

## 2026-10-30 — Session 41 (the CI browser check)

1. **Built, as you set it.** The render's browser check now runs on every push and PR, as the last step
   of `.github/workflows/test.yml`. Calls are in `progress/render/checkpoints.md` (newest entry).
2. **The two shared workflow files changed only as you OK'd:** the new step in `test.yml`, and the
   auto-merge wait in `auto-merge.yml` raised from 5 to 12 minutes. Nothing else in either file, and
   nothing in `package.json` or `package-lock.json` at the root (playwright-core is installed outside
   the repo in CI, not added as a dependency).
3. **Nothing for the game lane,** except that its PRs now run the check too. It builds its pages from
   the current source, so a game change that breaks the replay page (not one that only changes how a
   match plays out) fails it.

## 2026-10-30 — Session 42 (one replay's end in the CI check; a pinned Chromium)

1. **Built as you set it.** Calls are in `progress/render/checkpoints.md` (newest entry): mainly the
   lead after the lethal beat checked at half its length (call 1) and leaving the render's slow-motion
   clear as built (call 2).
2. **`.github/workflows/test.yml` changed only for the pinned Chromium,** as you OK'd: the render step's
   install lines, its name and its comment. Nothing else in the file; `auto-merge.yml` untouched.
3. **The CI times you asked for are in the PR's description,** not in this file: the PR merges itself
   when its checks pass, so they can't be committed into it after its run. The next render session
   copies them into `progress/render/log.md`.
4. **Nothing for the game lane.** Its PRs run the longer check too; a card change that turns Cortex vs
   Swarm seed 6 into a draw would fail a vitest test that says so.

## 2026-10-31 — Session 43 (the "tap to skip" hint)

1. **Built as you set it.** Calls are in `progress/render/checkpoints.md` (newest entry): mainly the
   words (call 1) and "shown until the first skip, on that page" (call 2).
2. **Season 0 read.** The render lane's next sessions follow your Season 0 list (the desktop website to
   the 2026-10-05 spec, as trimmed), starting next render session. The Season 0 checklist you asked for
   goes in `progress/roadmap.md`, which the render lane doesn't write (RENDER.md guardrail 4); the game
   lane keeps it, and the render lane will say what it has done in its own log for the game lane to tick.
3. **No shared files changed this session** (no workflow, no root package files). Nothing for the game
   lane: its PRs run the longer CI check (61 checks, about 10 s more).

## 2026-11-01 — Session 44 (the owner website, first slice)

1. **Built: sign-in, the shell and Settings -> Play,** against the owner API as it is. Calls are in
   `progress/render/checkpoints.md` (newest entry). Try it with `npm run site-demo -w @ai-tcg/render`.
2. **Endpoints the website needs that don't exist yet** (for the game lane; the pages say so meanwhile):
   - **Account settings** (theme, background, sound/music, and "the skip hint has been seen", your
     session-43 call 2): the hint can't be remembered on the account until this exists, so call 2 is not
     done yet; the hint still shows until the first skip on each page.
   - **Who am I** (the owner's display name, and whether they're the house admin, for the Admin entry):
     the account button shows the login typed at sign-in for now, and there is no Admin entry yet.
   - Wallet (credits, pack points, the Open button), notifications, connecting/switching agents, auto-
     play, and the rest already on the Season 0 list.
3. **Serving the page (call 3 in the checkpoint):** OWNER_API.md assumes the site shares the API's origin.
   `render/src/site/siteHost.ts` does that now. If you'd rather the owner API serve the page, that's a
   small game-lane change and the host can go.
4. **No shared files changed** (no workflow, no root package files, no server or economy code). The
   render tests import the owner API's source to test against it, read-only.

## 2026-11-01 — Session 45 (the look)

1. **Built: the liquid background and its picker, saved to your account,** plus your name, Admin and the
   wallet in the top bar. Calls are in `progress/render/checkpoints.md` (newest entry): mainly the
   liquid lowering its own resolution on a slow machine (call 1) and a plain background keeping your
   theme choice (call 2).
2. **Worth a look on the Mac mini:** the frame rate was only measured without a GPU (software WebGL, 12
   fps before it stepped down). Open the demo there and see if it feels smooth; it should hold 30 fps at
   full (0.3) resolution on a GPU.
3. **For the game lane:** the widget board (next render slice) needs the saved board layout endpoint
   (already on your Season 0 list). Until it exists the board's layout can only live in the page.
4. **No shared files changed** (no workflow, no root package files, no server or economy code).

## 2026-11-01 — Session 46 (Home as the widget board)

1. **Built: the widget board, saved to your account,** with Customise, the gallery, the empty state, the
   limits and the twelve Season 0 widgets. Calls are in `progress/render/checkpoints.md` (newest entry).
2. **Please look on the Mac mini: is the liquid still smooth behind a full board?** Measured here without a
   GPU (`progress/render/evidence/board-glass-cost-s46.txt`): 16 fps with nine glass tiles, 25 with
   session 45's two panels, 24.7 with the tiles' blur switched off; a smaller blur radius doesn't help. If
   it stutters on the Mac, the options are (a) the liquid goes still on Home when it can't hold 20 fps at
   its lowest resolution (it keeps moving on lighter pages), (b) the tiles drop the live blur for a
   frosted tint that doesn't re-blur each frame, or (c) the liquid draws slower (15 fps) under a full
   board. I'd try (a) first. Nothing changed until you say.
3. **For the game lane:** the free daily pack's claim (Store and Packs widgets) is planned for its session
   65; live matches, ladder, ratings, match history and notifications fill the waiting widgets after match
   running. Nothing else is needed for the board.
4. **No shared files changed** (no workflow, no root package files, no server or economy code).

## 2026-11-01 — Session 47 (the Store page and pack opening on the site)

1. **Built: the Store page, and pack opening full screen on the site.** Calls are in
   `progress/render/checkpoints.md` (newest entry).
2. **A small ask for the game lane (only if you want "Watch again"):** `GET /api/packs/:packId/opening`
   answers the logged copies (card, finish, serial), not the opening as `POST /api/packs/open` answered it
   (each card's slot, the NEW badge, "x N owned", pity, the starter guarantee, pack points). The reveal
   needs those to replay a pack honestly (slot order puts the shine card last; NEW and "x N owned" were
   true at the time). If the endpoint answered the same `PackOpening` shape (or the store kept it), the
   Store's recent openings could each have "Watch again", and a reload in the middle of a reveal could
   pick it up again. Until then the Store shows those openings' cards only.
3. **The liquid on the Mac mini:** nothing changed (your 2026-11-01 answer: fallback (a) only if you see
   it stutter). The opening pauses the liquid while it covers the page.
4. **No shared files changed** (no workflow, no root package files, no server or economy code). The site's
   bundle reads one file of the economy (`economy/src/packs.ts`, the hit-finish list) read-only.

## 2026-11-02 — Session 48 (the Collection page)

1. **Built: the Collection page** (the wide binder and the card viewer, with craft and salvage). Calls are in
   `progress/render/checkpoints.md` (newest entry).
2. **Two small asks for the game lane (no hurry; the page works without them):**
   - **A craft price in the card viewer's answer** (`GET /api/collection/cards/:cardId`: the craft cost and
     the playable limit). The page reads them from `economy/src/config.ts` and the engine's copy limits
     today, the same constants the store uses, but the API would be the one source.
   - **Signature cards and earned promos in the collection API**, for the Promos tab (it says what it waits
     on until then).
3. **The demo now has one deck saved by hand** (Nova's "Cortex, my tweak": the starter with one copy
   swapped for a pulled one), so salvage can be tried on a deck it would leave short. Only the demo.
4. **The liquid on the Mac mini:** nothing changed (no report yet). The Collection page has one glass panel
   and the binder's cards are opaque faces, so it's lighter than Home's nine tiles.
5. **No shared files changed** (no workflow, no root package files, no server or economy code). The site
   reads `economy/src/config.ts` (the craft prices) read-only.

## 2026-11-02 — Session 49 (the loadout picker in the Store)

1. **Built: the loadout picker in the Store,** full screen, with Equip and Buy against the real server.
   Calls are in `progress/render/checkpoints.md` (newest entry).
2. **A small ask for the game lane (the picker works without it):** the API never says **which faction the
   agent's deck plays**, or **its cards**. That faction decides what an empty victory-boast slot plays (the
   store's `chooseBoast`). The site knows it only when you lock a faction, or when the latest build is the
   deck being played. Otherwise the picker says "No deck built yet" rather than guess. One field would
   settle it: a `faction` (and ideally the card ids) on `DeckStatus` in `GET /api/play`'s `activeDeck` and
   `decks`. The preview board would then show the deck's own units, too.
3. **[OWNER CHECK-IN] Coin skins: the render lane's half of the plan** (your 2026-11-02 entry: plan
   first, nothing built; the game lane builds its half first). My proposal:
   - **Where:** inside the Match Boot intro, on the centre line, between HANDSHAKE OK and the saying. The
     intro goes from 2.6 s to about **3.4 s**: at 1.5 s the coin flicks up from the centre and spins, it
     lands at 2.1 s, the result line types at 2.2 s, the saying slams in at 2.4 s, everything is gone by
     3.4 s. Skip skips it with the rest.
   - **How the result reads:** each viewer's coin has two faces: **your agent's face** (its generated
     portrait, the avatar the site already draws) and **the coin's own design**. Landing portrait-up
     means you go first. The line under it says **YOU GO FIRST** or **THEY GO FIRST**. For a spectator who
     owns neither agent it says **<NAME> GOES FIRST**.
   - **One exception to the intro's grammar** (it favours neither side today): after landing, a short edge
     pulse runs into the first player's half. I'd write that exception into EFFECTS.md. Alternative: no
     pulse, the text alone.
   - **Sound:** a flick, a spin whir and a landing clink, all dead centre on the audio clock. Skip cuts them.
   - **Reduced motion:** the coin shown already landed, with the line, in the still. The still goes from
     1.0 s to about 1.3 s.
   - **Coin designs** (code-drawn like the boasts, placeholder until the art pass):
     - the free starter: **Chrome Token**, a silver hex;
     - two Season 0 store coins: **Dial-Up Dime**, a green CRT-phosphor rim, and **Neon Nickel**, a
       magenta and cyan neon edge;
     - the tier coins: **Gold** (gold foil), **Diamond** (prismatic facets) and **Mythic** (the Mythic
       ward's moving sheen). They climb like the card finishes, so a Mythic coin is plain at a glance.
     Names and prices are the game lane's call; these are the looks.
   - **The spectator view** (left open in your entry): a spectator who owns neither agent sees the house's
     neutral Chrome Token. I'd give the arena's open spectator question the same answer (a neutral
     default), so the two match.
   - **What the render needs from the game lane:** the coin slot in `GET /api/agents/:id/loadout` (the
     picker gets a sixth slot, "Coin", with the same tiles and Buy), and **each agent's equipped coin on
     the match record and the replay**, like the boasts. That keeps a replay's flip showing the coin worn
     then. Who went first is already there: the server's flip decides the seats, and p1 always moves first.
   - **Order:** once the game lane has the slot and the catalogue, two render slices: (1) the flip in
     Match Boot, the starter coin, reduced motion and sound; (2) the store and tier coins' looks, and the
     coin line in the picker and the Store.
4. **Found, not fixed:** session 36's standalone picker check (`loadout-check-s36.mjs`) fails 5 of 48
   checks, on main's committed page too. It was written before render 37 changed the win message, so the
   script is stale; the page isn't broken. In the debt list.
5. **No shared files changed** (no workflow, no root package files, no server or economy code). The site's
   bundle now also reads `economy/src/cosmetics.ts` (the slot list and the close-win health), read-only.

## 2026-11-02 — Session 50 (the match pages)

1. **Built: Agent match, Watch live, match history with full arena replays, the auto-play switch,** and
   the Live match, Watch live and Match history widgets. Calls are in `progress/render/checkpoints.md`
   (newest entry). Try it with `npm run site-demo -w @ai-tcg/render -- --ladder` (the real ladder plays in
   the demo; add `--speed 8` to watch a match in under a minute).
2. **[OWNER CHECK-IN] The spectator point of view (your 2026-11-02 entry: propose before building).** My
   proposal, nothing built:
   - **Where the toggle sits:** on every view of a match the viewer doesn't own: each Watch live card, the
     Watch live widget at M and L, and the replay (in its top bar, beside the agents' names). Not on the
     Live match widget or Agent match: those are always your own agent's match, so your own view. One
     two-button switch with the agents' names ("Watch as: Static Widow | Hive Courier").
   - **The chosen player moves to the near side: yes.** It is what "their point of view" means on a board,
     and it matches what owners already get (this session puts your own agent on the near side of every
     scoreboard). On the arena replay that means the board flips: the chosen player's units, hand and
     health bar come to the bottom. That's a render change only (the arena draws either way round).
   - **A switch mid-match re-shows nothing:** the coin and arena (and the near side) swap from then on. A
     coin flip already played isn't played again; a replay scrubbed back to the start shows the chosen
     player's coin.
   - **The tie rule for the default** (equal ratings, or both still in Placement): **the player who goes
     first** (p1, the seat the server's coin flip gave the first move). It's on the match record, it never
     changes, and it puts the opening move on the near side.
   - **Remembered per match, in the browser tab only** (not on the account): the next match starts from
     the higher-rated agent again, as you set as the default. Reopening the same replay in the same tab
     keeps the choice.
   - **What the render needs from the game lane:** both agents' ratings at the start of the match on the
     match record (`GET /api/matches/:id`), so a replay picks the same default later (the live list has
     them already), plus the coins and arenas from the coin plan.
3. **Next render slice: the big live board.** The arena (the same page that plays replays) fed from the
   live feed, so Agent match and Watch live show the real board as moves come out. The live feed sends the
   public board (hand counts, not hands) and the engine's events with instance ids, which is enough for the
   board, the units' live stats and most effects; the hands would show as card backs with counts. Statuses
   and tool bonuses aren't in the public board, so a few unit badges may need a small addition from the game
   lane; I'll name exactly which once the slice finds them.
4. **Not built (no endpoint yet):** featured picks ("Top rated"), viewer counts and the 2× vote.
5. **No shared files changed** (no workflow, no root package files, no server or economy code). The site
   now also reads `server/src/ladder/ladderRunner.ts` (`replayDeckSpec`, the replay file's types) and, in the
   demo only, `server/src/ladder/liveLadder.ts`, read-only, as it already reads the owner API.

## 2026-11-02 — Session 51 (the big live board)

1. **Built: a live match on the full arena** ("Watch on the arena" on Agent match and Watch live). Calls are
   in `progress/render/checkpoints.md` (newest entry). Try it with `npm run site-demo -w @ai-tcg/render --
   --ladder --speed 4`.
2. **For the game lane: four small additions to the live feed** (`GET /api/live/:id`, `server/src/ladder/
   timeline.ts`'s `PublicSide`), each so the live arena draws what the replay draws. In order of value:
   - **The signature card in `PublicSide.signature`**: the card itself (cardId, cost, attack, health,
     keywords, rules text), `timesPlayed`, `inZone` and `nextCost`, as the engine's own SignatureZone has it
     (it is public information in the engine). Today the feed sends its name and whether it was played, so
     the live arena draws no signature zone, and a signature unit's Barrier (from its printed keyword) and
     its ability's rules text in the feed are missing.
   - **The deck's faction on each side** (`LiveSideView.faction`): the arena colours each side by it; until
     a side plays a faction card it shows Neutral.
   - **The boast on the live view once the last move is out** (the record's `boast`, or the loadout's boast
     and close-win boast with the rule), so the live arena plays boast-then-result as replays do, instead of
     result-then-boast about 8 s later.
   - **The coin and `defaultView`** are already there (session 69); nothing more needed for the point of view.
3. **Found: the live feed shows the hands it means to hide.** `PublicSide` sends hand counts only ("no hand or
   deck contents"), but each step's `events` are the engine's whole log for that move, and its `draw` events
   name the card drawn (`{ type: "draw", player, card }`). Anyone reading the feed can rebuild both hands.
   The match is already decided in the engine when it is shown, so nobody can gain in the match from it;
   it is a question of what spectators should see. **Your call:** (a) keep hands hidden live: the game lane
   strips the card from `draw` events in the feed (the replay keeps them); or (b) show hands live, as the
   replay does: the render can then draw them face up. The live arena draws card backs until you decide,
   but its match feed (built from those same events) already says "draws Watchtower Relay" on each turn,
   as replays do: with (a) that line becomes "draws a card" by itself, with no render change.
4. **No shared files changed** (no workflow, no root package files, no server or economy code). The site
   now also reads `server/src/ladder/timeline.ts` (the feed's types; the tests use its recorder), read-only.


## 2026-11-02 — Session 52 (the spectator point of view)

1. **Built: "Watch as"** on Watch live, the Watch live widget (M and L) and the arena's top bar, as you
   approved it after session 50. Six calls in `progress/render/checkpoints.md` (newest entry); the one most
   worth a look is 3, which way the momentum gauge fills.
2. **Your answer to render 51 (hands live, face up) isn't built yet.** The render lane will rebuild live hands
   from the feed's `draw` events, as you said; it is the next slice, with the first coin slice. Nothing is
   needed from the game lane for it unless rebuilding turns out unreliable (then: the hand contents in the
   live view, as you allowed).
3. **Nothing new needed from the game lane** for the point of view: `defaultView` on `GET /api/live` and the
   history row's `seat` were enough. The match record's `defaultView` (`GET /api/matches/:id`) will be read
   when the site can open a replay of a match you don't own (a featured match), which it can't yet.
4. **No shared files changed** (no workflow, no root package files, no server or economy code).

## 2026-11-03 — Session 53 (live hands face up; the coin flip)

1. **Built: live hands face up, and the coin flip in Match Boot** (the first coin slice, as approved). Seven
   calls in `progress/render/checkpoints.md` (newest entry); the ones most worth a look are 1 (the coin rises
   toward you rather than up the screen) and 5 (opening cards as backs until played).
2. **A small ask for the game lane: the opening hands in the live view.** The render rebuilds each live hand
   from the moves and `draw` events, exactly, but the opening hands are dealt before the engine's log starts,
   so no event names them; those cards show as backs until played. One field would make every hand whole from
   move 0: the opening hands, by card id in hand order, on the live view's start (for example
   `openingHands: { p1: string[], p2: string[] }` beside `start` in `GET /api/live/:id`), sent while the match
   is decided before it is shown (your safety rule for real-time network agents would leave it out). The render
   already takes it (`LiveStart.openingHands`, tested).
3. **For the game lane, when the coin looks land:** `economy/test/cosmetics.test.ts` checks each item's `drawn`
   against the boast specs only, so the Chrome Token can't be marked drawn from the render side. The render's
   coin looks are in `render/src/coinFx.ts`'s `COIN_SPECS` (by item id); the test could check coins against
   that. Not urgent: the Chrome Token is never sold, and the store coins come with the second coin slice.
4. **Live costs with a signature card in play** are marked "?" (its abilities aren't in the feed). The queued
   ask for the signature card in `PublicSide.signature` (render 51) would make them exact too.
5. **No shared files changed** (no workflow, no root package files, no server or economy code). The site's
   bundle reads nothing new.

## 2026-11-03 — Session 54 (render hardening pass)

1. **The pass you set: no new features.** The two stale browser checks you named are rewritten and pass
   (the ten-pack open, 12 of 12; the loadout picker, 49 of 49), the ten-pack one shown to fail on a broken
   page. **The check-E flake was the test script, not the website:** under CPU load the script gave up waiting
   for the pack to tear after 15 s and then tapped nothing. Fixed in the script; the pack opening itself is
   unchanged and was never at fault. Every committed page under `render/output/`
   is rebuilt and now plays the coin flip.
2. **A call you may want to overrule: the committed replay pages follow the engine.** The new
   `npm run outputs -w @ai-tcg/render` rebuilds every page by playing its match again, so the 16 replay pages
   now show `rules-2` matches (24 health), not the matches they showed before; same factions and seeds,
   different games. The alternative is to rebuild them from frozen replay files (`ai-tcg-replay/2`), so a
   page only changes when the render changes. Kept as built unless you say otherwise.
3. **The live arena now reads two of the game lane's session-72 fields** (as you allowed "along the way"):
   the opening hands (every live hand is whole from move 0, no backs) and each side's deck faction (from the
   first frame, not Neutral until a faction card shows). The signature card in full and the live boast are
   not read yet: they change what the arena draws, so they are a slice of their own (next to the second coin
   slice). Nothing more is needed from the game lane for them.
4. **No shared files changed** (no workflow, no root package files, no server or economy code).

## 2026-11-04 — Session 55: the second coin slice

Nothing is blocking. The calls for this slice are in `progress/render/checkpoints.md` (newest entry).

**For the game lane (small):**
- This session flipped `drawn: true` on all six coins in `economy/src/cosmetics.ts`, in the same change that
  adds their looks (as session 33 did for the boasts). **Dial-Up Dime and Neon Nickel are now on sale in
  Season 0 at 300 credits each.** The tier coins stay unsold.
- The check you were asked for (owner 2026-11-03): `economy/test/cosmetics.test.ts`'s "marked drawn exactly
  when the render lane has drawn it" now checks coins against `render/src/coinFx.ts`'s `COIN_SPECS` (boasts
  against `BOAST_SPECS`, as before). Done here because the flag and the check have to change together or the
  test goes red; nothing for you to add.
- Two tests that assumed undrawn coins were moved with it: `economy/test/coins.test.ts` keeps the "never on
  sale before drawn" rule tested on an undrawn copy of the catalogue (`UNDRAWN_COINS`) and now also checks the
  shipped catalogue sells both; `server/test/ownerApiEconomy.test.ts`'s coin-slot test now expects both store
  coins in `GET /api/store` at 300 (the undrawn refusal is tested in the economy). No store or server code
  changed. `server/OWNER_API.md` may still say the store coins aren't on sale yet: yours to refresh.

**For you:** the coin sheet (`render/output/coin-sheet.html`) shows every coin still and flipping; the sounds
have not been listened to by a person (the modem warble most of all). The Season 1 question (new look or a
season mark) is proposed as a mark, call 1.


---

## 2026-11-05 — Render session 56 (the live arena slice)

1. **For the game lane's roadmap upkeep** (this lane doesn't write `progress/roadmap.md`): the render half of the
   2× vote is built (Agent match, over the live arena, Watch live's pill, Settings -> Play), and the live arena
   now reads the signature card in full and the live boast. The six calls are in `progress/render/checkpoints.md`.
2. **A wording change to a signature menu ability needs this lane too.** The live board rebuilds a signature
   card's abilities from the engine's menu by rules text (`render/src/site/liveFrames.ts` `signatureCardOf`).
   Change a menu ability's text and an existing card's old text (if the server ever sends it) won't match: the
   board falls back safely (no wrong data, costs marked "?"), and `render/test/liveFrames.test.ts` catches any
   card the current menu can make that doesn't rebuild. Nothing to do now; flagged so a wording change isn't a
   surprise.
3. **Nothing needed from the game lane for this slice.** One small thing it could add someday: a notification
   when the other owner asks for 2× (the notifications item already queued); today the ask shows within the
   site's 3 s read.

---

## 2026-11-05 — Render session 57 (My agent and Agent controls)

1. **For the game lane's roadmap upkeep** (this lane doesn't write `progress/roadmap.md`): "My agent and Agent
   controls" (render item 2) is built except the time ring's live data. The S/M/L split and the personality dial
   are in; the ring and the time buttons are drawn and tested against every state in the brief, waiting on game
   item 2g (the play-time allowance).
2. **For game session 76 (the play-time allowance):** the render side expects, per agent or owner, the minutes
   given today, the minutes left, and running / finishing / done (`TimeAllowance` in
   `render/src/site/siteAgent.ts`). Any field names are fine: the render lane writes the adapter from whatever
   `GET /api/play` sends and wires the 15 / 30 / 60 and +15 / +30 buttons to its endpoint in a short follow-up.
3. **The seven calls** are in `progress/render/checkpoints.md` (the newest checkpoint).

## 2026-11-05 — Render session 58 (the pack ceremony, part 1; the time ring live)

1. **For the game lane's roadmap upkeep** (this lane doesn't write `progress/roadmap.md`): render item 2 (My agent
   and Agent controls) is now complete: the time ring and the 15 / 30 / 60 and +15 / +30 buttons run on game
   session 76's allowance. Render item 3 (the pack ceremony, part 1) is built; parts 2 and 3 are next.
2. **The seven calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The one most worth a look:
   call 1 (the backdrop hints, which your 2026-10-18 note had ruled out for the pack itself).
3. **Nothing needed from the game lane.**

## 2026-11-09 — Render session 60 (the pack ceremony, part 2)

1. **Six calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The two most worth a look: call 1
   (plain Rares and Mythics sit below Foil on the ladder) and call 2 (every pack now ends on at least one short
   build, because every pack has a Rare slot).
2. **Lane:** this was the catch-up's second render session. Once its PR merges, plain alternation resumes: the next
   session is game (season end, part 2).
3. **Nothing needed from the game lane.**

## 2026-11-10 — Render session 61 (the pack ceremony, part 3a)

1. **Eight calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The three most worth a look:
   call 1 (part 3 split: Open 10's stops and the debug panel come next session), call 2 (the Zero-Day now builds
   before its terminal, so it hits after the Prototype, not before a Gold) and call 3 (the Prototype's length).
2. **The season-end pack warning (render list item) is dropped,** per your 2026-11-10 entry (unopened packs carry
   over). The Season 0 checklist line says so. If a season-end screen is built later and mentions packs, it will say
   they carry over and open as the new season's packs.
3. **Nothing needed from the game lane.** The set bar reads the existing binder endpoint.

## 2026-11-10 — Render session 62 (the pack ceremony, part 3b)

1. **Six calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The two most worth a look: call 1
   (Open 10 waits for your tap at every stop, Auto included) and call 2 (a plain Rare is a stop, so every pack in a
   ten stops at least once; the cut if it drags is one rule).
2. **The brief's pack done-check is met in the headless browser:** every reveal kind, one pack and ten, through the
   debug panel (90 PASS). For your 11 November feel check, the panel is the quickest way to each kind: DEBUG, pick,
   Open one now / Open ten now.
3. **A bug fixed that the website had too:** a second big pull in one Open 10 skipped its reveals.
4. **Nothing needed from the game lane.**

## 2026-11-11 — Render session 63 (the store layout, the Store and Packs widgets)

1. **Six calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The two most worth a look: call 2
   (the 1-to-10 stepper is gone; buying is 1 pack or 10 packs, as the brief lists) and call 1 (which tile is
   featured).
2. **To try it:** `npm run site-demo -w @ai-tcg/render`, sign in as nova, open Store; Customise on Home for the
   widget sizes.
3. **Nothing needed from the game lane.** (A bar to the pity guarantee would need the thresholds sent; not asked
   for, see call 6.)

## 2026-11-12 — Render session 65 (the Ladder, Rating & form and Notifications widgets)

1. **Four small calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The one most worth a look:
   call 1 (notifications are marked read only by Mark all read, never just by being shown).
2. **For the game lane's roadmap upkeep:** render item 3 is ticked (no widget waits on the server); item 7's widget
   pass is started (three of seven widgets done).
3. **Nothing needed from the game lane.**

## 2026-11-12 — Render session 66 (Daily rewards, Showcase and Collection)

1. **Four small calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The one most worth a look:
   call 2 (Showcase shows fewer cards so it can draw them larger: 1, 3 and 6 instead of 1, 5 and 10).
2. *(Dropped 2026-11-12, render session 67, as the owner asked: the daily-earnings order mismatch was fixed in game
   session 89; `GET /api/daily` numbers wins in recording order, the order they are paid in. The site demo's warm-up
   still records wins out of end order; left as it is, since the widget reads honestly either way.)*
3. **For the game lane's roadmap upkeep:** item 7's widget pass: six of seven widgets done; Watch live at L left.

## 2026-11-12 — Render session 67 (Watch live at L: the live match on the arena, in the tile)

1. **Four small calls** are in `progress/render/checkpoints.md` (the newest checkpoint). The one most worth a look:
   call 1 (one embedded arena per board; a second Watch live at L shows the compact board).
2. **For the game lane's roadmap upkeep:** item 7's widget pass is finished (seven of seven); ticked in
   `progress/roadmap.md`. Next on the render side: the Stats page, the ladder page and the bell.
3. **Nothing needed from the game lane.** The tile uses the same live page and frames the full-screen arena
   already reads (`POST /live-page/:matchId`, `GET /live-frames/:key`); no new server fields.
