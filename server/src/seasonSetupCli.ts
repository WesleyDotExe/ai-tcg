import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction } from "@ai-tcg/engine";
import { acquireSeasonLock, exitOnStopSignals } from "./seasonLock.js";
import { SETUP_FACTIONS, setUpSeason } from "./seasonSetup.js";
import { sydney } from "./seasonFile.js";
import { stampConsole } from "./logTime.js";

// A new season file with the owner's account and the house in it (session
// 93; seasonSetup.ts says what it puts there). The first step of the Mac mini
// guide (progress/mac-mini-guide.md):
//   npm run season:setup -w server -- <new season file> --name "<shown name>" --login <username> --faction <Cortex|Swarm|Aegis|Null> [--agent "<agent name>"] [--email <address>] [--ends <time> | --ends none]
// (session 94) --ends sets when the server ends the season (an ISO time, e.g.
// 2026-12-26T13:00:00Z); left out, it is the owner's time for the season
// (Season 0: 00:00 27 Dec 2026 Sydney); "none" sets no end time.
// It asks for the password twice (hidden). Piped in (not a terminal), it
// reads one line from standard input instead. It refuses a file that exists.
// Then: npm run season -w server -- <the same file>
stampConsole();
const USAGE =
  'usage: npm run season:setup -w server -- <new season file> --name "<shown name>" --login <username> --faction <Cortex|Swarm|Aegis|Null> [--agent "<agent name>"] [--email <address>] [--ends <time> | --ends none]';
const argv = process.argv.slice(2);
const opts: Record<string, string> = {};
const rest: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const value = argv[i + 1];
    if (!["name", "login", "faction", "agent", "email", "ends"].includes(key) || value === undefined || value.startsWith("--")) {
      console.error(`[setup] ${value === undefined || value.startsWith("--") ? `--${key} needs a value` : `unknown option "${a}"`}\n${USAGE}`);
      process.exit(1);
    }
    opts[key] = value;
    i++;
  } else rest.push(a);
}
const file = rest[0];
if (!file || rest.length > 1 || !opts.name || !opts.login || !opts.faction) {
  console.error(USAGE);
  process.exit(1);
}
const faction = SETUP_FACTIONS.find((f) => f.toLowerCase() === opts.faction!.toLowerCase());
if (!faction) {
  console.error(`[setup] not made: a starting faction is one of ${SETUP_FACTIONS.join(", ")}, got "${opts.faction}"`);
  process.exit(1);
}
if (existsSync(file)) {
  console.error(`[setup] not made: "${file}" already exists. Setup only makes a new season file; start the server on it with: npm run season -w server -- ${file}`);
  process.exit(1);
}

/** One hidden line from the terminal, or one line from a pipe. */
function readSecret(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      let buf = "";
      stdin.setEncoding("utf8");
      const onData = (d: string) => {
        buf += d;
        const i = buf.indexOf("\n");
        if (i >= 0) {
          stdin.off("data", onData);
          stdin.pause();
          resolve(buf.slice(0, i).replace(/\r$/, ""));
        }
      };
      stdin.on("data", onData);
      stdin.once("end", () => resolve(buf.replace(/\r?\n$/, "")));
    });
  }
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let s = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\u0003") process.exit(130);
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(s);
        }
        if (c === "\u007f" || c === "\b") s = s.slice(0, -1);
        else s += c;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await readSecret("Password for the website (at least 12 characters): ");
if (process.stdin.isTTY) {
  const again = await readSecret("The same password again: ");
  if (again !== password) {
    console.error("[setup] not made: the two passwords differ");
    process.exit(1);
  }
}

// The season file's folder is made if it isn't there yet.
mkdirSync(dirname(file), { recursive: true });
// Nothing can be running on a file that doesn't exist yet, but the lock is
// taken all the same, so a server started on it mid-setup is refused.
const lock = acquireSeasonLock(file, "npm run season:setup");
if ("problem" in lock) {
  console.error(`[setup] not made: ${lock.problem}`);
  process.exit(1);
}
exitOnStopSignals();
let store: EconomyStore | null = null;
try {
  store = EconomyStore.open(file);
  const r = setUpSeason(store, { name: opts.name, username: opts.login, password, email: opts.email ?? null, faction: faction as DeckFaction, ...(opts.agent ? { agentName: opts.agent } : {}), ...(opts.ends ? { endsAt: opts.ends === "none" ? null : opts.ends } : {}) });
  console.log(`[setup] season ${store.season} file made: ${file}`);
  console.log(`[setup] your account: ${opts.name}, sign in as "${opts.login}" (the admin); ${faction} starter deck and packs; your agent ${r.agentName} (signature card ${r.signatureCard}), connected, auto-play off`);
  console.log(`[setup] the house: ${r.house.map((h) => `${h.name} (${h.agent}, ${h.faction})`).join(", ")}`);
  console.log(
    r.endsAt === null
      ? "[setup] no end time set: the season ends only by the admin's end call"
      : `[setup] the season ends at ${r.endsAt} (${sydney(r.endsAt)} Sydney): the server stops pairing then, lets the matches on screen finish and ends it`,
  );
  console.log(`[setup] next: npm run season -w server -- ${file}`);
  store.close();
} catch (err) {
  // Nothing half-made is left behind: the file goes, so the next try starts clean.
  try {
    store?.close();
  } catch {}
  for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
  console.error(`[setup] not made: ${(err as Error).message}`);
  process.exit(1);
}
