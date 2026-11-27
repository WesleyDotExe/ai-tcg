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

import { agentState, type HomeData, type OwnerData } from "./homeFacts.js";
import { STATE_UNITS, from, statesSheet, type StateCase } from "./statesSheet.js";

type Allowance = NonNullable<OwnerData["play"]["autoPlay"]["allowance"]>;
const allowance = (state: Allowance["state"], minutesLeft: number, totalMinutes = 30, endsAtReset = false): Allowance => ({
  state,
  label: { waiting: "Waiting for the next round", running: "Running", finishing: "Finishing match", done: "Time's up" }[state],
  totalMinutes,
  minutesLeft,
  endsAtReset,
});

export type AgentStateCase = StateCase;

/** The states, each from a real owner's answer (deep-copied, then the
 * auto-play fields changed as the API documents). */
export function agentStateCases(data: HomeData): AgentStateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
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
    // Render session 90 (owner 2026-11-27, note 6): the play styles as
    // choices, one under the pointer and one pressed, so the check measures
    // those two states' look and contrast as it does the rest.
    { id: "choosing", name: "Choosing a play style: Tempo under the pointer, Fortress pressed", data: nova, pose: (h) => h.replace('class="choice" href="#/agent" data-go="agent" data-style="tempo"', 'class="choice hov" href="#/agent" data-go="agent" data-style="tempo"').replace('class="choice" href="#/agent" data-go="agent" data-style="fortress"', 'class="choice prs" href="#/agent" data-go="agent" data-style="fortress"') },
  ];
}

export { STATE_UNITS };

export function agentStatesPage(data: HomeData): string {
  return statesSheet({ tile: "agent", title: "My agent", session: 90, cases: agentStateCases(data), note: (c) => { const st = agentState(c.data); return `${st.label} · ${st.action}`; } });
}
