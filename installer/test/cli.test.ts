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

test("--checks sets the pre-commit commands from a file, and needs the checks component", () => {
  const dir = makeFixture("empty");
  const file = path.join(tempDir("kit-checks-"), "checks.conf");
  writeFileSync(file, "lint: npm run lint\ntest: npm test\n");
  assert.equal(cli("--target", dir, "--components", "checks", "--tools", "generic", "--checks", file, "--yes").code, 0);
  assert.match(read(dir, ".agent-kit/checks.conf"), /^lint: npm run lint\ntest: npm test$/m);
  assert.match(cli("--target", makeFixture("empty"), "--components", "rules", "--checks", file, "--dry-run").err, /--checks needs the checks component/);
});

test("--resolve chooses per conflicting file; a path that isn't a conflict is an error", () => {
  const dir = makeFixture("existing-settings");
  const preview = cli("--target", dir, "--tools", "claude-code", "--resolve", ".claude/agents/verifier.md=kit-new", "--dry-run");
  assert.equal(preview.code, 0, preview.err);
  assert.match(preview.out, /CONFLICT\s+\.claude\/agents\/verifier\.md \[kit-new\]/);
  assert.equal(cli("--target", dir, "--tools", "claude-code", "--resolve", ".claude/agents/verifier.md=kit-new", "--yes").code, 0);
  assert.equal(read(dir, ".claude/agents/verifier.md"), "---\nname: verifier\n---\nMy own verifier.\n");
  assert.ok(read(dir, ".claude/agents/verifier.md.kit-new").includes("name: \"verifier\""));
  assert.match(cli("--target", makeFixture("existing-settings"), "--tools", "claude-code", "--resolve", "README.md=kit", "--dry-run").err, /README\.md has no conflict/);
  assert.match(cli("--target", dir, "--resolve", "x=maybe", "--dry-run").err, /--resolve/);
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
