// The card face on the website (render session 48): the Collection page's
// binder and card viewer draw the same printed face the pack reveal, its
// summary and the card-face sheet draw, from the same source. Nothing here
// is a second copy of the face:
//
// - FACE_SCRIPT runs the pack page's pure source (PACK_PAGE_PURE_SOURCE) in
//   its own scope and hands the website the few functions it needs
//   (window.SITE_FACE: packFaceHtml, the text fit, the tilt angles, the
//   finish's look and label).
// - FACE_CSS is the pack page's own CSS (PACK_CSS) cut down to the face's
//   rules: every rule whose selectors are the face's (`.face...`, the
//   faction colours), the keyframes they name, and the custom properties
//   they read, scoped to `.cface` so nothing leaks into the website's own
//   styles. A test checks the cut keeps every `.face` rule the page has.
//
// The set symbol the face's number uses (`<use href="#setsym"/>`) is
// FACE_SYMBOLS, the pack page's own symbol markup.

import { PACK_CSS, PACK_PAGE_PURE_SOURCE, renderPackOpeningHtml } from "../packPage.js";
import { LOADOUT_GLYPHS } from "../loadoutPicker.js";

/** The names the website reads off window.SITE_FACE. */
export const FACE_EXPORTS = ["packFaceHtml", "packFitText", "packTiltAngles", "packFinishLayerName", "packFinishLabel", "packFullBleed", "packPlateSvg"] as const;

export const FACE_SCRIPT = `window.SITE_FACE = (function () {\n${PACK_PAGE_PURE_SOURCE}\nreturn { ${FACE_EXPORTS.map((n) => `${n}: ${n}`).join(", ")} };\n})();`;

/** One top-level CSS rule: its prelude (selectors or an at-rule) and body. */
interface CssRule {
  prelude: string;
  body: string;
}

/** Splits a stylesheet into its top-level rules (comments dropped). Enough
 * for PACK_CSS: no strings holding braces. */
export function cssRules(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: CssRule[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const prelude = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    out.push({ prelude, body: src.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

const FACE_SELECTOR = /^\.(face|faction-)/;

/** The face's rules from the pack page's CSS, each selector scoped under
 * `.cface`; a rule listing other selectors too (`.face, .back`) keeps only
 * the face's. */
export function faceRules(css: string): string[] {
  const out: string[] = [];
  for (const r of cssRules(css)) {
    if (r.prelude.startsWith("@")) continue;
    const sels = r.prelude.split(",").map((s) => s.trim()).filter((s) => FACE_SELECTOR.test(s));
    if (!sels.length) continue;
    out.push(`${sels.map((s) => `.cface ${s}`).join(", ")} {${r.body}}`);
  }
  return out;
}

/** The keyframes and @property rules the face's rules name. */
function faceAtRules(css: string, faceCss: string): string[] {
  const out: string[] = [];
  for (const r of cssRules(css)) {
    const kf = /^@keyframes\s+([\w-]+)/.exec(r.prelude);
    if (kf && new RegExp(`\\b${kf[1]}\\b`).test(faceCss)) out.push(`${r.prelude} {${r.body}}`);
    const prop = /^@property\s+(--[\w-]+)/.exec(r.prelude);
    if (prop && faceCss.includes(prop[1]!)) out.push(`${r.prelude} {${r.body}}`);
  }
  return out;
}

/** The custom properties the face reads, from the pack page's :root. */
function faceVars(css: string): string {
  const root = cssRules(css).find((r) => r.prelude === ":root");
  if (!root) return "";
  return root.body
    .split(";")
    .map((d) => d.trim())
    .filter((d) => /^--(cortex|aegis|swarm|null|neutral|gold\d)\s*:/.test(d))
    .join("; ");
}

function buildFaceCss(): string {
  const rules = faceRules(PACK_CSS);
  const body = rules.join("\n");
  return [
    // The card's width (--cw) is the slot's; the face fills it.
    `.cface { ${faceVars(PACK_CSS)}; --cw: 100%; position: relative; aspect-ratio: 5 / 7; color: #e6eeff; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }`,
    ".cface .face { position: absolute; inset: 0; border-radius: 6%/4.3%; }",
    body,
    ...faceAtRules(PACK_CSS, body),
  ].join("\n");
}

export const FACE_CSS = buildFaceCss();

/** The set symbol the face's number draws: the pack page's own <symbol>,
 * read out of its page. */
export function faceSymbols(): string {
  const m = /<symbol id="setsym"[\s\S]*?<\/symbol>/.exec(renderPackOpeningHtml({ title: "", packs: [], site: true }));
  if (!m) throw new Error("the pack page has no #setsym symbol");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${m[0]}</svg>`;
}

// ---- the sealed pack on the website (render session 63, the store layout) ----
// The store's tiles and the Packs widget draw the pack the opening tears:
// the pack page's own wrapper rules (`.pack .wrap`, the crimps, the logo,
// the emblem, SEASON ZERO, the set code, the plate), cut out of PACK_CSS and
// scoped to `.spk` (siteShop.sealedPackHtml's markup), and its plate from
// window.SITE_FACE.packPlateSvg. Nothing about the pack is restated here.

const PACK_PART = /^\.pack \.(wrap|crimp|logo|emb|set|meta|pa)\b/;

/** The sealed pack's rules from the pack page's CSS, `.pack ` turned into
 * `.spk ` (the torn halves, the flap and the grip are the opening's alone). */
export function sealedPackRules(css: string): string[] {
  const out: string[] = [];
  for (const r of cssRules(css)) {
    if (r.prelude.startsWith("@")) continue;
    const sels = r.prelude.split(",").map((s) => s.trim()).filter((s) => PACK_PART.test(s));
    if (!sels.length) continue;
    out.push(`${sels.map((s) => s.replace(/^\.pack /, ".spk ")).join(", ")} {${r.body}}`);
  }
  return out;
}

export const SEALED_PACK_CSS = [
  // The pack's box: --pw wide, 1.6 times as tall (the opening's ratio).
  ".spk { position: relative; flex: none; width: var(--pw); height: calc(var(--pw) * 1.6); border-radius: 10px; color: #e6eeff; font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif; line-height: 1.2; box-shadow: 0 12px 28px rgba(8,10,40,.45); }",
  ...sealedPackRules(PACK_CSS),
  // The crimps scale with the pack (the opening's 12 px is for a 300 px pack).
  ".spk .crimp { height: max(4px, calc(var(--pw) * 0.05)); }",
  ".spk .wrap { top: 0; overflow: hidden; }",
].join("\n");

/** The loadout picker's boast emblems as symbols (`#lg-<item id>`), so a
 * store tile draws the same emblem the picker's tile does. */
export function boastGlyphSymbols(): string {
  const defs = Object.entries(LOADOUT_GLYPHS)
    .map(([id, g]) => `<symbol id="lg-${id.replace(/[^a-z0-9-]/gi, "")}" viewBox="0 0 24 24">${g}</symbol>`)
    .join("");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${defs}</svg>`;
}
