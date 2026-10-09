import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { loadManifest } from "../src/core/manifest.js";
import { readRecord } from "../src/core/record.js";
import { projectTarget } from "../src/core/target.js";
import { runWizard } from "../src/wizard.js";
import { makeFixture, read, snapshotTree, tempDir } from "./fixtures.js";

const manifest = loadManifest();

/** Runs the wizard with scripted answers (one per line) and returns its exit code and everything it printed. */
async function wizard(answers: string[], cwd = tempDir("kit-cwd-")) {
  const input = new PassThrough();
  const output = new PassThrough();
  let printed = "";
  output.on("data", (chunk) => (printed += chunk));
  input.end(answers.map((a) => `${a}\n`).join(""));
  const code = await runWizard(manifest, { input, output, cwd, homeDir: tempDir("kit-home-") });
  return { code, printed };
}

test("guided project install: preset, explanation, project info, per-conflict choice, confirm", async () => {
  const dir = makeFixture("existing-settings");
  const { code, printed } = await wizard([
    "1", // a project folder
    dir,
    "", // keep the detected tools (Claude Code)
    "", // Recommended preset
    "?11", // explain /feature
    "4", // try to uncheck the code-simplifier: blocked by /feature
    "", // accept the list
    "y", // add a project section
    "Invoicing API.",
    "", // keep suggested stack
    "", // keep suggested commands
    "",
    "",
    "",
    "",
    "s", // conflict on verifier.md: save the kit's version alongside
    "y", // apply
  ]);
  assert.equal(code, 0, printed);
  assert.match(printed, /What it is: A slash command that walks the agent/);
  assert.match(printed, /can't be removed while .*\/feature/i);
  assert.match(printed, /CONFLICT .claude\/agents\/verifier\.md/);
  assert.match(printed, /Done: \d+ file\(s\) changed/);
  assert.equal(read(dir, ".claude/agents/verifier.md"), "---\nname: verifier\n---\nMy own verifier.\n");
  assert.ok(existsSync(path.join(dir, ".claude/agents/verifier.md.kit-new")));
  assert.ok(read(dir, "AGENTS.md").includes("## Project Overview\nInvoicing API.\n- Tech stack: JavaScript/Node.js (pnpm)"));
});

test("answering no at the final question writes nothing", async () => {
  const dir = makeFixture("empty");
  const before = snapshotTree(dir);
  const { code, printed } = await wizard(["1", dir, "", "2", "", "n", "n"]);
  assert.equal(code, 1);
  assert.match(printed, /Cancelled/);
  assert.deepEqual(snapshotTree(dir), before);
});

test("an existing install offers update / add-remove / uninstall, and uninstall restores the project", async () => {
  const dir = makeFixture("agents-only");
  const original = snapshotTree(dir);
  assert.equal((await wizard(["1", dir, "", "2", "", "n", "y"])).code, 0);
  assert.ok(readRecord(projectTarget(dir), manifest));

  const update = await wizard(["1", dir, "1"]);
  assert.match(update.printed, /Nothing to change/);

  const { code, printed } = await wizard(["1", dir, "3", "y"]);
  assert.equal(code, 0, printed);
  assert.deepEqual(snapshotTree(dir, [".agent-kit"]), original);
});

test("relative paths resolve against the working directory and bad folders are asked again", async () => {
  const dir = makeFixture("empty");
  const { code, printed } = await wizard(["1", "/no/such/folder", path.basename(dir), "", "2", "", "n", "y"], path.dirname(dir));
  assert.equal(code, 0, printed);
  assert.match(printed, /does not exist/);
  assert.ok(existsSync(path.join(dir, "AGENTS.md")));
});

test("input ending early cancels cleanly without writing", async () => {
  const dir = makeFixture("empty");
  const before = snapshotTree(dir);
  const { code, printed } = await wizard(["1", dir]);
  assert.equal(code, 1);
  assert.match(printed, /Nothing was written/);
  assert.deepEqual(snapshotTree(dir), before);
});

test("the tools step toggles tools by number and explains what each gets", async () => {
  const dir = makeFixture("empty");
  // Generic is pre-selected (nothing detected); add Claude Code (1) and Codex (2), drop Generic (19), explain Windsurf (8).
  const { code, printed } = await wizard(["1", dir, "1", "2", "19", "?8", "", "2", "", "n", "y"]);
  assert.equal(code, 0, printed);
  assert.match(printed, /Windsurf \/ Devin Desktop\n  Rules: Reads the kit's block in AGENTS\.md\./);
  assert.deepEqual(readRecord(projectTarget(dir), manifest)!.tools, ["claude-code", "codex"]);
});
