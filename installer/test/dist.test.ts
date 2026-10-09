import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotTree, tempDir } from "./fixtures.js";

const INSTALLER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the committed dist/ matches a fresh build of src/ (run `npm run build` if this fails)", () => {
  const outDir = tempDir("kit-dist-");
  const tsc = path.join(INSTALLER, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json", "--outDir", outDir], { cwd: INSTALLER, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(snapshotTree(path.join(INSTALLER, "dist")), snapshotTree(outDir));
});
