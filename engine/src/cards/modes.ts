// The generic "choose one" mechanic (owner 2026-10-16 amendment; built
// session 40). A modal card (Card.modes) is played in one of its modes. The
// engine never asks "which mode is this?" anywhere downstream: at the moment
// of the play it hands the board, the stack or the Directive slot a copy of
// the card whose `abilities` are the printed ones plus the chosen mode's, and
// whose `chosenMode` names the pick. Statics, triggers, cost auras and the
// agents' card reading then see exactly the chosen mode through the same
// `card.abilities` every other card uses. When the copy leaves play it goes
// to the graveyard as the printed card again (printedCard), so a graveyard
// never holds a half-played card.

import type { Ability, Card, CardMode } from "./types.js";

/** The mode `modeId` of `card`, or undefined when it has none by that id. */
export function findMode(card: Card, modeId: string): CardMode | undefined {
  return card.modes?.find((m) => m.id === modeId);
}

/** The copy of `card` played in mode `modeId`. Throws for a card without
 * that mode, or a copy that already has one chosen. */
export function withMode<T extends Card>(card: T, modeId: string): T {
  if (card.chosenMode !== undefined) throw new Error(`withMode: ${card.name} is already played in mode "${card.chosenMode}"`);
  const mode = findMode(card, modeId);
  if (!mode) throw new Error(`withMode: ${card.name} has no mode "${modeId}"`);
  return { ...card, abilities: [...card.abilities, ...mode.abilities], chosenMode: modeId };
}

/** The mode a played copy was played in, or undefined for a copy of a
 * plain card (or a printed card). */
export function chosenModeOf(card: Card): CardMode | undefined {
  return card.chosenMode === undefined ? undefined : findMode(card, card.chosenMode);
}

/** The printed card a played copy came from: the chosen mode's abilities
 * taken back out (by identity, so a printed ability equal in content to a
 * mode's is never confused with it) and `chosenMode` dropped. A card with
 * no mode chosen is returned as it is. */
export function printedCard<T extends Card>(card: T): T {
  const mode = chosenModeOf(card);
  if (!mode) return card;
  const { chosenMode: _chosen, ...rest } = card;
  return { ...rest, abilities: card.abilities.filter((a) => !mode.abilities.includes(a)) } as T;
}

/** Every ability a card can ever carry: its printed abilities plus every
 * mode's. For the card-pool lint, which judges what a card could do in
 * play, whichever mode is picked. */
export function allAbilities(card: Card): Ability[] {
  return [...card.abilities, ...(card.modes ?? []).flatMap((m) => m.abilities)];
}

/** The ways `card` can be played: one per mode for a modal card, or the
 * card itself (no mode) for any other. What legal-move generation and the
 * agents iterate over. */
export function playVariants<T extends Card>(card: T): { card: T; mode?: CardMode }[] {
  if (!card.modes || card.modes.length === 0) return [{ card }];
  return card.modes.map((mode) => ({ card: withMode(card, mode.id), mode }));
}
