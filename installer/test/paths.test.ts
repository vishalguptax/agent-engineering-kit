import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathSafetyError, resolveInside } from "../src/core/paths.js";

function tempDir(): string {
  return realpathSync(mkdtempSync(path.join(os.tmpdir(), "kit-paths-")));
}

test("resolves normal relative paths inside the root, even if they don't exist yet", () => {
  const root = tempDir();
  assert.equal(resolveInside(root, ".claude/agents/verifier.md"), path.join(root, ".claude", "agents", "verifier.md"));
});

test("rejects ../ traversal and absolute paths", () => {
  const root = tempDir();
  assert.throws(() => resolveInside(root, "../escape.md"), PathSafetyError);
  assert.throws(() => resolveInside(root, "docs/../../escape.md"), PathSafetyError);
  assert.throws(() => resolveInside(root, path.join(os.tmpdir(), "abs.md")), PathSafetyError);
});

test("rejects a path that goes through a symlinked folder pointing outside the root", () => {
  const root = tempDir();
  const outside = tempDir();
  symlinkSync(outside, path.join(root, ".claude"), "dir");
  assert.throws(() => resolveInside(root, ".claude/settings.json"), /outside/);
});

test("rejects writing to a file that is itself a symlink", () => {
  const root = tempDir();
  const outside = tempDir();
  writeFileSync(path.join(outside, "real.md"), "x");
  mkdirSync(path.join(root, "docs"));
  symlinkSync(path.join(outside, "real.md"), path.join(root, "docs", "RULES.md"));
  assert.throws(() => resolveInside(root, "docs/RULES.md"), /symlink/);
});

test("allows symlinks that stay inside the root", () => {
  const root = tempDir();
  mkdirSync(path.join(root, "real-claude"));
  symlinkSync(path.join(root, "real-claude"), path.join(root, ".claude"), "dir");
  assert.equal(resolveInside(root, ".claude/x.md"), path.join(root, ".claude", "x.md"));
});

test("a root that doesn't exist yet (a first global install into ~/.claude) is allowed", () => {
  const home = tempDir();
  const root = path.join(home, ".claude");
  assert.equal(resolveInside(root, ".agent-kit/install.json"), path.join(realpathSync(home), ".claude/.agent-kit/install.json"));
});
