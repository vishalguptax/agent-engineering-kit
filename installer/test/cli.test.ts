import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixture, read, snapshotTree, tempDir } from "./fixtures.js";

const INSTALLER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function cli(...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts", ...args], { cwd: INSTALLER, encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

test("--help prints usage", () => {
  const { code, out } = cli("--help");
  assert.equal(code, 0);
  assert.match(out, /--target <path>/);
});

test("--dry-run shows the plan and writes nothing", () => {
  const dir = makeFixture("existing-settings");
  const before = snapshotTree(dir);
  const { code, out } = cli("--target", dir, "--dry-run");
  assert.equal(code, 0, out);
  assert.match(out, /MERGE\s+\.claude\/settings\.json/);
  assert.match(out, /CONFLICT\s+\.claude\/agents\/verifier\.md \[keep\]/);
  assert.match(out, /Dry run: nothing was written/);
  assert.deepEqual(snapshotTree(dir), before);
});

test("--yes installs; a second run changes nothing; --uninstall restores the project", () => {
  const dir = makeFixture("agents-only");
  const original = snapshotTree(dir);

  const first = cli("--target", dir, "--preset", "minimal", "--tools", "claude-code", "--yes");
  assert.equal(first.code, 0, first.err);
  assert.match(first.out, /Done: \d+ file\(s\) changed/);
  assert.match(first.out, /\/plugin install mattpocock-skills|Restart Claude Code/);
  assert.equal(read(dir, "CLAUDE.md"), "<!-- agent-engineering-kit:start -->\n@AGENTS.md\n<!-- agent-engineering-kit:end -->\n");
  const installed = snapshotTree(dir);

  const second = cli("--target", dir, "--yes");
  assert.equal(second.code, 0);
  assert.match(second.out, /Nothing to change/);
  assert.deepEqual(snapshotTree(dir), installed);

  const removed = cli("--target", dir, "--uninstall", "--yes");
  assert.equal(removed.code, 0, removed.err);
  assert.deepEqual(snapshotTree(dir, [".agent-kit"]), original);
});

test("--project-info adds the user's Markdown above the kit's block", () => {
  const dir = makeFixture("empty");
  const info = path.join(tempDir("kit-info-"), "about.md");
  writeFileSync(info, "## Project Overview\nA tiny CLI for invoices.\n");
  assert.equal(cli("--target", dir, "--components", "instructions", "--project-info", info, "--yes").code, 0);
  assert.ok(read(dir, "AGENTS.md").startsWith("## Project Overview\nA tiny CLI for invoices.\n\n<!-- agent-engineering-kit:start -->"));
});

test("invalid settings.json stops with an explanation and a non-zero exit", () => {
  const dir = makeFixture("invalid-settings");
  const before = snapshotTree(dir);
  const { code, err } = cli("--target", dir, "--yes");
  assert.equal(code, 1);
  assert.match(err, /settings\.json is not valid JSON \(line 4, column 3\)/);
  assert.deepEqual(snapshotTree(dir), before);
});

test("--tools validates tool names", () => {
  assert.match(cli("--target", makeFixture("empty"), "--tools", "claude-code,vim", "--dry-run").err, /Unknown tool\(s\): vim/);
});

test("bad input gives a clear error", () => {
  assert.match(cli("--target", ".", "--global").err, /either --target <path> or --global/);
  assert.match(cli("--target", makeFixture("empty"), "--components", "feture", "--dry-run").err, /Unknown component "feture"/);
  assert.match(cli("--target", "/no/such/folder", "--dry-run").err, /does not exist/);
});
