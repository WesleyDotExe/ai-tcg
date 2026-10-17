// The rules for a name an owner types for their agent (owner 2026-10-16,
// "owners can name their agent"). Built session 37.
//
// The check runs here, in the game's own server code (the economy store the
// server calls), never in an outside moderation service. It uses the same
// blocked-word list and length cap as generated names
// (engine/src/data/signatureNames.ts), but not their repeated-word check
// (owner 2026-10-17: typed names may repeat words), plus the rules only a
// typed name needs:
//  - 3 to AGENT_NAME_MAX_LENGTH characters: letters, digits, spaces and
//    simple punctuation (' . - _), starting and ending with a letter or
//    digit, at least one letter, no punctuation run together ("a..b");
//    runs of spaces are tidied to one;
//  - no name that poses as staff or the game itself ("Admin", "AI-TCG
//    Official", "Moderator");
//  - the store adds the checks that need the database: unique without case
//    across every agent's current and past names, and never another owner's
//    login username.
//
// ASCII letters only, on purpose: look-alike letters from other alphabets
// would let "Аdmin" (Cyrillic A) through the staff check.

import { AGENT_NAME_MAX_LENGTH, blockedWordIn } from "@ai-tcg/engine";

export const AGENT_NAME_MIN_LENGTH = 3;

/** Words only staff and the game's own accounts may use. Matched on whole
 * words, and the longer ones also inside run-together words
 * ("TheRealAdmin"). */
const STAFF_WORDS = ["admin", "administrator", "sysadmin", "moderator", "mod", "mods", "staff", "official", "support", "helpdesk", "gm", "gamemaster", "dev", "developer", "system"];
const STAFF_ROOTS = ["admin", "moderator", "official", "aitcg", "gamemaster", "helpdesk"];

/** A typed name tidied the one way the store accepts: trimmed, with runs
 * of spaces made single. Everything else is refused, never rewritten. */
export function tidyAgentName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Why a typed agent name is refused, or undefined when it may be used
 * (before the store's uniqueness and username checks). */
export function customAgentNameProblem(raw: string): string | undefined {
  const name = tidyAgentName(raw);
  if (name.length < AGENT_NAME_MIN_LENGTH || name.length > AGENT_NAME_MAX_LENGTH) {
    return `an agent name is ${AGENT_NAME_MIN_LENGTH} to ${AGENT_NAME_MAX_LENGTH} characters`;
  }
  if (!/^[A-Za-z0-9 '.\-_]+$/.test(name)) return "an agent name uses letters, digits, spaces and ' . - _ only";
  if (!/^[A-Za-z0-9].*[A-Za-z0-9]$/.test(name)) return "an agent name starts and ends with a letter or digit";
  if (!/[A-Za-z]/.test(name)) return "an agent name needs at least one letter";
  if (/['.\-_]{2}/.test(name)) return "an agent name never runs punctuation together";
  const staff = staffWordIn(name);
  if (staff) return `an agent name can't pose as staff or the game ("${staff}")`;
  const blocked = blockedWordIn(name);
  if (blocked) return "an agent name can't contain a blocked word";
  // No repeated-word check: that is for generated names only, where a
  // repeat reads as a mistake (owner 2026-10-17). An owner may choose "Bit
  // by Bit" or "Static Static".
  return undefined;
}

function staffWordIn(name: string): string | undefined {
  const lower = name.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/).filter(Boolean);
  for (const w of STAFF_WORDS) if (words.includes(w)) return w;
  const squashed = words.join("");
  for (const r of STAFF_ROOTS) if (squashed.includes(r)) return r;
  return undefined;
}

/** The form two names are compared in when one might copy the other's
 * login username: case, spaces and punctuation ignored ("Neon_Fan99" and
 * "neon fan 99" are the same). */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
