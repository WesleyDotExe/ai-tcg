// The holdings behind the owner API demo's 26-card Null deck (owner
// 2026-10-24: "a Null-locked owner (starter plus 10 packs, Controller
// style) got a 26-card agent deck"), for the engine's deck-size check
// (engine/src/dev/deckSizeCheck.ts). The owner is made with exactly the
// demo's store calls and pack seeds (server/src/dev/ownerApiDemo.ts), in a
// throwaway store, and the cards held are written out as copies per card id.
//
//   npx tsx src/dev/deckSizeHoldings.ts > ../progress/deck-size/demo-owner-holdings.json
//
// Deterministic; builds no deck and plays no game.

import { EconomyStore } from "../store.js";

const store = EconomyStore.open(":memory:", { now: () => new Date("2026-10-23T09:00:00.000Z") });
const nova = store.createAccount({ name: "Nova", username: "nova", password: "a long demo password" });
store.grantStarterCollection(nova.ownerId, "Cortex");
for (let i = 0; i < 10; i++) store.grantPack(nova.ownerId, "S0", "ownerDaily");
let seed = 5600;
while (store.unopenedPacks(nova.ownerId).length > 0) store.openPack(nova.ownerId, undefined, { seed: seed++ });

const held = new Map<string, number>();
for (const c of store.collection(nova.ownerId)) held.set(c.cardId, (held.get(c.cardId) ?? 0) + 1);
const holdings = [...held].sort(([a], [b]) => a.localeCompare(b));
console.log(
  JSON.stringify(
    {
      _about: "The owner API demo's owner (Cortex starter + 10 packs, the demo's seeds): copies per card id. Written by economy/src/dev/deckSizeHoldings.ts.",
      copies: store.collection(nova.ownerId).length,
      holdings,
    },
    null,
    1,
  ),
);
store.close();
