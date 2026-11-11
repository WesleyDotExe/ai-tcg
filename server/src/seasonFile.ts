import { EconomyStore } from "@ai-tcg/economy";

// (session 85) Which file a server starts on. Switching seasons is done by
// hand (stop the server, `npm run season:next`, start it again on the new
// file: server/OWNER_API.md), so the two easy mistakes are starting it again
// on the ended file, and mistyping the new file's name (which used to create
// an empty Season 0 file and run the ladder on it). Both are refused before
// the file is opened, and so before anything in it is written or migrated.
//   --new      the file doesn't exist yet: create a new season file there
//   --archive  the file is an ended season's: serve it anyway (sign-in,
//              history, the final standings; no match is ever paired)

export interface SeasonFileFlags {
  /** Create the file (it must not exist). */
  new: boolean;
  /** Serve an ended season's file (it must have ended). */
  archive: boolean;
}

/** Splits `--new` / `--archive` out of a CLI's arguments, wherever they
 * are; any other `--` word is refused, so a typo isn't read as a path. */
export function seasonFileArgs(argv: readonly string[]): { args: string[]; flags: SeasonFileFlags } | { problem: string } {
  const flags: SeasonFileFlags = { new: false, archive: false };
  const args: string[] = [];
  for (const a of argv) {
    if (a === "--new") flags.new = true;
    else if (a === "--archive") flags.archive = true;
    else if (a.startsWith("--")) return { problem: `unknown option "${a}" (options: --new, --archive)` };
    else args.push(a);
  }
  if (flags.new && flags.archive) return { problem: "--new and --archive can't both be given: a new file has no season to have ended" };
  return { args, flags };
}

/** Why a server must not start on `path`, or null when it may. Reads the
 * file read-only and writes nothing. */
export function seasonFileProblem(path: string, flags: SeasonFileFlags): string | null {
  const peek = EconomyStore.peekSeasonFile(path);
  if (peek === null) {
    if (flags.new) return null;
    if (flags.archive) return `no season file at "${path}"`;
    return `no season file at "${path}". Check the name; to start a new season file there, pass --new.`;
  }
  if (flags.new) return `"${path}" already exists (season ${peek.season ?? "?"}): --new only creates a file. Drop --new to start on it.`;
  if (peek.endedAt !== null && !flags.archive) {
    return (
      `season ${peek.season ?? "?"} ended at ${peek.endedAt}: "${path}" is its archive, and no match is ever paired on it. ` +
      `Start on the next season's file (made with: npm run season:next -w server -- "${path}" <new season file> <new season, e.g. S1>), ` +
      `or pass --archive to serve the archive anyway.`
    );
  }
  if (peek.endedAt === null && flags.archive) return `season ${peek.season ?? "?"} hasn't ended: "${path}" isn't an archive. Drop --archive.`;
  return null;
}

/** The line a server prints once it has opened its file. */
export function seasonFileLine(store: EconomyStore, path: string): string {
  const end = store.seasonEnd();
  if (end !== null) return `[season] serving season ${store.season}'s archive (ended ${end.endedAt}) from ${path}: no match will be paired`;
  const start = store.seasonStart();
  return `[season] season ${store.season}${start ? ` (made from ${start.fromSeason}'s archive)` : ""} on ${path}`;
}
