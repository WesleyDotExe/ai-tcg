// The Collection page as HTML (render session 48). Pure: it takes the
// model's answers (siteCollection.ts) and a face renderer, and answers
// strings. In the browser the face renderer is the pack page's own
// packFaceHtml (window.SITE_FACE, siteFaces.ts); the tests pass the same
// function, built from the same source.

import { amount } from "./siteLook.js";
import type { SeasonFrozen } from "./siteSeason.js";
import { FACTION_HEX, esc } from "./siteModel.js";
import { FINISH_NAMES, type SiteCollection } from "./siteBoard.js";
import {
  COLLECTION_TABS,
  FACTION_FILTERS,
  SHOW_FILTERS,
  binderBlocks,
  collectionSummary,
  copiesByCard,
  copiesOfSlot,
  copyLines,
  craftView,
  faceOfSlot,
  salvageView,
  slotCaption,
  type BinderBlock,
  type BinderSlot,
  type CollectionFilters,
  type FaceInput,
  type SiteBinder,
  type SiteHoldings,
} from "./siteCollection.js";

/** Draws a face: the pack page's packFaceHtml with the finish's lasting
 * look as its CSS stand-in (the card-face sheet's way). */
export type FaceRenderer = (c: FaceInput, setCode: string) => string;

export interface FaceFns {
  packFaceHtml(c: FaceInput, opts: { settled: boolean }, setCode: string): string;
  packFinishLayerName(reveal: string): string;
}
export function faceRenderer(f: FaceFns): FaceRenderer {
  return (c, setCode) => {
    const layer = f.packFinishLayerName(c.reveal);
    return f.packFaceHtml(c, { settled: true }, setCode).replace('class="face ', `class="face ${layer ? `fx-css-${layer} ` : ""}`);
  };
}

function pills(act: string, options: readonly { id: string; label: string }[], value: string, label: string): string {
  return `<div class="seg" role="group" aria-label="${esc(label)}">${options.map((o) => `<button type="button" data-act="${act}" data-v="${esc(o.id)}" aria-pressed="${o.id === value}">${esc(o.label)}</button>`).join("")}</div>`;
}

function slotHtml(s: BinderSlot, face: FaceRenderer, setCode: string): string {
  const fin = s.finish && s.finish !== "standard" ? FINISH_NAMES[s.finish] : "";
  const label = s.owned
    ? `${s.name}, ${s.number}, ${s.rarity}${fin ? `, ${fin}` : ""}: you hold ${s.owned}`
    : `${s.name}, ${s.number}, ${s.rarity}: missing`;
  const hex = FACTION_HEX[s.faction] ?? FACTION_HEX.Neutral!;
  if (!s.owned) {
    const run = s.run ? `<small>Run of ${s.run.size} · ${s.run.found} found</small>` : `<small class="bm-n">${esc(s.name)}</small>`;
    return `<button type="button" class="bslot miss" data-act="view-slot" data-slot="${esc(s.key)}" data-faction="${esc(s.faction)}" aria-label="${esc(label)}" style="--c:${hex}"><span class="bmiss"><b>${esc(s.number)}</b>${run}<i class="r-${esc(s.rarity)}" aria-hidden="true"></i></span></button>`;
  }
  const count = s.owned > 1 ? `<span class="bcount">×${s.owned}</span>` : "";
  const chip = fin ? `<span class="bfin">${esc(fin)}</span>` : "";
  return `<button type="button" class="bslot held" data-act="view-slot" data-slot="${esc(s.key)}" data-faction="${esc(s.faction)}" aria-label="${esc(label)}"><span class="cface">${face(faceOfSlot(s), setCode)}</span>${count}${chip}</button>`;
}

function blockHtml(b: BinderBlock, face: FaceRenderer, setCode: string): string {
  const pct = b.total ? Math.floor((b.held / b.total) * 100) : 0;
  const body = b.slots.length ? `<div class="binder">${b.slots.map((s) => slotHtml(s, face, setCode)).join("")}</div>` : '<p class="muted small bempty">Nothing here with these filters.</p>';
  return `<section class="col-block" data-block="${b.id}"><div class="bh"><h3>${esc(b.title)}</h3><span class="bheld"><b>${b.held}</b> / ${b.total}</span><span class="bbar" role="img" aria-label="${pct}% held"><i style="width:${pct}%"></i></span></div><p class="muted small">${esc(b.note)}</p>${body}</section>`;
}

/** The whole page: the summary, the set and tab bar, the filters, the blocks. */
export function collectionPageHtml(b: SiteBinder, c: SiteCollection, f: CollectionFilters, packPoints: number, face: FaceRenderer): string {
  const sum = collectionSummary(b, c);
  const lines = sum.lines.map((l) => `<span><b>${l.held}</b>/${l.total} ${esc(l.label)}</span>`).join("");
  const summary = `<section class="panel glass col-sum"><div class="ring big" style="--p:${sum.pct}" role="img" aria-label="${sum.pct}% of the set"><b>${sum.pct}%</b></div><div class="wcol"><h3>Your collection</h3><p><b>${sum.held} / ${sum.total}</b> <span class="muted">${esc(sum.setCode)} cards</span></p><p class="cs-lines muted small">${lines}</p><p class="muted small">${amount(sum.copies)} copies of ${amount(sum.distinct)} different cards · <b>${amount(packPoints)}</b> pack points for crafting</p></div></section>`;
  const sets = c.sets.length ? c.sets : [{ setCode: b.setCode }];
  const setPills = `<div class="col-sets" role="group" aria-label="Set">${sets.map((s) => `<span class="pill${s.setCode === b.setCode ? " on" : ""}">${esc(s.setCode)} · ${esc(seasonOf(s.setCode))}</span>`).join("")}<span class="pill off" title="The next set comes with the next season">Next set · coming</span></div>`;
  const tabs = pills("col-tab", COLLECTION_TABS, f.tab, "Collection section");
  const filters =
    f.tab === "promos"
      ? ""
      : `<div class="col-filters">${pills("col-faction", FACTION_FILTERS.map((x) => ({ id: x, label: x })), f.faction, "Faction")}${pills("col-show", SHOW_FILTERS, f.show, "Show")}</div>`;
  const body =
    f.tab === "promos"
      ? `<section class="panel glass waits"><b>Promos</b><p>Your agents' signature cards and the promos you earn (a first win with each faction, 100 wins, a 10-win streak, the season finale) are kept here.</p><p class="muted small">Waiting on the server for: the signature cards and earned promos in the collection.</p></section>`
      : binderBlocks(b, c, f).map((x) => blockHtml(x, face, b.setCode)).join("");
  return `<div class="pg-wide col-pg">${summary}<div class="col-bar">${setPills}${tabs}</div>${filters}${body}</div>`;
}

function seasonOf(setCode: string): string {
  const m = /^S(\d+)$/.exec(setCode);
  return m ? `Season ${m[1]}` : setCode;
}

/** The card viewer's state the page keeps. */
export interface ViewerState {
  key: string;
  holdings: SiteHoldings | null;
  holdingsError: string | null;
  quantity: number;
  busy: boolean;
}

/** The card viewer: the card (tilts under the pointer), and beside it what
 * you hold, the decks that use it, craft and salvage. */
export function viewerHtml(s: BinderSlot, b: SiteBinder, c: SiteCollection, v: ViewerState, packPoints: number, nav: { prev: string | null; next: string | null }, face: FaceRenderer, frozen: SeasonFrozen | null = null): string {
  const copies = copiesOfSlot(s, copiesByCard(c));
  const allOfCard = copiesByCard(c).get(s.cardId) ?? [];
  const lines = copyLines(copies);
  const held = lines.length
    ? `<ul class="cv-copies">${lines.map((l) => `<li><b>${esc(l.finish)}</b>${l.serial ? ` · serial ${esc(l.serial)}` : ""}<span class="muted"> · ${esc(l.origin || "Held")}</span>${l.bound ? ' <span class="tag bound" title="Plays, but never sells or salvages">Account-bound</span>' : ""}</li>`).join("")}</ul>`
    : `<p class="muted">Not in your collection yet.</p>`;
  const h = v.holdings;
  const decks = h && h.decks.length
    ? `<p class="muted small">In your saved decks: ${h.decks.map((d) => `${esc(d.name)} uses ${d.uses}${d.active ? " (playing)" : ""}`).join("; ")}.</p>`
    : "";
  // Craft.
  const cv = craftView(s, { cardCopies: allOfCard.length }, packPoints);
  // Render session 73: once the season has ended the collection is its
  // archive: the price still shows, the button is off, the reason under it.
  const craft = frozen && cv.cost !== null
    ? `<div class="cv-act closed"><button type="button" class="btn" id="craft-btn" data-act="craft" disabled>Craft · ${amount(cv.cost)} pp</button><small class="muted cv-craft-why">${esc(frozen.collection)}</small></div>`
    : cv.cost === null
    ? `<p class="muted small cv-craft-why">${esc(cv.why)}</p>`
    : `<div class="cv-act"><button type="button" class="btn pri" id="craft-btn" data-act="craft"${cv.can && !v.busy ? "" : " disabled"}>Craft · ${amount(cv.cost)} pp</button><small class="muted cv-craft-why">${esc(cv.why)}</small></div>`;
  // Salvage: base slots only (per card; takes unbound standard pack copies).
  let salvage = "";
  if (s.section === "base") {
    if (frozen) salvage = `<p class="muted small cv-closed">${esc(frozen.collection)}</p>`;
    else if (!h) salvage = `<p class="muted small">${v.holdingsError ? `Couldn't read what can be salvaged: ${esc(v.holdingsError)}` : "Reading what can be salvaged…"}</p>`;
    else {
      const sv = salvageView(h, v.quantity);
      const why = sv.why.length ? `<ul class="muted small cv-why">${sv.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : "";
      salvage = sv.max
        ? `<div class="cv-act"><div class="stepper" role="group" aria-label="How many to salvage"><button type="button" class="btn sm" id="salv-minus" data-act="salv-step" data-d="-1"${sv.quantity <= 1 ? " disabled" : ""} aria-label="One fewer">−</button><output id="salv-n" aria-live="polite">${sv.quantity}</output><button type="button" class="btn sm" id="salv-plus" data-act="salv-step" data-d="1"${sv.quantity >= sv.max ? " disabled" : ""} aria-label="One more">+</button></div><button type="button" class="btn warn" id="salvage-btn" data-act="salvage"${v.busy ? " disabled" : ""}>Salvage ${sv.quantity} · +${amount(sv.packPoints)} pp</button></div><small class="muted">${sv.max} of ${h.owned} can be salvaged, ${sv.each} pack points each.</small>${why}`
        : `<p class="muted small">Nothing to salvage: only extra standard copies from packs can go.</p>${why}`;
    }
  }
  const navBtns = `<button type="button" class="btn sm" id="cv-prev" data-act="view-slot" data-slot="${esc(nav.prev ?? "")}"${nav.prev ? "" : " disabled"} aria-label="Previous card">‹</button><button type="button" class="btn sm" id="cv-next" data-act="view-slot" data-slot="${esc(nav.next ?? "")}"${nav.next ? "" : " disabled"} aria-label="Next card">›</button>`;
  return `<div class="cv" data-slot="${esc(s.key)}">
  <div class="cv-stage"><div class="cv-card${s.owned ? "" : " missing"}" id="cv-card"><span class="cface">${face(faceOfSlot(s), b.setCode)}</span></div><small class="muted cv-hint">Move the pointer over the card to tilt it.</small></div>
  <div class="cv-info">
    <h2 id="dlg-t">${esc(s.name)}</h2>
    <p class="muted">${esc(slotCaption(s, b.base.total, b.setCode))}</p>
    <h4>You hold ${copies.length}</h4>${held}${decks}
    <h4>Craft</h4>${craft}
    ${s.section === "base" ? `<h4>Salvage</h4>${salvage}` : ""}
    <div class="row cv-foot">${navBtns}<span class="sp"></span><button type="button" class="btn" id="cv-close" data-act="close-viewer">Close</button></div>
  </div>
</div>`;
}
