// The Match Boot sheet (render session 35, slice 1 evidence): all nine
// sayings, over all four factions and a mirror match, on a desktop-width
// board, a phone-width board for the two longest sayings, and the
// reduced-motion still. It runs the replay page's own sources verbatim
// (CANVAS_FX for the colours, SOUND, MUSIC, the dot font, MATCH_BOOT), so
// what it shows is what a replay plays; a replay shows its seed's saying.
// Usage: npm run boot-sheet -w @ai-tcg/render  -> render/output/match-boot-sheet.html
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANVAS_FX_PURE_SOURCE, CANVAS_FX_RUNTIME_SOURCE, fxAtlasDataUris } from "./canvasFx.js";
import { SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "./soundFx.js";
import { MUSIC_PURE_SOURCE, MUSIC_RUNTIME_SOURCE } from "./musicFx.js";
import { BOAST_CSS, BOAST_PURE_SOURCE } from "./boastFx.js";
import { BOOT_RARE, BOOT_SAYINGS, MATCH_BOOT_CSS, MATCH_BOOT_PURE_SOURCE, MATCH_BOOT_RUNTIME_SOURCE } from "./matchBootFx.js";
import { CSS } from "./renderHtml.js";

/** One scene: the saying, who sits on top (seat 2) and below (seat 1), the layout. */
export interface BootScene {
  key: string;
  title: string;
  saying: string;
  top: { name: string; faction: string; cards: number };
  bot: { name: string; faction: string; cards: number };
  phone?: boolean;
  reduced?: boolean;
}

export function bootScenes(): BootScene[] {
  // Each faction on top and below at least twice; a mirror match.
  const PAIRS: [string, string][] = [["Swarm", "Cortex"], ["Aegis", "Null"], ["Cortex", "Aegis"], ["Null", "Swarm"], ["Aegis", "Aegis"], ["Cortex", "Null"], ["Swarm", "Aegis"], ["Null", "Cortex"], ["Aegis", "Swarm"]];
  const NAMES = ["Brood Signal", "Bastion Relay", "Hollow Index", "Prism Daemon", "Coiljackal's Croupier", "Velvet Static", "Quiet Lattice", "Spore Relay"];
  const sayings = [...BOOT_SAYINGS, BOOT_RARE];
  const scenes: BootScene[] = sayings.map((saying, k) => {
    const [tf, bf] = PAIRS[k]!;
    return {
      key: `say-${k + 1}`, title: `${saying}${saying === BOOT_RARE ? " (the rare one, 1 match in 100)" : ""}: ${tf} above, ${bf} below${tf === bf ? " (mirror match)" : ""}`,
      saying, top: { name: NAMES[k % NAMES.length]!, faction: tf, cards: 0 }, bot: { name: NAMES[(k + 3) % NAMES.length]!, faction: bf, cards: 0 },
    };
  });
  scenes.push(
    { key: "phone-link", title: "LINK ESTABLISHED on a phone: the saying breaks onto two lines", saying: "LINK ESTABLISHED", top: { name: "Coiljackal's Croupier", faction: "Null", cards: 0 }, bot: { name: "Bastion Relay", faction: "Aegis", cards: 0 }, phone: true },
    { key: "phone-run", title: "> RUN MATCH.EXE on a phone", saying: "> RUN MATCH.EXE", top: { name: "Brood Signal", faction: "Swarm", cards: 0 }, bot: { name: "Prism Daemon", faction: "Cortex", cards: 0 }, phone: true },
    { key: "reduced", title: "Reduced motion: the still, about 1 s", saying: "OVERCLOCK", top: { name: "Hollow Index", faction: "Null", cards: 0 }, bot: { name: "Velvet Static", faction: "Cortex", cards: 0 }, reduced: true },
  );
  return scenes;
}

function sideHtml(key: string, half: "top" | "bot", faction: string): string {
  // Move 0: an empty board, six empty slots a side (as a replay starts).
  const slots = Array.from({ length: 6 }, () => `<div class="slot empty"></div>`).join("");
  return `<div class="side" id="${key}-${half}"><div class="board-row faction-${faction}">${slots}</div></div>`;
}

function sceneHtml(s: BootScene): string {
  const hud = (w: BootScene["top"]) => `<div class="hud faction-${w.faction}"><div class="name"><span style="color:var(--fc)">${w.name}</span><span class="faction-tag">${w.faction}</span></div><div class="meta">HP 30 / 30</div></div>`;
  return `<section class="scene${s.phone ? " phone" : ""}" id="${s.key}" data-saying="${s.saying}" data-top="${s.top.name}" data-topf="${s.top.faction}" data-bot="${s.bot.name}" data-botf="${s.bot.faction}"${s.reduced ? ' data-reduced="1"' : ""}>
<h2>${s.title.replace(/>/g, "&gt;")} <button class="go" data-scene="${s.key}">Play</button></h2>
<div class="scene-body"><div class="huds">${hud(s.bot)}${hud(s.top)}</div><div class="board-area" id="${s.key}-area">${sideHtml(s.key, "top", s.top.faction)}<div class="midline"></div>${sideHtml(s.key, "bot", s.bot.faction)}</div><div class="turnbar" id="${s.key}-result"></div></div>
</section>`;
}

export function renderBootSheet(): string {
  const scenes = bootScenes();
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Match Boot — AI-TCG render</title>
<style>${CSS}
${BOAST_CSS}
${MATCH_BOOT_CSS}
body { padding: 12px 16px; }
h1 { font-size: 0.95rem; letter-spacing: 0.1em; color: var(--ink-dim); font-weight: normal; margin: 4px 0 2px; }
h2 { font-size: 0.8rem; letter-spacing: 0.08em; color: var(--ink); font-weight: normal; margin: 18px 0 6px; display: flex; gap: 10px; align-items: center; }
.note { font-size: 0.72rem; color: var(--ink-dim); margin: 0 0 8px; max-width: 980px; }
.ctl { margin: 8px 0; font-size: 0.75rem; color: var(--ink-dim); }
.ctl button, h2 button { background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 3px 9px; cursor: pointer; font-family: inherit; }
.scene { position: relative; z-index: 1; width: 860px; max-width: 100%; }
.scene.phone { width: 380px; }
.scene-body { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: rgba(8,10,18,0.6); }
.huds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 6px; }
.scene.phone .huds { grid-template-columns: 1fr; }
.midline { height: 14px; }
.scene.phone .board-row { zoom: 0.72; max-width: 420px; margin: 0 auto; }
.scene .turnbar { margin-top: 6px; min-height: 1.4em; }
</style>
</head>
<body>
<h1>AI·TCG // MATCH BOOT (render slice 1: the intro at the start of every match)</h1>
<p class="note">Match Boot plays when a match or a replay starts from its first move, about 2.6 s, free and standard for every match (the Cosmetics switch doesn't touch it). Its grammar is symmetric and centre-out: both halves of the board power on together like CRTs, each in its own faction's colour (a mirror match: both the same); each half types its agent's line at the same time and speed, <code>LOADING AGENT: &lt;name&gt; [&lt;FACTION&gt;]</code>, padded so both finish together; <code>HANDSHAKE OK</code> types once on the centre line in neutral white-chrome, with a chirp; the centre line flashes and the saying slams in across it in the dot font, with a hit and a rising chord, while both agent lines lift away from the centre and fade; the saying swells and fades, the screens go and the first board shows. Every sound sits on the centre, so neither side is favoured. The saying comes from the match's seed (list 1, frozen): one of eight, equally likely, or <code>&gt; SUDO FIGHT</code> for 1 match in 100. A tap, Escape or Skip ends it and the first move starts at once. Reduced motion shows everything lit and still for about 1 s. Each scene here forces its saying; a replay always shows its own seed's.</p>
<div class="ctl"><span data-audio-ctl><button id="snd">Sound on</button> <input type="range" id="sndvol" min="0" max="100" value="80" aria-label="Effects volume"> <button id="mus">Music on</button> <input type="range" id="musvol" min="0" max="100" value="60" aria-label="Music volume"> <span id="musmeter"></span></span>
 <button id="all">Play all in turn</button> <span id="st"></span></div>
${scenes.map(sceneHtml).join("\n")}
<script type="application/json" id="fx-atlases">${JSON.stringify(fxAtlasDataUris())}</script>
<script>
(function () {
${CANVAS_FX_PURE_SOURCE}
${CANVAS_FX_RUNTIME_SOURCE}
${SOUND_FX_PURE_SOURCE}
${SOUND_FX_RUNTIME_SOURCE}
${MUSIC_PURE_SOURCE}
${MUSIC_RUNTIME_SOURCE}
${BOAST_PURE_SOURCE}
${MATCH_BOOT_PURE_SOURCE}
${MATCH_BOOT_RUNTIME_SOURCE}
  window.__boot = BOOT; // read by the browser check (progress/render/evidence/boot-check-s35.mjs)
  SND.mount(document.getElementById('snd'), document.getElementById('sndvol'));
  MUS.mount(document.getElementById('mus'), document.getElementById('musvol'), document.getElementById('musmeter'));
  var st = document.getElementById('st');
  function playScene(key, done) {
    var sc = document.getElementById(key), res = document.getElementById(key + '-result');
    res.innerHTML = '';
    var plan = BOOT.play({ top: document.getElementById(key + '-top'), bot: document.getElementById(key + '-bot'), area: document.getElementById(key + '-area') }, {
      who: { top: { name: sc.getAttribute('data-top'), faction: sc.getAttribute('data-topf') }, bot: { name: sc.getAttribute('data-bot'), faction: sc.getAttribute('data-botf') } },
      saying: sc.getAttribute('data-saying'), seed: 1, reduced: sc.hasAttribute('data-reduced') ? true : undefined,
      onEnd: function (reason) {
        res.textContent = 'MOVE 1 STARTS (' + reason + ' at ' + (BOOT.stats().last || {}).t + ' ms)';
        if (done) setTimeout(done, 700);
      }
    });
    var s = BOOT.stats();
    st.textContent = key + ': ' + (plan ? 'playing' + (s.still ? ' (still)' : '') : 'could not lay out') + (s.problem ? ' — grammar problem: ' + s.problem : '');
    return plan;
  }
  window.playBootScene = playScene;
  document.querySelectorAll('button.go').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); setTimeout(function () { playScene(b.getAttribute('data-scene')); }, 0); });
  });
  document.getElementById('all').addEventListener('click', function () {
    var keys = Array.prototype.map.call(document.querySelectorAll('.scene'), function (s) { return s.id; });
    (function next(k) { if (k < keys.length) { document.getElementById(keys[k]).scrollIntoView({ block: 'center' }); setTimeout(function () { playScene(keys[k], function () { next(k + 1); }); }, 350); } })(0);
  });
})();
</script>
</body>
</html>
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, "../output/match-boot-sheet.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderBootSheet(), "utf8");
  console.log(`Wrote ${out}`);
}
