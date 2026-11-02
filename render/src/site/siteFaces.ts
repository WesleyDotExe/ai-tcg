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

/** The names the website reads off window.SITE_FACE. */
export const FACE_EXPORTS = ["packFaceHtml", "packFitText", "packTiltAngles", "packFinishLayerName", "packFinishLabel", "packFullBleed"] as const;

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
