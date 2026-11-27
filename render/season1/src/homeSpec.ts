// The Season 1 Home tiles, as data (render session 82; owner 2026-11-22, plan
// item 18 step 1: "a tile audit and spec: for every tile, the one question it
// answers, what it shows at S / M / L, what a new player sees, its next
// action; merge the duplicates").
//
// Pure: no DOM. The readable spec is season1/HOME_TILES.md; the audit it rests
// on is progress/render/evidence/season1-home-audit-s82/ (the real Season 0
// Home read in a browser, season1/audit/home-audit.mjs). The tests
// (season1/test/homeSpec.test.ts) hold the spec to its own rules:
//   - every Season 0 widget goes somewhere (no tile silently dropped);
//   - every fact has exactly one home tile, and no tile shows another's fact
//     (the owner's "the rating shows in three tiles");
//   - a tile only grows with its size: what S shows, M shows, and L too
//     (owner point 12), and S keeps to at most three facts;
//   - every tile has its question, a new player's view at each size and a next
//     action at each size;
//   - every fact the audit found in two or more tiles has one home here.
// Phase 2 builds the S / M / L framework from this file, so a change of mind
// is made here, and the tests say what it breaks.
//
// Fenced off like the arena: nothing outside render/season1/ imports it.

/** The Season 0 widget types (render/src/site/siteBoard.ts WidgetType),
 * restated so this file imports nothing from Season 0. A test checks the two
 * lists agree. */
export const S0_WIDGETS = ["agent", "live", "watch", "packs", "daily", "collection", "showcase", "ladder", "form", "history", "notif", "store"] as const;
export type S0Widget = (typeof S0_WIDGETS)[number];

/** One thing a tile can show. Each has exactly one home tile. */
export const FACTS = {
  // The agent tile.
  agentName: "your agent's name and picture",
  agentStatus: "what your agent is doing now (playing / ready / stopped / out of time)",
  startStop: "Start / Stop",
  todayRecord: "today's wins and losses",
  personality: "its personality (play style)",
  playTime: "how long it may still play, and adding time",
  deck: "the deck it plays",
  // The ladder tile (Ladder + Rating & form).
  rating: "your rating",
  tier: "your tier",
  rank: "your place on the ladder (#n of N)",
  climb: "the next step up: placement progress (n of 5) until placed, then how far to the next tier",
  ratingSettled: "how settled the rating is (Season 0's ±)",
  weekChange: "the rating's change this week",
  form: "the last results as W/L dots",
  streak: "the current and best streak",
  trend: "the rating chart with the tier floors",
  standings: "the top of the ladder, and where you sit in it",
  factionWinRate: "win rate by deck faction",
  // Watch live.
  liveMatch: "the featured live match (players, health, turn)",
  liveArena: "the arena itself, playing (9:16 at M and L)",
  alsoLive: "the other live matches",
  playByPlay: "the play-by-play of the featured match",
  // Packs.
  unopened: "packs you have and haven't opened, and Open a pack",
  guarantee: "how soon a Full Art and a Mythic are guaranteed",
  lastPulls: "the cards from your last packs",
  // Store.
  credits: "credits to spend",
  affordable: "how many of the things for sale the credits buy",
  buyPacks: "packs for sale, as pictures with prices (M: the featured pack; L: every pack in one row)",
  cosmetics: "cosmetics for sale, as pictures with prices (M: 2-3 featured; L: the full shelf, grouped by type)",
  // Collection.
  completion: "set completion (held of total, %)",
  chase: "Secrets and Prototypes found",
  bestCards: "your best cards, drawn large",
  binder: "the binder by faction",
  // Daily rewards.
  earnedToday: "credits earned from wins today, of the day's most",
  nextWinPays: "what the next win pays",
  winSchedule: "the day's win-by-win pay",
  dayReset: "when the day resets",
  freePack: "the free daily pack: Claim it, or when the next one comes",
  // Match history.
  lastResult: "the last match's result",
  recentMatches: "recent matches with credits and rating change",
  replays: "replays and logs",
  // Notifications.
  unread: "unread alerts",
  alerts: "the alerts themselves, newest first",
  alertKinds: "alerts by kind",
  // Music (waiting on the owner's spec approval).
  nowPlaying: "the track playing",
  musicSlots: "the 5 save slots",
  musicMaker: "the drum machine / loop creator",
} as const;
export type Fact = keyof typeof FACTS;

export type Size = "S" | "M" | "L";

export interface TileSpec {
  id: string;
  name: string;
  /** The Season 0 widgets this tile takes over. */
  replaces: S0Widget[];
  /** The one question the tile answers, in an owner's words. */
  question: string;
  /** What each size shows. S ⊆ M ⊆ L (the tests check). */
  sizes: Record<Size, Fact[]>;
  /** What a brand-new player sees (just signed up, no match yet). */
  newPlayer: Record<Size, string>;
  /** The one thing the tile asks you to do next, at each size. */
  next: Record<Size, string>;
  /** The page its open arrow goes to (Season 0's page ids). */
  opens: string;
  /** Decided by the owner's notes, or waiting on the owner (never guessed). */
  status: "decided" | "waiting on owner";
  /** Why, in one line, when it is not obvious. */
  note?: string;
}

export const TILES: TileSpec[] = [
  {
    id: "agent",
    name: "My agent",
    replaces: ["agent", "live"],
    question: "Is my agent playing right now, and how do I steer it?",
    sizes: {
      S: ["agentName", "agentStatus", "startStop"],
      M: ["agentName", "agentStatus", "startStop", "todayRecord", "personality", "playTime"],
      L: ["agentName", "agentStatus", "startStop", "todayRecord", "personality", "playTime", "deck"],
    },
    newPlayer: {
      S: "Moth Lantern · Ready. [Start]",
      M: "Ready, not playing yet. Press Start and it joins the ladder's next round; it plays until you stop it or its time runs out.",
      L: "As M, with the personality dial explained in one line each and the deck: \"Your agent builds its own deck from your cards\".",
    },
    next: { S: "Start / Stop", M: "Start / Stop (then: give it time)", L: "Start / Stop, change personality, pick a deck" },
    opens: "match",
    status: "decided",
    note: "Owner phase 2: \"the agent tile (My agent + Agent controls)\". Rating moves to Ladder; the agent's name is shown here only.",
  },
  {
    id: "ladder",
    name: "Ladder",
    replaces: ["ladder", "form"],
    question: "How good is my agent, and is it getting better?",
    sizes: {
      S: ["rating", "tier", "rank"],
      M: ["rating", "tier", "rank", "climb", "weekChange", "form"],
      L: ["rating", "tier", "rank", "climb", "weekChange", "ratingSettled", "form", "streak", "standings", "trend", "factionWinRate"],
    },
    newPlayer: {
      S: "Unrated · 0 of 5 placement matches",
      M: "Unrated, in placement. 0 of 5 placement matches: your agent gets a rating after its first 5. (No empty chart, no \"±350\".)",
      L: "As M, the ladder's top as it stands, and the tiers drawn as a scale with the ranked agents on it, so the new player sees where the ratings sit.",
    },
    next: { S: "Open Stats", M: "Open Stats", L: "Open Stats" },
    opens: "stats",
    status: "decided",
    note: "Owner phase 2: \"the Ladder tile (Rating & form merged in)\". The one place for the rating, tier, rank and form. Render 89 merged placement + next tier into one bar (climb: only one of them is ever true) and around you + top of the ladder into one list (standings: with few ranked agents they were the same rows twice).",
  },
  {
    id: "watch",
    name: "Watch live",
    replaces: ["watch"],
    question: "What is playing right now, and can I watch it?",
    sizes: {
      S: ["liveMatch"],
      M: ["liveMatch", "liveArena"],
      L: ["liveMatch", "liveArena", "alsoLive", "playByPlay"],
    },
    newPlayer: {
      S: "The featured match's two names, health and turn (the same for everyone).",
      M: "The arena playing, 9:16. Under it: \"Your agent's matches show here once you press Start.\"",
      L: "As M, with the other live matches and the play-by-play.",
    },
    next: { S: "Watch", M: "Full screen", L: "Full screen / switch match" },
    opens: "live",
    status: "decided",
    note: "Owner point 13: the actual arena in 9:16 at M and L, basic info at S. Phase 1 step 5 prototypes it. Players' ratings stay on Ladder; the match shows names, factions and health.",
  },
  {
    id: "packs",
    name: "Packs",
    replaces: ["packs"],
    question: "Do I have packs to open?",
    sizes: {
      S: ["unopened"],
      M: ["unopened", "guarantee"],
      L: ["unopened", "guarantee", "lastPulls"],
    },
    newPlayer: {
      S: "3 packs waiting · [Open a pack]",
      M: "\"3 packs waiting. Open them to add cards your agent can use.\"",
      L: "As M; the last-pulls strip reads \"Your pulls appear here after your first pack.\"",
    },
    next: { S: "Open a pack", M: "Open a pack", L: "Open a pack" },
    opens: "store",
    status: "decided",
    note: "Owner 2026-11-22 (replaces render 82 call 2): Packs keeps only the packs you have and haven't opened. Each pack action has one home: claim in Daily rewards, open in Packs, buy in Store.",
  },
  {
    id: "store",
    name: "Store",
    replaces: ["store"],
    question: "What can I spend my credits on?",
    sizes: {
      S: ["credits", "affordable"],
      M: ["credits", "affordable", "buyPacks", "cosmetics"],
      L: ["credits", "affordable", "buyPacks", "cosmetics"],
    },
    newPlayer: {
      S: "0 credits · \"Your agent earns credits by winning.\"",
      M: "The featured pack and 2-3 cosmetics as pictures with prices; Buy disabled with \"Win matches to earn credits\" (not \"100 credits short\").",
      L: "As M, the full shelf: packs in one row, cosmetics grouped by type.",
    },
    next: { S: "Buy", M: "Buy", L: "Buy" },
    opens: "store",
    status: "decided",
    note: "Owner 2026-11-22: a visual shop window for what's for sale (packs and cosmetics, pictures with prices, Buy). S: credits and how many things they buy; M: a featured pack and 2-3 featured cosmetics; L: the full shelf. The cosmetics readability rule still holds.",
  },
  {
    id: "collection",
    name: "Collection",
    replaces: ["collection", "showcase"],
    question: "What cards do I have, and what's new?",
    sizes: {
      S: ["completion"],
      M: ["completion", "chase", "bestCards"],
      L: ["completion", "chase", "bestCards", "binder"],
    },
    newPlayer: {
      S: "20 of 124 · your starter",
      M: "\"20 of 124: your starter deck. 3 packs are waiting in Packs.\" with the starter's best three cards.",
      L: "As M, and the binder of the starter.",
    },
    next: { S: "Open Collection", M: "Open Collection (or Open packs, when packs wait and none were opened)", L: "Filter the binder" },
    opens: "collection",
    status: "decided",
    note: "Owner observation 17: \"No packs opened yet\" next to 3 waiting packs. Showcase folds in as the M/L best cards; last pulls live in Packs.",
  },
  {
    id: "daily",
    name: "Daily rewards",
    replaces: ["daily"],
    question: "How much has my agent earned today, and how much is left?",
    sizes: {
      S: ["earnedToday", "nextWinPays", "freePack"],
      M: ["earnedToday", "nextWinPays", "freePack", "winSchedule", "dayReset"],
      L: ["earnedToday", "nextWinPays", "freePack", "winSchedule", "dayReset"],
    },
    newPlayer: {
      S: "0 of 90 today · first win pays 30 · free pack ready [Claim free pack]",
      M: "\"Wins pay credits, the first win most. Up to 90 a day; resets at midnight Sydney.\", the win-by-win pay and the free daily pack.",
      L: "As M.",
    },
    next: { S: "Claim free pack (when one waits), else Open Stats", M: "Claim free pack, else Open Stats", L: "Claim free pack, else Open Stats" },
    opens: "stats",
    status: "decided",
    note: "Owner 2026-11-22 (replaces render 82 call 2): the free daily pack is claimed here (\"Claim free pack\"); a claimed pack lands in Packs. Owner phase 2 groups \"Collection and Daily rewards\" for the build, not as one tile.",
  },
  {
    id: "history",
    name: "Match history",
    replaces: ["history"],
    question: "How did my agent's last matches go?",
    sizes: {
      S: ["lastResult"],
      M: ["lastResult", "recentMatches"],
      L: ["lastResult", "recentMatches", "replays"],
    },
    newPlayer: {
      S: "No matches yet",
      M: "\"No matches yet. Press Start on My agent; results and replays show here.\"",
      L: "As M.",
    },
    next: { S: "Open the last match", M: "Replay", L: "Replay / All matches" },
    opens: "match",
    status: "decided",
    note: "Season 0's M lists 6 and overflows by 423 px (audit); the spec's M is the last 3.",
  },
  {
    id: "notif",
    name: "Notifications",
    replaces: ["notif"],
    question: "What happened while I was away?",
    sizes: {
      S: ["unread"],
      M: ["unread", "alerts"],
      L: ["unread", "alerts", "alertKinds"],
    },
    newPlayer: {
      S: "1 new",
      M: "The one alert (\"Your free daily pack is waiting\"), with its link going to Daily rewards.",
      L: "As M.",
    },
    next: { S: "Open the latest", M: "Open an alert / Mark all read", L: "Filter by kind" },
    opens: "bell",
    status: "decided",
    note: "Alerts link to the tile or page that owns the thing (a result to Match history, the free pack to Daily rewards); they don't repeat the agent's name when the owner has one agent.",
  },
  {
    id: "music",
    name: "Music",
    replaces: [],
    question: "What's playing, and can I make my own?",
    sizes: {
      S: ["nowPlaying"],
      M: ["nowPlaying", "musicSlots"],
      L: ["nowPlaying", "musicSlots", "musicMaker"],
    },
    newPlayer: {
      S: "Waiting on the music spec (phase 1 step 6).",
      M: "Waiting on the music spec (phase 1 step 6).",
      L: "Waiting on the music spec (phase 1 step 6).",
    },
    next: { S: "Play / pause", M: "Pick a slot", L: "Make a loop" },
    opens: "music",
    status: "waiting on owner",
    note: "Owner point 14 and plan item 24: spec first, built only after the owner approves it. The S / M / L split here is a placeholder for that spec.",
  },
];

/** The Season 0 labels the audit found unclear (owner observation 17 and the
 * audit's own), and what the spec writes instead. The facts behind each are
 * the server's (named), so none of these is a guess at a rule. */
export const LABELS: { tile: string; was: string; becomes: string; why: string }[] = [
  { tile: "ladder", was: "±109 (next to the rating)", becomes: "\"Settling\" while the rating can still move a lot, \"Settled\" after; the number only in the tile's explainer", why: "± is the rating's uncertainty (Glicko RD, `rating.rd`), and Rating & form's \"±0 this week\" uses the same sign for a change: two meanings side by side." },
  { tile: "ladder", was: "±0 this week", becomes: "\"No change this week\" / \"+42 this week\"", why: "the same sign as the uncertainty." },
  { tile: "packs", was: "0 since a Full Art · 0 since a Mythic", becomes: "\"Full Art guaranteed within 10 packs · Mythic within 40\" (counting down)", why: "the counts are pity timers: a Full Art or better is guaranteed after 10 packs without one, a Mythic after 40 (`economy/src/config.ts`, `pity: { fullArtAfter: 10, mythicAfter: 40 }`). \"0 since\" reads as nothing." },
  { tile: "packs", was: "Open 10 needs 10 waiting.", becomes: "waiting on owner (Open 10 calls 1–2 are not decided, owner point 25)", why: "the spec doesn't change Open 10 until the owner decides it." },
  { tile: "collection", was: "No packs opened yet (with 3 packs waiting)", becomes: "\"3 packs are waiting: open them to add cards\" with Open", why: "owner observation 17." },
  { tile: "store", was: "100 credits short", becomes: "\"Win matches to earn credits\" when the balance is 0; \"100 more credits\" otherwise", why: "\"short\" is store-speak; a new player has 0 and doesn't know how credits come." },
  { tile: "shell", was: "the ◆ 65 pill in the top bar", becomes: "named: \"65 pack points\"", why: "the audit's still shows an unlabelled diamond and number next to the credits (it is pack points); its label is only in the accessible name." },
  { tile: "ladder", was: "Placement · 0 rated matches ±350", becomes: "\"0 of 5 placement matches\"", why: "a new player meets two jargon terms and an uncertainty in one line." },
];

/** Where the audit's "same fact in several tiles" names land in FACTS (the
 * audit's names are in home-audit.mjs's factsOf). */
export const AUDIT_FACTS: Record<string, Fact[]> = {
  "agent name": ["agentName"],
  rating: ["rating"],
  "rating uncertainty (±)": ["ratingSettled"],
  streak: ["streak"],
  "win/loss record": ["todayRecord", "form", "recentMatches"],
  "tier name": ["tier"],
  "auto-play on/off": ["agentStatus"],
  "unopened packs": ["unopened"],
  "set completion": ["completion"],
  credits: ["credits"],
  "credits from wins today": ["earnedToday"],
  "rank (#n)": ["rank"],
};

/** The tile that shows a fact, at its fullest. */
export function homeOf(fact: Fact): TileSpec[] {
  return TILES.filter((t) => t.sizes.L.includes(fact));
}
