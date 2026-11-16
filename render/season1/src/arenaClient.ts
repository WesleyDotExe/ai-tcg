// Season 1 arena prototype: the browser half (owner 2026-11-14, a head start
// on the Season 1 arena spec's build-order step 1, the new layout). Bundled by
// arenaPage.ts with esbuild into one inline script, three.js included: the page
// loads nothing from outside (the project's no-outside-services rule).
//
// What it draws, from a real recorded match (a Season 0 MatchReplay):
// - a true-3D round arena (a raised disc with a glowing rim, the playmat circle),
//   each side's units in a row, its directives behind them, its signature zone on
//   its right and its draw pile and discard on its left, with the pile counts;
// - cards facing their owner, as on a real table; a card turns to face the
//   viewer while it is played or attacks, then settles back;
// - the far side's hand held up in the scene behind their side, backs to the
//   viewer (a count and a back only: the page never gets those faces);
// - the near side's hand fanned at the bottom edge;
// - hover (or tap) any face-up card to read it full size and upright;
// - the far side's HUD above the board and the near side's below, with a
//   68 px profile picture;
// - a right panel with Play-by-play and Chat tabs (Chat: coming soon);
// - "Watch as" swaps the seats: the camera moves to the other side.
// Placeholder art throughout. Not the Season 0 site; nothing links here.
import * as THREE from "three";
import {
  SEATS, otherSeat, seatSign, restYaw, viewerYaw, sceneAt, hudAt, motionsBetween, beatFrames, beatMs,
  deckPlace, discardPlace, sigPlace, heldPlace, slotPlace, footprint, ARENA_RADIUS, CARD_W, CARD_H, DISCARD_SCALE, ROW_Z,
  DIRECTIVE_Z, DIRECTIVE_SCALE,
  artRings, type Seat, type CardFace, type SceneModel, type TableCard, type Loadout, type Motion,
} from "./arenaModel.js";
import type { MatchReplay, Frame } from "../../src/types.js";
import type { FeedEntry, FeedPart } from "../../src/feed.js";

export interface CardBack { itemId: string | null; name: string }
export interface ArenaData {
  replay: MatchReplay;
  /** cardId -> its abilities' rules text (the engine's Ability.text). */
  cardText: Record<string, string[]>;
  loadouts: Record<Seat, Loadout>;
  backs: Record<Seat, CardBack>;
  /** "full" (full screen), "tile" (the Home tile's size: no panel, silent). */
  mode: "full" | "tile";
  pov: Seat;
}

const FACTION_COLOR: Record<string, string> = {
  Cortex: "#35c9ff", Aegis: "#ff7d24", Swarm: "#8bff5c", Null: "#d565ff", Neutral: "#fff0c2",
};
const RARITY_COLOR: Record<string, string> = { Common: "#8e9bb8", Uncommon: "#cfe0ff", Rare: "#59a8ff", Mythic: "#ffcf5c" };
const colorOf = (f: string) => FACTION_COLOR[f] ?? FACTION_COLOR.Neutral!;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// ---------------------------------------------------------------------------
// boot

const data: ArenaData = JSON.parse(document.getElementById("s1data")!.textContent!);
const R = data.replay;
const frames = R.frames;
const beats = beatFrames(frames);
let beat = 0;
let pov: Seat = data.pov;
const params = new URLSearchParams(location.search);
const mode: "full" | "tile" = params.get("mode") === "tile" ? "tile" : params.get("mode") === "full" ? "full" : data.mode;
let playing = mode === "tile";
let speed = 1;
if (params.get("pov") === "p2") pov = "p2";
if (params.get("play") === "1") playing = true;
const $ = (id: string) => document.getElementById(id)!;
const frameAt = (b: number) => frames[beats[b]!]!;

// ---------------------------------------------------------------------------
// card faces and backs (canvas textures; placeholder art)

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number, maxLines: number): number {
  const words = text.split(/\s+/);
  let line = "", n = 0;
  for (const word of words) {
    const t = line ? line + " " + word : word;
    if (g.measureText(t).width > w && line) {
      if (n === maxLines - 1) { g.fillText(line + "…", x, y + n * lh); return n + 1; }
      g.fillText(line, x, y + n * lh); n++; line = word;
    } else line = t;
  }
  if (line) { g.fillText(line, x, y + n * lh); n++; }
  return n;
}

function faceCanvas(f: CardFace): HTMLCanvasElement {
  const W = 256, H = 358;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const c = colorOf(f.faction), rc = RARITY_COLOR[f.rarity] ?? "#8e9bb8";
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#1c2340"); bg.addColorStop(0.7, "#0b0f22"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // generative art window: faction tint, rings seeded by the card id
  const ax = 18, ay = 48, aw = W - 36, ah = 140;
  const ag = g.createRadialGradient(W / 2, ay + ah * 0.55, 4, W / 2, ay + ah * 0.55, 110); ag.addColorStop(0, "#ffffff"); ag.addColorStop(0.1, c); ag.addColorStop(1, "#0d1230");
  g.fillStyle = ag; g.fillRect(ax, ay, aw, ah);
  g.save(); g.beginPath(); g.rect(ax, ay, aw, ah); g.clip();
  g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 2;
  for (const ring of artRings(f.cardId)) { g.beginPath(); g.arc(W / 2 + ring.dx, ay + ah * 0.55, ring.r, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  // frame: faction colour, rarity inner line
  g.strokeStyle = c; g.lineWidth = 9; g.strokeRect(4.5, 4.5, W - 9, H - 9);
  g.strokeStyle = rc; g.lineWidth = 2; g.strokeRect(12, 12, W - 24, H - 24);
  // name + cost
  g.fillStyle = "#eef3ff"; g.font = "bold 21px 'Segoe UI', system-ui, sans-serif"; g.textBaseline = "alphabetic";
  let nm = f.name; while (g.measureText(nm).width > W - 76 && nm.length > 4) nm = nm.slice(0, -2);
  g.fillText(nm === f.name ? nm : nm + "…", 20, 38);
  g.fillStyle = "#ffb000"; g.beginPath(); g.arc(W - 32, 30, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#121212"; g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.fillText(String(f.cost), W - 32, 38); g.textAlign = "left";
  // type line
  g.fillStyle = rc; g.font = "bold 13px sans-serif";
  g.fillText(`${f.signature ? "SIGNATURE · " : ""}${f.type.toUpperCase()} · ${f.rarity.toUpperCase()}`, 20, ay + ah + 20);
  // keywords + state (short)
  g.fillStyle = "#b8c4e6"; g.font = "15px sans-serif";
  const words = [...f.keywords, ...f.state.filter((s) => !s.startsWith("Played"))].join(" · ");
  if (words) wrap(g, words, 20, ay + ah + 42, W - 40, 18, 2);
  if (f.attack !== undefined && f.health !== undefined) {
    const up = (v: number, p?: number) => (p === undefined || v === p ? "#121212" : v > p ? "#0b5d2c" : "#7a0f1f");
    g.fillStyle = "#ffb000"; g.beginPath(); g.arc(38, H - 38, 25, 0, Math.PI * 2); g.fill();
    const hurt = f.maxHealth !== undefined && f.health < f.maxHealth;
    g.fillStyle = hurt ? "#ff4d6d" : "#35e6a0"; g.beginPath(); g.arc(W - 38, H - 38, 25, 0, Math.PI * 2); g.fill();
    g.font = "bold 28px sans-serif"; g.textAlign = "center";
    g.fillStyle = up(f.attack, f.printedAttack); g.fillText(String(f.attack), 38, H - 28);
    g.fillStyle = hurt ? "#ffffff" : up(f.health, f.printedHealth); g.fillText(String(f.health), W - 38, H - 28);
    g.textAlign = "left";
  }
  if (f.keywords.includes("Guard")) { g.setLineDash([12, 8]); g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(17, 17, W - 34, H - 34); g.setLineDash([]); }
  return cv;
}

function backCanvas(seat: Seat): HTMLCanvasElement {
  const W = 256, H = 358;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const c = colorOf(R.factions[seat]);
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#151a36"); bg.addColorStop(1, "#05060d"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // The standard back (no Season 0 card back item exists): a lattice of
  // chevrons, its rim in the side's faction colour. An equipped back would
  // draw here instead (the cardBack slot's code-drawn spec, then its art).
  g.strokeStyle = c; g.globalAlpha = 0.28; g.lineWidth = 3;
  for (let y = -20; y < H + 20; y += 26) { g.beginPath(); for (let x = 0; x <= W; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 12 : 0)); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = "#05060d"; g.beginPath(); g.arc(W / 2, H / 2, 46, 0, Math.PI * 2); g.fill();
  g.strokeStyle = c; g.lineWidth = 5; g.beginPath(); g.arc(W / 2, H / 2, 46, 0, Math.PI * 2); g.stroke();
  g.fillStyle = c; g.font = "bold 24px sans-serif"; g.textAlign = "center"; g.fillText("AI·TCG", W / 2, H / 2 + 9);
  g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  return cv;
}

// ---------------------------------------------------------------------------
// the 3D scene

const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = "gl";
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05060d, 14, 28);
const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 100);

scene.add(new THREE.AmbientLight(0x8a90c8, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(2, 10, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(key);
for (const seat of SEATS) {
  const l = new THREE.PointLight(new THREE.Color(colorOf(R.factions[seat])), 2.2, 14, 0);
  l.position.set(0, 2.6, seatSign(seat) * 5.4); scene.add(l);
}

function tex(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function floorTexture(): THREE.CanvasTexture {
  const n = 2048, cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d")!;
  const bg = g.createRadialGradient(n / 2, n / 2, 40, n / 2, n / 2, n / 2); bg.addColorStop(0, "#1b2150"); bg.addColorStop(0.75, "#0e1230"); bg.addColorStop(1, "#080a1e");
  g.fillStyle = bg; g.fillRect(0, 0, n, n);
  g.strokeStyle = "rgba(255,255,255,.045)"; g.lineWidth = 2;
  for (let x = 0; x < n; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, n); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(n, x); g.stroke(); }
  g.strokeStyle = "rgba(140,150,255,.22)";
  for (const r of [0.18, 0.62, 0.92]) { g.lineWidth = 4; g.beginPath(); g.arc(n / 2, n / 2, (r * n) / 2, 0, Math.PI * 2); g.stroke(); }
  return tex(cv);
}

// the round arena: a raised disc, a glowing rim, each half tinted by its side
const disc = new THREE.Mesh(
  new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS + 0.15, 0.3, 128),
  [new THREE.MeshStandardMaterial({ color: 0x0a0c22, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.78 }), new THREE.MeshStandardMaterial({ color: 0x0a0c22 })],
);
disc.position.y = -0.15; disc.receiveShadow = true; scene.add(disc);
const rim = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS + 0.05, 0.06, 12, 180), new THREE.MeshBasicMaterial({ color: 0x8a7bff }));
rim.rotation.x = Math.PI / 2; scene.add(rim);
const halo = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS + 0.1, ARENA_RADIUS + 0.95, 128), new THREE.MeshBasicMaterial({ color: 0x6a5cff, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
halo.rotation.x = -Math.PI / 2; halo.position.y = -0.2; scene.add(halo);
for (const seat of SEATS) {
  // CircleGeometry's half: thetaStart 0..PI covers +y in its own plane,
  // which is -z once laid flat (rotation.x = -PI/2): that half is p2's.
  const half = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS - 0.05, 96, seat === "p2" ? 0 : Math.PI, Math.PI),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(colorOf(R.factions[seat])), transparent: true, opacity: 0.075, depthWrite: false }),
  );
  half.rotation.x = -Math.PI / 2; half.position.y = 0.004; scene.add(half);
}
const midLine = new THREE.Mesh(new THREE.BoxGeometry(2 * ARENA_RADIUS - 1.2, 0.01, 0.04), new THREE.MeshBasicMaterial({ color: 0x8a7bff }));
midLine.position.y = 0.008; scene.add(midLine);

function frameAt3(x: number, z: number, color: string, scale = 1, op = 0.6) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op });
  const w = CARD_W * scale + 0.14, h = CARD_H * scale + 0.14, t = 0.035;
  for (const [px, pz, sx, sz] of [[x, z - h / 2, w, t], [x, z + h / 2, w, t], [x - w / 2, z, t, h], [x + w / 2, z, t, h]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.01, sz), mat); b.position.set(px, 0.006, pz); scene.add(b);
  }
}
for (const seat of SEATS) {
  const c = colorOf(R.factions[seat]);
  const n = frames[0]!.players[seat].slotsMax;
  for (let i = 0; i < n; i++) { const { pos, scale } = slotPlace(seat, i, n); frameAt3(pos.x, pos.z, c, scale, 0.45); }
  const sp = sigPlace(seat); frameAt3(sp.x, sp.z, c, 1, 0.95);
  const dp = deckPlace(seat); frameAt3(dp.x, dp.z, c, 1, 0.3);
  const gp = discardPlace(seat); frameAt3(gp.x, gp.z, c, DISCARD_SCALE, 0.25);
}

const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1a1f40, roughness: 0.6 });
const backMats: Partial<Record<Seat, THREE.MeshStandardMaterial>> = {};
function backMat(seat: Seat): THREE.MeshStandardMaterial {
  return (backMats[seat] ??= new THREE.MeshStandardMaterial({ map: tex(backCanvas(seat)), roughness: 0.5, emissive: new THREE.Color(colorOf(R.factions[seat])), emissiveIntensity: 0.05 }));
}
const faceCache = new Map<string, THREE.MeshStandardMaterial>();
function faceMat(f: CardFace): THREE.MeshStandardMaterial {
  const k = JSON.stringify(f);
  let m = faceCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: tex(faceCanvas(f)), roughness: 0.45, metalness: 0.1, emissive: new THREE.Color(colorOf(f.faction)), emissiveIntensity: 0.05 });
    faceCache.set(k, m);
  }
  return m;
}
const cardGeo = new THREE.BoxGeometry(CARD_W, 0.03, CARD_H);
// box faces: +x, -x, +y (the face), -y (the back), +z, -z
function cardMesh(f: CardFace | null, seat: Seat): THREE.Mesh {
  const face = f ? faceMat(f) : backMat(seat);
  const m = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, face, backMat(seat), edgeMat, edgeMat]);
  m.castShadow = true;
  return m;
}

// piles: a short stack of backs, its height following the count
const piles: Record<Seat, THREE.Mesh[]> = { p1: [], p2: [] };
const discards: Record<Seat, THREE.Mesh[]> = { p1: [], p2: [] };
function drawPiles(model: SceneModel) {
  for (const seat of SEATS) {
    for (const m of [...piles[seat], ...discards[seat]]) scene.remove(m);
    piles[seat] = []; discards[seat] = [];
    const dp = deckPlace(seat), gp = discardPlace(seat);
    const deckN = Math.min(10, Math.ceil(model.piles[seat].deck / 3));
    for (let k = 0; k < deckN; k++) {
      const m = cardMesh(null, seat); m.material = [edgeMat, edgeMat, backMat(seat), backMat(seat), edgeMat, edgeMat];
      m.position.set(dp.x, dp.y + k * 0.035, dp.z); m.rotation.set(0, restYaw(seat) + ((k % 3) - 1) * 0.015, 0);
      scene.add(m); piles[seat].push(m);
    }
    const disN = Math.min(8, Math.ceil(model.piles[seat].discard / 3));
    for (let k = 0; k < disN; k++) {
      const m = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ color: 0x2a2f55, roughness: 0.7 }));
      m.scale.setScalar(DISCARD_SCALE); m.position.set(gp.x, gp.y + k * 0.03, gp.z); m.rotation.set(0, restYaw(seat) + ((k * 7) % 5 - 2) * 0.06, 0);
      scene.add(m); discards[seat].push(m);
    }
  }
}

// table cards, kept by key so a card that stays is moved, not rebuilt
interface Live { mesh: THREE.Mesh; card: TableCard }
const live = new Map<string, Live>();
let held: THREE.Mesh[] = [];

function placeMesh(l: Live) {
  const { pos, scale, yaw } = l.card;
  l.mesh.position.set(pos.x, pos.y, pos.z); l.mesh.rotation.set(0, yaw, 0); l.mesh.scale.setScalar(scale);
}

function syncTable(model: SceneModel) {
  const seen = new Set<string>();
  for (const card of model.table) {
    seen.add(card.key);
    const had = live.get(card.key);
    if (had) {
      had.card = card;
      (had.mesh.material as THREE.Material[])[2] = faceMat(card.face);
      if (!busy.has(card.key)) placeMesh(had);
    } else {
      const mesh = cardMesh(card.face, card.seat);
      mesh.userData = { key: card.key };
      scene.add(mesh);
      const l = { mesh, card };
      live.set(card.key, l); placeMesh(l);
    }
  }
  for (const [k, l] of live) if (!seen.has(k) && !busy.has(k)) { scene.remove(l.mesh); live.delete(k); }
}

function syncHeld(model: SceneModel) {
  for (const m of held) scene.remove(m);
  held = [];
  const { seat, count } = model.held;
  for (let k = 0; k < count; k++) {
    // No face exists for these cards on the page: the mesh is a back on both sides.
    const m = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, backMat(seat), backMat(seat), edgeMat, edgeMat]);
    m.castShadow = true;
    const h = heldPlace(seat, k, count);
    m.userData = { held: true, base: h, k };
    scene.add(m); held.push(m);
  }
}

// camera: behind the POV's seat, looking across the arena. Its distance is
// fitted every resize so the zones (both rows, the piles, the signature zones)
// fit across and the far side's held hand fits above: on a narrow screen the
// camera pulls back and the disc's rim may run off the sides, never a zone.
// Every zone's corners, both sides: what must stay on screen across.
const FIT_POINTS = SEATS.flatMap((seat) => [
  ...footprint(sigPlace(seat)), ...footprint(deckPlace(seat)), ...footprint(discardPlace(seat), DISCARD_SCALE),
  ...footprint(slotPlace(seat, 0, 6).pos), ...footprint(slotPlace(seat, 5, 6).pos),
]);
let fittedFor = "";
let fitDist = 12;
let fitLook = 0.55;
// The framing's bounds, in clip space (-1..1). Zoomed in a little (owner
// 2026-11-15, after render 79: "does need to be zoomed in a little bit,
// especially on the tile version"): the camera's look-at point is now fitted
// with its distance, so the top bound (the far side's held hand) and the bottom
// bound (the near row) are both met, instead of the held hand alone setting the
// distance with empty board under the near row. The tile lets the held hand's
// top edge run off the board (backs only, nothing to read there) and its rim
// margins are tighter: it has no panel and no hover.
// "bottom" is for the near side's directive row, the nearest thing the near
// hand could cover: the hand is DOM at a fixed size in px along the bottom
// edge, so its share of the board (and the bound) is measured, not fixed.
// "floor" keeps the near discard (beside the hand, lower) on the board.
const FRAME = {
  full: { side: 0.97, top: 0.92, gap: 12, floor: -0.97 },
  phone: { side: 0.97, top: 0.92, gap: 12, floor: -0.97 },
  tile: { side: 0.985, top: 1.06, gap: 6, floor: -0.98 },
};
/** How far the near hand's tallest card reaches up into the board, px. */
function handReach(): number {
  const hand = $("hand"), stageBottom = stage.getBoundingClientRect().bottom;
  const probe = document.createElement("div");
  probe.className = "hc"; probe.style.visibility = "hidden";
  hand.appendChild(probe);
  const reach = stageBottom - probe.getBoundingClientRect().top;
  probe.remove();
  return Math.max(0, reach);
}
function frameFor(aspect: number) { return mode === "tile" ? FRAME.tile : aspect < 1 ? FRAME.phone : FRAME.full; }
function aim(d: number, look: number) {
  const s = seatSign(pov);
  const tilt = 0.8;
  camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d * s);
  camera.lookAt(0, 0, look * s);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
function fitCamera(aspect: number): { d: number; look: number } {
  const s = seatSign(pov);
  const f = frameFor(aspect);
  const h = Math.max(1, stage.getBoundingClientRect().height);
  const bottom = -1 + (2 * (handReach() + f.gap)) / h;
  const topY = () => new THREE.Vector3(0, HELD_TOP, -s * (HELD_Z_ABS + 0.3)).project(camera).y;
  const bottomY = () => new THREE.Vector3(0, 0, s * NEAR_DIR_EDGE).project(camera).y;
  const floorY = () => Math.min(...footprint(discardPlace(pov), DISCARD_SCALE).map((c) => new THREE.Vector3(c.x, 0, c.z).project(camera).y));
  const sidesFit = () => FIT_POINTS.every((c) => Math.abs(new THREE.Vector3(c.x, 0, c.z).project(camera).x) <= f.side);
  // At a distance d: aim the camera where the held hand's top sits exactly on
  // the top bound (the further the aim, the lower the scene on screen), then
  // ask whether the near row still clears the bottom bound and every zone fits
  // across. The aim stays between the arena's middle and its near rows.
  const probe = (d: number): number | null => {
    let lo = -2, hi = 3; // look-at z (towards the viewer = larger)
    aim(d, lo); if (topY() > f.top) return null; // even aimed far, the hand is too high
    aim(d, hi);
    if (topY() <= f.top) { lo = hi; }
    else for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; aim(d, mid); if (topY() <= f.top) lo = mid; else hi = mid; }
    aim(d, lo);
    return bottomY() >= bottom && floorY() >= f.floor && sidesFit() ? lo : null;
  };
  let lo = 4, hi = 40;
  for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (probe(mid) !== null) hi = mid; else lo = mid; }
  return { d: hi, look: probe(hi) ?? 0.55 };
}
/** The near directive row's edge nearest the viewer (z, unsigned). */
const NEAR_DIR_EDGE = DIRECTIVE_Z + (CARD_H * DIRECTIVE_SCALE) / 2;
const HELD_TOP = heldPlace("p1", 0, 1).pos.y + CARD_H / 2;
const HELD_Z_ABS = Math.abs(heldPlace("p1", 0, 1).pos.z);
function placeCamera() {
  const r = stage.getBoundingClientRect();
  const aspect = Math.max(0.3, r.width / Math.max(1, r.height));
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 52 : 44;
  const keyNow = `${pov}:${Math.round(r.width)}x${Math.round(r.height)}`;
  if (keyNow !== fittedFor) { const fit = fitCamera(aspect); fitDist = fit.d; fitLook = fit.look; fittedFor = keyNow; }
  aim(fitDist, fitLook);
}
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  placeCamera();
}
addEventListener("resize", resize);

function screenOf(v: THREE.Vector3): [number, number] {
  const p = v.clone().project(camera); const r = stage.getBoundingClientRect();
  return [(p.x * 0.5 + 0.5) * r.width, (-p.y * 0.5 + 0.5) * r.height];
}

// tweens
interface Tween { t0: number; dur: number; step: (e: number, t: number) => void; done?: () => void }
const tweens: Tween[] = [];
const busy = new Set<string>();
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
function tween(dur: number, step: Tween["step"], done?: () => void) { tweens.push({ t0: performance.now(), dur: dur / speed, step, done }); }
let shakeUntil = 0;

function animate(now: number) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]!; const t = Math.min(1, (now - tw.t0) / tw.dur);
    tw.step(ease(t), t);
    if (t >= 1) { tweens.splice(i, 1); tw.done?.(); }
  }
  for (const m of held) {
    const b = m.userData.base as ReturnType<typeof heldPlace>;
    m.position.set(b.pos.x, b.pos.y + Math.sin(now / 900 + (m.userData.k as number)) * 0.04, b.pos.z);
    m.rotation.set(b.tilt, b.yaw, 0);
  }
  placeCamera();
  if (shakeUntil > now) { const a = (shakeUntil - now) / 500; camera.position.x += (Math.random() - 0.5) * 0.3 * a; camera.position.y += (Math.random() - 0.5) * 0.18 * a; }
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(animate);
}

// deck / discard / signature labels over the scene
const labels: Record<string, HTMLDivElement> = {};
function label(id: string): HTMLDivElement {
  return (labels[id] ??= (() => { const d = document.createElement("div"); d.className = "lbl"; d.dataset.lbl = id; stage.appendChild(d); return d; })());
}
let lastModel: SceneModel | null = null;
function placeLabels() {
  if (!lastModel) return;
  // The turn line: between the two halves, in the gap between the rows.
  const [mx, my] = screenOf(new THREE.Vector3(0, 0, 0));
  const tl = $("turnline"); tl.style.top = my + "px"; tl.style.left = mx + "px";
  for (const seat of SEATS) {
    const c = colorOf(R.factions[seat]);
    const dp = deckPlace(seat), gp = discardPlace(seat), sp = sigPlace(seat);
    const s = seatSign(pov);
    const put = (id: string, v: THREE.Vector3, html: string) => { const [x, y] = screenOf(v); const l = label(id); l.style.left = x + "px"; l.style.top = y + "px"; l.style.setProperty("--c", c); if (l.innerHTML !== html) l.innerHTML = html; };
    // A pile's count sits on the pile itself (a badge on the top card).
    put(`deck-${seat}`, new THREE.Vector3(dp.x, 0.4, dp.z), `<em>DECK</em><b>${lastModel.piles[seat].deck}</b><span>${esc(data.backs[seat].name)}</span>`);
    put(`discard-${seat}`, new THREE.Vector3(gp.x, 0.3, gp.z), `<em>DISCARD</em><b>${lastModel.piles[seat].discard}</b>`);
    const z = lastModel.sigZone[seat];
    // The signature label sits on the zone's outer edge (below the near zone,
    // above the far one): clear of the turn line in the middle, of the other
    // side's piles across from it, and of a card waiting in the zone.
    put(`sig-${seat}`, new THREE.Vector3(sp.x, 0.05, sp.z + (seat === pov ? 1 : -1) * s * (CARD_H / 2 + 0.3)), z === "none" ? "NO SIGNATURE" : z === "waiting" ? "SIGNATURE <b>READY</b>" : "SIGNATURE <b>IN PLAY</b>");
  }
}

// ---------------------------------------------------------------------------
// motions (placeholder versions of the Season 0 effects: the 3D effect
// rebuild is later work; these are the table moves the layout needs)

function dmgPop(x: number, y: number, amount: number) {
  const d = document.createElement("div"); d.className = "dmg"; d.textContent = "-" + amount; d.style.left = x + "px"; d.style.top = y + "px";
  stage.appendChild(d); setTimeout(() => d.remove(), 1200 / speed);
}

function playMotions(ms: Motion[], next: SceneModel) {
  for (const m of ms) {
    if (m.kind === "enter") {
      const l = live.get(m.key); if (!l) continue;
      const end = l.card.pos; const s = seatSign(m.seat);
      const start = m.fromSignature ? sigPlace(m.seat) : m.seat === pov ? { x: 0, y: 2.4, z: s * 6.4 } : { x: 0, y: 1.6, z: s * 4.4 };
      const toCam = viewerYaw(pov), rest = restYaw(m.seat);
      busy.add(m.key);
      tween(900, (e) => {
        l.mesh.position.set(start.x + (end.x - start.x) * e, end.y + Math.sin(e * Math.PI) * 1.3 + (1 - e) * (start.y - end.y), start.z + (end.z - start.z) * e);
        l.mesh.rotation.set((1 - e) * -0.7 * seatSign(pov), e < 0.7 ? toCam : toCam + (rest - toCam) * ((e - 0.7) / 0.3), 0);
      }, () => { busy.delete(m.key); placeMesh(l); shakeUntil = performance.now() + 220; });
    } else if (m.kind === "attack") {
      const l = live.get(m.attacker); if (!l) continue;
      const a = l.card.pos;
      let b: { x: number; z: number };
      if (m.target.kind === "unit") { const t = live.get(m.target.key); b = t ? t.card.pos : { x: 0, z: 0 }; }
      else b = { x: 0, z: seatSign(m.target.seat) * (ROW_Z + 2.6) };
      const rest = restYaw(m.seat), toCam = viewerYaw(pov);
      busy.add(m.attacker);
      tween(1000, (_e, t) => {
        const f = t < 0.6 ? Math.sin((t / 0.6) * (Math.PI / 2)) * 0.82 : 0.82 * (1 - (t - 0.6) / 0.4);
        l.mesh.position.set(a.x + (b.x - a.x) * f, 0.03 + Math.sin(Math.min(1, t / 0.6) * Math.PI) * 1.0, a.z + (b.z - a.z) * f);
        // lifts and turns to face the viewer, then settles facing its owner
        l.mesh.rotation.set(0, rest + (toCam - rest) * Math.sin(Math.min(1, t / 0.92) * Math.PI), 0);
      }, () => { busy.delete(m.attacker); placeMesh(l); shakeUntil = performance.now() + 380; });
    } else if (m.kind === "hurt") {
      const l = live.get(m.key); if (!l) continue;
      const mat = (l.mesh.material as THREE.MeshStandardMaterial[])[2]!;
      tween(500, (e) => { mat.emissiveIntensity = 0.9 - 0.85 * e; });
      const [x, y] = screenOf(new THREE.Vector3(l.card.pos.x, 0.3, l.card.pos.z)); dmgPop(x, y, m.amount);
    } else if (m.kind === "face") {
      const hud = $(m.seat === pov ? "hudNear" : "hudFar");
      hud.classList.remove("hit"); void hud.offsetWidth; hud.classList.add("hit");
      const bar = hud.querySelector(".hpbar")!.getBoundingClientRect(), st = stage.getBoundingClientRect();
      dmgPop(bar.left + bar.width / 2 - st.left, m.seat === pov ? st.height - 40 : 40, m.amount);
    } else if (m.kind === "leave") {
      const l = live.get(m.key); if (!l) continue;
      busy.add(m.key);
      const mat = ((l.mesh.material as THREE.MeshStandardMaterial[])[2] = (l.mesh.material as THREE.MeshStandardMaterial[])[2]!.clone());
      mat.transparent = true;
      const y0 = l.mesh.position.y, delay = ms.some((x) => x.kind === "attack") ? 0.45 : 0;
      tween(900, (_e, t) => {
        const u = Math.max(0, (t - delay) / (1 - delay));
        l.mesh.position.y = y0 + Math.sin(u * Math.PI) * 0.7; l.mesh.rotation.z = u * 1.1; mat.opacity = 1 - u; l.mesh.scale.setScalar(l.card.scale * (1 - u * 0.4));
      }, () => { busy.delete(m.key); scene.remove(l.mesh); live.delete(m.key); if (lastModel) syncTable(lastModel); });
    }
  }
  void next;
}

// ---------------------------------------------------------------------------
// HUDs, near hand, the side panel

function hudHtml(seat: Seat, frame: Frame): string {
  const h = hudAt(R, frame, seat, data.loadouts[seat]);
  const c = colorOf(h.faction);
  const pips = Array.from({ length: h.maxEnergy }, (_, i) => `<i class="${i < h.energy ? "on" : ""}"></i>`).join("");
  const pic = h.avatarUrl ? `<img src="${esc(h.avatarUrl)}" alt="">` : h.avatarSvg;
  return `<div class="port" style="--c:${c}">${pic}</div>
    <div class="who"><b data-name>${esc(h.name)}</b><span>${h.owner ? esc(h.owner) + " · " : ""}${esc(h.faction)}</span></div>
    <div class="hp" style="--c:${c}"><div class="hpbar"><div style="width:${(100 * Math.max(0, h.health)) / h.maxHealth}%"></div></div><div class="num"><b data-hp>${h.health}</b> / ${h.maxHealth} health</div></div>
    <div class="enw"><div class="en">${pips}</div><div class="num"><b data-en>${h.energy}</b> / ${h.maxEnergy} energy</div></div>
    <div class="counts">Hand<b data-hand>${h.hand}</b> Deck<b data-deck>${h.deck}</b> Discard<b>${h.discard}</b></div>
    <div class="sig" style="--c:${c}" data-sig>${h.signature ? "SIGNATURE · " + esc(h.signature.toUpperCase()) : "NO SIGNATURE"}</div>
    <div class="kit"><span title="Coin">◎ ${esc(h.coin)}</span><span title="Boast">✦ ${esc(h.boast)}</span></div>
    ${h.active ? `<div class="turnflag" style="--c:${c}">${h.hasPriority ? "ON THE CLOCK" : "THEIR TURN"}</div>` : h.hasPriority ? `<div class="turnflag resp" style="--c:${c}">RESPONDING</div>` : ""}`;
}

function miniCard(f: CardFace | null, seat: Seat, i: number, n: number): string {
  const r = (i - (n - 1) / 2) * 6, y = Math.abs(i - (n - 1) / 2) * 5;
  const st = `transform:rotate(${r}deg) translateY(${y}px)`;
  if (!f) return `<div class="hc back" style="${st};--c:${colorOf(R.factions[seat])}"></div>`;
  const c = colorOf(f.faction);
  return `<div class="hc" style="${st};--c:${c}" data-i="${i}"><div class="hn">${esc(f.name)}</div><div class="hcst">${f.cost}</div><div class="ht">${esc(f.type)}</div></div>`;
}

function partsHtml(parts: FeedPart[]): string {
  return parts.map((p) => typeof p === "string" ? esc(p)
    : "card" in p ? `<b style="color:${colorOf(R.cardFactions[p.card] ?? "Neutral")}">${esc(p.card)}</b>`
    : `<b style="color:${colorOf(R.factions[p.player as Seat])}">${esc(R.agentNames[p.player as Seat])}</b>`).join("");
}
const BIG = (e: FeedEntry) => e.kind === "end" || e.tag === "SIGNATURE" || (e.kind === "result" && e.parts.some((p) => typeof p === "string" && /destroyed|dies|lethal/i.test(p)));

function feedHtml(upTo: number): string {
  const out: string[] = [];
  for (let i = 0; i <= upTo; i++) {
    for (const e of frames[i]!.feed ?? []) {
      if (e.kind === "turn") { out.push(`<div class="ev turn">${partsHtml(e.parts)}</div>`); continue; }
      const c = e.side ? colorOf(R.factions[e.side as Seat]) : "#8ea3c9";
      out.push(`<div class="ev ${e.kind}${BIG(e) ? " big" : ""}" style="--c:${c}">${e.tag ? `<small>${esc(e.tag)}</small>` : ""}${partsHtml(e.parts)}${e.detail ? `<div class="det">${partsHtml(e.detail)}</div>` : ""}</div>`);
    }
  }
  return out.join("");
}

// ---------------------------------------------------------------------------
// the reader: hover or tap a card to read it upright and full size

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const reader = $("reader");
function readerHtml(f: CardFace, seat: Seat): string {
  const c = colorOf(f.faction);
  const text = data.cardText[f.cardId] ?? [];
  const stats = f.attack !== undefined ? `<div class="rst"><span class="a">${f.attack}</span><span class="h">${f.health}${f.maxHealth !== undefined && f.health! < f.maxHealth ? ` / ${f.maxHealth}` : ""}</span></div>` : "";
  return `<div class="rcard" style="--c:${c}"><div class="rtop"><b>${esc(f.name)}</b><span class="rc">${f.cost}</span></div>
    <div class="rtype">${f.signature ? "SIGNATURE · " : ""}${esc(f.type)} · ${esc(f.faction)} · ${esc(f.rarity)}</div>
    ${f.keywords.length ? `<div class="rkw">${f.keywords.map(esc).join(" · ")}</div>` : ""}
    ${text.map((t) => `<p>${esc(t)}</p>`).join("")}
    ${f.state.length ? `<div class="rstate">${f.state.map(esc).join(" · ")}</div>` : ""}
    <div class="rfl">${esc(f.flavor)}</div>${stats}
    <div class="rown" style="color:${colorOf(R.factions[seat])}">${esc(R.agentNames[seat])}</div></div>`;
}
function showReader(f: CardFace, seat: Seat, x: number, y: number) {
  reader.innerHTML = readerHtml(f, seat);
  reader.dataset.card = f.name;
  reader.hidden = false;
  const st = stage.getBoundingClientRect(), w = reader.offsetWidth, h = reader.offsetHeight;
  reader.style.left = Math.max(6, Math.min(st.width - w - 6, x + 16)) + "px";
  reader.style.top = Math.max(6, Math.min(st.height - h - 6, y - h / 2)) + "px";
}
function hideReader() { reader.hidden = true; delete reader.dataset.card; }
function pick(ev: PointerEvent) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  // Held cards are in the scene too: a hit on one ends the search with
  // nothing to read (it's a back), so a card behind it isn't read through it.
  const hit = ray.intersectObjects([...[...live.values()].map((l) => l.mesh), ...held], false)[0];
  const k = hit?.object.userData.key as string | undefined;
  const l = k ? live.get(k) : undefined;
  if (l) showReader(l.card.face, l.card.seat, ev.clientX - r.left, ev.clientY - r.top);
  else hideReader();
}
renderer.domElement.addEventListener("pointermove", (ev) => { if (ev.pointerType === "mouse") pick(ev); });
renderer.domElement.addEventListener("pointerdown", pick);
renderer.domElement.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") hideReader(); });

// ---------------------------------------------------------------------------
// show a beat

let shownBeat = -1;
function show(b: number, animateMotions: boolean) {
  beat = Math.max(0, Math.min(beats.length - 1, b));
  const frame = frameAt(beat);
  const prevFrame = shownBeat >= 0 ? frameAt(shownBeat) : undefined;
  const model = sceneAt(frame, pov);
  const step = animateMotions && shownBeat === beat - 1;
  // Motions are played between consecutive beats only; a jump draws the
  // frame as it stands. Departures play before the table drops the card.
  const ms = step ? motionsBetween(frames[beats[beat]! - 1] ?? prevFrame, frame) : [];
  const leaving = new Set(ms.filter((m) => m.kind === "leave").map((m) => (m as { key: string }).key));
  for (const k of leaving) busy.add(k);
  syncTable(model);
  for (const k of leaving) busy.delete(k);
  lastModel = model;
  placeLabels();
  syncHeld(model);
  drawPiles(model);
  if (step) playMotions(ms, model);
  shownBeat = beat;

  $("hudFar").innerHTML = hudHtml(otherSeat(pov), frame);
  $("hudNear").innerHTML = hudHtml(pov, frame);
  $("hudFar").dataset.seat = otherSeat(pov); $("hudNear").dataset.seat = pov;
  $("hudFar").style.setProperty("--fc", colorOf(R.factions[otherSeat(pov)]));
  $("hudNear").style.setProperty("--fc", colorOf(R.factions[pov]));
  const nh = model.nearHand.cards;
  $("hand").innerHTML = nh.map((f, i) => miniCard(f, pov, i, nh.length)).join("");
  $("hand").dataset.count = String(nh.length);
  $("held").dataset.count = String(model.held.count);
  const ac = colorOf(R.factions[frame.activePlayer as Seat]);
  $("turnline").innerHTML = frame.winner
    ? frame.winner === "draw" ? "DRAW" : `<b style="color:${colorOf(R.factions[frame.winner as Seat])}">${esc(R.agentNames[frame.winner as Seat])}</b> WINS`
    : `TURN ${frame.turnNumber} · <b style="color:${ac}">${esc(R.agentNames[frame.activePlayer as Seat])}</b>`;
  $("watchAs").textContent = "Watch as: " + R.agentNames[pov];
  const feed = $("feed");
  feed.innerHTML = feedHtml(beats[beat]!);
  feed.scrollTop = feed.scrollHeight;
  ($("scrub") as HTMLInputElement).value = String(beat);
  $("pos").textContent = `Turn ${frame.turnNumber} · move ${beats[beat]} / ${frames.length - 1}`;
  document.body.dataset.beat = String(beat);
  document.body.dataset.frame = String(beats[beat]);
  document.body.dataset.pov = pov;
}

// transport
let timer: number | undefined;
function schedule() {
  clearTimeout(timer);
  if (!playing) return;
  if (beat >= beats.length - 1) { playing = false; syncPlay(); return; }
  const next = frameAt(beat + 1);
  timer = window.setTimeout(() => { show(beat + 1, true); schedule(); }, beatMs(frameAt(beat), next) / speed);
}
function syncPlay() { $("play").textContent = playing ? "❚❚ Pause" : "▶ Play"; $("play").setAttribute("aria-pressed", String(playing)); }
$("play").onclick = () => { playing = !playing; if (playing && beat >= beats.length - 1) show(0, false); syncPlay(); schedule(); };
$("prev").onclick = () => { playing = false; syncPlay(); show(beat - 1, false); };
$("next").onclick = () => { playing = false; syncPlay(); show(beat + 1, true); };
$("speed").onclick = () => { speed = speed === 1 ? 2 : 1; $("speed").textContent = speed + "x"; schedule(); };
const scrub = $("scrub") as HTMLInputElement;
scrub.max = String(beats.length - 1);
scrub.oninput = () => { playing = false; syncPlay(); show(Number(scrub.value), false); };
$("watchAs").onclick = () => { pov = otherSeat(pov); hideReader(); for (const [, l] of live) scene.remove(l.mesh); live.clear(); busy.clear(); tweens.length = 0; shownBeat = -1; show(beat, false); };
document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); });
    $("feed").hidden = b.dataset.t !== "pbp"; $("chat").hidden = b.dataset.t !== "chat";
  };
});
addEventListener("keydown", (ev) => {
  if (ev.target instanceof HTMLInputElement) return;
  if (ev.key === "ArrowRight") $("next").click();
  else if (ev.key === "ArrowLeft") $("prev").click();
  else if (ev.key === " ") { ev.preventDefault(); $("play").click(); }
});

// The page's own handle for its browser check (read-only state; no control).
(window as unknown as { __s1: unknown }).__s1 = {
  beats: beats.length,
  frames: frames.length,
  state: () => ({ beat, frame: beats[beat], pov, table: [...live.values()].map((l) => ({ key: l.card.key, seat: l.card.seat, name: l.card.face.name, zone: l.card.zone })), held: held.length, busy: busy.size }),
  screenOfCard: (key: string) => { const l = live.get(key); return l ? screenOf(new THREE.Vector3(l.card.pos.x, 0.05, l.card.pos.z)) : null; },
  heldScreen: (k: number) => { const m = held[k]; return m ? screenOf(m.position.clone()) : null; },
  cameraZ: () => camera.position.z,
  /** The camera's fitted distance and aim, and every zone corner on screen (px in the stage). */
  framing: () => ({ d: fitDist, look: fitLook, zones: FIT_POINTS.map((c) => screenOf(new THREE.Vector3(c.x, 0, c.z))) }),
  /** A unit slot's width on screen, px: the zoom, measured. */
  /** The near directive row's near edge on screen (y px) and the near hand's top (y px, in the stage). */
  nearEdge: () => ({ dirEdge: screenOf(new THREE.Vector3(0, 0, seatSign(pov) * NEAR_DIR_EDGE))[1], handTop: $("hand").children.length ? Math.min(...[...$("hand").children].map((c) => c.getBoundingClientRect().top)) - stage.getBoundingClientRect().top : null }),
  slotWidth: () => { const a = slotPlace(pov, 0, 6).pos, b = slotPlace(pov, 1, 6).pos; const pa = screenOf(new THREE.Vector3(a.x, 0, a.z)), pb = screenOf(new THREE.Vector3(b.x, 0, b.z)); return Math.abs(pb[0] - pa[0]); },
  yawOf: (key: string) => { const l = live.get(key); return l ? l.mesh.rotation.y : null; },
  restOf: (key: string) => { const l = live.get(key); return l ? l.card.yaw : null; },
};

document.body.classList.add(mode);
resize();
show(0, false);
syncPlay();
schedule();
requestAnimationFrame(animate);
