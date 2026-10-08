// Password hashing for Season 0 sign-in, on Node's built-in scrypt (no
// external service, no native addon). A stored hash is self-describing:
//
//   scrypt$<log2 N>$<r>$<p>$<salt, base64>$<key, base64>
//
// so the cost can be raised later without breaking existing hashes; the
// store re-hashes a password at sign-in when its stored cost is below the
// current one. The password itself is never stored or logged.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SCRYPT_COST } from "./config.js";

const KEY_BYTES = 64;
const SALT_BYTES = 16;

interface Cost {
  log2N: number;
  r: number;
  p: number;
}

function derive(password: string, salt: Buffer, cost: Cost): Buffer {
  const N = 2 ** cost.log2N;
  // scrypt needs 128 * N * r bytes; allow twice that so Node's default
  // 32 MB ceiling never refuses the configured cost.
  return scryptSync(password.normalize("NFKC"), salt, KEY_BYTES, { N, r: cost.r, p: cost.p, maxmem: 256 * N * cost.r });
}

export function hashPassword(password: string, cost: Cost = SCRYPT_COST): string {
  const salt = randomBytes(SALT_BYTES);
  const key = derive(password, salt, cost);
  return `scrypt$${cost.log2N}$${cost.r}$${cost.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

function parse(stored: string): { cost: Cost; salt: Buffer; key: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [log2N, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![log2N, r, p].every((n) => Number.isInteger(n) && n > 0) || log2N > 20) return null;
  return { cost: { log2N, r, p }, salt: Buffer.from(parts[4]!, "base64"), key: Buffer.from(parts[5]!, "base64") };
}

/** True when `password` matches `stored`. Constant-time on the key compare. */
export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parse(stored);
  if (!parsed) return false;
  const key = derive(password, parsed.salt, parsed.cost);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

/** True when a stored hash was made at a lower cost than the current one. */
export function needsRehash(stored: string, cost: Cost = SCRYPT_COST): boolean {
  const parsed = parse(stored);
  return !parsed || parsed.cost.log2N < cost.log2N || parsed.cost.r < cost.r || parsed.cost.p < cost.p;
}

let dummy: string | null = null;
/** A real hash of nothing, so a sign-in for an unknown login spends the same
 * scrypt time as one for a real login and doesn't reveal which logins exist. */
export function dummyHash(): string {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}
