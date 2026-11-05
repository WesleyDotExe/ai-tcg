// progress/demos.json is the list `npm run demos` re-runs (session 75). This
// keeps it whole: every economy/server dev script that names a committed
// progress/*.txt output is either a listed demo or a listed record, and every
// listed demo's script and file exist. A new demo left off the list fails here,
// so it can't drift silently the way six did before session 65.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(join(root, "progress/demos.json"), "utf8")) as {
  demos: Array<{ file: string; workspace: string; script: string; plays: boolean; slow?: boolean }>;
  records: { files: string[] };
};

describe("progress/demos.json", () => {
  it("every listed demo has its script and its committed file", () => {
    for (const d of manifest.demos) {
      expect(existsSync(join(root, d.workspace, d.script)), d.script).toBe(true);
      expect(existsSync(join(root, "progress", d.file)), d.file).toBe(true);
    }
  });

  it("no file is listed twice", () => {
    const files = [...manifest.demos.map((d) => d.file), ...manifest.records.files];
    expect(new Set(files).size).toBe(files.length);
  });

  it("every dev script's committed output is a listed demo or a listed record", () => {
    const listed = new Set([...manifest.demos.map((d) => d.file), ...manifest.records.files]);
    const missing: string[] = [];
    for (const ws of ["economy", "server"]) {
      const dir = join(root, ws, "src/dev");
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
        const text = readFileSync(join(dir, name), "utf8");
        for (const m of text.matchAll(/progress\/([a-z0-9_.-]+\.txt)/g)) {
          if (existsSync(join(root, "progress", m[1])) && !listed.has(m[1])) missing.push(`${ws}/src/dev/${name}: ${m[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
