import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadManifest } from "../src/core/manifest.js";
import { planInstall, type Action } from "../src/core/plan.js";
import { presetSelection } from "../src/core/resolve.js";
import { globalTarget, projectTarget } from "../src/core/target.js";
import { markersFor } from "../src/core/text-block.js";
import type { ToolId } from "../src/tools/profiles.js";
import { makeFixture, snapshotTree, tempDir } from "./fixtures.js";

const MARKER_START = markersFor("html").start;
const manifest = loadManifest();
const recommended = presetSelection(manifest, "recommended");
const homeDir = tempDir("kit-home-");

function plan(dir: string, tools: ToolId[], selected = recommended) {
  return planInstall({ manifest, target: projectTarget(dir), selected, tools, homeDir });
}

function byPath(actions: Action[]): Record<string, Action> {
  return Object.fromEntries(actions.map((a) => [a.path, a]));
}

test("(a) empty folder, Claude Code: everything is a CREATE, AGENTS.md is the hub, and planning writes nothing", () => {
  const dir = makeFixture("empty");
  const before = snapshotTree(dir);
  const result = plan(dir, ["claude-code"]);
  assert.deepEqual(result.blockers, []);
  assert.ok(result.actions.every((a) => a.kind === "CREATE"), result.actions.map((a) => `${a.kind} ${a.path}`).join("\n"));
  const actions = byPath(result.actions);
  for (const p of [
    "AGENTS.md",
    "CLAUDE.md",
    "docs/agent-engineering/RULES.md",
    "docs/agent-engineering/plan-template.md",
    "docs/agent-engineering/agents/verifier.md",
    ".claude/agents/verifier.md",
    ".claude/skills/feature/SKILL.md",
    ".claude/skills/fix/SKILL.md",
    ".agent-kit/format.mjs",
    ".claude/settings.json",
  ]) {
    assert.ok(actions[p], `expected an action for ${p}`);
  }
  assert.ok(actions["AGENTS.md"].after!.startsWith("## Project Overview"), "new AGENTS.md starts with the project template");
  assert.ok(actions["AGENTS.md"].after!.includes(MARKER_START));
  assert.equal(actions["CLAUDE.md"].after, `${MARKER_START}\n@AGENTS.md\n${markersFor("html").end}\n`);
  assert.match(actions[".claude/agents/verifier.md"].after!, /tools: "Read, Grep, Glob, Bash"/);
  const settings = JSON.parse(actions[".claude/settings.json"].after!);
  assert.equal(settings.hooks.PostToolUse[0].hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/.agent-kit/format.mjs" --from claude');
  assert.ok(settings.permissions.deny.includes("Read(./.env)"));
  assert.deepEqual(snapshotTree(dir), before);
});

test("Codex + Cursor + Gemini: one shared skills folder, each tool's own agent format, hooks only where documented", () => {
  const dir = makeFixture("empty");
  const result = plan(dir, ["codex", "cursor", "gemini"]);
  assert.deepEqual(result.blockers, []);
  const paths = result.actions.map((a) => a.path);
  assert.ok(paths.includes(".agents/skills/feature/SKILL.md"));
  assert.ok(!paths.some((p) => p.startsWith(".claude/")), "nothing for Claude Code");
  assert.ok(paths.includes(".codex/agents/verifier.toml"));
  assert.ok(!paths.some((p) => p.startsWith(".cursor/agents/")), "Cursor reads .codex/agents, so it isn't written twice");
  assert.ok(paths.includes(".gemini/agents/verifier.md"));
  assert.ok(paths.includes(".cursor/hooks.json") && paths.includes(".cursorignore") && paths.includes(".geminiignore"));
  const gemini = JSON.parse(byPath(result.actions)[".gemini/settings.json"].after!);
  assert.deepEqual(gemini.context.fileName, ["GEMINI.md", "AGENTS.md"]);
  assert.ok(result.notes.some((n) => n.startsWith("OpenAI Codex:") && /format hook/.test(n)), "the missing Codex hook is explained");
  assert.ok(!paths.includes("CLAUDE.md"));
});

test("Claude + Codex + Cursor: Cursor's double view of the skills is explained, not hidden", () => {
  const result = plan(makeFixture("empty"), ["claude-code", "codex", "cursor"]);
  assert.ok(result.notes.some((n) => n.startsWith("Cursor: reads both .claude/skills and .agents/skills")), result.notes.join("\n"));
});

test("(b) existing settings, CLAUDE.md and a custom agent: MERGE, APPEND and CONFLICT with diffs", () => {
  const dir = makeFixture("existing-settings");
  const actions = byPath(plan(dir, ["claude-code"]).actions);
  const settings = actions[".claude/settings.json"];
  assert.equal(settings.kind, "MERGE");
  assert.match(settings.diff, /\+.*Read\(\.\/secrets\/\*\*\)/);
  assert.match(settings.diff, /\+.*PostToolUse/);
  assert.equal(JSON.parse(settings.after!).model, "opus");
  assert.equal(actions["CLAUDE.md"].kind, "APPEND");
  assert.ok(actions["CLAUDE.md"].after!.startsWith(`# Acme\n\nUse pnpm.\n\n${MARKER_START}\n@AGENTS.md\n`));
  assert.equal(actions["AGENTS.md"].kind, "CREATE");
  assert.equal(actions[".claude/agents/verifier.md"].kind, "CONFLICT");
  assert.match(actions[".claude/agents/verifier.md"].diff, /^-My own verifier\.$/m);
});

test("(c) only AGENTS.md: the block goes into it and CLAUDE.md just imports it", () => {
  const actions = byPath(plan(makeFixture("agents-only"), ["claude-code"], ["instructions"]).actions);
  assert.equal(actions["AGENTS.md"].kind, "APPEND");
  assert.ok(actions["AGENTS.md"].after!.startsWith("# Agents\n\nRun `uv run pytest`.\n\n" + MARKER_START));
  assert.equal(actions["CLAUDE.md"].kind, "CREATE");
});

test("(e) invalid settings.json blocks the install with an explanation", () => {
  const dir = makeFixture("invalid-settings");
  const result = plan(dir, ["claude-code"]);
  assert.equal(result.blockers.length, 1);
  assert.match(result.blockers[0], /\.claude\/settings\.json is not valid JSON \(line \d+/);
  assert.deepEqual(plan(dir, ["claude-code"], ["learn"]).blockers, [], "components that don't touch settings.json can still install");
});

test("tool warnings: Zed is told when an earlier-priority rules file hides AGENTS.md", () => {
  const dir = makeFixture("empty");
  writeFileSync(path.join(dir, ".rules"), "my rules\n");
  assert.ok(plan(dir, ["zed"], ["instructions"]).notes.some((n) => n.startsWith("Zed: Zed reads only the first rules file")));
});

test("global mode installs under ~/.claude for Claude Code only, with project paths rewritten", () => {
  const home = tempDir("kit-home-");
  mkdirSync(path.join(home, ".claude"));
  const result = planInstall({ manifest, target: globalTarget(home), selected: recommended, tools: ["claude-code"], homeDir: home });
  const actions = byPath(result.actions);
  assert.ok(actions["skills/feature/SKILL.md"], "no .claude/ prefix inside ~/.claude");
  assert.ok(actions["agents/verifier.md"]);
  assert.ok(!actions["AGENTS.md"], "no AGENTS.md hub globally");
  assert.match(actions["skills/feature/SKILL.md"].after!, /`~\/\.claude\/docs\/agent-engineering\/RULES\.md`/);
  assert.match(actions["CLAUDE.md"].after!, /@~\/\.claude\/docs\/agent-engineering\/RULES\.md/);
  assert.ok(!actions["CLAUDE.md"].after!.includes("## Project Overview"), "no project template globally");
  const settings = JSON.parse(actions["settings.json"].after!);
  assert.equal(settings.hooks.PostToolUse[0].hooks[0].command, 'node "$HOME/.claude/.agent-kit/format.mjs" --from claude');
  const withCodex = planInstall({ manifest, target: globalTarget(home), selected: recommended, tools: ["claude-code", "codex"], homeDir: home });
  assert.match(withCodex.blockers.join(), /Claude Code only/);
});

test("every kit doc path that installed skills, agents and instructions mention is installed too", () => {
  for (const [tools, preset] of [[["claude-code"], "everything"], [["codex", "cursor"], "everything"], [["windsurf", "zed"], "recommended"], [["claude-code"], "minimal"]] as [ToolId[], string][]) {
    const actions = plan(makeFixture("empty"), tools, presetSelection(manifest, preset)).actions;
    const installed = new Set(actions.map((a) => a.path));
    const mentioned = actions.flatMap((a) => a.after?.match(/docs\/agent-engineering\/[\w./-]+\.md/g) ?? []).filter((p) => !p.endsWith("/X.md"));
    const missing = [...new Set(mentioned)].filter((p) => !installed.has(p));
    assert.deepEqual(missing, [], `${tools.join("+")} (${preset}): mentioned but not installed`);
  }
});
