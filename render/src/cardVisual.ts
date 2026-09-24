// DESIGN.md's art section: until real generated art exists (a late,
// owner-funded pass), cards must render with "a clean, readable generative
// frame driven by card attributes... explicitly NOT an emoji or glyph on a
// flat background." Faction gives the frame its palette (see renderHtml.ts);
// this module supplies the one further bit of per-card *distinctness* a
// placeholder frame can honestly offer without real art: a deterministic
// pattern seed derived from the card's own id, so two cards of the same
// faction/rarity still look visibly different from each other instead of
// being identical stamped rectangles.
//
// A simple string hash, not cryptographic — determinism (same id always
// produces the same seed, so a card looks the same every time it's drawn)
// is the only property that matters here.
export function visualSeedFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Which of a small set of generative background patterns (see the CSS in
 * renderHtml.ts) a card uses — a second, independent axis from hue so
 * same-hue cards (e.g. two Commons in the same faction) still read as
 * distinct shapes, not just distinct tints. */
export function visualPatternFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 17 + id.charCodeAt(i) * 7) | 0;
  }
  return Math.abs(hash) % 4;
}
