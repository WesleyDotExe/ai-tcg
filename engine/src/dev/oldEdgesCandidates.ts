// The candidate errata of the balance session's job 2 (session 61, test only),
// in a module of their own that imports no card data, so a throwaway copy
// of the repo can apply one at load (progress/old-edges/run-candidate.sh
// appends a call to the end of its data/registry.ts) without an import cycle.
// oldEdgesScreen.ts applies them in-process for the ring screen.
//
// NO CARD IS CHANGED by this file: applyCandidate mutates the card objects
// it is handed, in the calling process only. Session 62 shipped NA12 and CS7
// in the real card files (owner 2026-11-01), so against today's cards those
// two keys change nothing; the rest still measure from today's cards.

import type { Card, UnitCard } from "../cards/types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type CardLookup = (id: string) => Card | undefined;
let lookup: CardLookup = () => undefined;
const card = (id: string): any => {
  const c = lookup(id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const ability = (id: string, abilityId: string): any => {
  const a = (card(id) as Card).abilities.find((x) => x.id === abilityId);
  if (!a) throw new Error(`no ability ${abilityId} on ${id}`);
  return a;
};

/** Makes a one-ability card modal: its printed ability becomes the first
 * mode (same ability, same text), `extra` the second, aimed at one enemy
 * unit (or every enemy unit with scope "all"), same speed and cost.
 * Since session 62 NA12 and CS7 ship, so Null Pointer and Force Quit are
 * already modal: the first mode's ability is then the printed one and the
 * second mode is replaced, so NA12 and CS7 change nothing and the other
 * modal candidates still measure "the printed answer + their own mode". */
function modal(id: string, firstId: string, firstName: string, extra: { id: string; name: string; text: string; scope?: "all"; effects: unknown[] }): void {
  const c = card(id);
  if (c.modes) {
    if (c.abilities.length !== 0 || c.modes.length !== 2 || c.modes[0].id !== firstId || c.modes[0].abilities.length !== 1) {
      throw new Error(`${c.name}: modal() expects the shipped two-mode card with "${firstId}" first`);
    }
    c.abilities = [...c.modes[0].abilities];
    delete c.modes;
  }
  const [printed] = c.abilities;
  if (c.abilities.length !== 1) throw new Error(`${c.name}: modal() expects one printed ability`);
  c.abilities = [];
  c.modes = [
    { id: firstId, name: firstName, text: printed.text, abilities: [printed] },
    {
      id: extra.id.split("-").slice(-2).join("-"), name: extra.name, text: extra.text,
      abilities: [{
        id: extra.id, trigger: "onPlay", text: extra.text,
        targeting: extra.scope === "all" ? { scope: "all", filter: { side: "opponent", kind: "unit" } } : { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
        effects: extra.effects,
      }],
    },
  ];
}

export interface Candidate {
  key: string;
  /** Which old edge it is aimed at: NA = Null > Aegis, CS = Cortex > Swarm. */
  edge: "NA" | "CS" | "-";
  label: string;
  /** The aim, in one line: what measured cause it answers. */
  why: string;
  apply: () => void;
}

export const CANDIDATES: Candidate[] = [
  { key: "shipped", edge: "-", label: "the shipped cards", why: "the reference", apply: () => {} },

  // ---- Null > Aegis. Causes on file (balance reports 030-032): a signature
  // card is worth ~+10 to Aegis, a third of it spare late energy, and its
  // body becomes Aegis's attacker (the closer its deck of walls lacks); the
  // design note for the next set asks for "an answer to one durable
  // attacker" for Null. Report 031 already tried: no tools on a signature
  // card, Kernel Panic reach 5/6, Plating Module +0/+2,
  // signature cards cost 6. Report 032 tried heavier all-Aegis lists.
  // (Segmentation Fault at cost 3 was on the list; the pool lint forbids a
  // permanent enemy-stat aura under 4 mana, so it is not a legal card.)
  {
    key: "NA1", edge: "NA",
    label: "Bit Rot: -3/-0 permanently (was this turn); cost 1",
    why: "an answer to one durable attacker: a 1-cost instant that defangs the 3-4 attack body for good",
    apply: () => {
      const a = ability("NL-018", "bit-rot-cast");
      a.effects[0].duration = "permanent";
      a.text = "Target enemy unit gets -3/-0 permanently. Instant speed.";
    },
  },
  {
    key: "NA2", edge: "NA",
    label: "Bit Rot: -3/-0 permanently (was this turn); cost 1 -> 2",
    why: "NA1 at a fairer price",
    apply: () => {
      const a = ability("NL-018", "bit-rot-cast");
      a.effects[0].duration = "permanent";
      a.text = "Target enemy unit gets -3/-0 permanently. Instant speed.";
      card("NL-018").cost = 2;
    },
  },
  {
    key: "NA3", edge: "NA",
    label: "Segfault Handler deals 4 (was 3) and costs 3 (was 2; the lint caps a sub-3-cost hit at cost+1)",
    why: "Null's one burn spell kills a 4-health wall (Sentinel, Turret, Bastion) and a tool-less 3/4 body",
    apply: () => {
      const a = ability("NL-004", "segfault-handler-cast");
      a.effects[0].amount.value = 4;
      a.text = "Deal 4 damage to target enemy unit.";
      card("NL-004").cost = 3;
    },
  },
  {
    key: "NA4", edge: "NA",
    label: "Deprecated Routine: -3/-3 (was -2/-2)",
    why: "the telegraphed shrink answers a mid-size body (a 3/6 signature line ends 0/3)",
    apply: () => {
      const r = card("NL-009") as UnitCard;
      for (const a of r.abilities as any[]) for (const e of a.effects ?? []) if (e.kind === "buff") { e.attack = -3; e.health = -3; }
    },
  },
  {
    key: "NA6", edge: "NA",
    label: "Aegis Warden's evolve: gains Barrier only (no full heal)",
    why: "an Aegis-side trim: the evolved 5/7 no longer resets, so Null's chip damage sticks",
    apply: () => {
      const w = card("AG-013") as UnitCard;
      for (const a of w.abilities as any[]) {
        if (!a.effects) continue;
        a.effects = a.effects.filter((e: any) => e.kind !== "heal");
        a.text = "When this evolves in, it gains Barrier.";
      }
    },
  },
  {
    key: "NA7", edge: "NA",
    label: "Kernel Panic costs 5 (was 6)",
    why: "Null's evolve-in removal comes online a turn earlier (it evolved in ~11% of Null's games vs Aegis)",
    apply: () => { card("NL-013").cost = 5; },
  },

  // Session 61's ablation (progress/old-edges/ablation.txt) says WHERE to aim:
  // Aegis's own cards carry it about equally against Null and against
  // Cortex (Prime Aegis cut: Null +7.3, Aegis vs Cortex -7.0), so an Aegis
  // trim moves Aegis > Cortex (gate already OUT low) with Null > Aegis. On
  // Null's side, Null Pointer (destroy target enemy directive) is the one
  // dead card: Null does +1.4 better against Aegis and Swarm without it
  // (Aegis runs 2 directives, Swarm none). The modal candidates keep its
  // printed answer and add a second mode, so it is live in those matchups.
  {
    key: "NA8", edge: "NA",
    label: "Null Pointer becomes modal: Dereference (destroy target enemy directive) or Null Out (target enemy unit gets -2/-2 permanently)",
    why: "the dead card gets a permanent shrink: a 3/6 signature line ends 1/4; a damaged body of 3 health or less dies (max health floors at 1)",
    apply: () => modal("NL-015", "dereference", "Dereference", {
      id: "null-pointer-null-out", name: "Null Out", text: "Target enemy unit gets -2/-2 permanently.",
      effects: [{ kind: "buff", attack: -2, health: -2, duration: "permanent" }],
    }),
  },
  {
    key: "NA9", edge: "NA",
    label: "Null Pointer becomes modal: Dereference (destroy target enemy directive) or Hard Fault (deal 3 damage to target enemy unit)",
    why: "the dead card becomes a second Segfault Handler at instant speed when there is no directive to hit",
    apply: () => modal("NL-015", "dereference", "Dereference", {
      id: "null-pointer-hard-fault", name: "Hard Fault", text: "Deal 3 damage to target enemy unit.",
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    }),
  },
  {
    key: "NA10", edge: "NA",
    label: "Null Pointer becomes modal: Dereference (destroy target enemy directive) or Disarm (target enemy unit gets -3/-0 permanently)",
    why: "an answer to one durable attacker without killing anything: the signature body or a Warden stops hitting hard",
    apply: () => modal("NL-015", "dereference", "Dereference", {
      id: "null-pointer-disarm", name: "Disarm", text: "Target enemy unit gets -3/-0 permanently.",
      effects: [{ kind: "buff", attack: -3, health: 0, duration: "permanent" }],
    }),
  },
  {
    key: "NA12", edge: "NA",
    label: "Null Pointer becomes modal: Dereference (destroy target enemy directive) or Null Out (target enemy unit gets -3/-3 permanently)",
    // Session 62: max health floors at 1 (state/queries.ts), so an undamaged
    // 3-health body ends 0/1, not dead; it kills a damaged one of 4 or less.
    why: "NA8 one step stronger: a 3/6 signature line ends 0/3; a damaged body of 4 health or less dies",
    apply: () => modal("NL-015", "dereference", "Dereference", {
      id: "null-pointer-null-out", name: "Null Out", text: "Target enemy unit gets -3/-3 permanently.",
      effects: [{ kind: "buff", attack: -3, health: -3, duration: "permanent" }],
    }),
  },
  {
    key: "NA11", edge: "NA",
    label: "Null Singularity costs 6 (was 7; report 031's T5 re-run on today's cards)",
    why: "the best single change on file (+3.8 real in report 031), measured again after set A",
    apply: () => { card("NL-014").cost = 6; },
  },

  // ---- Cortex > Swarm. Real-match mode only (gate 58.2% is in reach of the
  // band): a signature card is worth -2.8 to Cortex vs Swarm and +3.3 to
  // Swarm vs Cortex (report 031 section 1). Swarm goes wide on 1-health
  // bodies; Cortex's answers to wide boards are Cascade Purge (1 copy),
  // Rate Limiter, Retaliation Node, Deadlock Detector. A Cortex buff must
  // not push Aegis > Cortex (gate 49.3%, accepted OUT) further out, so the
  // candidates aim at wide boards only.
  {
    key: "CS1", edge: "CS",
    label: "Cascade Purge costs 3 (was 4)",
    why: "Cortex's sweeper lands before Swarm's board snowballs; it does little to Aegis's 3-4 health walls",
    apply: () => { card("CX-005").cost = 3; },
  },
  {
    key: "CS2", edge: "CS",
    label: "Rate Limiter fires at 2+ enemy units (was 3+)",
    why: "the anti-wide ping starts sooner",
    apply: () => {
      const a = ability("CX-020", "rate-limiter-tick");
      a.effects[0].condition.count = 2;
      a.text = "At the start of your turn, if the enemy controls 2 or more units, deal 1 damage to all enemy units.";
    },
  },
  {
    key: "CS3", edge: "CS",
    label: "Retaliation Node is 1/4 (was 1/3)",
    why: "the damage-triggered ping-all survives one more hit, so it fires more often against small attackers",
    apply: () => { card("CX-013").health = 4; },
  },
  {
    key: "CS4", edge: "CS",
    label: "Deadlock Detector stuns for 2 turns (was 1)",
    why: "its wide-board-only stun matters for longer",
    apply: () => {
      const a = ability("CX-023", "deadlock-detector-play");
      a.effects[0].then[0].duration = 2;
      a.text = "If the enemy controls 3 or more units, stun a random enemy unit for 2 turns.";
    },
  },
  {
    key: "CS5", edge: "CS",
    label: "Load Balancer: its attack ping hits 2 random enemy units (was 1)",
    why: "more pings when it attacks, the most against many 1-health bodies",
    apply: () => {
      const a = ability("CX-021", "load-balancer-attack");
      a.targeting.count = 2;
      a.text = "Whenever this attacks, deal 1 damage to 2 random enemy units.";
    },
  },
  {
    key: "CS6", edge: "CS",
    label: "Quorum Arbiter costs 4 (was 5)",
    why: "Cortex's Mythic scales with enemy units; a turn earlier against the widest faction",
    apply: () => { card("CX-024").cost = 4; },
  },
  // The same ablation on Cortex's side: Force Quit (destroy target enemy
  // directive) is dead against Swarm, which runs no directives. A second
  // mode aimed at wide boards is live against exactly the faction Cortex
  // should prey on, and does least against Aegis's 3-5 health walls.
  {
    key: "CS7", edge: "CS",
    label: "Force Quit becomes modal: Terminate (destroy target enemy directive) or Kill All (deal 1 damage to all enemy units)",
    why: "the card that is dead vs Swarm becomes an instant ping-all: 1-health bodies are Swarm's whole board",
    apply: () => modal("CX-019", "terminate", "Terminate", {
      id: "force-quit-kill-all", name: "Kill All", text: "Deal 1 damage to all enemy units.", scope: "all",
      effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
    }),
  },
  {
    key: "CS8", edge: "CS",
    label: "Force Quit becomes modal: Terminate (destroy target enemy directive) or Kill (deal 2 damage to target enemy unit)",
    why: "the generic version of CS7: live vs Swarm, but a single-target hit",
    apply: () => modal("CX-019", "terminate", "Terminate", {
      id: "force-quit-kill", name: "Kill", text: "Deal 2 damage to target enemy unit.",
      effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
    }),
  },
];


/** Applies one candidate's erratum to the cards `getCard` returns. */
export function applyCandidate(key: string, getCard: CardLookup): Candidate {
  lookup = getCard;
  // "A+B" applies two candidates together (one per edge, as both might ship).
  const parts = key.split("+").map((k) => {
    const c = CANDIDATES.find((x) => x.key === k);
    if (!c) throw new Error(`no candidate ${k}`);
    return c;
  });
  for (const c of parts) c.apply();
  if (parts.length === 1) return parts[0]!;
  return { key, edge: "-", label: parts.map((c) => `${c.key} (${c.label})`).join(" + "), why: "both fixes together", apply: () => {} };
}

/** A candidate's label, for a single key or an "A+B" pair. */
export function candidateLabel(key: string): string {
  return key.split("+").map((k) => CANDIDATES.find((x) => x.key === k)?.label ?? k).join("  +  ");
}
