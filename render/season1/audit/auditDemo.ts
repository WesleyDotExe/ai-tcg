// Season 1 Home tile audit (render session 82): the Season 0 site demo with
// the ladder playing, plus a brand-new owner beside Nova, so the audit sees
// every Season 0 tile as an experienced owner (Nova) and as a new player
// (Wren: just through sign-up, a starter, one agent connected, no match yet).
// It reads Season 0's demo as a fixed upstream and changes nothing in it.
//
//   npx tsx season1/audit/auditDemo.ts [--speed 8]     (in render/)

import { startSiteDemo, DEMO_PASSWORD } from "../../src/site/siteDemo.js";

export const NEW_LOGIN = "wren";

const sp = process.argv.indexOf("--speed");
const demo = await startSiteDemo({ port: 0, ladder: true, speed: sp >= 0 ? Number(process.argv[sp + 1]) : 8 });
// The new player, made with the same store calls sign-up and the first-time
// page make (an account, a starter, one agent, connected). Auto-play stays
// off, as a new account's does, so Wren never plays during the audit.
const wren = demo.store.createAccount({ name: "Wren", username: NEW_LOGIN, password: DEMO_PASSWORD });
demo.store.grantStarterCollection(wren.ownerId, "Swarm");
const agent = demo.store.createAgent({ ownerId: wren.ownerId, name: "Moth Lantern" });
demo.store.connectAgent(wren.ownerId, agent.agentId);
console.log(`[audit-demo] ${demo.url}`);
const stop = async () => {
  await demo.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
