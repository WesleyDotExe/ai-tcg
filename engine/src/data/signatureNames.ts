// Signature card names (owner 2026-10-15: "names must make sense and stay on
// theme"). Built session 35.
//
// The game's theme is cyberpunk with 1990s retro-futurism; the owner's
// example is "Zion's Midnight DDoS". A name is built from a template with
// grammatical slots, never words strung together at random, so every result
// reads as a name:
//
//   [Handle]'s [Modifier] [Thing]     Zion's Midnight DDoS        41%
//   [Handle]'s [Thing]                Glitchmoth's Paywall        20%
//   [Thing] of the [Place]            Honeypot of the Dead Mall   30%
//   [Modifier] [Thing]                Ultraviolet Firewall         5%
//   [Modifier] [Thing] [Edition]      Dial-Up Rollback 2000        4%
//
// The weights are the owner's (2026-10-16): the "[Handle]'s" patterns about
// 60%, "of the [Place]" about 30%, and the bare two-word and edition names
// 10% or less, since those read weakest.
//
// Each word list is tagged by its slot. Handles are hacker handles: a short
// hand-written list, plus compounds of a tech prefix and a creature-or-role
// suffix ("Bytewolf", "Hexmoth"), which gives the slot thousands of
// options. The Thing leans toward the card's ability (an attack card can be
// a "DDoS", a defensive one a "Firewall"); now and then it is a generic
// retro-tech object instead.
//
// The filter (namingProblem) refuses a name that repeats a word across
// slots ("Static Static Burst"), runs too long for the card frame, or
// contains a blocked word, and the generator re-rolls. Names never repeat:
// a taken name is re-rolled too.
//
// Rarely, the handle is the owner's own username ("[username]'s Midnight
// DDoS"): 1 candidate in USERNAME_HANDLE_ODDS (owner 2026-10-16: 1 in 100),
// only when the username passes the same filter.
//
// Agent names share the generator (owner 2026-10-16: the same themed
// treatment, hacker-handle style, and the same favoured patterns):
//
//   [Handle]'s [Modifier] [Program]   Ghostlynx's Midnight Oracle 41%
//   [Handle]'s [Program]              Bytewolf's Daemon           20%
//   [Handle] of the [Place]           Hexmoth of the Undernet     30%
//   [Modifier] [Handle]               Midnight Glitchmoth          5%
//   [Handle] [Edition]                Phreakhawk 2000              4%
//
// A Program is what an AI agent is, in the theme's words: a daemon, a
// ghost, a copilot, a construct.
//
// All lists are original. No handle, place or product here is a character,
// location or trademark from an existing work.

import type { Rng } from "../state/rng.js";

/** One candidate in this many puts the owner's username in the handle
 * slot (owner 2026-10-16, option C: a real rarity, about one draft in 33). */
export const USERNAME_HANDLE_ODDS = 100;
/** Longest name the card frame takes. */
export const MAX_NAME_LENGTH = 30;
/** Longest agent name, generated or typed by its owner. The owner's
 * proposed 24 is raised a little for the three-part generated names (owner
 * 2026-10-16: "if three-part names need it, raise the cap a little"). */
export const AGENT_NAME_MAX_LENGTH = 32;
/** Numerals added to a generated agent name that clashes (owner 2026-10-16:
 * "add a numeral instead of failing"). */
const CLASH_NUMERALS = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** How often the Thing is a generic retro-tech object rather than one that
 * hints at the ability. */
const GENERIC_THING_SHARE = 0.2;

// ---- the blocked-word filter ----

// Roots of slurs, profanity and hate references, matched on the letters of
// a whole token (so "Analog" is not caught by a short root inside it).
// Kept short and blunt on purpose: every curated list here is hand-checked,
// so this mainly guards compound handles and owners' usernames.
const BLOCKED_ROOTS = [
  "fuck", "shit", "cunt", "dick", "cock", "piss", "slut", "whore", "bitch", "bastard",
  "nazi", "hitler", "rape", "rapist", "nigg", "fag", "kike", "spic", "chink", "tranny",
  "retard", "porn", "penis", "vagina", "boob", "tits", "anus", "jizz", "cum", "sex",
  "kkk", "isis", "jihad", "terror", "suicide", "kill yourself", "kys",
];
/** Short roots that are blocked only as a whole token (they sit inside
 * ordinary words: "Cumulus", "Sussex", "Grapevine"). */
const WHOLE_TOKEN_ONLY = new Set(["cum", "sex", "kys", "isis", "anus", "spic", "fag", "tits", "boob", "rape"]);

/** The blocked root `text` contains, if any (exported for the server's
 * custom agent-name check, which uses the same list). */
export function blockedWordIn(text: string): string | undefined {
  const lower = text.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  const squashed = tokens.join("");
  for (const root of BLOCKED_ROOTS) {
    if (root.includes(" ")) {
      if (lower.includes(root)) return root;
    } else if (WHOLE_TOKEN_ONLY.has(root)) {
      if (tokens.includes(root)) return root;
    } else if (squashed.includes(root)) {
      return root;
    }
  }
  return undefined;
}

// ---- slot: handle ----

const HANDLES_PLAIN = [
  "Zion", "Kilobyte", "Lowkey", "Patchwork", "Sysop", "Driftnet", "Halflife", "Wirehead", "Overflow", "Payphone",
  "Lazarus", "Mainline", "Backspace", "Daybreak", "Moonlight", "Redline", "Shortwave", "Skylark", "Sleetstorm", "Switchblade",
  "Tinfoil", "Underscore", "Voltage", "Wildcard", "Keystroke", "Ratchet", "Sidecar", "Silverline", "Starling", "Juniper",
  "Marlowe", "Farad", "Quasar", "Orbit", "Kodiak", "Domino", "Gemini", "Halcyon", "Indigo", "Jericho",
  "Mercury", "Nimbus", "Paladin", "Rhapsody", "Saffron", "Tango", "Vandal", "Whisper", "Xenon", "Yonder",
  "Cobalt", "Diesel", "Fresco", "Gizmo", "Hotwire", "Lockpick", "Mixtape", "Nightjar", "Outlaw", "Pinball",
];
// Session 37 (owner 2026-10-16, "more room for generated agent names"):
// both lists about doubled, to ~100 x ~100, so the handle slot holds about
// 10,000 handles after the filter.
const HANDLE_PREFIX = [
  "Byte", "Bit", "Glitch", "Static", "Null", "Hex", "Chrome", "Neon", "Volt", "Pixel",
  "Echo", "Cipher", "Vector", "Flux", "Ghost", "Proxy", "Krypto", "Zero", "Data", "Phreak",
  "Laser", "Turbo", "Synth", "Wire", "Code", "Root", "Kernel", "Packet", "Signal", "Modem",
  "Dial", "Sector", "Cyber", "Holo", "Retro", "Mono", "Quartz", "Ion", "Nova", "Strobe",
  "Fuse", "Circuit", "Logic", "Ping", "Raster", "Vapor", "Tape", "Disk", "Grid", "Bios",
  "Chip", "Rom", "Baud", "Pulse", "Spark", "Arc", "Coil", "Diode", "Relay", "Servo",
  "Sonic", "Astro", "Photon", "Plasma", "Rust", "Steel", "Iron", "Copper", "Onyx", "Jade",
  "Crimson", "Shadow", "Night", "Dusk", "Storm", "Frost", "Smoke", "Cinder", "Blaze", "Torrent",
  "Stream", "Cache", "Stack", "Heap", "Shell", "Macro", "Pager", "Arcade", "Floppy", "Giga",
  "Tera", "Nano", "Micro", "Omni", "Hyper", "Delta", "Sigma", "Omega", "Lambda", "Fiber",
];
const HANDLE_SUFFIX = [
  "wolf", "fox", "crow", "kid", "jack", "rat", "wraith", "punk", "monk", "viper",
  "hawk", "moth", "cat", "runner", "rider", "smith", "witch", "king", "queen", "droid",
  "bot", "mancer", "slinger", "breaker", "burner", "spider", "shark", "mantis", "lynx", "raven",
  "cobra", "jinx", "drifter", "hound", "owl", "bandit", "pilot", "saint", "nomad", "widow",
  "fang", "claw", "bear", "boar", "stag", "newt", "toad", "frog", "bat", "wasp",
  "hornet", "beetle", "scarab", "gecko", "jackal", "coyote", "dingo", "ferret", "otter", "mink",
  "weasel", "badger", "heron", "crane", "falcon", "kestrel", "osprey", "condor", "magpie", "finch",
  "wren", "sparrow", "swift", "gull", "python", "adder", "mamba", "krait", "gator", "squid",
  "kraken", "orca", "manta", "pike", "tiger", "panther", "puma", "jaguar", "ocelot", "hare",
  "golem", "imp", "sprite", "scout", "ranger", "hunter", "warden", "keeper", "sentry", "ronin",
  "pirate", "corsair", "outlaw", "courier", "broker", "fixer", "medic", "doc", "prophet", "sage",
];

// ---- slot: modifier (time of night, neon, retro tech) ----

const MODIFIERS = [
  // time of night
  "Midnight", "After-Hours", "Graveyard", "Twilight", "Moonlit", "Nocturnal", "Late-Night", "Sleepless", "Insomniac", "Dawnless",
  "Small-Hours", "Blackout", "Last-Call", "Night-Shift", "Moonless",
  // neon and light
  "Neon", "Ultraviolet", "Infrared", "Chrome", "Magenta", "Cyan", "Electric", "Phosphor", "Fluorescent", "Holographic",
  "Iridescent", "Strobing", "Laser", "Black-Light", "Rain-Slick", "Smoke-Filled", "Mirrored", "Glowing", "Holo-Foil", "Pastel",
  // retro tech
  "Analog", "Dial-Up", "Turbo", "8-Bit", "16-Bit", "32-Bit", "Pixelated", "Magnetic", "Cathode", "Overclocked",
  "Encrypted", "Bootleg", "Pirated", "Shareware", "Freeware", "Unlicensed", "Hardwired", "Cordless", "Handheld", "Lo-Fi",
  "Hi-Fi", "Lo-Res", "Hi-Res", "Dot-Matrix", "Monochrome", "Glitched", "Corrupted", "Fragmented", "Compressed", "Archived",
  "Rewound", "Fast-Forward", "Widescreen", "Stereo", "Mono-Channel", "Coin-Op", "Plug-In", "Battery-Powered", "Solar", "Wireless",
  // the street and the scene
  "Black-Market", "Gray-Market", "Underground", "Basement", "Rooftop", "Back-Alley", "Downtown", "Off-World", "Orbital", "Subterranean",
  "Synthetic", "Cybernetic", "Chromed", "Silicon", "Titanium", "Carbon", "Quantum", "Atomic", "Plasma", "Supersonic",
  "Hyperdrive", "Kernel-Level", "Root-Level", "Superuser", "Unpatched", "Legacy", "Obsolete", "Vintage", "Prototype", "Experimental",
  "Beta", "Deluxe", "Limited", "Ultimate", "Mega", "Hyper", "Ultra", "Infinite", "Looping", "Recursive",
  "Jacked-In", "Offline", "Real-Time", "Dead-Air", "White-Noise", "Forgotten", "Abandoned", "Hidden", "Classified", "Redacted",
  "Off-Grid", "Blacklisted", "Stolen", "Borrowed", "Second-Hand", "Rogue", "Phantom", "Silent", "Velvet", "Cold-Boot",
  // session 37 (owner 2026-10-16: about 300 modifiers)
  // weather and the city at night
  "Rain-Soaked", "Fogbound", "Smoggy", "Thunderstruck", "Storm-Lit", "Frostbitten", "Sun-Bleached", "Overcast", "Humid", "Windswept",
  "Neon-Lit", "Streetlit", "Skyline", "Elevated", "Sub-Level", "Alleyway", "Gutter", "Highway", "Overpass", "Freeway",
  "Uptown", "Midtown", "Dockside", "Harbor", "Industrial", "Warehouse", "Concrete", "Rust-Belt", "Riverside", "Terminal",
  // colour and material
  "Crimson", "Scarlet", "Cobalt", "Emerald", "Amber", "Violet", "Teal", "Vermilion", "Obsidian", "Ivory",
  "Gilded", "Silver", "Copper", "Brass", "Lead-Lined", "Rusted", "Polished", "Brushed-Steel", "Glass", "Crystal",
  "Plastic", "Vinyl", "Neoprene", "Leather", "Denim", "Fiber-Optic", "Copper-Wired", "Gold-Plated", "Carbon-Fiber", "Ceramic",
  // retro media and games
  "VHS", "Betamax", "Laserdisc", "Cassette", "Mixtape", "Boombox", "Walkman-Era", "Arcade", "Pinball", "Joystick",
  "Two-Player", "High-Score", "Bonus-Round", "Extra-Life", "Game-Over", "Continue-Screen", "Final-Boss", "Side-Scrolling", "Split-Screen", "Cartridge",
  "Floppy", "Dial-Tone", "Busy-Signal", "Pager", "Beeper", "Answering-Machine", "Late-Show", "Prime-Time", "Rerun", "Test-Pattern",
  // the scene's mood
  "Restless", "Reckless", "Fearless", "Nameless", "Faceless", "Sleepwalking", "Daydreaming", "Wide-Awake", "Lucky", "Unlucky",
  "Wired", "Unplugged", "Plugged-In", "Logged-Out", "Backlit", "Overdriven", "Supercharged", "Turbocharged", "Unstoppable", "Untraceable",
  "Unbreakable", "Unknown", "Uncharted", "Unmarked", "Unsigned", "Undocumented", "Unindexed", "Unlisted", "Unseen", "Unsung",
  // machine states
  "Booting", "Buffering", "Compiling", "Debugging", "Rendering", "Streaming", "Syncing", "Scanning", "Uploading", "Downloading",
  "Idle", "Sleeping", "Dormant", "Awakened", "Rebooted", "Patched", "Forked", "Cloned", "Shadowed", "Backed-Up",
  "Overwritten", "Deleted", "Restored", "Recovered", "Decrypted", "Spoofed", "Rerouted", "Tunneled", "Proxied", "Sandboxed",
  "Moonstruck", "Starlit", "Smoldering", "Flickering", "Humming", "Crackling", "Buzzing", "Static-Charged", "Ghostly", "Spectral",
  "Masked", "Hooded", "Mirrorshade", "Chrome-Plated", "Low-Battery",
];

// ---- slot: thing ----

/** Things by what the card does, so the name hints at the ability. Every
 * menu option maps to one group (THING_GROUP_OF). */
const THINGS: Record<string, string[]> = {
  // "Zero-Day" left this list in session 37: it is the proposed name of the
  // season's top finish (owner 2026-10-16), and a card named for it would
  // read as one.
  strike: [
    "DDoS", "Payload", "Exploit", "Backdoor", "Logic Bomb", "Killswitch", "Ping Flood", "Rootkit", "Worm", "Spike",
    "Buffer Overflow", "Trojan", "Brute Force", "Hack", "Crash", "Kernel Panic", "Overload", "Shock", "Short Circuit", "Laser",
  ],
  wave: [
    "Packet Storm", "Shockwave", "Static Burst", "Power Surge", "EMP", "Feedback Loop", "Signal Flood", "Broadcast Storm", "Flatline", "Brownout",
    "Cascade", "Ripple", "Pulse", "Interference", "Meltdown", "Data Storm",
  ],
  guard: [
    "Firewall", "Honeypot", "Proxy", "Sandbox", "Failsafe", "Air Gap", "Blast Door", "Encryption", "Checksum", "Body Armor",
    "Faraday Cage", "Bunker", "Safe Room", "Panic Room", "Deadbolt", "Shield", "Bodyguard", "Decoy", "Stunt Double", "Lightning Rod",
  ],
  draw: [
    "Download", "Dead Drop", "Data Mule", "Courier", "Uplink", "Mailbag", "Care Package", "Warez Drop", "Torrent", "Cache",
    "Backup Tape", "Recycle Bin", "Undelete", "Salvage", "Afterimage", "Mirror Site", "Archive", "Data Heist",
  ],
  boost: [
    "Anthem", "Mixtape", "Rave", "Broadcast", "Pirate Radio", "Bulletin Board", "Pep Talk", "Hype Track", "Power Ballad", "Bass Drop",
    "Signal Fire", "Encore", "Drumline", "Upgrade", "Mentor", "Tutorial", "Cheat Code", "Level Up",
  ],
  mend: [
    "Patch", "Rollback", "Defrag", "Safe Mode", "Reboot", "Hotfix", "Restore Point", "Repair Kit", "Firmware", "Service Pack",
    "Field Medic", "Duct Tape", "Soldering Iron", "Fuse Box", "Checkpoint", "Save State",
  ],
  toll: [
    "Paywall", "Toll Booth", "Tariff", "Nag Screen", "License Key", "Paygate", "Late Fee", "Surcharge", "Cover Charge", "Meter",
    "Red Tape", "Gatekeeper", "Bouncer", "Velvet Rope", "Turnstile",
  ],
  power: [
    "Overclock", "Battery Pack", "Turbo Button", "Capacitor", "Jumpstart", "Dynamo", "Generator", "Power Cell", "Adrenaline", "Afterburner",
    "Nitro", "Fuel Cell", "Reactor", "Spark Plug", "Live Wire",
  ],
  jam: [
    "Jammer", "Freeze Frame", "Screensaver", "Lag Spike", "Pause Button", "Dial Tone", "Busy Signal", "Hold Music", "Blue Screen", "Deadlock",
    "Infinite Loop", "System Hang", "Signal Jam", "Static", "Muffler", "Fog Machine",
  ],
  hunt: [
    "Tracer", "Bloodhound", "Daemon", "Bounty Bot", "Trace Route", "Search Engine", "Spider", "Crawler", "Headhunter", "Tripwire",
    "Sniffer", "Seeker", "Predator", "Manhunt", "Night Vision",
  ],
};
const THING_GROUP_OF: Record<string, keyof typeof THINGS> = {
  smite: "strike",
  hunter: "hunt",
  sweep: "wave",
  guardian: "guard",
  bulwark: "guard",
  "shield-wall": "guard",
  recycle: "draw",
  "supply-line": "draw",
  rally: "boost",
  inspire: "boost",
  "commanders-aura": "boost",
  restore: "mend",
  tax: "toll",
  "energy-surge": "power",
  dampen: "jam",
  suppress: "jam",
};
/** Retro-tech objects that fit any card. */
const GENERIC_THINGS = [
  "Mainframe", "Cassette", "Pager", "Modem", "Terminal", "Floppy", "Joystick", "Boombox", "Beeper", "Arcade Cabinet",
  "Synth", "Transistor", "Satellite", "Switchboard", "Payphone Line", "Mixer", "Camcorder", "Calculator", "Hologram", "Antenna",
  "Circuit Board", "Motherboard", "Server Rack", "Cartridge", "Magnetic Tape", "Vacuum Tube", "Radio Tower", "Neon Sign", "Jukebox", "Pinball Machine",
  "Robot", "Android", "Cyborg", "Drone", "Ghost", "Pocket TV", "Fax Machine", "Lava Lamp", "Laser Pointer", "Mainframe Key",
];

// ---- slot: place ----

const PLACES = [
  "the Dead Mall", "the Mainframe", "the Last Arcade", "the Server Farm", "the Undernet", "the Neon District", "the Back Alley", "the Dial-Up Era",
  "the Night Market", "the Data Haven", "the Grid", "the Wire", "the Blackout", "the Basement BBS", "the Chatroom", "the Datacenter",
  "the Midnight Shift", "the Last Login", "the Rooftops", "the Underpass", "the Night Train", "the Food Court", "the Video Store", "the Pawn Shop",
  "the Rain City", "the Night Rain", "the Deep Web", "the Lost Floppy", "the Burned CD", "the Arcade Strip", "the Laser Tag Arena", "the Parking Garage",
  "the Phone Lines", "the Pirate Station", "the Signal Tower", "the Junkyard", "the Chrome Bazaar", "the Glass Tower", "the Old Network", "the Ninth Floor",
  "the Loading Screen", "the Error Log", "the Recycle Bin", "the Test Server", "the Clean Room", "the Mirror Site", "the Hologram Booth", "the Night Bus",
  "the Eleventh Sector", "the Zero Sector", "the Late Channel", "the Thirteenth Floor", "the Open Port", "the Back Room", "the Last Platform", "the Outer Grid",
];

// ---- slot: edition ----

const EDITIONS = ["2000", "3000", "'95", "'97", "'99", "XL", "Deluxe", "Pro", "Plus", "Max", "Gold", "v2", "Mk III", "SE", "Classic"];
/** Agent names never end like a version number (owner 2026-10-16: no "v2.7",
 * no "Mk III"); a Roman numeral is kept for the rare clash (agentName). */
const AGENT_EDITIONS = EDITIONS.filter((e) => !/^v\d|^Mk\b/.test(e));

// ---- templates ----

export type Template = "handleModThing" | "handleThing" | "thingOfPlace" | "modThing" | "modThingEdition";
/** Weights out of 100 (owner 2026-10-16): the [Handle]'s patterns 61, "of
 * the [Place]" 30, bare two-word and edition names 9 together (the owner
 * asked for 10% or less, so this sits under it with room for noise). */
export const TEMPLATE_WEIGHTS: readonly [Template, number][] = [
  ["handleModThing", 41],
  ["handleThing", 20],
  ["thingOfPlace", 30],
  ["modThing", 5],
  ["modThingEdition", 4],
];

export type AgentTemplate = "handleModProgram" | "handleProgram" | "handleOfPlace" | "modHandle" | "handleEdition";
/** Agent names use the same split (owner 2026-10-16: "the same goes for the
 * themed agent names, where they share the generator"). Session 37 (owner
 * 2026-10-16, more room): a three-part [Handle]'s [Modifier] [Program] like
 * the card names, taking most of the [Handle]'s share as it does there. */
export const AGENT_TEMPLATE_WEIGHTS: readonly [AgentTemplate, number][] = [
  ["handleModProgram", 41],
  ["handleProgram", 20],
  ["handleOfPlace", 30],
  ["modHandle", 5],
  ["handleEdition", 4],
];

// ---- slot: program (agent names only) ----

/** What an AI agent is, in the theme's words. Original, generic nouns. */
const PROGRAMS = [
  "Daemon", "Ghost", "Copilot", "Autopilot", "Construct", "Familiar", "Oracle", "Proxy", "Avatar", "Sidekick",
  "Shadow", "Clone", "Twin", "Echo", "Doppelganger", "Understudy", "Apprentice", "Protege", "Prodigy", "Copycat",
  "Spectre", "Mirror", "Instance", "Process", "Subroutine", "Algorithm", "Engine", "Machine", "Automaton", "Android",
  "Droid", "Bot", "Mind", "Brain", "Script", "Macro", "Wingman", "Gambit", "Ace", "Champion",
  "Stand-In", "Ringer", "Hustler", "Operator", "Navigator", "Analyst", "Strategist", "Pupil", "Protocol", "Intelligence",
  // session 37 (owner 2026-10-16: about 200 program words)
  "Agent", "Assistant", "Advisor", "Counsel", "Confidant", "Accomplice", "Partner", "Second", "Lieutenant", "Deputy",
  "Envoy", "Emissary", "Ambassador", "Herald", "Messenger", "Courier", "Runner", "Scout", "Lookout", "Sentinel",
  "Guardian", "Warden", "Custodian", "Caretaker", "Keeper", "Steward", "Butler", "Valet", "Concierge", "Chauffeur",
  "Gamer", "Player", "Contender", "Challenger", "Rival", "Nemesis", "Duelist", "Gladiator", "Prizefighter", "Underdog",
  "Dark Horse", "Wildcard", "Joker", "Trickster", "Gambler", "Card Shark", "Bluffer", "Dealer", "Croupier", "High Roller",
  "Mastermind", "Tactician", "Planner", "Schemer", "Plotter", "Architect", "Engineer", "Mechanic", "Tinkerer", "Inventor",
  "Scholar", "Student", "Tutor", "Mentor", "Professor", "Librarian", "Archivist", "Historian", "Chronicler", "Scribe",
  "Calculator", "Computer", "Cogitator", "Thinker", "Dreamer", "Sleepwalker", "Wanderer", "Drifter", "Pilgrim", "Nomad",
  "Phantom", "Wraith", "Revenant", "Apparition", "Poltergeist", "Haunt", "Specter", "Shade", "Wisp", "Visitor",
  "Prototype", "Experiment", "Testbed", "Simulation", "Model", "Replica", "Facsimile", "Copy", "Duplicate", "Backup",
  "Successor", "Heir", "Protagonist", "Hero", "Antihero", "Villain", "Wingmate", "Plus-One", "Mascot", "Puppet",
  "Marionette", "Golem", "Homunculus", "Servitor", "Minion", "Henchman", "Lackey", "Crony", "Goon", "Muscle",
  "Brawler", "Bruiser", "Enforcer", "Bouncer", "Bodyguard", "Watchdog", "Guard Dog", "Bloodhound", "Pointer", "Retriever",
  "Compass", "Lodestar", "North Star", "Beacon", "Lighthouse", "Signal", "Antenna", "Receiver", "Transmitter", "Relay",
  "Kernel", "Core", "Heart", "Spark", "Pulse", "Circuit", "Switch", "Gear", "Cog", "Flywheel",
];

/** Every handle the generator can use: the plain list and the compounds the
 * filter lets through. */
export const HANDLES: readonly string[] = (() => {
  const out = new Set(HANDLES_PLAIN);
  for (const p of HANDLE_PREFIX) {
    for (const s of HANDLE_SUFFIX) {
      const handle = p + s;
      // No doubled letter at the join ("Pixellynx", "Biossaint") and no
      // suffix the prefix already contains.
      if (p.toLowerCase().includes(s) || p.toLowerCase().endsWith(s[0]!)) continue;
      if (blockedWordIn(handle)) continue;
      out.add(handle);
    }
  }
  return [...out];
})();

/** The slot lists, read-only, for tests and the sample report. */
export const NAME_LISTS = {
  modifiers: MODIFIERS,
  things: THINGS,
  generic: GENERIC_THINGS,
  places: PLACES,
  editions: EDITIONS,
  agentEditions: AGENT_EDITIONS,
  programs: PROGRAMS,
  groupOf: THING_GROUP_OF,
};

/** A name the filter refuses, and why; undefined when it's fine. */
export function namingProblem(name: string, maxLength = MAX_NAME_LENGTH): string | undefined {
  if (name.length > maxLength) return `longer than ${maxLength} characters`;
  const blocked = blockedWordIn(name);
  if (blocked) return `contains a blocked word (${blocked})`;
  // A word used twice across slots: "Static Static Burst", "Turbo Turbo Button".
  const words = name
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 3 && w !== "the");
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const [a, b] = [words[i]!, words[j]!];
      if (a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b))) return `repeats "${a.length <= b.length ? a : b}"`;
    }
  }
  return undefined;
}

/** The owner's username as a handle, or undefined when it can't be one
 * (too long or short, odd characters, or a blocked word). */
export function usernameHandle(username: string | undefined): string | undefined {
  if (!username) return undefined;
  // A handle is a name: "zion" reads as "Zion's Midnight DDoS".
  const u = username.trim().replace(/^[a-z]/, (c) => c.toUpperCase());
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,15}$/.test(u)) return undefined;
  if (/^[0-9._-]+$/.test(u)) return undefined;
  if (blockedWordIn(u)) return undefined;
  return u;
}

/**
 * A themed name for a signature card with `ability`, never one in `used`.
 * `username` (the owner's) may fill the handle slot, at USERNAME_HANDLE_ODDS.
 * Re-rolls until the filter passes and the name is free; the space per
 * ability runs to millions (signatureNameSpace), so this ends fast.
 */
export function signatureCardName(rng: Rng, ability: string, used: ReadonlySet<string>, opts: { username?: string } = {}): string {
  return drawSignatureCardName(rng, ability, used, opts).name;
}

/** signatureCardName, also saying which template the name came from (for
 * the sample report and the weight test). */
export function drawSignatureCardName(
  rng: Rng,
  ability: string,
  used: ReadonlySet<string>,
  opts: { username?: string } = {},
): { name: string; template: Template; username: boolean } {
  const owned = usernameHandle(opts.username);
  const useOwner = owned !== undefined && rng.int(USERNAME_HANDLE_ODDS) === 0;
  // The template is drawn once and only its words are re-rolled, so the
  // filter (which refuses long triples more often) can't skew the owner's
  // 60 / 30 / 10 split. The username goes into handle templates only; after
  // a few misses (taken or filtered), a generated handle takes its place.
  const template: Template = useOwner ? (rng.int(3) === 0 ? "handleThing" : "handleModThing") : weighted(rng, TEMPLATE_WEIGHTS);
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const withOwner = useOwner && attempt < 50;
    const name = composeName(rng, template, ability, withOwner ? owned : undefined);
    if (!used.has(name) && namingProblem(name) === undefined) return { name, template, username: withOwner };
  }
  throw new Error(`signatureCardName: no free name for ${ability} after 10,000 tries`);
}

/**
 * A themed agent name (owner 2026-10-16), never one in `used` (compared
 * without case, as the store compares them): a hacker handle with what the
 * agent is ("Bytewolf's Midnight Daemon"), or where it runs ("Hexmoth of the
 * Undernet"). Same filter as card names, with the agent-name length cap.
 * A name the filter refuses re-rolls its words; a name that is only taken
 * gets a numeral ("Bytewolf's Daemon II", owner 2026-10-16) instead.
 */
export function agentName(rng: Rng, used: ReadonlySet<string>): string {
  return drawAgentName(rng, used).name;
}

/** agentName, also saying which template it came from and whether a
 * numeral was needed (for the sample report and the tests). */
export function drawAgentName(rng: Rng, used: ReadonlySet<string>): { name: string; template: AgentTemplate; numeral: boolean } {
  const taken = new Set([...used].map((n) => n.toLowerCase()));
  // As for card names: one template, words re-rolled, so the split holds.
  const template = weighted(rng, AGENT_TEMPLATE_WEIGHTS);
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const handle = rng.pick(HANDLES as string[]);
    const name =
      template === "handleModProgram" ? `${handle}'s ${rng.pick(MODIFIERS)} ${rng.pick(PROGRAMS)}`
      : template === "handleProgram" ? `${handle}'s ${rng.pick(PROGRAMS)}`
      : template === "handleOfPlace" ? `${handle} of ${rng.pick(PLACES)}`
      : template === "modHandle" ? `${rng.pick(MODIFIERS)} ${handle}`
      : `${handle} ${rng.pick(AGENT_EDITIONS)}`;
    if (namingProblem(name, AGENT_NAME_MAX_LENGTH) !== undefined) continue;
    if (!taken.has(name.toLowerCase())) return { name, template, numeral: false };
    // Taken: the first free numeral that still fits, else new words.
    for (const n of CLASH_NUMERALS) {
      const numbered = `${name} ${n}`;
      if (numbered.length <= AGENT_NAME_MAX_LENGTH && !taken.has(numbered.toLowerCase())) return { name: numbered, template, numeral: true };
    }
  }
  throw new Error("agentName: no free name after 10,000 tries");
}

/** How many distinct agent names the templates can make (before the
 * filter and the length cap, and before numerals). */
export function agentNameSpace(): number {
  const h = HANDLES.length;
  const m = MODIFIERS.length;
  const p = PROGRAMS.length;
  return h * m * p + h * p + h * PLACES.length + m * h + h * AGENT_EDITIONS.length;
}

function composeName(rng: Rng, template: Template, ability: string, ownerHandle: string | undefined): string {
  const handle = ownerHandle ?? rng.pick(HANDLES as string[]);
  const thing = pickThing(rng, ability);
  const mod = rng.pick(MODIFIERS);
  return template === "handleModThing" ? `${handle}'s ${mod} ${thing}`
    : template === "handleThing" ? `${handle}'s ${thing}`
    : template === "thingOfPlace" ? `${thing} of ${rng.pick(PLACES)}` // every place starts "the"
    : template === "modThing" ? `${mod} ${thing}`
    : `${mod} ${thing} ${rng.pick(EDITIONS)}`;
}

function pickThing(rng: Rng, ability: string): string {
  const group = THING_GROUP_OF[ability];
  if (!group || rng.next() < GENERIC_THING_SHARE) return rng.pick(GENERIC_THINGS);
  return rng.pick(THINGS[group]!);
}

function weighted<T>(rng: Rng, table: readonly [T, number][]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [item, w] of table) if ((roll -= w) < 0) return item;
  return table[table.length - 1]![0];
}

/** How many distinct names the templates can make for `ability`, before the
 * filter (an upper bound; the filter removes a small share). */
export function signatureNameSpace(ability: string): number {
  const group = THING_GROUP_OF[ability];
  const things = GENERIC_THINGS.length + (group ? THINGS[group]!.length : 0);
  const h = HANDLES.length;
  const m = MODIFIERS.length;
  return h * m * things + m * things + things * PLACES.length + h * things + m * things * EDITIONS.length;
}
