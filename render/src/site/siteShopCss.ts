// The store layout's styles (render session 63; siteShop.ts draws the
// markup). The current AI·TCG look (the glass, the type, the light and dark
// themes); only the placement is the item shop's: large tiles of different
// sizes, one featured, the art as the hero on a deep plate, the price on the
// art, the button underneath. Motion is transform and opacity only, and
// still under reduce motion.

import { SEALED_PACK_CSS } from "./siteFaces.js";

export const SHOP_CSS = `${SEALED_PACK_CSS}
/* The sealed pack's foil sweep (transform only). */
.spk { overflow: hidden; }
.spk-foil { position: absolute; inset: -20% -60%; pointer-events: none; background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.28) 48%, rgba(190,220,255,.12) 52%, transparent 62%); transform: translateX(-40%); animation: spk-sweep 5.5s ease-in-out infinite; mix-blend-mode: screen; }
@keyframes spk-sweep { 0%, 55% { transform: translateX(-45%); } 85%, 100% { transform: translateX(45%); } }
.spile { position: relative; display: grid; place-items: center; }
.spile > span { grid-area: 1 / 1; display: block; }
.spile .sp-l { transform: translate(-34%, 4%) rotate(-11deg); filter: brightness(.72); }
.spile .sp-r { transform: translate(34%, 4%) rotate(11deg); filter: brightness(.72); }
.spile .sp-c { position: relative; z-index: 1; }
.sp-n { position: absolute; z-index: 2; right: -20%; top: 2%; font: 900 22px/1 ui-rounded, system-ui; color: #fff; padding: 6px 9px; border-radius: 12px; background: linear-gradient(135deg, #4f6bff, #8b5cff); box-shadow: 0 6px 18px rgba(80,60,255,.5); }

/* ---- render session 73: the season has ended: the Store drawn closed ---- */
.sh-closed { margin: 0; padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; background: color-mix(in srgb, var(--glass) 70%, rgba(140,140,160,.18)); border: 1px dashed color-mix(in srgb, var(--muted) 55%, transparent); }
.sh-closed b { display: inline-block; margin-right: 8px; padding: 1px 9px; border-radius: 99px; font-size: 11.5px; letter-spacing: .02em; background: rgba(140,140,160,.28); }
.shw .sh-closed { padding: 7px 10px; font-size: 12px; margin-bottom: 8px; }
.sh-t.closed .sh-art { filter: grayscale(.8) brightness(.8); }
.sh-t.closed .spk-foil { animation: none; opacity: 0; }
.sh-t.closed .sh-price { opacity: .55; }
.pkw.closed .pkw-pile, .pkw.closed > .spk, .shw-s.closed .spk { filter: grayscale(.75) brightness(.8); }
.pkw.closed .spk-foil, .shw-s.closed .spk-foil { animation: none; opacity: 0; }
.pkw-x { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pkw-why, .st-closed, .cv-closed { line-height: 1.4; }
.dr-pk.closed .dr-pki { filter: grayscale(1); opacity: .6; }

/* ---- the store page's head: the balance and the countdown ---- */
.sh-pg { display: flex; flex-direction: column; gap: 18px; }
.sh-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sh-head .sp { flex: 1; }
.sh-bal, .sh-reset { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px 0 12px; border-radius: 99px; background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow); font: 600 14px system-ui; white-space: nowrap; }
.sh-bal b { font: 800 17px ui-rounded, system-ui; font-variant-numeric: tabular-nums; }
.sh-clock { font: 800 17px ui-rounded, ui-monospace, system-ui; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.sh-reset small { color: var(--muted); font-weight: 600; }
.sh-clock-ic { width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 2px currentColor; position: relative; opacity: .8; }
.sh-clock-ic::after { content: ""; position: absolute; left: 7px; top: 3px; width: 2px; height: 6px; background: currentColor; border-radius: 1px; transform-origin: 1px 5px; transform: rotate(40deg); }
.sh-sec h3 { margin: 0; font: 800 19px system-ui; letter-spacing: .01em; }
.sh-sec .sh-sub { margin: 2px 0 12px; color: var(--muted); font-size: 13.5px; }

/* ---- the tiles ---- */
.sh-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.sh-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 16px; }
.sh-t { --c: #6a8cff; position: relative; display: flex; flex-direction: column; min-width: 0; border-radius: 22px; overflow: hidden;
  background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow); backdrop-filter: blur(22px) saturate(1.4); -webkit-backdrop-filter: blur(22px) saturate(1.4);
  transition: transform .22s cubic-bezier(.2,.8,.3,1), box-shadow .22s; }
.sh-t:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(50,40,140,.24), inset 0 1px 0 rgba(255,255,255,.4); }
.sh-t.t-feature { grid-column: span 2; }
.sh-t.t-tall, .sh-t.t-feature { min-height: 400px; }
/* The art is the hero: a deep plate in the product's colour, the art centred on it. */
.sh-art { position: relative; flex: 1; min-height: 150px; display: grid; place-items: center; overflow: hidden; isolation: isolate;
  background: radial-gradient(120% 90% at 50% 38%, color-mix(in srgb, var(--c) 46%, #10123a) 0%, #0b0d2a 62%, #05061a 100%); }
.sh-art::before { content: ""; position: absolute; inset: 0; z-index: -1; background: repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 22px), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 22px); }
.sh-art::after { content: ""; position: absolute; left: 50%; top: 46%; width: 70%; aspect-ratio: 1; z-index: -1; border-radius: 50%; transform: translate(-50%, -50%); background: radial-gradient(circle, color-mix(in srgb, var(--c) 60%, transparent), transparent 66%); opacity: .55; }
.sh-t.t-item .sh-art { min-height: 150px; flex: none; height: 150px; }
/* The pack tiles line up: the art a fixed height, the words take what's left, the buttons on one line. */
.sh-t.t-tall .sh-art, .sh-t.t-feature .sh-art { flex: none; height: 270px; }
.sh-info { flex: 1; }
.sh-t .spk, .sh-t .spile { transition: transform .35s cubic-bezier(.2,.8,.3,1); }
.sh-t:hover .spk, .sh-t:hover .spile { transform: translateY(-4px) rotate(-1.5deg); }
.sh-t:hover .spile .spk { transform: none; }
.tone-pack { --c: #6a5cff; } .tone-free { --c: #f6c445; } .tone-coin { --c: #6f7cb8; }
.sh-t.t-feature .sh-art .spk { animation: sh-bob 4.2s ease-in-out infinite; }
@keyframes sh-bob { 50% { transform: translateY(-7px) rotate(-.8deg); } }
/* The price, on the art: the credits icon and the number. */
.sh-price { position: absolute; right: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 7px; border-radius: 99px; color: #fff;
  background: rgba(6,8,30,.62); border: 1px solid rgba(255,255,255,.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font: 800 16px ui-rounded, system-ui; font-variant-numeric: tabular-nums; }
.sh-price.free { padding: 5px 12px; color: #1a1205; background: linear-gradient(135deg, #ffe08a, #f6c445); border-color: rgba(255,255,255,.6); letter-spacing: .06em; text-transform: uppercase; font-size: 13px; }
.t-feature .sh-price { font-size: 20px; right: 16px; bottom: 16px; }
.sh-badge { position: absolute; left: 12px; top: 12px; padding: 4px 10px; border-radius: 8px; font: 800 10.5px system-ui; letter-spacing: .1em; text-transform: uppercase; color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.22); }
.tone-free .sh-badge { color: #1a1205; background: #f6c445; border-color: #ffe08a; }
.sh-t.owned .sh-badge { background: rgba(70,200,140,.85); border-color: rgba(255,255,255,.4); }
.sh-info { padding: 12px 16px 2px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sh-n { font: 800 16px system-ui; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .t-feature .sh-n { font-size: 21px; }
.sh-info small { color: var(--muted); font-size: 12.5px; }
.sh-act { padding: 10px 16px 16px; display: flex; flex-direction: column; gap: 4px; }
.sh-buy { width: 100%; justify-content: center; padding: 11px 16px; font-size: 15px; }
.t-feature .sh-buy { padding: 13px 16px; font-size: 16px; }
.sh-buy:disabled { opacity: .55; cursor: not-allowed; }
.sh-why { color: var(--muted); font-size: 12px; text-align: center; }
/* A boast's emblem (the loadout picker's), in the faction colour on a lit hex. */
.sh-emb { width: 96px; height: 96px; color: var(--c); filter: drop-shadow(0 0 14px color-mix(in srgb, var(--c) 70%, transparent)); }
.sh-emb svg { width: 100%; height: 100%; overflow: visible; }
.sh-hex { fill: color-mix(in srgb, var(--c) 18%, #0b0d2a); stroke: currentColor; stroke-width: 1.1; }
.sh-glyph { color: #fff; } .sh-glyph use { color: color-mix(in srgb, var(--c) 40%, #fff); }
/* A coin: the site's coin painter on the tile's plate (no swatch box). */
.sh-art .si-pv.si-coin { width: auto; height: auto; background: none; border-radius: 0; }
/* In a widget (the Store and Packs widgets): the same tiles, smaller. */
.sh-grid.compact, .sh-items.compact { gap: 10px; }
.sh-grid.compact { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sh-grid.compact .sh-t.t-tall, .sh-grid.compact .sh-t.t-feature { min-height: 0; }
.compact .sh-t { border-radius: 16px; }
.compact .sh-art { min-height: 0; height: 112px; flex: none; }
.compact .sh-info { padding: 7px 10px 0; } .compact .sh-n { font-size: 13.5px; } .compact .t-feature .sh-n { font-size: 15px; } .compact .sh-info small { font-size: 11.5px; }
.compact .sh-act { padding: 6px 10px 10px; } .compact .sh-buy { padding: 7px 10px; font-size: 13px; } .compact .sh-why { font-size: 11px; }
.sh-items.compact .sh-info { padding: 5px 10px 0; } .sh-items.compact .sh-act { padding: 5px 10px 8px; } .sh-items.compact .sh-buy { padding: 5px 10px; }
.compact .sh-price { right: 8px; bottom: 8px; font-size: 13px; padding: 3px 9px 3px 5px; } .compact .sh-price .coin { width: 14px; height: 14px; }
.compact .sh-price.free { font-size: 11px; padding: 3px 9px; }
.compact .sh-badge { left: 8px; top: 8px; font-size: 9px; padding: 3px 7px; }
.compact .sh-emb { width: 64px; height: 64px; }
.compact .sp-n { font-size: 15px; padding: 4px 7px; border-radius: 9px; }
.sh-items.compact { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.sh-items.compact .sh-art { height: 60px; min-height: 0; } .sh-items.compact .sh-emb { width: 44px; height: 44px; }
.sh-grid.compact .sh-t.t-tall .sh-art, .sh-grid.compact .sh-t.t-feature .sh-art { height: 100px; }
/* The store widget's rows. */
.shw { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.shw-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.shw-head .sh-bal, .shw-head .sh-reset { height: 32px; font-size: 12.5px; padding: 0 12px 0 9px; box-shadow: none; }
.shw-head .sh-bal b, .shw-head .sh-clock { font-size: 14px; }
.shw h4 { margin: 4px 0 0; }
/* The Store widget at S: the free pack, claim and the clock. */
.shw-s { display: flex; align-items: center; gap: 12px; min-width: 0; }
.shw-s .dn { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.shw-s .sh-reset { height: auto; padding: 0; background: none; border: 0; box-shadow: none; font-size: 12px; backdrop-filter: none; -webkit-backdrop-filter: none; }
.shw-s .sh-clock { font-size: 13px; }
/* The Packs widget: the pack and its count, the pity counters as chips. */
.pkw { display: flex; gap: 14px; align-items: center; min-width: 0; }
.pkw .dn { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pkw-n { font: 800 30px/1 ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .pkw-n small { font: 600 13px system-ui; color: var(--muted); margin-left: 4px; }
.pity { display: flex; gap: 6px; flex-wrap: wrap; }
.pity span { display: inline-flex; align-items: baseline; gap: 4px; padding: 4px 9px; border-radius: 99px; background: var(--soft); box-shadow: var(--soft-edge); font-size: 12px; }
.pity b { font: 800 14px ui-rounded, system-ui; font-variant-numeric: tabular-nums; }
.pity span.sure { background: linear-gradient(135deg, #ffe08a, #f6c445); color: #1a1205; }
.pkw-pile { position: relative; flex: none; }
.pkw-back { position: absolute; left: 0; top: 0; transform: translate(14%, -4%) rotate(7deg); filter: brightness(.66); }
.pkw-front { position: relative; z-index: 1; }
.pkw-pile { margin-right: 12px; }
.pkw-pile.none { opacity: .55; filter: saturate(.5); }
.pkw-c { position: absolute; right: -8px; top: -8px; z-index: 2; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 99px; display: grid; place-items: center; font: 800 13px ui-rounded, system-ui; color: #fff; background: linear-gradient(135deg, #4f6bff, #8b5cff); box-shadow: 0 3px 10px rgba(80,60,255,.45); }
.wsplit > .pkw { align-self: start; }
.pkw-pulls { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
@media (max-width: 1100px) { .sh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .sh-t.t-feature { grid-column: span 2; } .sh-t.t-tall { min-height: 340px; } }
@media (max-width: 560px) { .sh-reset small { display: none; } .sh-head .sp + .muted { flex-basis: 100%; } .sh-grid { grid-template-columns: minmax(0, 1fr); } .sh-t.t-feature { grid-column: span 1; } .sh-t.t-tall, .sh-t.t-feature { min-height: 330px; } .sh-items { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
@media (prefers-reduced-motion: reduce) { .spk-foil, .sh-t.t-feature .sh-art .spk { animation: none; } .sh-t, .sh-t .spk, .sh-t .spile { transition: none; } .sh-t:hover, .sh-t:hover .spk, .sh-t:hover .spile { transform: none; } }
@media (prefers-reduced-transparency: reduce) { .sh-t, .sh-bal, .sh-reset, .sh-price { backdrop-filter: none; -webkit-backdrop-filter: none; } .sh-t, .sh-bal, .sh-reset { background: var(--solid); } }
`;
