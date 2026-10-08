import { describe, expect, it } from "vitest";
import { SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { EconomyStore, hashPassword, needsRehash, SESSION_DAYS, SIGN_IN_LOCKOUT, verifyPassword } from "../src/index.js";

// Build-order step 2 (owner 2026-10-05): Season 0 sign-in, one connected
// agent per owner, no switching during a live match, the faction lock, and
// the admin view's house-owner data.

const T0 = Date.parse("2026-10-08T10:00:00.000Z");
function store() {
  const clock = { t: T0 };
  const s = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  return { s, clock };
}
const PW = "correct horse battery";

/** An owner with the starter collection, an active starter deck and one
 * connected agent: ready to start a match. */
function ready(s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null", kind: "player" | "house" = "house") {
  const owner = s.createOwner({ name, kind });
  const { copies } = s.grantStarterCollection(owner.ownerId, faction);
  const deck = s.saveDeck(owner.ownerId, `${faction} starter`, copies.map((c) => c.copyId));
  s.setActiveDeck(owner.ownerId, deck.deckId);
  const agent = s.createAgent({ ownerId: owner.ownerId, name: `${name}-a` });
  s.connectAgent(owner.ownerId, agent.agentId);
  return { ownerId: owner.ownerId, agentId: agent.agentId, deckId: deck.deckId };
}

describe("passwords", () => {
  it("hash with a fresh salt, verify only the right password, and never contain it", () => {
    const a = hashPassword(PW);
    const b = hashPassword(PW);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$15\$8\$1\$/);
    expect(a).not.toContain(PW);
    expect(verifyPassword(PW, a)).toBe(true);
    expect(verifyPassword(PW + "!", a)).toBe(false);
    expect(verifyPassword(PW, "not-a-hash")).toBe(false);
    expect(needsRehash(a)).toBe(false);
    expect(needsRehash(hashPassword(PW, { log2N: 10, r: 8, p: 1 }))).toBe(true);
  });
});

describe("Season 0 sign-in", () => {
  it("creates an account, signs in by username or email (any case), and stores no password or token", () => {
    const { s } = store();
    const owner = s.createAccount({ name: "Ada", username: "ada", email: "ada@example.test", password: PW });
    expect(owner.kind).toBe("player");
    const byName = s.signIn("ADA", PW);
    const byEmail = s.signIn("Ada@Example.test", PW);
    expect([byName.ownerId, byEmail.ownerId]).toEqual([owner.ownerId, owner.ownerId]);
    expect(byName.token).not.toBe(byEmail.token);
    expect(byName.expiresAt).toBe(new Date(T0 + SESSION_DAYS * 86_400_000).toISOString());
    expect(s.authenticate(byName.token)).toEqual({ ownerId: owner.ownerId, isAdmin: false, expiresAt: byName.expiresAt });
    // Neither the password nor a token is anywhere in the file.
    s.unsafeExec(`CREATE TEMP TABLE dump AS SELECT password_hash AS v FROM logins UNION ALL SELECT token_hash FROM sessions`);
    const raw = JSON.stringify((s as unknown as { db: { prepare(q: string): { all(): unknown[] } } }).db.prepare("SELECT v FROM dump").all());
    expect(raw).not.toContain(PW);
    expect(raw).not.toContain(byName.token);
  });

  it("refuses bad usernames, short passwords, taken usernames and emails, and a second login", () => {
    const { s } = store();
    s.createAccount({ name: "Ada", username: "ada", email: "ada@example.test", password: PW });
    expect(() => s.createAccount({ name: "x", username: "a", password: PW })).toThrow(/3 to 32/);
    expect(() => s.createAccount({ name: "x", username: "bad name", password: PW })).toThrow(/3 to 32/);
    expect(() => s.createAccount({ name: "x", username: "xyz", email: "nope", password: PW })).toThrow(/email/);
    expect(() => s.createAccount({ name: "x", username: "xyz", password: "short" })).toThrow(/at least 10/);
    expect(() => s.createAccount({ name: "x", username: "ADA", password: PW })).toThrow(/username is taken/);
    expect(() => s.createAccount({ name: "x", username: "xyz", email: "ADA@example.test", password: PW })).toThrow(/email address is already in use/);
    // A refused account leaves no owner behind.
    expect(s.listOwners().map((o) => o.name)).toEqual(["Ada"]);
    const house = s.createOwner({ name: "house-cortex", kind: "house" });
    s.addLogin(house.ownerId, { username: "house-cortex", password: PW });
    expect(() => s.addLogin(house.ownerId, { username: "house-cortex-2", password: PW })).toThrow(/already has a login/);
  });

  it("gives the same answer for a wrong password and an unknown login", () => {
    const { s } = store();
    s.createAccount({ name: "Ada", username: "ada", password: PW });
    expect(() => s.signIn("ada", "wrong password!")).toThrow(/^wrong login or password$/);
    expect(() => s.signIn("nobody", PW)).toThrow(/^wrong login or password$/);
  });

  it("locks a login after repeated failures, counted per account across username and email, until the window passes", () => {
    const { s, clock } = store();
    s.createAccount({ name: "Ada", username: "ada", email: "ada@example.test", password: PW });
    for (let i = 0; i < SIGN_IN_LOCKOUT.failures; i++) {
      expect(() => s.signIn(i % 2 ? "ada" : "ada@example.test", `guess number ${i}`)).toThrow(/wrong login/);
    }
    // Locked: even the right password is refused, and nothing is checked.
    expect(() => s.signIn("ada", PW)).toThrow(/too many failed sign-ins/);
    clock.t += SIGN_IN_LOCKOUT.windowMinutes * 60_000 + 1;
    const ok = s.signIn("ada", PW);
    expect(s.authenticate(ok.token).ownerId).toBeTruthy();
    // A success clears the count.
    expect(() => s.signIn("ada", "one more wrong")).toThrow(/wrong login/);
    expect(s.signIn("ada", PW).token).toBeTruthy();
  });

  it("ends sessions on sign-out, on expiry, and all of them on a password change", () => {
    const { s, clock } = store();
    const owner = s.createAccount({ name: "Ada", username: "ada", password: PW });
    const phone = s.signIn("ada", PW);
    const laptop = s.signIn("ada", PW);
    s.signOut(phone.token);
    expect(() => s.authenticate(phone.token)).toThrow(/not signed in/);
    expect(s.authenticate(laptop.token).ownerId).toBe(owner.ownerId);
    expect(() => s.authenticate("made-up-token")).toThrow(/not signed in/);

    expect(() => s.changePassword(owner.ownerId, "not the password", "a whole new password")).toThrow(/wrong password/);
    s.changePassword(owner.ownerId, PW, "a whole new password");
    expect(() => s.authenticate(laptop.token)).toThrow(/not signed in/);
    expect(() => s.signIn("ada", PW)).toThrow(/wrong login/);
    const fresh = s.signIn("ada", "a whole new password");
    clock.t += SESSION_DAYS * 86_400_000;
    expect(() => s.authenticate(fresh.token)).toThrow(/not signed in/);
  });

  it("re-hashes a password made at a lower cost at the next sign-in", () => {
    const { s } = store();
    const owner = s.createAccount({ name: "Ada", username: "ada", password: PW });
    s.unsafeExec(`UPDATE logins SET password_hash = '${hashPassword(PW, { log2N: 10, r: 8, p: 1 })}' WHERE owner_id = '${owner.ownerId}'`);
    s.signIn("ada", PW);
    const stored = (s as unknown as { db: { prepare(q: string): { get(): { password_hash: string } } } }).db
      .prepare("SELECT password_hash FROM logins")
      .get().password_hash;
    expect(needsRehash(stored)).toBe(false);
    expect(verifyPassword(PW, stored)).toBe(true);
  });

  it("marks admin accounts", () => {
    const { s } = store();
    const admin = s.createAccount({ name: "Admin", username: "admin", password: PW, isAdmin: true });
    const player = s.createAccount({ name: "Ada", username: "ada", password: PW });
    expect(s.authenticate(s.signIn("admin", PW).token).isAdmin).toBe(true);
    expect([s.isAdmin(admin.ownerId), s.isAdmin(player.ownerId)]).toEqual([true, false]);
    expect(() => s.unsafeExec(`UPDATE logins SET password_hash = 'plaintext' WHERE owner_id = '${player.ownerId}'`)).toThrow(/CHECK/);
  });
});

describe("one connected agent per owner", () => {
  it("connects only the owner's own agents, one at a time; switching moves nothing else", () => {
    const { s } = store();
    const a = ready(s, "a", "Cortex");
    const b = ready(s, "b", "Swarm");
    const a2 = s.createAgent({ ownerId: a.ownerId, name: "a-second" });
    expect(s.connectedAgent(a.ownerId)!.agentId).toBe(a.agentId);
    expect(() => s.connectAgent(a.ownerId, b.agentId)).toThrow(/its own agents/);
    expect(() => s.unsafeExec(`UPDATE owners SET connected_agent_id = '${b.agentId}' WHERE owner_id = '${a.ownerId}'`)).toThrow(/its own agents/);
    const before = { copies: s.collection(a.ownerId).length, deck: s.getOwner(a.ownerId).activeDeckId };
    s.connectAgent(a.ownerId, a2.agentId);
    expect(s.connectedAgent(a.ownerId)!.agentId).toBe(a2.agentId);
    expect({ copies: s.collection(a.ownerId).length, deck: s.getOwner(a.ownerId).activeDeckId }).toEqual(before);
    s.disconnectAgent(a.ownerId);
    expect(s.connectedAgent(a.ownerId)).toBeNull();
    expect(() => s.startMatch({ matchId: "m", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId })).toThrow(/no connected agent/);
  });

  it("starts a match with each owner's connected agent and active deck, and refuses switching until it's recorded", () => {
    const { s } = store();
    const a = ready(s, "a", "Cortex");
    const b = ready(s, "b", "Swarm");
    const c = ready(s, "c", "Aegis");
    const a2 = s.createAgent({ ownerId: a.ownerId, name: "a-second" });
    const live = s.startMatch({ matchId: "m1", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    expect([live.p1.agentId, live.p2.agentId]).toEqual([a.agentId, b.agentId]);
    expect(live.p1.deck.spec.cards).toHaveLength(SHIPPED_DECK_LISTS.Cortex.reduce((n, e) => n + e.copies, 0));
    expect(s.liveMatchOf(a.ownerId)!.matchId).toBe("m1");
    expect(s.liveMatches().map((m) => m.matchId)).toEqual(["m1"]);

    expect(() => s.connectAgent(a.ownerId, a2.agentId)).toThrow(/during a live match/);
    expect(() => s.disconnectAgent(a.ownerId)).toThrow(/during a live match/);
    expect(() => s.unsafeExec(`UPDATE owners SET connected_agent_id = NULL WHERE owner_id = '${a.ownerId}'`)).toThrow(/during a live match/);
    // One live match per owner: a can't start a second one against c.
    expect(() => s.startMatch({ matchId: "m2", p1OwnerId: c.ownerId, p2OwnerId: a.ownerId })).toThrow(/already in a live match/);
    expect(() => s.startMatch({ matchId: "m1", p1OwnerId: c.ownerId, p2OwnerId: a.ownerId })).toThrow(/already live/);
    // It must be recorded with the agents that started it.
    expect(() =>
      s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: a2.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: b.agentId } }),
    ).toThrow(/started by other agents/);

    s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId } });
    expect(s.liveMatchOf(a.ownerId)).toBeNull();
    s.connectAgent(a.ownerId, a2.agentId);
    // A recorded match id can't go live again.
    expect(() => s.startMatch({ matchId: "m1", p1OwnerId: a.ownerId, p2OwnerId: c.ownerId })).toThrow(/already recorded/);
    // A cancel or abandon ends the live match too (and pays nothing).
    s.startMatch({ matchId: "m3", p1OwnerId: a.ownerId, p2OwnerId: c.ownerId });
    const abandoned = s.recordMatch({ matchId: "m3", seed: 3, p1AgentId: a2.agentId, p2AgentId: c.agentId, outcome: { kind: "abandoned", byAgentId: c.agentId } });
    expect([abandoned.p1Credits, abandoned.p2Credits, s.liveMatches().length]).toEqual([0, 0, 0]);
  });

  it("refuses to start: self-play, no active deck, an incomplete deck, and a deck outside the faction lock", () => {
    const { s } = store();
    const a = ready(s, "a", "Cortex");
    const b = ready(s, "b", "Swarm");
    expect(() => s.startMatch({ matchId: "m", p1OwnerId: a.ownerId, p2OwnerId: a.ownerId })).toThrow(/never play each other/);

    const bare = s.createOwner({ name: "bare" });
    s.connectAgent(bare.ownerId, s.createAgent({ ownerId: bare.ownerId, name: "bare-a" }).agentId);
    expect(() => s.startMatch({ matchId: "m", p1OwnerId: bare.ownerId, p2OwnerId: b.ownerId })).toThrow(/no active deck/);

    // Faction lock: Swarm-locked with a Cortex deck active can't start.
    expect(s.setFactionLock(a.ownerId, "Swarm")).toEqual({ activeDeckFits: false });
    expect(() => s.startMatch({ matchId: "m", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId })).toThrow(/locked to Swarm/);
    expect(() => s.setActiveDeck(a.ownerId, a.deckId)).toThrow(/faction lock is Swarm/);
    expect(() => s.setFactionLock(a.ownerId, "Neutral" as never)).toThrow(/can't lock/);
    expect(s.setFactionLock(a.ownerId, "Cortex")).toEqual({ activeDeckFits: true });
    expect(s.getOwner(a.ownerId).factionLock).toBe("Cortex");
    s.setFactionLock(a.ownerId, null);

    // An incomplete active deck can't start a match.
    const first = s.loadDeck(a.deckId).copyIds[0]!;
    s.unsafeExec(`UPDATE card_copies SET disposed_at = 'x', disposed_reason = 'retired' WHERE copy_id = '${first}'`);
    expect(() => s.startMatch({ matchId: "m", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId })).toThrow(/incomplete/);
    expect(s.liveMatches()).toEqual([]);
  });
});

describe("admin: house owners", () => {
  it("lists every house owner with agents, connected agent, wallet, collection, packs, stats and live state", () => {
    const { s } = store();
    const h1 = ready(s, "house-cortex", "Cortex");
    const h2 = ready(s, "house-swarm", "Swarm");
    ready(s, "a-player", "Null", "player");
    s.createAgent({ ownerId: h1.ownerId, name: "house-cortex-b" });
    s.startMatch({ matchId: "m1", p1OwnerId: h1.ownerId, p2OwnerId: h2.ownerId });
    s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: h1.agentId, p2AgentId: h2.agentId, outcome: { kind: "win", winnerAgentId: h1.agentId } });
    s.startMatch({ matchId: "m2", p1OwnerId: h2.ownerId, p2OwnerId: h1.ownerId });
    const roster = s.houseRoster();
    expect(
      roster.map((r) => [r.owner.name, r.agents.map((a) => a.name), r.connectedAgent?.name, r.credits, r.copies, r.unopenedPacks, r.stats.wins, r.inLiveMatch]),
    ).toEqual([
      ["house-cortex", ["house-cortex-a", "house-cortex-b"], "house-cortex-a", 30, 40, 3, 1, true],
      ["house-swarm", ["house-swarm-a"], "house-swarm-a", 2, 40, 3, 0, true],
    ]);
  });
});
