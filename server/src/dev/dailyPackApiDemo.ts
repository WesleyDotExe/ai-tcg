// Evidence for the owner's daily pack over HTTP (session 65; owner
// 2026-11-01: "add the daily pack in session 65"; the rule is the owner's
// 2026-10-04 spec, "one free pack a day that only the owner can claim,
// stacking up to 2", on the midnight-Sydney day).
//
//   npx tsx src/dev/dailyPackApiDemo.ts > ../progress/owner-api-demo-005-daily-pack.txt
//
// A real season database file, two owners, the owner API on a real port,
// every step an HTTP request from this script. The store's clock is moved
// by hand across Sydney midnights (and one owner is away for four days);
// halfway through, the API and store are closed and reopened on the same
// file, to show the bank is worked out from the stored packs, not memory.
// Pack ids are replaced by names, so the output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore, type DailyPackStatus } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";

const tempDir = mkdtempSync(join(tmpdir(), "daily-pack-demo-"));
const dbFile = join(tempDir, "season-0.db");
// 20:00 on 1 Nov in Sydney (AEDT, +11): Sydney midnight is 13:00 UTC.
let clock = new Date("2026-11-01T09:00:00.000Z");
let store = EconomyStore.open(dbFile, { now: () => clock });
const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
const sydney = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const at = (iso: string) => {
  clock = new Date(iso);
  say();
  say(`[clock ${iso} = ${sydney.format(clock)} in Sydney]`);
};

const nova = store.createAccount({ name: "Nova Kestrel", username: "nova", password: PASSWORD });
const rook = store.createAccount({ name: "Rook Ansel", username: "rook", password: PASSWORD });

const names = new Map<string, string>([
  [nova.ownerId, "<owner Nova>"],
  [rook.ownerId, "<owner Rook>"],
]);
const redact = (text: string) =>
  text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
    if (!names.has(id)) names.set(id, `<pack ${[...names.values()].filter((n) => n.startsWith("<pack ")).length + 1}>`);
    return names.get(id)!;
  });

let api: RunningOwnerApi = await startOwnerApi({ store, port: 0, packSeed: () => 6501 });
async function call(method: string, path: string, token: string) {
  const res = await fetch(`http://localhost:${api.port}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (text === "" ? null : JSON.parse(text)) as any;
  say(`> ${method} ${path}  -> ${res.status}`);
  return { status: res.status, body };
}
const signIn = async (login: string) => {
  const res = await fetch(`http://localhost:${api.port}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password: PASSWORD }) });
  return ((await res.json()) as { token: string }).token;
};
const statusLine = (who: string, s: DailyPackStatus) =>
  `  ${who}: ${s.waiting} of ${s.cap} waiting (set ${s.setCode}), day ${s.day} ${s.timeZone}, resets ${s.resetsAt}; ` +
  `next pack ${s.nextPackAt ?? "none while full (claim one to start the clock)"}; claimed today ${s.claimedToday}; last claim ${s.lastClaimedAt ?? "never"}`;
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};

try {
  say("Owner API demo 005 — the owner's daily pack over HTTP (session 65)");
  say("=".repeat(72));
  say("Rule (owner 2026-10-04): one free pack a day that only the owner can claim, stacking up to 2.");
  say("The day runs midnight to midnight Sydney (owner 2026-11-01). The database is a real file.");
  let novaToken = await signIn("nova");
  let rookToken = await signIn("rook");

  section("1. Not signed in: both daily-pack endpoints answer 401");
  for (const [m, p] of [["GET", "/api/packs/daily"], ["POST", "/api/packs/daily/claim"]] as const) {
    const r = await call(m, p, "");
    say(`  error: ${r.body.error}`);
  }

  section("2. A new owner's first day: one waiting; claim it; a second claim is refused");
  at("2026-11-01T09:00:00.000Z");
  say(statusLine("Nova", (await call("GET", "/api/packs/daily", novaToken)).body));
  const claim1 = await call("POST", "/api/packs/daily/claim", novaToken);
  say(redact(`  claimed ${claim1.body.pack.packId}: set ${claim1.body.pack.setCode}, source ${claim1.body.pack.source}, acquired ${claim1.body.pack.acquiredAt}`));
  say(statusLine("Nova", claim1.body.dailyPack));
  say(redact(`  wallet: ${claim1.body.wallet.unopenedPacks.map((p: { packId: string; source: string }) => `${p.packId} (${p.source})`).join(", ")}`));
  const refused = await call("POST", "/api/packs/daily/claim", novaToken);
  say(`  error: ${refused.body.error}`);
  say(`  Nova still has ${store.unopenedPacks(nova.ownerId).length} unopened pack(s).`);

  section("3. The Packs and Store widgets read the same status with what they already load");
  const packs = await call("GET", "/api/packs", novaToken);
  const shop = await call("GET", "/api/store", novaToken);
  say(`  /api/packs dailyPack: ${packs.body.dailyPack.waiting} waiting, next ${packs.body.dailyPack.nextPackAt}`);
  say(`  /api/store dailyPack: ${shop.body.dailyPack.waiting} waiting, next ${shop.body.dailyPack.nextPackAt}`);

  section("4. One minute before Sydney midnight: still none. At midnight (UTC is still 1 Nov): one in");
  at("2026-11-01T12:59:00.000Z");
  say(statusLine("Nova", (await call("GET", "/api/packs/daily", novaToken)).body));
  at("2026-11-01T13:00:00.000Z");
  say(statusLine("Nova", (await call("GET", "/api/packs/daily", novaToken)).body));
  const claim2 = await call("POST", "/api/packs/daily/claim", novaToken);
  say(statusLine("Nova", claim2.body.dailyPack));

  section("5. Per owner: Rook keeps a separate bank; Nova's claims didn't touch it");
  say(statusLine("Rook", (await call("GET", "/api/packs/daily", rookToken)).body));
  say("  (Rook was made on 1 Nov and never claimed: the 1 Nov and 2 Nov packs both wait, the cap.)");

  section("6. The API and the store closed and reopened on the same file");
  await api.close();
  store.close();
  store = EconomyStore.open(dbFile, { now: () => clock });
  api = await startOwnerApi({ store, port: 0, packSeed: () => 6501 });
  novaToken = await signIn("nova");
  rookToken = await signIn("rook");
  say(statusLine("Nova", (await call("GET", "/api/packs/daily", novaToken)).body));
  say(`  error on a claim: ${(await call("POST", "/api/packs/daily/claim", novaToken)).body.error}`);

  section("7. Nova away four days: the bank stops at 2; claim both; then none until midnight");
  at("2026-11-06T02:00:00.000Z");
  const away = (await call("GET", "/api/packs/daily", novaToken)).body;
  say(statusLine("Nova", away));
  for (let i = 0; i < 3; i++) {
    const r = await call("POST", "/api/packs/daily/claim", novaToken);
    say(r.status === 201 ? statusLine("Nova", r.body.dailyPack) : `  error: ${r.body.error}`);
  }

  section("8. A claimed daily pack opens like any other");
  const opened = await fetch(`http://localhost:${api.port}/api/packs/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${novaToken}` },
    body: JSON.stringify({ packId: claim1.body.pack.packId }),
  });
  const openedBody = (await opened.json()) as { packs: { packId: string; cards: { name: string; rarity: string }[] }[] };
  say(redact(`> POST /api/packs/open {"packId":"${claim1.body.pack.packId}"}  -> ${opened.status}`));
  say(redact(`  ${openedBody.packs[0]!.packId}: ${openedBody.packs[0]!.cards.length} cards (${openedBody.packs[0]!.cards.map((c) => c.rarity).join(", ")})`));

  section("9. Nova's daily packs, from the store");
  const daily = store.unopenedPacks(nova.ownerId).filter((p) => p.source === "ownerDaily");
  for (const p of daily) say(redact(`  ${p.packId}  unopened, acquired ${p.acquiredAt}`));
  say(`  plus 1 opened (section 8): ${daily.length + 1} daily packs claimed over 6 Sydney days (1 to 6 Nov), at most 2 waiting at any time.`);
} finally {
  await api.close();
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
}
