// The My agent tile in every state the owner API can put it in (render
// session 88, phase 2 "the tiles in groups": the agent tile). The snapshot
// the Home page draws (season1/mockup/data/home-data.json) holds two owners,
// Nova (playing, no time limit) and Wren (just signed up), so most of the
// auto-play states (server/OWNER_API.md: the play-time allowance waiting,
// running, finishing and done; today's rewards maxed; stopped; no agent; a
// deck the owner picked) never reach the page. This sheet draws each one at
// S, M and L, on the three units the grid uses at 1280, 1440 and 1024 px, so
// the browser check can measure that each fits its box and spills nothing.
//
// Each state is the snapshot's real answer with only the auto-play fields
// the API documents changed, in the API's own shape.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { esc } from "../../src/site/siteModel.js";
import type { Size } from "./homeSpec.js";
import { agentState, homeArt, type HomeData, type OwnerData } from "./homeFacts.js";
import { bCss } from "./homeMockupB.js";
import { GRID } from "./homeGrid.js";
import { GRID_CSS, gridTileHtml } from "./homePage.js";

type Allowance = NonNullable<OwnerData["play"]["autoPlay"]["allowance"]>;
const allowance = (state: Allowance["state"], minutesLeft: number, totalMinutes = 30, endsAtReset = false): Allowance => ({
  state,
  label: { waiting: "Waiting for the next round", running: "Running", finishing: "Finishing match", done: "Time's up" }[state],
  totalMinutes,
  minutesLeft,
  endsAtReset,
});

export interface AgentStateCase { id: string; name: string; data: OwnerData }

/** The states, each from a real owner's answer (deep-copied, then the
 * auto-play fields changed as the API documents). */
export function agentStateCases(data: HomeData): AgentStateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  const from = (base: OwnerData, f: (d: OwnerData) => void): OwnerData => {
    const d = JSON.parse(JSON.stringify(base)) as OwnerData;
    f(d);
    return d;
  };
  const ap = (d: OwnerData) => d.play.autoPlay;
  return [
    { id: "playing", name: "Playing, no time limit (Nova, as served)", data: nova },
    { id: "new", name: "Just signed up (Wren, as served)", data: wren },
    { id: "waiting", name: "Started with 30 min, waiting for a round", data: from(nova, (d) => { d.play.liveMatch = null; ap(d).allowance = allowance("waiting", 30); ap(d).canAddTime = true; }) },
    { id: "running", name: "30 min allowance, 12 left, in a match", data: from(nova, (d) => { ap(d).allowance = allowance("running", 12); ap(d).canAddTime = true; }) },
    { id: "running-reset", name: "60 min cut at midnight: 8 left, nothing more today", data: from(nova, (d) => { d.play.liveMatch = null; ap(d).allowance = allowance("running", 8, 60, true); ap(d).canAddTime = false; }) },
    { id: "finishing", name: "Time's up mid-match: finishing", data: from(nova, (d) => { ap(d).allowance = allowance("finishing", 0); ap(d).canAddTime = true; }) },
    { id: "timeup", name: "Time's up, no match left", data: from(nova, (d) => { d.play.liveMatch = null; ap(d).on = false; ap(d).stopped = { reason: "timeUp" }; ap(d).allowance = allowance("done", 0); ap(d).canAddTime = false; }) },
    { id: "maxed", name: "Today's rewards all earned", data: from(nova, (d) => { d.play.liveMatch = null; ap(d).on = false; ap(d).dailyRewardsMaxed = true; ap(d).stopped = { reason: "dailyRewardsMaxed" }; }) },
    { id: "stopped", name: "Stopped by the owner, has played before", data: from(nova, (d) => { d.play.liveMatch = null; ap(d).on = false; }) },
    { id: "picked", name: "Plays a deck the owner picked, Rusher", data: from(nova, (d) => { d.play.deckChoice = "forced"; d.play.activeDeck = { name: "Redline Swarm, tuned", faction: "Swarm", cards: 40 }; d.play.connectedAgent = { ...d.play.connectedAgent!, playStyle: "rusher" }; }) },
    { id: "long-name", name: "A long agent name (24 characters)", data: from(wren, (d) => { d.play.connectedAgent = { ...d.play.connectedAgent!, name: "Quantum Lattice Overseer" }; }) },
    { id: "no-agent", name: "No agent connected", data: from(wren, (d) => { d.play.connectedAgent = null; }) },
  ];
}

/** The unit (px) the grid gives at each screen the check measures. */
export const STATE_UNITS = [
  { screen: 1280, unit: 191 },
  { screen: 1440, unit: 218 },
  { screen: 1024, unit: 231 },
] as const;

const SIZES: Size[] = ["S", "M", "L"];

export function agentStatesPage(data: HomeData): string {
  const art = homeArt();
  const cases = agentStateCases(data);
  const sections = STATE_UNITS.map(({ screen, unit }) =>
    `<h2>Unit ${unit}px (the grid at ${screen} px wide)</h2>` +
    cases.map((c) => {
      const st = agentState(c.data);
      // S at column 1, M at 2-3, L at 4-5 (rows 1-2): the grid's own shapes.
      const place: Record<Size, string> = { S: "1 / 1 / 2 / 2", M: "1 / 2 / 2 / 4", L: "1 / 4 / 3 / 6" };
      return `<section class="case" data-case="${c.id}" data-unit="${unit}"><h3>${esc(c.name)} <small>${esc(st.label)} · ${esc(st.action)}</small></h3>` +
        `<div class="ugrid" style="--cols:5;--unit:${unit}px;--g:${GRID.gap}px">` +
        SIZES.map((s) => gridTileHtml("agent", s, c.data).replace(`style="--c:`, `style="grid-area:${place[s]};--c:`)).join("") +
        `</div></section>`;
    }).join("")).join("");
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>My agent states</title>
<style>
${bCss(art)}
${GRID_CSS}
main { max-width: none; }
h2 { font: 800 18px system-ui, sans-serif; margin: 28px 0 6px; }
.case { margin: 10px 0 22px; }
.case h3 { font: 700 13px system-ui, sans-serif; margin: 0 0 6px; } .case h3 small { color: var(--muted); font-weight: 600; }
</style></head><body>
<main id="main"><div class="top"><div><span class="kick">// prototype sheet</span><h1>My agent, every state</h1></div></div>
<p class="sub">Season 1 Home, render session 88. Each row is one state the owner API can serve, drawn at S, M and L on the grid's unit. Not a page of the site.</p>
${sections}</main>
${art.defs}
<script>${art.script}</script>
</body></html>`;
}
