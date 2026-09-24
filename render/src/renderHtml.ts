import type { MatchReplay } from "./types.js";

/** Builds the self-contained HTML replay page (RENDER.md's suggested first
 * slice): a single file, no external network dependency (no CDN fonts/JS —
 * this has to keep working when opened offline straight from the repo), that
 * plays a captured match back turn by turn. All data is embedded as JSON;
 * all interactivity is one inline <script>, vanilla DOM, no framework —
 * matching the project's own zero-dependency instinct (see agents/'s own
 * package.json comment) for something this self-contained. */
export function renderMatchHtml(replay: MatchReplay): string {
  const dataJson = JSON.stringify(replay).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(replay.title)} — AI-TCG replay</title>
<style>${CSS}</style>
</head>
<body>
<div class="crt-overlay" aria-hidden="true"></div>
<header class="matchbar">
  <div class="brand">AI·TCG // SPECTATOR REPLAY</div>
  <div class="matchup" id="matchup"></div>
  <div class="seed">seed ${replay.seed}</div>
</header>

<main id="app">
  <section class="hud-row">
    <div class="hud" id="hud-p1"></div>
    <div class="momentum" id="momentum"></div>
    <div class="hud" id="hud-p2"></div>
  </section>

  <section class="turnbar" id="turnbar"></section>

  <section class="board-area">
    <div class="board-row" id="board-p2"></div>
    <div class="stackzone" id="stackzone"></div>
    <div class="board-row" id="board-p1"></div>
  </section>

  <section class="lower">
    <div class="hand" id="hand-p1"></div>
    <div class="eventlog" id="eventlog"></div>
    <div class="hand" id="hand-p2"></div>
  </section>

  <section class="controls">
    <button id="btn-first" title="First move">|&lt;</button>
    <button id="btn-prev" title="Previous move">&lt;</button>
    <button id="btn-play" title="Play / pause">&#9654;</button>
    <button id="btn-next" title="Next move">&gt;</button>
    <button id="btn-last" title="Last move">&gt;|</button>
    <input type="range" id="scrubber" min="0" value="0" step="1">
    <span id="framecount" class="framecount"></span>
    <label class="speedlabel">speed
      <select id="speed">
        <option value="1400">slow</option>
        <option value="700" selected>normal</option>
        <option value="250">fast</option>
      </select>
    </label>
  </section>
</main>

<script type="application/json" id="match-data">${dataJson}</script>
<script>${JS}</script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const CSS = `
:root {
  --bg: #070912;
  --panel: #0d1220;
  --panel-2: #121a2e;
  --ink: #d7e6ff;
  --ink-dim: #8ea3c9;
  --line: #24314f;
  --good: #35e6a0;
  --bad: #ff4d6d;
  --neutral: #ffcf5c;
  --cortex: #35c9ff;
  --aegis: #9fd8d0;
  --swarm: #8bff5c;
  --null: #d565ff;
  font-size: 15px;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: var(--bg); color: var(--ink);
  font-family: "Courier New", "Consolas", ui-monospace, monospace;
  min-height: 100vh;
}
.crt-overlay {
  position: fixed; inset: 0; pointer-events: none; z-index: 50; mix-blend-mode: overlay;
  background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 2px, transparent 3px);
}
.matchbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 18px; background: linear-gradient(180deg, #0b0f1c, #090c16);
  border-bottom: 1px solid var(--line);
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem;
}
.brand { color: var(--ink-dim); }
.matchup { font-weight: bold; letter-spacing: 0.12em; }
.matchup .vs { color: var(--ink-dim); margin: 0 0.5em; }
.seed { color: var(--ink-dim); font-size: 0.75rem; }
#app { max-width: 1180px; margin: 0 auto; padding: 14px 12px 24px; }

.hud-row { display: grid; grid-template-columns: 1fr 220px 1fr; gap: 10px; align-items: stretch; margin-bottom: 8px; }
.hud { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; }
.hud .name { font-weight: bold; letter-spacing: 0.05em; display: flex; justify-content: space-between; }
.hud .faction-tag { font-size: 0.7rem; padding: 1px 6px; border-radius: 3px; border: 1px solid currentColor; }
.bar-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 0.78rem; }
.bar-track { flex: 1; height: 9px; background: #050810; border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.bar-fill { height: 100%; }
.bar-fill.health { background: linear-gradient(90deg, #ff4d6d, #ff8a5c); }
.bar-fill.energy { background: linear-gradient(90deg, #35c9ff, #7de3ff); }
.hud .meta { display: flex; gap: 10px; margin-top: 6px; font-size: 0.72rem; color: var(--ink-dim); }

.momentum { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.momentum .label { font-size: 0.62rem; color: var(--ink-dim); letter-spacing: 0.1em; margin-bottom: 5px; }
.momentum .gauge { width: 100%; height: 10px; background: #050810; border: 1px solid var(--line); border-radius: 5px; position: relative; overflow: hidden; }
.momentum .gauge .mid { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--line); }
.momentum .gauge .fill { position: absolute; top: 0; bottom: 0; background: var(--neutral); }
.momentum .why { font-size: 0.66rem; color: var(--ink-dim); margin-top: 6px; min-height: 2.4em; }

.turnbar { text-align: center; padding: 6px; font-size: 0.8rem; letter-spacing: 0.08em; color: var(--ink-dim); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 10px; }
.turnbar b { color: var(--ink); }
.turnbar .win { color: var(--neutral); font-weight: bold; }

.board-area { position: relative; }
.board-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; padding: 8px 0; min-height: 168px; }
.stackzone { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; min-height: 22px; margin: 2px 0; }
.stackitem { font-size: 0.68rem; background: var(--panel-2); border: 1px dashed var(--neutral); color: var(--neutral); padding: 2px 8px; border-radius: 3px; }

.slot { width: 118px; height: 158px; border-radius: 6px; position: relative; flex-shrink: 0; }
.slot.empty { border: 1px dashed var(--line); background: repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 6px, transparent 6px 12px); }

.card { width: 118px; height: 158px; border-radius: 6px; position: relative; overflow: hidden;
  border: 1px solid var(--line); display: flex; flex-direction: column; color: #0a0e18; }
.card .art { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; padding: 4px; }
.card .art .glyph { font-size: 1.6rem; opacity: 0.85; }
.card .head { display: flex; justify-content: space-between; align-items: center; padding: 2px 4px; font-size: 0.6rem; background: rgba(0,0,0,0.28); }
.card .cost { background: rgba(0,0,0,0.55); color: #fff; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; }
.card .name { font-size: 0.62rem; font-weight: bold; line-height: 1.05; padding: 2px 5px; background: rgba(0,0,0,0.35); color: #fff; }
.card .stats { display: flex; justify-content: space-between; padding: 3px 5px; font-size: 0.72rem; font-weight: bold; background: rgba(0,0,0,0.42); color: #fff; }
.card .stats .atk::before { content: "\\2694 "; }
.card .stats .hp::before { content: "\\2665 "; }
.card .tags { position: absolute; top: 2px; left: 2px; display: flex; flex-direction: column; gap: 2px; z-index: 2; }
.card .tag { font-size: 0.52rem; padding: 1px 3px; border-radius: 2px; background: rgba(0,0,0,0.55); color: #fff; letter-spacing: 0.03em; }
.card.pending { filter: grayscale(0.55) brightness(0.75); }
.card.pending::after { content: "ARMING"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; letter-spacing: 0.15em; color: var(--neutral); background: repeating-linear-gradient(45deg, rgba(0,0,0,0.55) 0 6px, rgba(0,0,0,0.7) 6px 12px); z-index: 1; }
.card .arm-count { position: absolute; bottom: 2px; right: 2px; font-size: 0.55rem; color: var(--neutral); background: rgba(0,0,0,0.6); padding: 1px 4px; border-radius: 3px; z-index: 2; }
.card .tools { flex-shrink: 0; display: flex; gap: 2px; flex-wrap: wrap; padding: 1px 4px 2px; background: rgba(0,0,0,0.32); }
.card .tool-chip { font-size: 0.5rem; background: rgba(0,0,0,0.6); color: #fff; padding: 1px 3px; border-radius: 2px; }

.rarity-Common { box-shadow: none; }
.rarity-Uncommon { box-shadow: 0 0 0 1px rgba(255,255,255,0.25) inset; }
.rarity-Rare { box-shadow: 0 0 8px 1px var(--rc), 0 0 0 1px var(--rc) inset; }
.rarity-Mythic { box-shadow: 0 0 14px 3px var(--rc), 0 0 0 1px var(--rc) inset; animation: pulse 2.2s ease-in-out infinite; }
@keyframes pulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.18); } }

.faction-Cortex { --fc: var(--cortex); --rc: #35c9ff; }
.faction-Aegis { --fc: var(--aegis); --rc: #b9f3ea; }
.faction-Swarm { --fc: var(--swarm); --rc: #b6ff8f; }
.faction-Null { --fc: var(--null); --rc: #e79bff; }
.card.faction-Cortex, .card.faction-Aegis, .card.faction-Swarm, .card.faction-Null { background: var(--fc); }

.lower { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 10px; margin-top: 12px; }
.hand { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; min-height: 90px; }
.hand .minicard { font-size: 0.62rem; padding: 3px 6px; border-radius: 3px; border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); }
.hand .minicard b { color: var(--fc, var(--ink)); }
.hand-label { width: 100%; font-size: 0.6rem; color: var(--ink-dim); letter-spacing: 0.1em; margin-bottom: 2px; }

.eventlog { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font-size: 0.72rem; max-height: 220px; overflow-y: auto; }
.eventlog .turn-hdr { color: var(--neutral); margin-top: 6px; }
.eventlog .ev { color: var(--ink-dim); white-space: pre-wrap; }
.eventlog .ev.now { color: var(--ink); }
.eventlog .ev.gameover { color: var(--good); font-weight: bold; }

.controls { display: flex; align-items: center; gap: 8px; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
.controls button { background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 5px 10px; cursor: pointer; font-family: inherit; }
.controls button:hover { border-color: var(--cortex); }
.controls #scrubber { width: 320px; }
.framecount { font-size: 0.75rem; color: var(--ink-dim); min-width: 90px; }
.speedlabel { font-size: 0.72rem; color: var(--ink-dim); display: flex; gap: 4px; align-items: center; }
.speedlabel select { background: var(--panel-2); color: var(--ink); border: 1px solid var(--line); }
`;

const JS = `
(function () {
  const replay = JSON.parse(document.getElementById('match-data').textContent);
  const frames = replay.frames;
  let i = 0;
  let playing = false;
  let timer = null;

  document.getElementById('matchup').innerHTML =
    '<span class="faction-' + replay.factions.p1 + '" style="color:var(--fc)">' + escapeHtml(replay.agentNames.p1) + ' [' + replay.factions.p1 + ']</span>' +
    '<span class="vs">vs</span>' +
    '<span class="faction-' + replay.factions.p2 + '" style="color:var(--fc)">' + escapeHtml(replay.agentNames.p2) + ' [' + replay.factions.p2 + ']</span>';

  const scrubber = document.getElementById('scrubber');
  scrubber.max = String(frames.length - 1);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function glyphFor(type) {
    return { Unit: '\\u25C8', Command: '\\u2699', Directive: '\\u25A3', Tool: '\\u2692' }[type] || '\\u25C8';
  }

  function cardArtStyle(faction, visualSeed, visualPattern) {
    const hue = (visualSeed % 40) - 20;
    const patterns = [
      'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 4px, transparent 4px 9px)',
      'repeating-linear-gradient(-45deg, rgba(0,0,0,0.14) 0 3px, transparent 3px 8px)',
      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22) 0 2px, transparent 2px 14px)',
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0 2px, transparent 2px 10px), repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0 2px, transparent 2px 10px)',
    ];
    return 'filter: hue-rotate(' + hue + 'deg); background-image: ' + patterns[visualPattern % patterns.length] + ';';
  }

  function renderCardEl(c, opts) {
    opts = opts || {};
    const rarity = c.rarity || 'Common';
    const div = document.createElement('div');
    div.className = 'card faction-' + c.faction + ' rarity-' + rarity + (opts.pending ? ' pending' : '');
    div.title = c.name + ' — ' + c.flavor;
    const tags = [];
    if (opts.isEvolved) tags.push('EVOLVED');
    if (opts.keywords) opts.keywords.forEach(function (k) { tags.push(k.toUpperCase()); });
    div.innerHTML =
      '<div class="head"><span>' + rarity[0] + '</span><span class="cost">' + c.cost + '</span></div>' +
      '<div class="art" style="' + cardArtStyle(c.faction, c.visualSeed, c.visualPattern) + '"><span class="glyph">' + glyphFor(c.type) + '</span></div>' +
      '<div class="name">' + escapeHtml(c.name) + '</div>' +
      (opts.tools && opts.tools.length ? '<div class="tools">' + opts.tools.map(function (t) { return '<span class="tool-chip">' + escapeHtml(t.name) + '</span>'; }).join('') + '</div>' : '') +
      (opts.stats ? '<div class="stats"><span class="atk">' + opts.stats.attack + '</span><span class="hp">' + opts.stats.health + '</span></div>' : '') +
      (tags.length ? '<div class="tags">' + tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' : '') +
      (opts.armTurn !== undefined ? '<div class="arm-count">T' + opts.armTurn + '</div>' : '');
    return div;
  }

  function renderUnitSlot(u) {
    return renderCardEl(
      { name: u.name, faction: u.faction, rarity: u.rarity, cost: 0, type: 'Unit', flavor: u.flavor, visualSeed: u.visualSeed, visualPattern: u.visualPattern },
      { stats: { attack: u.attack, health: u.health }, pending: u.pending, armTurn: u.pending ? u.armTurn : undefined, isEvolved: u.isEvolved, keywords: u.keywords, tools: u.tools },
    );
  }

  function renderDirectiveSlot(d) {
    return renderCardEl({ name: d.name, faction: d.faction, rarity: d.rarity, cost: 0, type: 'Directive', flavor: d.flavor, visualSeed: d.visualSeed, visualPattern: d.visualPattern }, {});
  }

  function renderBoard(elId, snapshot) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const occupants = snapshot.board.map(function (u) { return { kind: 'unit', v: u }; })
      .concat(snapshot.directives.map(function (d) { return { kind: 'dir', v: d }; }));
    for (let s = 0; s < snapshot.slotsMax; s++) {
      const occ = occupants[s];
      if (!occ) {
        const empty = document.createElement('div');
        empty.className = 'slot empty';
        el.appendChild(empty);
        continue;
      }
      const cardEl = occ.kind === 'unit' ? renderUnitSlot(occ.v) : renderDirectiveSlot(occ.v);
      el.appendChild(cardEl);
    }
  }

  function renderHud(elId, snapshot) {
    const el = document.getElementById(elId);
    const hpPct = Math.max(0, Math.min(100, (snapshot.health / snapshot.maxHealth) * 100));
    const enPct = snapshot.maxEnergy ? Math.max(0, Math.min(100, (snapshot.energy / snapshot.maxEnergy) * 100)) : 0;
    el.className = 'hud faction-' + snapshot.faction;
    el.innerHTML =
      '<div class="name"><span>' + escapeHtml(snapshot.name) + '</span><span class="faction-tag" style="color:var(--fc)">' + snapshot.faction + '</span></div>' +
      '<div class="bar-row"><span>HP</span><div class="bar-track"><div class="bar-fill health" style="width:' + hpPct + '%"></div></div><span>' + snapshot.health + '/' + snapshot.maxHealth + '</span></div>' +
      '<div class="bar-row"><span>EN</span><div class="bar-track"><div class="bar-fill energy" style="width:' + enPct + '%"></div></div><span>' + snapshot.energy + '/' + snapshot.maxEnergy + '</span></div>' +
      '<div class="meta"><span>hand ' + snapshot.hand.length + '</span><span>deck ' + snapshot.deckSize + '</span><span>grave ' + snapshot.graveyardSize + '</span><span>slots ' + snapshot.slotsUsed + '/' + snapshot.slotsMax + '</span></div>';
  }

  function renderHand(elId, snapshot, label) {
    const el = document.getElementById(elId);
    el.innerHTML = '<div class="hand-label">' + label + '</div>';
    snapshot.hand.forEach(function (c) {
      const chip = document.createElement('div');
      chip.className = 'minicard faction-' + c.faction;
      chip.innerHTML = '<b>' + c.cost + '</b> ' + escapeHtml(c.name);
      el.appendChild(chip);
    });
  }

  function renderMomentum(m) {
    const el = document.getElementById('momentum');
    const pct = (m.score + 100) / 2;
    const color = m.leader === 'even' ? 'var(--neutral)' : 'var(--' + replay.factions[m.leader].toLowerCase() + ')';
    let fillLeft, fillWidth;
    if (m.score >= 0) { fillLeft = 50; fillWidth = pct - 50; } else { fillLeft = pct; fillWidth = 50 - pct; }
    el.innerHTML =
      '<div class="label">MOMENTUM</div>' +
      '<div class="gauge"><div class="mid"></div><div class="fill" style="left:' + fillLeft + '%;width:' + fillWidth + '%;background:' + color + '"></div></div>' +
      '<div class="why">' + (m.leader === 'even' ? 'EVEN' : (m.leader.toUpperCase() + ' AHEAD')) + '<br>' + escapeHtml(m.reasons.join(' \\u00b7 ')) + '</div>';
  }

  function renderStack(stack) {
    const el = document.getElementById('stackzone');
    el.innerHTML = '';
    stack.slice().reverse().forEach(function (item, idx) {
      const div = document.createElement('div');
      div.className = 'stackitem';
      div.textContent = (idx === 0 ? '\\u25B2 TOP: ' : '') + item.controller + ': ' + item.description;
      el.appendChild(div);
    });
  }

  function renderTurnbar(frame) {
    const el = document.getElementById('turnbar');
    let text = 'TURN ' + frame.turnNumber + ' (of up to ' + replay.turnCap + ')  \\u2014  active: <b>' + frame.activePlayer.toUpperCase() + '</b>  \\u2014  priority: <b>' + frame.priority.toUpperCase() + '</b>';
    if (frame.winner) {
      text += '  \\u2014  <span class="win">GAME OVER: ' + (frame.winner === 'draw' ? 'DRAW' : frame.winner.toUpperCase() + ' WINS') + '</span>';
    }
    el.innerHTML = text;
  }

  function renderEventLog(upTo) {
    const el = document.getElementById('eventlog');
    el.innerHTML = '';
    let lastTurn = null;
    for (let f = 0; f <= upTo; f++) {
      const frame = frames[f];
      frame.newEvents.forEach(function (e) {
        if (e.event.type === 'turnStart' && e.event.turn !== lastTurn) {
          lastTurn = e.event.turn;
        }
        const line = document.createElement('div');
        line.className = 'ev' + (f === upTo ? ' now' : '') + (e.event.type === 'gameOver' ? ' gameover' : '');
        line.textContent = e.text;
        el.appendChild(line);
      });
    }
    el.scrollTop = el.scrollHeight;
  }

  function renderFrame() {
    const frame = frames[i];
    renderHud('hud-p1', frame.players.p1);
    renderHud('hud-p2', frame.players.p2);
    renderMomentum(frame.momentum);
    renderTurnbar(frame);
    renderBoard('board-p2', frame.players.p2);
    renderBoard('board-p1', frame.players.p1);
    renderStack(frame.stack);
    renderHand('hand-p1', frame.players.p1, 'P1 HAND');
    renderHand('hand-p2', frame.players.p2, 'P2 HAND');
    renderEventLog(i);
    scrubber.value = String(i);
    document.getElementById('framecount').textContent = 'move ' + i + ' / ' + (frames.length - 1);
  }

  function goTo(n) {
    i = Math.max(0, Math.min(frames.length - 1, n));
    renderFrame();
    if (i === frames.length - 1) stop();
  }

  function stop() { playing = false; clearInterval(timer); document.getElementById('btn-play').textContent = '\\u25B6'; }
  function play() {
    if (i >= frames.length - 1) i = 0;
    playing = true;
    document.getElementById('btn-play').textContent = '\\u23F8';
    const speed = Number(document.getElementById('speed').value);
    clearInterval(timer);
    timer = setInterval(function () {
      if (i >= frames.length - 1) { stop(); return; }
      goTo(i + 1);
    }, speed);
  }

  document.getElementById('btn-first').onclick = function () { stop(); goTo(0); };
  document.getElementById('btn-prev').onclick = function () { stop(); goTo(i - 1); };
  document.getElementById('btn-next').onclick = function () { stop(); goTo(i + 1); };
  document.getElementById('btn-last').onclick = function () { stop(); goTo(frames.length - 1); };
  document.getElementById('btn-play').onclick = function () { playing ? stop() : play(); };
  scrubber.oninput = function () { stop(); goTo(Number(scrubber.value)); };
  document.getElementById('speed').onchange = function () { if (playing) { stop(); play(); } };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { stop(); goTo(i + 1); }
    if (e.key === 'ArrowLeft') { stop(); goTo(i - 1); }
    if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
  });

  renderFrame();
})();
`;
