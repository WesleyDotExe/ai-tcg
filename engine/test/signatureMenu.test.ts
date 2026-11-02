// The Neutral signature-card menu (owner 2026-10-05, the unique Mythic as
// amended; built session 32) and the engine pieces it needed: onKill
// (Hunter), onEnemyAttack + the once-per-turn limit (Bulwark), buffAllies'
// excludeSelf (Commander's aura) and cardCostModifier's cardType (Tax).

import { describe, expect, it } from "vitest";
import {
  SIGNATURE_MENU,
  SIGNATURE_TIERS,
  allSignatureSpecs,
  buildSignatureCard,
  signatureComboId,
  signatureFingerprint,
  signatureSpecProblem,
  legacySignatureAbilityText,
  type SignatureSpec,
} from "../src/data/signatureMenu.js";
import { APPROVED_SIGNATURE_LINES } from "../src/data/signatureApproved.js";
import { applyMove } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { resolveAbility } from "../src/effects/resolver.js";
import { runMatch } from "../src/engine/match.js";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentHealth, effectiveCardCost } from "../src/state/queries.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { buildCortexDeck, buildSwarmDeck } from "../src/data/decks.js";
import { diagnosticPulse, signalDrone } from "../src/data/cards.js";
import type { UnitCard } from "../src/cards/types.js";
import type { GameState } from "../src/state/types.js";
import { drainStack, emptyState, putUnit } from "./helpers.js";
import { REFERENCE_SIGNATURE, pairedChange } from "../src/dev/signatureFairness.js";

const card = (spec: Partial<SignatureSpec> & { ability: string }): UnitCard =>
  buildSignatureCard({ tier: 5, attack: 3, health: 6, ...spec } as SignatureSpec);

const vanilla = (attack: number, health: number, name = "Vanilla"): UnitCard => ({ ...REFERENCE_SIGNATURE, id: `T-${name}`, name, attack, health });

/** p1 to act in its main phase, units already able to attack. */
function readyToAttack(state: GameState): void {
  state.turnNumber += 1;
  state.activePlayer = "p1";
  state.priority = "p1";
}

function attack(state: GameState, attackerInstanceId: string, target: { kind: "unit"; instanceId: string } | { kind: "player"; playerId: "p1" | "p2" }, rng: Rng): void {
  applyMove(state, { type: "attack", attackerInstanceId, target }, rng);
  drainStack(state, rng);
}

describe("the Neutral signature menu as card data", () => {
  it("holds the owner's 16 options, four per category, four of them auras", () => {
    expect(SIGNATURE_MENU).toHaveLength(16);
    for (const cat of ["Offence", "Defence", "Card flow and energy", "Disruption"]) {
      expect(SIGNATURE_MENU.filter((m) => m.category === cat)).toHaveLength(4);
    }
    expect(SIGNATURE_MENU.filter((m) => m.aura).map((m) => m.key)).toEqual(["commanders-aura", "shield-wall", "dampen", "tax"]);
    expect(new Set(SIGNATURE_MENU.map((m) => m.key)).size).toBe(16);
  });

  it("enumerates every combination the body table allows, each legal and uniquely named", () => {
    const specs = allSignatureSpecs();
    // 16 x 3 at cost 5; 16 x 3 x 3 at cost 6 minus a keyword an option
    // already prints (Guardian's Barrier, Hunter's Rush: 6);
    // (12 x 4 + 4 x 3) x 2 at cost 7.
    expect(specs.filter((s) => s.tier === 5)).toHaveLength(48);
    expect(specs.filter((s) => s.tier === 6)).toHaveLength(138);
    expect(specs.filter((s) => s.tier === 7)).toHaveLength(120);
    expect(new Set(specs.map(signatureComboId)).size).toBe(specs.length);
    for (const s of specs) {
      expect(signatureSpecProblem(s)).toBeUndefined();
      const c = buildSignatureCard(s);
      expect(c).toMatchObject({ faction: "Neutral", rarity: "Mythic", type: "Unit", cost: s.tier, attack: s.attack, health: s.health });
      expect(SIGNATURE_TIERS[s.tier].stats).toContainEqual([c.attack, c.health]);
    }
  });

  it("refuses anything off the owner's table", () => {
    expect(signatureSpecProblem({ ability: "smite", tier: 5, attack: 5, health: 5 })).toMatch(/not a cost-5 stat line/);
    expect(signatureSpecProblem({ ability: "smite", tier: 5, attack: 3, health: 6, keyword: "Rush" })).toMatch(/only cost 6/);
    expect(signatureSpecProblem({ ability: "smite", tier: 6, attack: 4, health: 8 })).toMatch(/one keyword/);
    expect(signatureSpecProblem({ ability: "guardian", tier: 6, attack: 4, health: 8, keyword: "Barrier" })).toMatch(/already has Barrier/);
    // Guardian is Barrier only since owner 2026-10-15, so cost 6 may add Guard.
    expect(signatureSpecProblem({ ability: "guardian", tier: 6, attack: 4, health: 8, keyword: "Guard" })).toBeUndefined();
    expect(signatureSpecProblem({ ability: "dampen", tier: 7, attack: 3, health: 7, secondAura: "dampen" })).toMatch(/must differ/);
    expect(signatureSpecProblem({ ability: "smite", tier: 7, attack: 3, health: 7, secondAura: "sweep" })).toMatch(/second aura/);
    expect(() => buildSignatureCard({ ability: "nope", tier: 5, attack: 3, health: 6 })).toThrow(/no signature ability/);
  });

  it("puts the second aura's ability and the tier keyword on the card", () => {
    const seven = buildSignatureCard({ ability: "sweep", tier: 7, attack: 3, health: 7, secondAura: "dampen" });
    expect(seven.abilities.map((a) => a.id)).toEqual(["sig-sweep", "sig-dampen"]);
    const six = buildSignatureCard({ ability: "hunter", tier: 6, attack: 4, health: 8, keyword: "Guard" });
    expect(six.keywords).toEqual(["Rush", "Guard"]);
  });
});

describe("ability sizes (owner 2026-10-13: the tuner's size lever)", () => {
  it("every size builds a legal card that differs from the standard, with a unique id", () => {
    const ids = new Set<string>();
    for (const option of SIGNATURE_MENU) {
      const standard = card({ ability: option.key });
      ids.add(standard.id);
      for (const size of option.sizes) {
        const sized = card({ ability: option.key, size: size.key });
        expect(sized.id).toBe(`sig5-3x6-${option.key}.${size.key}`);
        expect(JSON.stringify(sized.abilities)).not.toBe(JSON.stringify(standard.abilities));
        // Owner 2026-10-18: every size has its own ability id (the standard's plus the size key).
        expect(sized.abilities.map((a) => a.id)).toEqual(standard.abilities.map((a) => `${a.id}.${size.key}`));
        expect(size.text).not.toBe(option.text);
        ids.add(sized.id);
      }
    }
    expect(ids.size).toBe(SIGNATURE_MENU.length + SIGNATURE_MENU.reduce((n, o) => n + o.sizes.length, 0));
  });

  // Owner 2026-10-19 (answers to render session 28): each signature ability
  // prints its menu option's full wording, trigger included, so anything
  // printing abilities[].text (replays, card faces) reads the whole rule.
  it("every ability prints its option's full wording, trigger included, keywords printed once", () => {
    for (const option of SIGNATURE_MENU) {
      const versions = [{ text: option.text, keywords: option.keywords, abilities: option.abilities }, ...option.sizes.map((z) => ({ ...z, keywords: z.keywords ?? option.keywords }))];
      for (const v of versions) {
        // Guardian is a keyword alone; every other option is exactly one ability.
        expect(v.abilities.length, option.key).toBe(option.key === "guardian" ? 0 : 1);
        for (const a of v.abilities) {
          const lead = v.keywords.map((k) => `${k}. `).find((p) => v.text.startsWith(p)) ?? "";
          expect(a.text).toBe(v.text.slice(lead.length));
        }
      }
    }
    expect(card({ ability: "inspire", size: "a0" }).abilities[0]!.text).toBe("At the start of your turn, a random ally gets +0/+1 permanently.");
    const hunter = card({ ability: "hunter" });
    expect(hunter.keywords).toContain("Rush");
    expect(hunter.abilities[0]!.text).toBe("Whenever it destroys a unit, it gets +1/+1.");
    // A cost-7 card's second aura reads in full too.
    expect(buildSignatureCard({ ability: "smite", tier: 7, attack: 3, health: 7, secondAura: "tax" }).abilities.map((a) => a.text))
      .toEqual(["On arrival, deal 3 damage to an enemy unit.", "Enemy Commands cost 1 more."]);
  });

  it("the full wording leaves every fingerprint as it was (the approved list's, recorded before it)", () => {
    for (const line of APPROVED_SIGNATURE_LINES) {
      expect(signatureFingerprint(buildSignatureCard(line.spec, { anyStats: true })), line.id).toBe(line.fingerprint);
    }
    // The fingerprint hashes the old wording, and only for signature abilities.
    expect(legacySignatureAbilityText(card({ ability: "inspire", size: "a0" }).abilities[0]!)).toBe("A random unit of yours gets +0/+1.");
    expect(legacySignatureAbilityText({ id: "x", trigger: "onPlay", text: "Draw a card." })).toBe("Draw a card.");
  });

  it("refuses a size the option doesn't have", () => {
    expect(signatureSpecProblem({ ability: "smite", tier: 5, attack: 3, health: 6, size: "d9" })).toMatch(/no size/);
    expect(signatureSpecProblem({ ability: "guardian", tier: 5, attack: 3, health: 6, size: "d1" })).toMatch(/no size/);
  });

  it("a smaller Smite deals less, and a conditional aura is off until its condition holds", () => {
    const rng = new Rng(3);
    const state = emptyState();
    const victim = putUnit(state, "p2", vanilla(1, 9, "Victim"));
    const smiter = putUnit(state, "p1", card({ ability: "smite", size: "d2" }));
    resolveAbility({
      state,
      ability: smiter.card.abilities[0]!,
      controller: "p1",
      source: { kind: "unit", instanceId: smiter.instanceId, cardName: smiter.card.name },
      chosen: { kind: "unit", instanceId: victim.instanceId },
      rng,
    });
    expect(currentHealth(state, victim)).toBe(7);

    const aura = putUnit(state, "p1", card({ ability: "commanders-aura", size: "w4" }));
    const ally = putUnit(state, "p1", vanilla(2, 2, "Ally"));
    expect(currentAttack(state, ally)).toBe(2); // 3 units: a w4 aura is off
    putUnit(state, "p1", vanilla(1, 1, "Fourth"));
    expect(currentAttack(state, ally)).toBe(3); // 4 units: on
    expect(currentAttack(state, aura)).toBe(3); // never itself
  });
});

describe("session 35's new sizes (owner 2026-10-15: \"add new sizes for the next tuner pass\")", () => {
  const fire = (state: GameState, unit: ReturnType<typeof putUnit>, chosen?: ReturnType<typeof putUnit>) =>
    resolveAbility({
      state,
      ability: unit.card.abilities[0]!,
      controller: "p1",
      source: { kind: "unit", instanceId: unit.instanceId, cardName: unit.card.name },
      chosen: chosen ? { kind: "unit", instanceId: chosen.instanceId } : undefined,
      rng: new Rng(5),
    });

  it("Smite d2m3 deals 2, and only to a unit with 3 or less health", () => {
    const smite = card({ ability: "smite", size: "d2m3" });
    expect(smite.abilities[0]!.targeting).toMatchObject({ scope: "chosen", filter: { side: "opponent", kind: "unit", maxHealth: 3 } });
    const state = emptyState();
    const small = putUnit(state, "p2", vanilla(1, 3, "Small"));
    fire(state, putUnit(state, "p1", smite), small);
    expect(currentHealth(state, small)).toBe(1);
  });

  it("the 'if you have 15 or less health' sizes do nothing until you're behind", () => {
    for (const [ability, size] of [["smite", "d1hp15"], ["smite", "d2hp15"], ["sweep", "hp15"], ["sweep", "r2hp15"]] as const) {
      const c = card({ ability, size });
      expect(c.abilities[0]!.text, size).toMatch(/^On arrival, if you have 15 or less health, deal \d damage to /);
      const state = emptyState();
      const enemy = putUnit(state, "p2", vanilla(1, 9, "Enemy"));
      const self = putUnit(state, "p1", c);
      state.players.p1.health = 16;
      fire(state, self, enemy);
      expect(currentHealth(state, enemy), `${size} at 16 health`).toBe(9);
      state.players.p1.health = 15;
      fire(state, self, enemy);
      expect(currentHealth(state, enemy), `${size} at 15 health`).toBeLessThan(9);
    }
  });
});

describe("the engine pieces the menu needed", () => {
  it("Commander's aura buffs your other units, not itself", () => {
    const state = emptyState();
    const commander = putUnit(state, "p1", card({ ability: "commanders-aura" }));
    const ally = putUnit(state, "p1", vanilla(2, 2));
    const enemy = putUnit(state, "p2", vanilla(2, 2, "Enemy"));
    expect(currentAttack(state, commander)).toBe(3);
    expect(currentAttack(state, ally)).toBe(3);
    expect(currentAttack(state, enemy)).toBe(2);
  });

  it("Tax makes enemy Commands cost 1 more, and nothing else", () => {
    const state = emptyState();
    putUnit(state, "p1", card({ ability: "tax" }));
    expect(effectiveCardCost(state, "p2", diagnosticPulse)).toBe(diagnosticPulse.cost + 1);
    expect(effectiveCardCost(state, "p2", signalDrone)).toBe(signalDrone.cost);
    expect(effectiveCardCost(state, "p1", diagnosticPulse)).toBe(diagnosticPulse.cost);
  });

  it("Hunter grows when its attack destroys a unit, and not when it dies in the same exchange", () => {
    const rng = new Rng(3);
    const state = emptyState();
    const hunter = putUnit(state, "p1", card({ ability: "hunter" }));
    const small = putUnit(state, "p2", vanilla(1, 2, "Small"));
    readyToAttack(state);
    attack(state, hunter.instanceId, { kind: "unit", instanceId: small.instanceId }, rng);
    expect(state.players.p2.board).toHaveLength(0);
    expect(hunter.permanentBuff).toEqual({ attack: 1, health: 1 });
    expect(state.log.some((e) => e.type === "abilityTrigger" && e.ability === "sig-hunter" && e.trigger === "onKill")).toBe(true);

    // A trade: both die, so nothing is left to grow.
    const s2 = emptyState();
    const h2 = putUnit(s2, "p1", card({ ability: "hunter" }));
    const big = putUnit(s2, "p2", vanilla(9, 3, "Big"));
    readyToAttack(s2);
    attack(s2, h2.instanceId, { kind: "unit", instanceId: big.instanceId }, rng);
    expect(s2.players.p1.board).toHaveLength(0);
    expect(s2.players.p2.board).toHaveLength(0);
    expect(s2.log.some((e) => e.type === "abilityTrigger" && e.ability === "sig-hunter")).toBe(false);
  });

  it("Hunter has Rush: it can attack the turn it arrives", () => {
    const state = emptyState();
    state.players.p1.signature = { card: card({ ability: "hunter" }), timesPlayed: 0, inZone: true };
    state.turnNumber = 3;
    state.players.p1.energy = state.players.p1.maxEnergy = 5;
    const rng = new Rng(1);
    applyMove(state, { type: "playSignature" }, rng);
    const hunter = state.players.p1.board[0]!;
    applyMove(state, { type: "attack", attackerInstanceId: hunter.instanceId, target: { kind: "player", playerId: "p2" } }, rng);
    drainStack(state, rng);
    expect(state.players.p2.health).toBeLessThan(state.players.p2.maxHealth);
  });

  it("Bulwark takes the first attack aimed at one of its side's units each turn, and only the first", () => {
    const rng = new Rng(5);
    const state = emptyState();
    const a1 = putUnit(state, "p1", vanilla(1, 5, "A1"));
    const a2 = putUnit(state, "p1", vanilla(1, 5, "A2"));
    const bulwark = putUnit(state, "p2", card({ ability: "bulwark" }));
    const other = putUnit(state, "p2", vanilla(1, 5, "Other"));
    readyToAttack(state);
    attack(state, a1.instanceId, { kind: "unit", instanceId: other.instanceId }, rng);
    expect(currentHealth(state, bulwark)).toBe(5); // took the hit
    expect(currentHealth(state, other)).toBe(5);
    expect(state.log.some((e) => e.type === "attackRedirected" && e.attacker === "A1")).toBe(true);
    attack(state, a2.instanceId, { kind: "player", playerId: "p2" }, rng);
    expect(currentHealth(state, bulwark)).toBe(5); // second attack goes through
    expect(state.players.p2.health).toBe(state.players.p2.maxHealth - 1);

    // The limit resets when the turn ends.
    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng);
    expect(bulwark.usedThisTurn).toBeUndefined();
  });

  it("Bulwark's own attacker is not redirected onto itself twice (an attack already aimed at it uses the turn's redirect)", () => {
    const rng = new Rng(6);
    const state = emptyState();
    const a1 = putUnit(state, "p1", vanilla(1, 5, "A1"));
    const a2 = putUnit(state, "p1", vanilla(1, 5, "A2"));
    const bulwark = putUnit(state, "p2", card({ ability: "bulwark" }));
    const other = putUnit(state, "p2", vanilla(1, 5, "Other"));
    readyToAttack(state);
    attack(state, a1.instanceId, { kind: "unit", instanceId: bulwark.instanceId }, rng);
    attack(state, a2.instanceId, { kind: "unit", instanceId: other.instanceId }, rng);
    expect(currentHealth(state, bulwark)).toBe(5);
    expect(currentHealth(state, other)).toBe(4);
  });

  // Owner 2026-10-13, call 3: Guard takes priority over Bulwark.
  it("Bulwark stands aside while a Guard unit protects its side, and keeps its redirect for later", () => {
    const rng = new Rng(7);
    const state = emptyState();
    const a1 = putUnit(state, "p1", vanilla(3, 5, "A1"));
    const a2 = putUnit(state, "p1", vanilla(1, 5, "A2"));
    const bulwark = putUnit(state, "p2", card({ ability: "bulwark" }));
    const guard = putUnit(state, "p2", { ...vanilla(1, 3, "Wall"), keywords: ["Guard"] });
    const other = putUnit(state, "p2", vanilla(1, 5, "Other"));
    readyToAttack(state);
    // The only legal enemy target is the Guard; Bulwark doesn't take it.
    attack(state, a1.instanceId, { kind: "unit", instanceId: guard.instanceId }, rng);
    expect(state.log.some((e) => e.type === "attackRedirected")).toBe(false);
    expect(currentHealth(state, bulwark)).toBe(6);
    expect(bulwark.usedThisTurn).toBeUndefined(); // the redirect wasn't spent
    expect(state.players.p2.board.includes(guard)).toBe(false); // 3 damage killed the 1/3 Guard
    // With the Guard gone, the next attack is Bulwark's first of the turn.
    attack(state, a2.instanceId, { kind: "unit", instanceId: other.instanceId }, rng);
    expect(currentHealth(state, bulwark)).toBe(5);
    expect(currentHealth(state, other)).toBe(5);
  });

  it("a Bulwark with Guard of its own (the cost-6 keyword) never pulls an attack off another Guard", () => {
    const rng = new Rng(8);
    const state = emptyState();
    const a1 = putUnit(state, "p1", vanilla(1, 5, "A1"));
    const bulwark = putUnit(state, "p2", card({ ability: "bulwark", tier: 6, attack: 4, health: 8, keyword: "Guard" }));
    const guard = putUnit(state, "p2", { ...vanilla(1, 5, "Wall"), keywords: ["Guard"] });
    readyToAttack(state);
    attack(state, a1.instanceId, { kind: "unit", instanceId: guard.instanceId }, rng);
    expect(currentHealth(state, guard)).toBe(4);
    expect(currentHealth(state, bulwark)).toBe(8);
  });

  it("a pending (unarmed) Guard doesn't protect, so Bulwark steps in as usual", () => {
    const rng = new Rng(9);
    const state = emptyState();
    const a1 = putUnit(state, "p1", vanilla(1, 5, "A1"));
    const bulwark = putUnit(state, "p2", card({ ability: "bulwark" }));
    const dormant = putUnit(state, "p2", { ...vanilla(1, 5, "Dormant"), keywords: ["Guard"] });
    dormant.pending = true;
    const other = putUnit(state, "p2", vanilla(1, 5, "Other"));
    readyToAttack(state);
    attack(state, a1.instanceId, { kind: "unit", instanceId: other.instanceId }, rng);
    expect(currentHealth(state, bulwark)).toBe(5);
  });

  // Owner 2026-10-15, option A: Bulwark covers units, never the player.
  it("Bulwark never takes an attack aimed at its controller, and that attack doesn't use up its redirect", () => {
    const rng = new Rng(10);
    const state = emptyState();
    const a1 = putUnit(state, "p1", vanilla(1, 5, "A1"));
    const a2 = putUnit(state, "p1", vanilla(1, 5, "A2"));
    const bulwark = putUnit(state, "p2", card({ ability: "bulwark" }));
    const other = putUnit(state, "p2", vanilla(1, 5, "Other"));
    readyToAttack(state);
    attack(state, a1.instanceId, { kind: "player", playerId: "p2" }, rng); // aimed at the player: not taken
    expect(currentHealth(state, bulwark)).toBe(6);
    expect(state.players.p2.health).toBe(state.players.p2.maxHealth - 1);
    expect(bulwark.usedThisTurn).toBeUndefined();
    attack(state, a2.instanceId, { kind: "unit", instanceId: other.instanceId }, rng); // aimed at a unit: taken
    expect(currentHealth(state, bulwark)).toBe(5);
    expect(currentHealth(state, other)).toBe(5);
  });

  it("a once-per-turn activated ability isn't offered again after it resolved this turn", () => {
    const rng = new Rng(11);
    const state = emptyState();
    const pinger = putUnit(state, "p1", {
      ...vanilla(1, 5, "Pinger"),
      abilities: [{ id: "t-ping", trigger: "activated", limit: "oncePerTurn", text: "Deal 1 damage to the enemy player.", targeting: { scope: "chosen", filter: { side: "opponent", kind: "player" } }, effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }] }],
    });
    readyToAttack(state);
    const offered = () => getLegalMoves(state).filter((m) => m.type === "activateAbility" && m.sourceInstanceId === pinger.instanceId);
    expect(offered()).toHaveLength(1);
    applyMove(state, offered()[0]!, rng);
    drainStack(state, rng);
    expect(state.players.p2.health).toBe(state.players.p2.maxHealth - 1);
    expect(offered()).toHaveLength(0);
  });

  it("a once-per-turn Instant ability isn't offered again while its first activation is still on the stack", () => {
    const rng = new Rng(12);
    const state = emptyState();
    const pinger = putUnit(state, "p1", {
      ...vanilla(1, 5, "Pinger"),
      abilities: [{ id: "t-ping", trigger: "activated", speed: "Instant", limit: "oncePerTurn", cost: { energy: 1 }, text: "Deal 1 damage to the enemy player.", targeting: { scope: "chosen", filter: { side: "opponent", kind: "player" } }, effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }] }],
    });
    readyToAttack(state);
    state.players.p1.energy = 5;
    const offered = () => getLegalMoves(state).filter((m) => m.type === "activateAbility" && m.sourceInstanceId === pinger.instanceId);
    applyMove(state, offered()[0]!, rng);
    expect(state.stack).toHaveLength(1);
    expect(state.priority).toBe("p1"); // the actor keeps priority, so a second activation would be its own move
    expect(offered()).toHaveLength(0);
    drainStack(state, rng);
    expect(state.players.p2.health).toBe(state.players.p2.maxHealth - 1);
    expect(state.players.p1.energy).toBe(4); // paid once, used once
  });

  it("a destroy effect credits its source unit with the kill", () => {
    const rng = new Rng(2);
    const state = emptyState();
    const killer = putUnit(state, "p1", {
      ...card({ ability: "hunter" }),
      abilities: [
        ...card({ ability: "hunter" }).abilities,
        { id: "t-destroy", trigger: "activated", text: "Destroy an enemy unit.", targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } }, effects: [{ kind: "destroy" }] },
      ],
    });
    const victim = putUnit(state, "p2", vanilla(1, 9, "Victim"));
    readyToAttack(state);
    applyMove(state, { type: "activateAbility", sourceInstanceId: killer.instanceId, abilityId: "t-destroy", target: { kind: "unit", instanceId: victim.instanceId } }, rng);
    drainStack(state, rng);
    expect(state.players.p2.board).toHaveLength(0);
    expect(killer.permanentBuff).toEqual({ attack: 1, health: 1 });
  });
});

describe("every menu option fires in real games", () => {
  // Each option as Cortex's signature card (cost 5, 3/6) against Swarm, in
  // Lookahead games until it has fired (at most 150). Every option with an
  // ability must see it resolve; Guardian (Barrier only) must see its
  // Barrier absorb a hit. Recycle is the slow one: a 3/6 signature card dies
  // in only ~3% of these games (session 32).
  for (const option of SIGNATURE_MENU) {
    it(option.name, async () => {
      const sig = card({ ability: option.key });
      let fired = 0;
      let barrier = 0;
      for (let seed = 1; seed <= 150 && fired + barrier === 0; seed++) {
        const { state } = await runMatch(
          { ...buildCortexDeck("p1", "Cortex"), signature: sig },
          { ...buildSwarmDeck("p2", "Swarm"), signature: REFERENCE_SIGNATURE },
          new LookaheadAgent("A", seed),
          new LookaheadAgent("B", seed + 1),
          seed,
        );
        const ids = new Set(sig.abilities.map((a) => a.id));
        fired += state.log.filter((e) => e.type === "abilityTrigger" && ids.has(e.ability)).length;
        barrier += state.log.filter((e) => e.type === "barrierAbsorbed" && e.unit === sig.name).length;
      }
      if (option.abilities.length > 0) {
        // Static auras have no trigger event; they're checked above.
        if (option.abilities.every((a) => a.trigger === "static")) return;
        expect(fired).toBeGreaterThan(0);
      } else {
        expect(barrier).toBeGreaterThan(0);
      }
    });
  }
});

describe("the fairness test's paired change", () => {
  it("is the mean per-seed difference with a paired interval", () => {
    expect(pairedChange("1100", "1100")).toMatchObject({ diff: 0, lo: 0, hi: 0, rate: 0.5 });
    const c = pairedChange("1110", "1000");
    expect(c.diff).toBeCloseTo(0.5);
    expect(c.lo).toBeLessThan(0.5);
    expect(c.hi).toBeGreaterThan(0.5);
    // Draws count as non-wins, as in the ring.
    expect(pairedChange("d1", "01").diff).toBe(0);
  });
});
