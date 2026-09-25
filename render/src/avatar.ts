// Deterministic, username-seeded placeholder avatar (owner-feedback
// 2026-09-26, "reserve player identity"). Same spirit as the card frames'
// generative placeholders: readable, distinct, obviously a placeholder —
// and NOT an emoji/glyph (DESIGN's banned cheap-out; also this sandbox's
// headless Chromium has no emoji font, see the slice-1 shield-badge note).
//
// Pure SVG string, no DOM. The body cells use `currentColor`, so the HUD
// that embeds it paints them in the player's faction colour; the accent
// ring's hue and every shape choice come from the username alone. Two
// players of the SAME faction (a mirror match) therefore still get
// visibly different avatars — which is the case where name + faction
// colour alone can't tell the sides apart. The planned 1-of-1 leader art
// is meant to reuse this same username seed.

/** FNV-1a, 32-bit. */
export function usernameHash(username: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < username.length; i++) {
    h ^= username.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID = 5;
const FRAMES = ["circle", "hex", "diamond", "square"] as const;
export type AvatarFrame = (typeof FRAMES)[number];

export interface AvatarSpec {
  /** GRID x GRID, left-right mirrored. */
  cells: boolean[][];
  frame: AvatarFrame;
  accentHue: number;
}

export function avatarSpec(username: string): AvatarSpec {
  const rand = mulberry32(usernameHash(username));
  const cells: boolean[][] = [];
  for (let r = 0; r < GRID; r++) {
    const row: boolean[] = new Array(GRID).fill(false);
    for (let c = 0; c < Math.ceil(GRID / 2); c++) {
      const on = rand() < 0.55;
      row[c] = on;
      row[GRID - 1 - c] = on;
    }
    cells.push(row);
  }
  // Never an empty face — guarantee a visible core in the centre column.
  if (!cells.some((row) => row.some(Boolean))) cells[2]![2] = true;
  const frame = FRAMES[Math.floor(rand() * FRAMES.length)]!;
  const accentHue = Math.floor(rand() * 360);
  return { cells, frame, accentHue };
}

function framePath(frame: AvatarFrame): string {
  switch (frame) {
    case "circle":
      return '<circle cx="32" cy="32" r="28"/>';
    case "hex":
      return '<polygon points="32,4 56,18 56,46 32,60 8,46 8,18"/>';
    case "diamond":
      return '<polygon points="32,3 61,32 32,61 3,32"/>';
    case "square":
      return '<rect x="5" y="5" width="54" height="54" rx="9"/>';
  }
}

export function avatarSvg(username: string): string {
  const spec = avatarSpec(username);
  const cell = 6;
  const gap = 1;
  const origin = 32 - (GRID * cell + (GRID - 1) * gap) / 2;
  const rects: string[] = [];
  spec.cells.forEach((row, r) =>
    row.forEach((on, c) => {
      if (!on) return;
      const x = origin + c * (cell + gap);
      const y = origin + r * (cell + gap);
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.2"/>`);
    }),
  );
  const accent = `hsl(${spec.accentHue},85%,64%)`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="avatar">` +
    `<rect width="64" height="64" rx="10" fill="#0a0f1c"/>` +
    `<g fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.9">${framePath(spec.frame)}</g>` +
    `<g fill="currentColor">${rects.join("")}</g>` +
    `</svg>`
  );
}
