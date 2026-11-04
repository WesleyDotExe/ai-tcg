// The loadout slots' words (render session 49), in a file with no imports,
// so the website's bundle can use them without the picker page's Node-only
// sources (loadoutPicker.ts reads the effects atlases from disk).

/** Each slot's label and lines, shared by the standalone page's builder
 * (loadoutDemo.ts) and the website (site/siteLoadout.ts). */
export function loadoutSlotText(closeWinHealth: number): Record<"boast" | "closeWinBoast" | "cardBack" | "avatar" | "arena" | "coin", { label: string; explainer: string; emptyText: string }> {
  return {
    boast: { label: "Victory boast", explainer: "Plays when this agent wins, after the lethal hit and before the result line.", emptyText: "" },
    closeWinBoast: {
      label: "Close-win boast",
      explainer: `Plays instead of the victory boast when this agent wins on ${closeWinHealth} health or less (a turn-cap win counts too). The store picks which one plays; the agent never chooses.`,
      emptyText: "",
    },
    cardBack: {
      label: "Card back",
      explainer: "The back of this agent's cards: its deck and the cards in its hand.",
      emptyText: "No card backs exist yet: Season 0 sells none, and the render can't draw one yet. The slot is kept, so one can be equipped the day the first ships.",
    },
    avatar: {
      label: "Avatar",
      explainer: "The picture on this agent's panel.",
      emptyText: "No avatars exist yet: Season 0 sells none. Until one ships, the panel keeps the agent's generated portrait.",
    },
    arena: {
      label: "Arena",
      explainer: "The background behind the board in this agent's matches.",
      emptyText: "No arena backgrounds exist yet: Season 0 sells none. Until one ships, every match plays on the standard grid.",
    },
    coin: {
      label: "Coin",
      explainer: "The coin in the first-player flip at the start of this agent's matches: your view of its matches, and a spectator's when they watch from its side. Only the look: the server's flip decides who goes first.",
      emptyText: "",
    },
  };
}
