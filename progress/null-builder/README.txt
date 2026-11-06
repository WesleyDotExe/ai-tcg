The test-only Null deck-builder session (session 79; owner 2026-11-03 on session 71's call 1)

Asked: the builder keeps the designed deck unless another deck beats it by more than noise; then re-run the
built-deck ring and bring the results to an owner check-in. No card, deck or rule change without the owner's OK.

Built (test only): `keepDesigned` in engine/src/deckbuilder/deckBuilder.ts, OFF by default (the store's builder
and every agent deck are unchanged). With it on, the designed start is the confirm step's incumbent: a challenger
(the rating start or the searched deck) replaces it only when, on the confirm's 400 fresh-seed games against the
four shipped decks, it wins at least z x sqrt(d) more of the d seeds where the two decks' games differ (paired
sign test, the search's own rule; at least 2). `builtDeckRing.ts build ... --keep-designed z`.

Ran: run-built-deck-ring.sh (same collections and seeds as built-deck-ring-005), z = 2 and z = 1, 4 minutes each
on 4 cores. The z = 2 run was run twice and reproduced byte for byte.
  progress/built-deck-ring-006.txt      z = 2
  progress/built-deck-ring-006-z1.txt   z = 1
  progress/built-deck-ring-005.txt      the store's builder today (the one to beat)

Real-match mode (the launch gate's measure): in band / unresolved / out, and the faction furthest from 50
                 005 (today)                 006 (z = 2)                 006-z1 (z = 1)
  full           0/4/2  Null 39.2            0/2/4  Cortex 43.6          0/4/2  Aegis 53.3
  37 packs       0/5/1  Null 47.9            0/5/1  Null 52.0            0/5/1  Aegis 52.4
  17 packs       2/2/2  Null 46.3            1/5/0  Swarm 47.7           0/4/2  Swarm 47.2
  3 packs        1/3/2  Swarm 46.5           1/2/3  Cortex/Null 46.3/53.2 1/3/2  Swarm 46.2
Gate mode, full: 005 1/3/2 (Null 40.2); z = 2 1/3/2 (Aegis 56.7); z = 1 1/4/1 (Null 46.5).

Full-collection Null mean, real mode: 39.2 today -> 51.5 (z = 2) / 50.0 (z = 1); Swarm > Null 69.4 -> 53.0.
Both margins keep the designed Null list from a full collection (the rating deck: +68 -66, net +2).
The difference between the margins is Cortex: its full-collection rating deck beats the designed list by net +19
(1.6 SD). z = 2 throws that deck away and full Cortex falls to 43.6 (Aegis > Cortex 62.6, out); z = 1 keeps it
(48.3). At the pack levels the two margins differ by noise.
