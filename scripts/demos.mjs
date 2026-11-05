#!/usr/bin/env node
// The demo drift check (session 75, hardening). Re-runs every demo listed in
// progress/demos.json and compares what it prints with its committed file, so
// a stale demo is found by a command, not by chance (quality-debt: "demos
// drift silently", sessions 64, 65, 70 and 71).
//
//   npm run demos                 the fast demos; exit 1 if any differs or fails
//   npm run demos -- --all        the slow ones too (economy-demo-014 and -016, minutes)
//   npm run demos -- --write      rewrite the files that differ (then read the diff!)
//   npm run demos -- <name>...    only the demos whose file name contains <name>
//
// Lines containing "[timing, varies per run]" are left out of the comparison,
// the convention the demos already use for wall-clock numbers.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "progress/demos.json"), "utf8"));
const args = process.argv.slice(2);
const all = args.includes("--all");
const write = args.includes("--write");
const names = args.filter((a) => !a.startsWith("--"));

const TIMING = "[timing, varies per run]";
const comparable = (text) => text.split("\n").filter((l) => !l.includes(TIMING)).join("\n");

let chosen = manifest.demos.filter((d) => all || !d.slow || names.length > 0);
if (names.length > 0) chosen = chosen.filter((d) => names.some((n) => d.file.includes(n)));
if (chosen.length === 0) {
  console.error("no demo matches", names.join(" "));
  process.exit(2);
}

function run(demo) {
  return new Promise((done) => {
    const started = Date.now();
    const tsx = join(root, "node_modules/.bin/tsx");
    const child = spawn(tsx, [demo.script], { cwd: join(root, demo.workspace), env: process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (err += b));
    child.on("close", (code) => done({ demo, code, out, err, seconds: (Date.now() - started) / 1000 }));
  });
}

/** The first few differing lines, as "- committed / + now". */
function sketch(was, now) {
  const a = comparable(was).split("\n");
  const b = comparable(now).split("\n");
  const lines = [];
  for (let i = 0; i < Math.max(a.length, b.length) && lines.length < 6; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) lines.push(`      - ${a[i]}`);
    if (b[i] !== undefined) lines.push(`      + ${b[i]}`);
  }
  return lines.join("\n");
}

const width = Math.max(1, Math.min(4, cpus().length));
const queue = [...chosen];
const results = [];
await Promise.all(
  Array.from({ length: width }, async () => {
    while (queue.length > 0) results.push(await run(queue.shift()));
  }),
);
results.sort((x, y) => manifest.demos.indexOf(x.demo) - manifest.demos.indexOf(y.demo));

let bad = 0;
for (const { demo, code, out, err, seconds } of results) {
  const path = join(root, "progress", demo.file);
  let committed = "";
  try {
    committed = readFileSync(path, "utf8");
  } catch {
    committed = "";
  }
  const time = `${seconds.toFixed(0)} s`;
  if (code !== 0) {
    bad++;
    console.log(`FAIL  ${demo.file}  (exit ${code}, ${time})`);
    console.log(err.trim().split("\n").slice(-5).map((l) => `      ${l}`).join("\n"));
    continue;
  }
  if (comparable(committed) === comparable(out)) {
    console.log(`same  ${demo.file}  (${time})`);
    continue;
  }
  if (write) {
    writeFileSync(path, out);
    console.log(`wrote ${demo.file}  (${time})`);
    continue;
  }
  bad++;
  console.log(`DIFF  ${demo.file}  (${time})`);
  console.log(sketch(committed, out));
}
console.log(`\n${results.length} demos, ${bad} ${write ? "failed" : "stale or failed"}`);
process.exit(bad > 0 ? 1 : 0);
