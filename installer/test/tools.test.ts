import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { detectTools } from "../src/tools/detect.js";
import { findCollisions } from "../src/tools/collisions.js";
import { chooseLocations } from "../src/tools/locations.js";
import { profileProblems, TOOL_PROFILES, toolById, type ToolId } from "../src/tools/profiles.js";
import { makeFixture, tempDir } from "./fixtures.js";

const pick = (...ids: ToolId[]) => ids.map(toolById);

test("the shipped tool profiles are valid", () => {
  assert.deepEqual(profileProblems(TOOL_PROFILES), []);
});

test("profile validation catches unsafe paths, duplicate ids and missing sources", () => {
  const claude = toolById("claude-code");
  assert.match(profileProblems([claude, claude]).join(), /duplicate tool id/);
  assert.match(profileProblems([{ ...claude, skills: { reads: ["../outside"] } }]).join(), /must be a relative path/);
  assert.match(profileProblems([{ ...claude, docs: [] }]).join(), /needs at least one docs link/);
});

test("every supported tool reads AGENTS.md, except the ones documented as needing a note", () => {
  const withoutAgentsMd = TOOL_PROFILES.filter((t) => t.instructions.kind === "note").map((t) => t.id);
  assert.deepEqual(withoutAgentsMd, ["aider"]);
});

test("skills: Claude + Cursor share .claude/skills with no duplicates", () => {
  const result = chooseLocations(pick("claude-code", "cursor"), "skills");
  assert.deepEqual(result.chosen.map((l) => l.dir), [".claude/skills"]);
  assert.deepEqual(result.duplicates, []);
});

test("skills: Codex + Cursor + Gemini share one .agents/skills", () => {
  const result = chooseLocations(pick("codex", "cursor", "gemini"), "skills");
  assert.deepEqual(result.chosen.map((l) => l.dir), [".agents/skills"]);
  assert.deepEqual(result.duplicates, []);
});

test("skills: Claude + Codex + Cursor needs two folders, and Cursor's double view is reported", () => {
  const result = chooseLocations(pick("claude-code", "codex", "cursor"), "skills");
  assert.deepEqual(result.chosen.map((l) => l.dir), [".claude/skills", ".agents/skills"]);
  assert.deepEqual(result.duplicates, [{ toolId: "cursor", dirs: [".claude/skills", ".agents/skills"] }]);
});

test("skills: Kiro has its own folder", () => {
  assert.deepEqual(chooseLocations(pick("kiro", "codex"), "skills").chosen.map((l) => l.dir), [".agents/skills", ".kiro/skills"]);
});

test("agents: Claude, Cursor and Copilot share .claude/agents; Codex gets TOML files", () => {
  const shared = chooseLocations(pick("claude-code", "cursor", "copilot"), "agents");
  assert.deepEqual(shared.chosen.map((l) => [l.dir, l.format]), [[".claude/agents", "claude-md"]]);
  const withCodex = chooseLocations(pick("codex", "copilot"), "agents");
  assert.deepEqual(withCodex.chosen.map((l) => [l.dir, l.format]), [[".codex/agents", "codex-toml"], [".github/agents", "copilot-agent-md"]]);
});

test("tools without sub-agents get references instead of agent files", () => {
  const result = chooseLocations(pick("windsurf", "zed"), "agents");
  assert.deepEqual(result.chosen, []);
  assert.deepEqual(result.asReference, ["windsurf", "zed"]);
});

test("coverage tells which location serves each tool", () => {
  const result = chooseLocations(pick("claude-code", "codex", "cursor"), "skills");
  assert.equal(result.coverage.get("cursor")?.dir, ".claude/skills");
  assert.equal(result.coverage.get("codex")?.dir, ".agents/skills");
});

test("detection pre-selects tools only from project markers", () => {
  const dir = makeFixture("empty");
  mkdirSync(path.join(dir, ".cursor"));
  writeFileSync(path.join(dir, "GEMINI.md"), "# rules\n");
  const home = tempDir("kit-home-");
  mkdirSync(path.join(home, ".codex"));
  const detected = detectTools(dir, { homeDir: home, pathEnv: "" });
  assert.deepEqual(detected.inProject, ["cursor", "gemini"]);
  assert.ok(detected.onMachine.includes("codex"));
  assert.ok(!detected.inProject.includes("codex"), "machine-only tools stay unchecked");
});

test("detection finds CLIs on PATH without a shell", () => {
  const bin = tempDir("kit-bin-");
  const cli = path.join(bin, process.platform === "win32" ? "claude.cmd" : "claude");
  writeFileSync(cli, "#!/bin/sh\n", { mode: 0o755 });
  const detected = detectTools(makeFixture("empty"), { homeDir: tempDir("kit-home-"), pathEnv: bin });
  assert.ok(detected.onMachine.includes("claude-code"));
});

test("collisions: same-named skills and agents in other folders a selected tool reads are reported", () => {
  const dir = makeFixture("empty");
  const home = tempDir("kit-home-");
  mkdirSync(path.join(home, ".claude/skills/verify"), { recursive: true });
  writeFileSync(path.join(home, ".claude/skills/verify/SKILL.md"), "---\nname: verify\n---\nmine\n");
  mkdirSync(path.join(dir, ".agents/skills/fix"), { recursive: true });
  writeFileSync(path.join(dir, ".agents/skills/fix/SKILL.md"), "---\nname: fix\n---\nmine\n");
  mkdirSync(path.join(dir, ".cursor/agents"), { recursive: true });
  writeFileSync(path.join(dir, ".cursor/agents/verifier.md"), "mine\n");

  const tools = pick("claude-code", "cursor");
  const collisions = findCollisions({ projectDir: dir, homeDir: home, tools, skillNames: ["verify", "fix"], agentNames: ["verifier"] });
  assert.deepEqual(
    collisions.map((c) => `${c.toolId}:${c.kind}:${c.name}:${c.where}`),
    [
      "claude-code:skill:verify:~/.claude/skills/verify",
      "cursor:skill:verify:~/.claude/skills/verify",
      "cursor:skill:fix:.agents/skills/fix",
      "cursor:agent:verifier:.cursor/agents/verifier.md",
    ],
  );
});

test("collisions ignore the folders the kit itself writes to", () => {
  const dir = makeFixture("empty");
  mkdirSync(path.join(dir, ".claude/skills/verify"), { recursive: true });
  writeFileSync(path.join(dir, ".claude/skills/verify/SKILL.md"), "x\n");
  const collisions = findCollisions({ projectDir: dir, homeDir: tempDir("kit-home-"), tools: pick("claude-code"), skillNames: ["verify"], agentNames: [] });
  assert.deepEqual(collisions, [], "a file at the kit's own destination is a normal conflict, handled by the planner");
});
