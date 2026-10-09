import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { KIT_ROOT } from "../src/core/manifest.js";
import { tempDir } from "./fixtures.js";

const SCRIPT = path.join(KIT_ROOT, "hooks", "format.mjs");

/** A project with a fake Prettier that records the arguments it was called with. */
function projectWithPrettier(): string {
  const root = tempDir("kit-format-");
  mkdirSync(path.join(root, "node_modules/prettier"), { recursive: true });
  writeFileSync(path.join(root, "node_modules/prettier/package.json"), JSON.stringify({ name: "prettier", bin: { prettier: "bin.cjs" } }));
  writeFileSync(
    path.join(root, "node_modules/prettier/bin.cjs"),
    'require("fs").writeFileSync(require("path").join(process.cwd(), "called.json"), JSON.stringify(process.argv.slice(2)));\n',
  );
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "src/app.ts"), "const x=1\n");
  return root;
}

function runHook(root: string, from: string, payload: unknown, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [SCRIPT, "--from", from], {
    cwd: root,
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", ...env },
    encoding: "utf8",
  });
}

const calledWith = (root: string) => JSON.parse(readFileSync(path.join(root, "called.json"), "utf8")) as string[];

test("Claude: reads tool_input.file_path and formats from CLAUDE_PROJECT_DIR", () => {
  const root = projectWithPrettier();
  const result = runHook(tempDir(), "claude", { tool_input: { file_path: path.join(root, "src/app.ts") } }, { CLAUDE_PROJECT_DIR: root });
  assert.equal(result.status, 0);
  assert.deepEqual(calledWith(root), ["--write", "--ignore-unknown", path.join(root, "src/app.ts")]);
});

test("Cursor: reads the absolute file_path; runs from the project root", () => {
  const root = projectWithPrettier();
  assert.equal(runHook(root, "cursor", { file_path: path.join(root, "src/app.ts"), edits: [] }).status, 0);
  assert.deepEqual(calledWith(root).slice(-1), [path.join(root, "src/app.ts")]);
});

test("Windsurf/Devin: reads tool_info.file_path", () => {
  const root = projectWithPrettier();
  assert.equal(runHook(root, "devin", { agent_action_name: "post_write_code", tool_info: { file_path: "src/app.ts" } }).status, 0);
  assert.deepEqual(calledWith(root).slice(-1), [path.join(root, "src/app.ts")]);
});

test("never formats files outside the project, and never fails the agent", () => {
  const root = projectWithPrettier();
  const outside = path.join(tempDir(), "x.ts");
  writeFileSync(outside, "x\n");
  for (const [from, payload] of [
    ["cursor", { file_path: outside }],
    ["cursor", "not json"],
    ["cursor", { file_path: "src/missing.ts" }],
    ["unknown-tool", { file_path: "src/app.ts" }],
    ["claude", { tool_input: {} }],
  ] as const) {
    assert.equal(runHook(root, from, payload).status, 0, `${from} ${JSON.stringify(payload)}`);
  }
  assert.ok(!existsSync(path.join(root, "called.json")), "no formatter ran");
});

test("does nothing when the project has no formatter for the file type", () => {
  const root = tempDir("kit-format-");
  writeFileSync(path.join(root, "notes.md"), "x\n");
  assert.equal(runHook(root, "cursor", { file_path: path.join(root, "notes.md") }).status, 0);
});
