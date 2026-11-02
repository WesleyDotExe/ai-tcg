The full-collection Null deck under rules-2: a noise check (session 71)

built-deck-ring-005's full-collection Null build (search seed 1) kept a rated list over the designed list
(214 against 212 of 400 on the confirm step). Rebuilt with search seeds 2 and 3 (builtDeckRing.ts build full
Null --search-seed N, same collection), each then played in the real-mode ring at full against
built-deck-ring-005's other three full builds (builds-seedN/, full-real-seedN.json).

Null's mean over its three edges, real mode, full collection (50 = even with the field):
  rules-1, designed list kept (built-deck-ring-004)            48.5
  rules-2, the same rules-1 decks (session 68's c4 ring)        49.2
  rules-2, rebuilt, search seed 1 (built-deck-ring-005)         39.2   rated start kept, 214/400 (designed 212)
  rules-2, rebuilt, search seed 2                               45.3   searched deck, 218/400
  rules-2, rebuilt, search seed 3                               43.7   searched deck, 223/400

Every rebuilt Null deck is worse in the ring than the designed list it replaced, chiefly against the built
Swarm deck (Swarm > Null 63.0-69.4 against 55.7). Seed 1's is the worst of the three. The builder scores
against the shipped decks only; under rules-2 the designed Null list scores 212 there (218 under rules-1), so
a search beats it on that score while losing on the ring. A builder issue that the rule exposed, not the rule
moving balance.
