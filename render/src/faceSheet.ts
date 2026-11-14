// The card-face sheet (render session 26): every finish's settled face side
// by side, drawn by the pack page's own face code (packFaceHtml, the same
// source the page runs) and its CSS. Owner 2026-10-18: a finish rarer than
// Full Art always shows its art across the whole card, "everywhere these
// cards are drawn: the pack reveal, the summary grid and any card viewer",
// and a modal card's face shows each mode's name and rules text. The pack
// page shows one finish at a time, a few hundred ms each; this sheet is
// where they can be judged together.
//
// Every card on it is real: the hit of each showcase pack (packDemo.ts's
// openShowcase, real store openings) plus the 3 Zero-Day cards from the
// card registry in their only finish, numbered as the set numbers them.
// Faces wear the CSS finish looks (a static sheet runs no shaders).
//
// Usage: npm run card-faces -w @ai-tcg/render  -> render/output/card-faces.html

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cardSet } from "@ai-tcg/economy";
import { openShowcase, type Showcase } from "./packDemo.js";
import { cardFaceOf, revealKindOf, type RevealCard } from "./packOpening.js";
import { PACK_CSS, PACK_PAGE_PURE_SOURCE } from "./packPage.js";

type FaceCard = Pick<RevealCard, "face" | "finish" | "reveal" | "collectorNumber" | "prototype" | "hit">;

interface SheetEntry {
  card: FaceCard;
  /** Where the card on the sheet came from. */
  source: string;
}

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packFaceHtml, packFinishLayerName, packFinishLabel, packFullBleed };`)() as {
  packFaceHtml: (c: FaceCard, opts: { settled: boolean }, setCode: string) => string;
  packFinishLayerName: (reveal: string) => string;
  packFinishLabel: (finish: string) => string;
  packFullBleed: (reveal: string) => boolean;
};

/** The showcase's hits, one per finish (the shine slot, or a Prototype's
 * bonus card), best last, in the showcase's own order. */
export function showcaseEntries(showcase: readonly Showcase[]): SheetEntry[] {
  const out: SheetEntry[] = [];
  for (const s of showcase) {
    if (s.label === "Jackpot") continue;
    const c = s.reveal.cards.find((x) => x.slot === "bonus") ?? s.reveal.cards.find((x) => x.slot === "shine")!;
    out.push({ card: c, source: `${s.label} pack, seed ${s.reveal.seed}` });
  }
  return out;
}

/** The 3 Zero-Day cards, as a pulled copy would show them. */
export function zeroDayEntries(): SheetEntry[] {
  return cardSet("S0").secrets.filter((s) => s.kind === "zeroDay").map((s) => ({
    card: { face: cardFaceOf(s), finish: "zeroDay", reveal: "zeroDay", collectorNumber: s.collectorNumber, prototype: null, hit: true },
    source: `card registry, ${s.code}`,
  }));
}

/** Render session 75: Season 0's 28 booster cards (097-124), each in every
 * version it has: Standard, Full Art, Gold (125-152), its Glitch version and
 * its secret illustration where the chase lists name it, and its Prototype
 * run's plate. Numbered as the set numbers them (`cardSet("S0")`). Starter
 * cards are Standard only (owner 2026-11-14), so none is here. */
export interface BoosterRow {
  cardId: string;
  name: string;
  number: string;
  entries: SheetEntry[];
}
export function boosterRows(): BoosterRow[] {
  const set = cardSet("S0");
  return set.packCards.map((sc) => {
    const face = cardFaceOf(sc);
    const e = (finish: string, _reveal: string, collectorNumber: string, source: string, prototype: FaceCard["prototype"] = null): SheetEntry => ({
      card: { face, finish: finish as FaceCard["finish"], reveal: revealKindOf(finish as FaceCard["finish"]), collectorNumber, prototype, hit: finish !== "standard" && finish !== "foil" },
      source,
    });
    const entries: SheetEntry[] = [e("standard", "standard", sc.collectorNumber, "Standard"), e("fullArt", "fullArt", sc.collectorNumber, "Full Art")];
    if (sc.goldNumber) entries.push(e("gold", "gold", sc.goldNumber, `Gold ${sc.goldNumber}`));
    if (set.glitch.includes(sc.cardId)) entries.push(e("glitch", "glitch", sc.collectorNumber, "Glitch"));
    for (const x of set.secrets) if (x.cardId === sc.cardId && x.kind !== "zeroDay") entries.push(e("secret", "secret", x.collectorNumber, `Secret illustration ${x.code}`));
    for (const r of set.prototypes) if (r.cardId === sc.cardId) entries.push(e("prototype", "prototype", sc.collectorNumber, `Prototype ${r.code}, serial 1 of ${r.runSize}`, { runCode: r.code, serial: 1, runSize: r.runSize }));
    return { cardId: sc.cardId, name: sc.name, number: sc.collectorNumber, entries };
  });
}

export function faceHtml(c: FaceCard): string {
  const layer = pure.packFinishLayerName(c.reveal);
  return pure.packFaceHtml(c, { settled: true }, "S0").replace('class="face ', `class="face ${layer ? `fx-css-${layer} ` : ""}`);
}

function entryHtml(e: SheetEntry): string {
  const c = e.card;
  const lab = pure.packFinishLabel(c.finish) || "STANDARD";
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return `<figure class="sc" data-finish="${c.finish}" data-full="${pure.packFullBleed(c.reveal)}" data-modes="${c.face.modes.length}">
  <div class="mini">${faceHtml(c)}</div>
  <figcaption><span class="fin${c.hit ? " hit" : ""}">${lab}</span> ${esc(c.face.name)}<br>${esc(e.source)}</figcaption>
</figure>`;
}

export function renderFaceSheet(showcase: readonly Showcase[]): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Card faces — AI-TCG</title>
<style>${PACK_CSS}
body { padding: 12px 16px 30px; display: block; }
h1 { font-size: 13px; letter-spacing: 0.1em; color: var(--dim); margin: 4px 0 2px; }
h2 { font-size: 12px; letter-spacing: 0.16em; color: var(--dim); text-transform: uppercase; margin: 22px 0 10px; }
.note { font-size: 12px; color: var(--dim); margin: 0 0 8px; max-width: 900px; }
.sheet { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, calc(50vw - 24px)), 1fr)); gap: 18px 14px; }
.sheet.zdrow { grid-template-columns: repeat(auto-fill, minmax(min(300px, calc(100vw - 32px)), 1fr)); }
.sc { margin: 0; }
.bkrow { display: block; margin: 0 0 18px; }
.bkrow h3 { font-size: 12px; color: var(--dim); margin: 0 0 8px; letter-spacing: .04em; }
.bkrow .sheet { grid-template-columns: repeat(auto-fill, minmax(min(190px, calc(50vw - 24px)), 1fr)); }
.sc .mini { position: relative; width: 100%; aspect-ratio: 5 / 7; --cw: 100%; }
.sc .mini .face { border-radius: 8px; }
.sc figcaption { margin-top: 6px; font-size: 11px; color: var(--dim); line-height: 1.35; }
.sc .fin { display: inline-block; font-weight: 800; letter-spacing: 0.08em; font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #1a2342; color: #cfe0ff; }
.sc .fin.hit { background: linear-gradient(110deg, #7a5cff, #ff5cc8); color: #fff; }
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="setsym" viewBox="0 0 16 16"><path d="M8 1 14 4.5v7L8 15 2 11.5v-7z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.3" fill="currentColor"/></symbol></defs></svg>
<h1>AI·TCG // CARD FACES</h1>
<p class="note">Every finish's settled face, drawn by the pack page's own face code. Finishes rarer than Full Art show their art across the whole card. A "choose one" card prints each mode's name and rules text. CSS finish looks (no shaders on a static sheet); placeholder art until the art pass.</p>
<h2>The 3 Zero-Day cards</h2>
<div class="sheet zdrow">${zeroDayEntries().map(entryHtml).join("\n")}</div>
<h2>Season 0's booster cards, 097 to 124, in every version they have</h2>
<p class="note">The only cards packs hold. Each row is one card: Standard, Full Art, Gold (125 to 152), and its Glitch version, secret illustration and Prototype run where the chase lists name it. Starter cards (001 to 096) are Standard only, so they have no row here.</p>
${boosterRows().map((r) => `<section class="bkrow" data-card="${r.cardId}"><h3>${r.number} · ${r.name}</h3><div class="sheet">${r.entries.map(entryHtml).join("\n")}</div></section>`).join("\n")}
<h2>One real pull per finish (the pack showcase)</h2>
<div class="sheet">${showcaseEntries(showcase).map(entryHtml).join("\n")}</div>
<script>${PACK_PAGE_PURE_SOURCE}
packFitWatch(document.body);</script>
</body>
</html>
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, "..", "output", "card-faces.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderFaceSheet(openShowcase()));
  process.stderr.write(`wrote ${out}\n`);
}
