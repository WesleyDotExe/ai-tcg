// The owner website in the browser (Season 0 render item 1, render session
// 44): sign-in, the glass sidebar and top bar, and the pages. Bundled by
// sitePage.ts with esbuild into one inline script; everything it shows
// comes from the owner API (siteApi.ts) or says plainly what it waits on
// (siteModel.ts PAGE_WAITS). No made-up numbers.
//
// What this slice serves for real: signing in and out, the agent card,
// Home's My agent and Deck panels, Settings -> Play (who picks the deck,
// the faction lock, the forced deck, each agent's play style, "rebuild
// now" with its job), Connect agent's list, and the theme.

import { avatarSvg } from "../avatar.js";
import { SiteApiError, siteApi, type SiteFaction, type SitePlay } from "./siteApi.js";
import {
  FACTION_HEX,
  NAV_LOWER,
  NAV_MAIN,
  PAGE_TITLES,
  PAGE_WAITS,
  agentStatus,
  deckLine,
  errorText,
  esc,
  hashOf,
  icon,
  initialOf,
  jobSummary,
  nextTheme,
  pageFromHash,
  rebuildView,
  styleName,
  themeOf,
  type NavItem,
  type PageId,
  type ThemePref,
} from "./siteModel.js";

const api = siteApi((input, init) => fetch(input, init));
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** The session lives for the tab (sessionStorage), so a reload stays
 * signed in and closing the tab signs the browser out of it. The server's
 * expiry still rules: a 401 drops it. */
const SESSION_KEY = "aitcg.site.session";
interface Session {
  token: string;
  login: string;
  expiresAt: string;
}

const state: {
  session: Session | null;
  play: SitePlay | null;
  page: PageId;
  theme: ThemePref;
  busy: boolean;
  poll: number;
} = { session: null, play: null, page: "home", theme: "system", busy: false, poll: 0 };

// The page's test hook (the evidence script reads it).
(window as unknown as { __site: unknown }).__site = {
  state: () => ({ page: state.page, signedIn: !!state.session, theme: state.theme, drawn: document.body.dataset.theme, play: state.play }),
};

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || Date.parse(s.expiresAt) <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}
function saveSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: the session lasts this page load */
  }
}

// ---- theme ------------------------------------------------------------------
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme(): void {
  document.body.dataset.theme = themeOf(state.theme, !!darkQuery?.matches);
  const b = document.getElementById("theme-btn");
  if (b) {
    const drawn = document.body.dataset.theme;
    b.innerHTML = icon(drawn === "dark" ? "moon" : "sun", 19) + (state.theme === "system" ? '<i class="auto-dot" aria-hidden="true"></i>' : "");
    const label = state.theme === "system" ? `Theme: system (${drawn})` : `Theme: ${state.theme}`;
    b.setAttribute("aria-label", label + ". Change theme");
    b.title = label;
  }
  const seg = document.getElementById("theme-seg");
  if (seg) seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === state.theme)));
}
darkQuery?.addEventListener?.("change", applyTheme);

// ---- toasts and dialogs -----------------------------------------------------
let toastTimer = 0;
function toast(text: string, tone: "info" | "error" = "info"): void {
  const t = $("#toast");
  t.textContent = text;
  t.className = `toast on ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.className = "toast"), tone === "error" ? 5200 : 2600);
}
function fail(err: unknown): void {
  if (err instanceof SiteApiError) {
    if (err.signedOut && state.session) {
      signedOut("You've been signed out. Sign in again.");
      return;
    }
    toast(errorText(err.status, err.message), "error");
  } else toast("Something went wrong. Try again.", "error");
}

/** A centred confirmation (2026-10-05 B: "Confirmations open as centred
 * dialogs"). Resolves true on the confirm button. */
function confirmDialog(title: string, body: string, confirm: string): Promise<boolean> {
  return new Promise((resolve) => {
    const d = $("#dialog");
    d.innerHTML = `<div class="dlg glass" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${esc(title)}</h2><p>${esc(body)}</p><div class="row end"><button class="btn" data-a="no">Cancel</button><button class="btn pri" data-a="yes">${esc(confirm)}</button></div></div>`;
    d.className = "dim on";
    const done = (v: boolean) => {
      d.className = "dim";
      d.innerHTML = "";
      document.removeEventListener("keydown", onKey, true);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    d.onclick = (e) => {
      const a = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
      if (a) done(a.dataset.a === "yes");
      else if (e.target === d) done(false);
    };
    (d.querySelector('[data-a="yes"]') as HTMLElement).focus();
  });
}

// ---- sign-in ----------------------------------------------------------------
function showSignIn(message = ""): void {
  $("#shell").hidden = true;
  $("#signin").hidden = false;
  const m = $("#si-msg");
  m.textContent = message;
  m.hidden = !message;
  ($("#si-login") as HTMLInputElement).focus();
}
function signedOut(message: string): void {
  state.session = null;
  state.play = null;
  saveSession(null);
  clearTimeout(state.poll);
  showSignIn(message);
}
async function onSignIn(e: Event): Promise<void> {
  e.preventDefault();
  const login = ($("#si-login") as HTMLInputElement).value.trim();
  const password = ($("#si-pass") as HTMLInputElement).value;
  const btn = $("#si-go") as HTMLButtonElement;
  const m = $("#si-msg");
  if (!login || !password) {
    m.textContent = "Enter your login and password.";
    m.hidden = false;
    return;
  }
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const s = await api.signIn(login, password);
    state.session = { token: s.token, login, expiresAt: s.expiresAt };
    saveSession(state.session);
    ($("#si-pass") as HTMLInputElement).value = "";
    await enter();
  } catch (err) {
    m.textContent = err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong. Try again.";
    m.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
}
async function signOut(): Promise<void> {
  const s = state.session;
  if (!s) return;
  if (!(await confirmDialog("Sign out?", "You'll need your login and password to come back.", "Sign out"))) return;
  try {
    await api.signOut(s.token);
  } catch {
    /* already gone on the server: sign out here anyway */
  }
  signedOut("Signed out.");
}

/** Signed in: load the play settings, then draw the shell. */
async function enter(): Promise<void> {
  if (!state.session) return showSignIn();
  try {
    state.play = await api.play(state.session.token);
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    showSignIn(err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong.");
    return;
  }
  $("#signin").hidden = true;
  $("#shell").hidden = false;
  drawShell();
  route();
  schedulePoll();
}

/** Keeps the agent's status current (a match starting or ending, a rebuild
 * finishing): every 15 s while the tab is visible, every 1.5 s while a
 * rebuild runs. */
function schedulePoll(): void {
  clearTimeout(state.poll);
  if (!state.session) return;
  const running = state.play?.rebuild.job?.state === "running";
  state.poll = window.setTimeout(refresh, running ? 1500 : 15000);
}
async function refresh(): Promise<void> {
  if (!state.session || document.hidden) return schedulePoll();
  try {
    const was = state.play?.rebuild.job;
    state.play = await api.play(state.session.token);
    const now = state.play.rebuild.job;
    if (was?.state === "running" && now && now.jobId === was.jobId && now.state !== "running") {
      toast(now.state === "done" ? "Your agent finished building its deck." : `The rebuild failed: ${now.error ?? "no reason given"}`, now.state === "done" ? "info" : "error");
    }
    drawAgentCard();
    if (!state.busy) drawPage();
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
  }
  schedulePoll();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.session && state.play) void refresh();
});

// ---- the shell --------------------------------------------------------------
function navButton(n: NavItem): string {
  const soon = n.soon ? '<span class="nbadge soon">Soon</span>' : "";
  return `<a class="navb${n.soon ? " is-soon" : ""}" href="${hashOf(n.id)}" data-page="${n.id}"${n.soon ? ' aria-disabled="true" title="Comes after Season 0"' : ""}>${icon(n.icon)}<span>${esc(n.label)}</span>${soon}</a>`;
}
function drawShell(): void {
  $("#nav").innerHTML = NAV_MAIN.map(navButton).join("") + '<hr class="nav-rule">' + NAV_LOWER.map(navButton).join("");
  const s = state.session!;
  const acct = $("#acct-btn");
  acct.textContent = initialOf(s.login);
  acct.setAttribute("aria-label", `Account: ${s.login}`);
  $("#acct-name").textContent = s.login;
  drawAgentCard();
  applyTheme();
}

function avatar(name: string, faction: string | null, size: number): string {
  const c = (faction && FACTION_HEX[faction]) || "#8f8cff";
  return `<span class="av" style="--c:${c};width:${size}px;height:${size}px">${avatarSvg(name)}</span>`;
}
function agentFaction(play: SitePlay): SiteFaction | null {
  return play.factionLock ?? play.rebuild.job?.result?.faction ?? null;
}

function drawAgentCard(): void {
  const p = state.play;
  const card = $("#agent-card");
  if (!p) return;
  const a = p.connectedAgent;
  if (!a) {
    card.innerHTML = `<div class="ac-none">No agent connected</div><a class="btn sm" href="#/connect">Connect agent</a>`;
    return;
  }
  const st = agentStatus(p);
  card.innerHTML = `<div class="ac-top">${avatar(a.name, agentFaction(p), 36)}<div class="ac-name"><b>${esc(a.name)}</b><small>${esc(styleName(p, a.playStyle))}</small></div></div><span class="status ${st.tone}"><i></i>${esc(st.label)}</span>`;
}

function route(): void {
  const page = pageFromHash(location.hash);
  // The Tournament is "Soon": its link doesn't open a page.
  if (NAV_MAIN.find((n) => n.id === page)?.soon) {
    toast("Tournaments come after Season 0.");
    history.replaceState(null, "", hashOf(state.page));
    return;
  }
  state.page = page;
  document.querySelectorAll<HTMLElement>("#nav .navb").forEach((b) => {
    const on = b.dataset.page === page;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#title").textContent = PAGE_TITLES[page];
  document.title = `${PAGE_TITLES[page]} · AI·TCG`;
  drawPage();
  ($("#page") as HTMLElement).scrollTop = 0;
}
window.addEventListener("hashchange", () => {
  if (state.session && state.play) route();
});

// ---- pages ------------------------------------------------------------------
function drawPage(): void {
  const p = state.play;
  if (!p) return;
  const el = $("#page");
  const page = state.page;
  if (page === "home") el.innerHTML = homePage(p);
  else if (page === "settings") el.innerHTML = settingsPage(p);
  else if (page === "connect") el.innerHTML = connectPage(p);
  else el.innerHTML = waitsPage(page);
  applyTheme();
}

function panelHead(ic: Parameters<typeof icon>[0], title: string, grad: string, open?: PageId): string {
  return `<div class="wgh"><span class="wic" style="--g:${grad}">${icon(ic, 12)}</span><span>${esc(title)}</span>${open ? `<a class="wopen" href="${hashOf(open)}" aria-label="Open ${esc(PAGE_TITLES[open])}">${icon("arrow", 14)}</a>` : ""}</div>`;
}

function homePage(p: SitePlay): string {
  const a = p.connectedAgent;
  const st = agentStatus(p);
  const fac = agentFaction(p);
  const my = a
    ? `<div class="mya">${avatar(a.name, fac, 64)}<div><div class="mya-n">${esc(a.name)}${fac ? `<span class="ftag" style="--c:${FACTION_HEX[fac]}">${esc(fac.toUpperCase())}</span>` : ""}</div><div class="muted">${esc(styleName(p, a.playStyle))} play style</div></div></div>
       <div class="row"><span class="status ${st.tone}"><i></i>${esc(st.label)}</span>${p.liveMatch ? `<span class="muted small">since ${esc(timeOf(p.liveMatch.startedAt))}</span>` : ""}</div>`
    : `<p class="muted">No agent is connected.</p><a class="btn pri" href="#/connect">Connect agent</a>`;
  const rv = rebuildView(p);
  const deck = `<div class="big-line">${esc(deckLine(p))}</div>
    <div class="muted small">${p.factionLock ? `Locked to ${esc(p.factionLock)}` : "Any faction"} · ${p.decks.length} saved deck${p.decks.length === 1 ? "" : "s"}</div>
    <div class="rb-note ${rv.kind}">${esc(rv.kind === "wanted" ? `${rv.text} ${rv.reasons[0]}${rv.reasons.length > 1 ? ` (+${rv.reasons.length - 1} more)` : ""}` : rv.text)}</div>
    <a class="btn" href="#/settings">Deck settings</a>`;
  return `<div class="boardbar"><h2>Your board</h2></div>
  <div class="wgrid">
    <section class="wg sz-M hero" style="--c:${(fac && FACTION_HEX[fac]) || "#8f8cff"}">${panelHead("link", "My agent", "linear-gradient(135deg,#6a7bff,#9a5cff)", "connect")}<div class="wgb">${my}</div></section>
    <section class="wg sz-M">${panelHead("col", "Deck", "linear-gradient(135deg,#25b0ff,#3d6bff)", "settings")}<div class="wgb">${deck}</div></section>
  </div>
  <p class="muted small board-note">More of your board (packs, the live match, the ladder) comes as the server serves it. Customising the board comes with it.</p>`;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function seg(id: string, options: [string, string][], value: string, label: string): string {
  return `<div class="seg" id="${id}" role="group" aria-label="${esc(label)}">${options.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(t)}</button>`).join("")}</div>`;
}

function settingsPage(p: SitePlay): string {
  const rv = rebuildView(p);
  const job = p.rebuild.job ? jobSummary(p.rebuild.job) : [];
  const lockOpts: [string, string][] = [["", "Any"], ...p.lockableFactions.map((f) => [f, f] as [string, string])];
  const decks = p.decks.length
    ? p.decks
        .map((d) => {
          const isActive = p.activeDeck?.deckId === d.deckId;
          const agentsOwn = p.agentDeck?.deckId === d.deckId;
          const miss = d.complete ? "" : `<small class="warn-t">Incomplete: ${d.missing.map((m) => `${esc(m.cardId)} ${m.owned}/${m.uses}`).join(", ")}</small>`;
          return `<button type="button" class="deckrow${isActive ? " on" : ""}" data-deck="${esc(d.deckId)}" ${d.complete ? "" : 'aria-disabled="true"'}><span class="radio" aria-hidden="true"></span><span class="dn"><b>${esc(d.name)}</b><small>${d.cards} cards${agentsOwn ? " · built by your agent" : ""}</small>${miss}</span>${isActive ? '<span class="pill on">Playing</span>' : ""}</button>`;
        })
        .join("")
    : '<p class="muted">No saved decks yet.</p>';
  const agents = p.agents
    .map((a) => {
      const connected = p.connectedAgent?.agentId === a.agentId;
      return `<div class="agrow">${avatar(a.name, connected ? agentFaction(p) : null, 32)}<div class="dn"><b>${esc(a.name)}</b><small>${connected ? "Connected" : "Not connected"}</small></div><label class="sel"><span class="vh">Play style for ${esc(a.name)}</span><select data-style-for="${esc(a.agentId)}">${p.playStyles.map((s) => `<option value="${esc(s.id)}"${s.id === a.playStyle ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>`;
    })
    .join("");
  const styleHelp = p.playStyles.map((s) => `<li><b>${esc(s.name)}</b> ${esc(s.summary)}</li>`).join("");
  const running = rv.kind === "running";
  const rebuild = `<div class="rb-note ${rv.kind}" role="status">${running ? '<span class="spin" aria-hidden="true"></span>' : ""}${esc(rv.text)}${
    rv.kind === "wanted" ? `<ul>${rv.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""
  }</div>${job.length ? `<div class="job"><b>Last build</b><ul>${job.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}<button type="button" class="btn pri" id="rebuild"${running || p.deckChoice === "forced" ? " disabled" : ""}>${running ? "Building…" : "Rebuild now"}</button>`;
  return `<div class="pg">
  ${p.liveMatch ? '<div class="banner live"><span class="status live"><i></i>In a match</span> Your agent is playing. Some changes wait until the match ends.</div>' : ""}
  <h3>Play</h3>
  <section class="panel glass">
    <div class="field"><div><b>Who picks the deck</b><small>Your agent builds and picks its own deck, or you choose one of your saved decks.</small></div>${seg("deck-choice", [["agent", "Agent picks"], ["forced", "I choose"]], p.deckChoice, "Who picks the deck")}</div>
    <div class="field"><div><b>Faction lock</b><small>Keep your agent to one faction, or let it play any.</small></div>${seg("faction-lock", lockOpts, p.factionLock ?? "", "Faction lock")}</div>
    <div class="field col"><div><b>Deck now</b><small>${esc(deckLine(p))}</small></div></div>
  </section>
  <h3>Saved decks</h3>
  <section class="panel glass decks"><p class="muted small">Pick one to play it yourself (the choice becomes "I choose").</p>${decks}</section>
  <h3>Your agent's deck</h3>
  <section class="panel glass">${rebuild}</section>
  <h3>Play style</h3>
  <section class="panel glass">${agents || '<p class="muted">No agents yet.</p>'}<details class="styles"><summary>What the play styles mean</summary><ul>${styleHelp}</ul></details></section>
  <h3>Display</h3>
  <section class="panel glass"><div class="field"><div><b>Theme</b><small>System follows your computer's setting.</small></div>${seg("theme-seg", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], state.theme, "Theme")}</div></section>
  </div>`;
}

function connectPage(p: SitePlay): string {
  const rows = p.agents
    .map((a) => {
      const on = p.connectedAgent?.agentId === a.agentId;
      return `<div class="agrow">${avatar(a.name, on ? agentFaction(p) : null, 40)}<div class="dn"><b>${esc(a.name)}</b><small>${esc(styleName(p, a.playStyle))} play style</small></div>${on ? '<span class="pill on">Connected</span>' : '<span class="pill">Not connected</span>'}</div>`;
    })
    .join("");
  return `<div class="pg"><h3>Your agents</h3><section class="panel glass">${rows || '<p class="muted">No agents yet.</p>'}</section>
  ${waitsBox(["connecting and switching agents", "generating a new agent"], "Switching which agent plays, and generating a new one with its signature card, open here once the server serves them. One agent plays at a time.")}</div>`;
}

function waitsBox(needs: string[], will: string): string {
  return `<section class="panel glass waits"><b>Coming to this page</b><p>${esc(will)}</p><p class="muted small">Waiting on the server for: ${needs.map(esc).join(", ")}.</p></section>`;
}
function waitsPage(page: PageId): string {
  const w = PAGE_WAITS[page];
  if (!w) return "";
  const n = [...NAV_MAIN, ...NAV_LOWER].find((x) => x.id === page)!;
  return `<div class="pg"><div class="waits-hero glass"><span class="wic big" style="--g:linear-gradient(135deg,#6a7bff,#9a5cff)">${icon(n.icon, 26)}</span><h2>${esc(PAGE_TITLES[page])}</h2><p>${esc(w.will)}</p><p class="muted small">Waiting on the server for: ${w.needs.map(esc).join(", ")}.</p><a class="btn" href="#/">Back to Home</a></div></div>`;
}

// ---- actions ----------------------------------------------------------------
async function act(fn: (token: string) => Promise<SitePlay>, ok?: string): Promise<void> {
  if (!state.session || state.busy) return;
  state.busy = true;
  document.body.classList.add("busy");
  try {
    state.play = await fn(state.session.token);
    if (ok) toast(ok);
  } catch (err) {
    fail(err);
  } finally {
    state.busy = false;
    document.body.classList.remove("busy");
    drawAgentCard();
    drawPage();
  }
}

async function onRebuild(): Promise<void> {
  const p = state.play;
  if (!p || !state.session) return;
  if (rebuildView(p).kind === "current" && p.agentDeck && !(await confirmDialog("Rebuild anyway?", "Your agent's deck is up to date. A rebuild plays a few minutes of games to build it again.", "Rebuild"))) return;
  try {
    const job = await api.rebuild(state.session.token);
    state.play = { ...p, rebuild: { ...p.rebuild, job } };
    toast("Your agent started building its deck.");
  } catch (err) {
    fail(err);
  }
  drawPage();
  schedulePoll();
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const segBtn = t.closest(".seg button") as HTMLElement | null;
  if (segBtn) {
    const group = segBtn.parentElement!.id;
    const v = segBtn.dataset.v ?? "";
    if (segBtn.getAttribute("aria-pressed") === "true") return;
    if (group === "deck-choice") void act((tok) => api.setDeckChoice(tok, v as "agent" | "forced"));
    else if (group === "faction-lock")
      void act(async (tok) => {
        const r = await api.setFactionLock(tok, (v || null) as SiteFaction | null);
        // Matches start only with an active deck of the locked faction.
        if (r.activeDeckFits === false) toast(`The deck that plays now isn't ${v}. Matches wait until a ${v} deck plays: rebuild your agent's deck, or pick a ${v} deck.`, "error");
        return r;
      });
    else if (group === "theme-seg") {
      state.theme = v as ThemePref;
      applyTheme();
    }
    return;
  }
  const deck = t.closest(".deckrow") as HTMLElement | null;
  if (deck) {
    if (deck.getAttribute("aria-disabled") === "true") return toast("That deck is incomplete: you don't hold every card it uses.", "error");
    if (deck.classList.contains("on") && state.play?.deckChoice === "forced") return;
    void act((tok) => api.setActiveDeck(tok, deck.dataset.deck!), "Your agent will play that deck.");
    return;
  }
  if (t.closest("#rebuild")) return void onRebuild();
  if (t.closest("#theme-btn")) {
    state.theme = nextTheme(state.theme);
    applyTheme();
    return;
  }
  const acctBtn = t.closest("#acct-btn");
  const menu = $("#acct-menu");
  if (acctBtn) {
    menu.hidden = !menu.hidden;
    acctBtn.setAttribute("aria-expanded", String(!menu.hidden));
    return;
  }
  if (t.closest("#sign-out")) {
    menu.hidden = true;
    return void signOut();
  }
  if (!t.closest("#acct-menu")) menu.hidden = true;
});
document.addEventListener("change", (e) => {
  const sel = (e.target as HTMLElement).closest("select[data-style-for]") as HTMLSelectElement | null;
  if (sel) void act((tok) => api.setPlayStyle(tok, sel.dataset.styleFor!, sel.value), "Play style saved.");
});

// ---- start --------------------------------------------------------------------
$("#si-form").addEventListener("submit", (e) => void onSignIn(e));
applyTheme();
state.session = loadSession();
if (state.session) void enter();
else showSignIn();
