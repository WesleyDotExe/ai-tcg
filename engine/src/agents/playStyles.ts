// Play styles (owner 2026-10-15: "owners pick their agent's play style from
// a set of presets"; ~6 is a target; each style should play visibly
// differently and the styles should be fair against each other, tested the
// same way as signature cards). Built session 52, roadmap 2b part 2.
//
// A style is a preset of the LookaheadAgent's weights, not a second brain:
// every style reads the same data-driven effect scoring (no card names), and
// differs only in how much it cares about each kind of gain. That keeps the
// styles honest (a style can't cheat its way to strength with a special
// case) and means a new card is scored by every style the day it ships.
//
// Calculator is today's agent, weight for weight: the reference every
// balance measurement uses. A test pins that it picks exactly the moves the
// unstyled agent picks.
//
// The weights (all multipliers are 1 for Calculator):
//   face      value of a point of damage to a player (the agent's FACE_DAMAGE_WEIGHT, 2)
//   cards     value of a card drawn, and the cost of wasting one (1.5)
//   energy    cost of a point of energy spent (0.4); lower spends more freely
//   trade     multiplier on an attack into a unit (the exchange's value)
//   risk      multiplier on what an attack loses when the attacker dies;
//             above 1 is loss-averse, below 1 trades recklessly
//   removal   multiplier on harm done to enemy units by an effect
//             (damage, destroy, statuses)
//   protect   multiplier on help given to my side by an effect (heals,
//             lasting buffs, a Barrier) and on harm my side takes from one
//   develop   multiplier on a new unit's body and abilities
//   toughness multiplier on a new unit's health in its body value (a
//             3/5 over a 5/3)
//   reserve   on my own turn with an empty stack, the penalty for a
//             sorcery-speed play or attack-free spend that leaves less energy
//             than the cheapest Instant left in my hand (holding up a response)
//   margin    the Gambler's dice: any move within `margin` of the best score
//             (and above -Infinity) may be picked, uniformly; 0 = always the best

/** The preset ids, in the order the owner app lists them. */
export const PLAY_STYLE_IDS = ["calculator", "rusher", "controller", "tempo", "fortress", "gambler"] as const;
export type PlayStyleId = (typeof PLAY_STYLE_IDS)[number];

export interface PlayStyleWeights {
  face: number;
  cards: number;
  energy: number;
  trade: number;
  risk: number;
  removal: number;
  protect: number;
  develop: number;
  toughness: number;
  reserve: number;
  margin: number;
}

export interface PlayStyle {
  id: PlayStyleId;
  name: string;
  /** One line for the owner app's picker. */
  summary: string;
  weights: PlayStyleWeights;
}

/** Today's agent. Every other style is a change from this. */
export const CALCULATOR_WEIGHTS: PlayStyleWeights = {
  face: 2,
  cards: 1.5,
  energy: 0.4,
  trade: 1,
  risk: 1,
  removal: 1,
  protect: 1,
  develop: 1,
  toughness: 1,
  reserve: 0,
  margin: 0,
};

const w = (changes: Partial<PlayStyleWeights>): PlayStyleWeights => ({ ...CALCULATOR_WEIGHTS, ...changes });

/** The six presets. Tuned session 52 against each other with
 * dev/playStyleRing.ts and confirmed on fresh seeds (5001-5300, 48,000
 * games per style): every style within 1.5 points of 50% against the field
 * (progress/play-style-ring-001.txt). Each one picks a move Calculator
 * would not in 5-11% of its decisions. The owner approves them at a
 * check-in. */
export const PLAY_STYLES: Record<PlayStyleId, PlayStyle> = {
  calculator: {
    id: "calculator",
    name: "Calculator",
    summary: "Weighs every move on the board as it stands and takes the best. The balanced default.",
    weights: w({}),
  },
  rusher: {
    id: "rusher",
    name: "Rusher",
    summary: "Goes for the opponent's health, spends fast, and trades with units only when it must.",
    weights: w({ face: 3, energy: 0.3, trade: 0.7 }),
  },
  controller: {
    id: "controller",
    name: "Controller",
    summary: "Answers threats, draws cards and keeps a response ready; wins the long game.",
    weights: w({ cards: 2.2, energy: 0.3, trade: 1.15, removal: 1.3, develop: 0.9, reserve: 0.6 }),
  },
  tempo: {
    id: "tempo",
    name: "Tempo",
    summary: "Uses its energy every turn to put the wider board down first.",
    weights: w({ energy: 0.15, develop: 1.5 }),
  },
  fortress: {
    id: "fortress",
    name: "Fortress",
    summary: "Plays tough bodies, protects its units and attacks only when the trade is safe.",
    weights: w({ risk: 1.6, protect: 2, toughness: 1.8 }),
  },
  gambler: {
    id: "gambler",
    name: "Gambler",
    summary: "Rolls the dice between its good moves: hard to read, now and then brilliant.",
    weights: w({ margin: 0.6 }),
  },
};

export const DEFAULT_PLAY_STYLE: PlayStyleId = "calculator";

export function isPlayStyleId(x: string): x is PlayStyleId {
  return (PLAY_STYLE_IDS as readonly string[]).includes(x);
}

export function playStyle(id: PlayStyleId): PlayStyle {
  return PLAY_STYLES[id];
}
