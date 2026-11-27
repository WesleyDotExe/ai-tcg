// The My agent tile (render session 88, phase 2 "the tiles in groups"): one
// glass tile like the rest (owner 2026-11-27), its state read from the owner
// API's auto-play answer in the API's own shape (server/OWNER_API.md, "The
// play-time allowance"), each size's copy written for its box.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gridTileHtml } from "../src/homePage.js";
import { agentState, factsIn, nextAction, styleTag, tileById, type HomeData } from "../src/homeFacts.js";
import { agentStateCases, agentStatesPage } from "../src/agentStates.js";
import { TILES, type Size } from "../src/homeSpec.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const cases = agentStateCases(data);
const byId = Object.fromEntries(cases.map((c) => [c.id, c.data]));
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;");

describe("My agent's state", () => {
  it("reads every auto-play state the API serves, with one button that matches", () => {
    const got = Object.fromEntries(cases.map((c) => { const s = agentState(c.data); return [c.id, `${s.label} / ${s.action}`]; }));
    expect(got).toEqual({
      playing: "Playing now / Stop",
      new: "Ready, not playing yet / Start",
      waiting: "Waiting for a round / Stop",
      running: "Playing now / Stop",
      "running-reset": "Ready / Stop",
      finishing: "Finishing match / Stop",
      timeup: "Time's up / Start",
      maxed: "Done for today / Start",
      stopped: "Stopped / Start",
      picked: "Playing now / Stop",
      "long-name": "Ready, not playing yet / Start",
      "no-agent": "No agent / Connect an agent",
      choosing: "Playing now / Stop",
    });
  });
  it("a running allowance shows its minutes left (the old code read a field the API never serves and said No time limit)", () => {
    const run = byId.running!;
    expect(text(gridTileHtml("agent", "M", run))).toContain("12 min left");
    expect(text(gridTileHtml("agent", "L", run))).toContain("12 min left of 30");
    expect(text(gridTileHtml("agent", "L", run))).not.toContain("No limit");
    expect(gridTileHtml("agent", "M", run)).toContain("+15 min");
  });
  it("offers +15 min only when the API says time can be added", () => {
    expect(gridTileHtml("agent", "L", byId["running-reset"]!)).not.toContain("+15 min");
    expect(text(gridTileHtml("agent", "L", byId["running-reset"]!))).toContain("to midnight");
    expect(gridTileHtml("agent", "L", byId.timeup!)).not.toContain("+15 min");
    expect(gridTileHtml("agent", "L", byId.playing!)).not.toContain("+15 min");
  });
  it("the pill, the footer's button and the next action agree at every size", () => {
    for (const c of cases) for (const s of SIZES) {
      const html = gridTileHtml("agent", s, c.data);
      const st = agentState(c.data);
      expect(html).toContain(`>${esc(st.label)}</span>`);
      expect(html).toMatch(new RegExp(`<footer>.*>${st.action}</button>`));
      expect(nextAction(tileById("agent"), s, c.data).label).toBe(st.action);
    }
  });
  it("shows exactly the spec's facts at each size, in every state", () => {
    const spec = TILES.find((t) => t.id === "agent")!;
    for (const c of cases) for (const s of SIZES) expect(factsIn(gridTileHtml("agent", s, c.data)).sort()).toEqual([...spec.sizes[s]].sort());
  });
});

describe("My agent's copy for each box", () => {
  it("S gives the pill alone; M the short reason; L the full sentence", () => {
    const w = data.owners.wren!;
    const st = agentState(w);
    expect(gridTileHtml("agent", "S", w)).not.toContain('class="sub why"');
    expect(text(gridTileHtml("agent", "M", w))).toContain(st.short);
    expect(text(gridTileHtml("agent", "L", w))).toContain(st.why);
    for (const c of cases) expect(agentState(c.data).short.length).toBeLessThanOrEqual(45);
  });
  it("L draws the six play styles as choices, explained in one line each, the agent's own marked current", () => {
    const html = gridTileHtml("agent", "L", byId.picked!);
    expect(html).toContain('<span class="lab">Play style</span><span class="subt">personality</span>');
    expect(text(html)).toContain("It changes how your agent plays, from its next match.");
    for (const p of data.owners.nova!.play.playStyles) {
      expect(html).toContain(`<b>${p.name}</b><i class="cur">Current</i></span><span class="ct">${styleTag(p)}</span>`);
      // Each a link to My agent carrying its style (the page confirms it).
      expect(html).toMatch(new RegExp(`<a class="choice( on)?" href="#/agent" data-go="agent" data-style="${p.id}"`));
    }
    expect((html.match(/class="choice on"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<a class="choice on"[^>]*data-style="rusher"[^>]*aria-current="true">/);
    for (const p of data.owners.nova!.play.playStyles) expect(styleTag(p).length).toBeLessThanOrEqual(30);
  });
  it("S names the current style; M names it with Change (owner 2026-11-27, note 6)", () => {
    for (const c of cases.filter((x) => x.id !== "no-agent")) {
      const name = c.data.play.playStyles.find((p) => p.id === c.data.play.connectedAgent!.playStyle)!.name;
      expect(text(gridTileHtml("agent", "S", c.data))).toContain(`Play style ${name}`);
      expect(text(gridTileHtml("agent", "M", c.data))).toContain(`Play style ${name} Change`);
    }
    expect(gridTileHtml("agent", "M", byId.playing!)).toMatch(/data-fact="personality".*<a class="chg" href="#\/agent" data-go="agent" data-style=""/);
  });
  it("with no agent, no style is marked current and the line says to connect one first", () => {
    const html = gridTileHtml("agent", "L", byId["no-agent"]!);
    expect(html).not.toContain('class="choice on"');
    expect(text(html)).toContain("Connect an agent, then choose how it plays.");
    expect(text(gridTileHtml("agent", "S", byId["no-agent"]!))).toContain("Play style None yet");
  });
  it("the sheet poses one choice under the pointer and one pressed", () => {
    const sheet = agentStatesPage(data);
    expect(sheet).toContain('class="choice hov" href="#/agent" data-go="agent" data-style="tempo"');
    expect(sheet).toContain('class="choice prs" href="#/agent" data-go="agent" data-style="fortress"');
  });
  it("an unknown personality falls back to its summary's first clause", () => {
    expect(styleTag({ id: "new-one", summary: "Plays slow and careful, then strikes." })).toBe("Plays slow and careful");
  });
  it("a picked deck says so and offers Change; the agent's own offers Pick one", () => {
    expect(text(gridTileHtml("agent", "L", byId.picked!))).toMatch(/Redline Swarm, tuned · Swarm · 40 cards · your pick/);
    expect(gridTileHtml("agent", "L", byId.picked!)).toMatch(/data-fact="deck".*>Change</);
    expect(gridTileHtml("agent", "L", byId.playing!)).toMatch(/data-fact="deck".*>Pick one</);
  });
  it("long names take the smaller size", () => {
    expect(gridTileHtml("agent", "S", byId["long-name"]!)).toContain('class="big long"');
    expect(gridTileHtml("agent", "S", byId.playing!)).not.toContain('class="big long"');
  });
});

describe("the states sheet", () => {
  it("draws every state at S, M and L on each of the grid's three units, none of them the hero panel", () => {
    const html = agentStatesPage(data);
    expect((html.match(/<article /g) ?? []).length).toBe(cases.length * 3 * 3);
    expect(html).not.toMatch(/class="tile [^"]*\bhero\b/);
    expect(html).not.toMatch(/<article style="[^"]*"[^>]* style=/);
  });
});
