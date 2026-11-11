// A coin's swatch in the Store's cosmetics list (render session 55): a
// canvas the page's COIN_SCRIPT (siteCoins.ts) paints with the coin's own
// look. No imports, so the client bundle stays free of coinFx.ts. Render
// session 63: a size, for the store's larger tiles (the canvas's own
// width and height; the coin script scales the coin to them).

export function coinSwatchHtml(itemId: string, size: { w: number; h: number } = { w: 120, h: 54 }): string {
  return `<span class="si-pv si-coin"><canvas data-coin="${itemId.replace(/[^a-z0-9-]/gi, "")}" width="${Math.round(size.w)}" height="${Math.round(size.h)}" aria-hidden="true"></canvas></span>`;
}
