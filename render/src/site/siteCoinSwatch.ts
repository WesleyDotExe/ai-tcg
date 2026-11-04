// A coin's swatch in the Store's cosmetics list (render session 55): a
// canvas the page's COIN_SCRIPT (siteCoins.ts) paints with the coin's own
// look. No imports, so the client bundle stays free of coinFx.ts.

export function coinSwatchHtml(itemId: string): string {
  return `<span class="si-pv si-coin"><canvas data-coin="${itemId.replace(/[^a-z0-9-]/gi, "")}" width="120" height="54" aria-hidden="true"></canvas></span>`;
}
