import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { KIT_ROOT } from "../src/core/manifest.js";
import { mergeJson } from "../src/core/json-merge.js";
import { renderAgent, AGENT_FORMATS } from "../src/render/agent.js";
import { parseFrontmatter } from "../src/render/frontmatter.js";
import { formatHookAddition, formatHookSeed } from "../src/render/hooks.js";
import { claudeImportBlock, geminiContextAddition } from "../src/render/instructions.js";
import { secretGuardAddition, secretGuardIgnoreLines } from "../src/render/secret-guard.js";
import { renderSkill } from "../src/render/skill.js";

const kitFile = (rel: string) => readFileSync(path.join(KIT_ROOT, rel), "utf8");
const AGENT = `---
name: probe
description: Checks things: carefully, with "quotes" and #hashes.
access: read-only
---

You check things. You never edit files.
`;

test("every kit skill follows the Agent Skills spec and renders to one identical file", () => {
  for (const name of readdirSync(path.join(KIT_ROOT, "skills"))) {
    const rendered = renderSkill(kitFile(`skills/${name}/SKILL.md`), name);
    const { data } = parseFrontmatter(rendered, name);
    assert.equal(data.name, name);
    assert.ok(typeof data.description === "string" && data.description.length <= 1024);
    assert.equal(renderSkill(rendered, name), rendered, `${name}: rendering is stable`);
  }
});

test("a skill whose name doesn't match its folder, or breaks the spec, is refused", () => {
  assert.throws(() => renderSkill("---\nname: other\ndescription: x\n---\nbody\n", "fix"), /must match its folder/);
  assert.throws(() => renderSkill("---\nname: Fix_It\ndescription: x\n---\nbody\n", "Fix_It"), /lowercase letters, digits and hyphens/);
  assert.throws(() => renderSkill("---\nname: fix\n---\nbody\n", "fix"), /needs a description/);
});

test("agents: Claude format gets read-only tools and quoted strings", () => {
  assert.equal(
    renderAgent(AGENT, "claude-md"),
    `---\nname: "probe"\ndescription: "Checks things: carefully, with \\"quotes\\" and #hashes."\ntools: "Read, Grep, Glob, Bash"\nmodel: "inherit"\n---\n\nYou check things. You never edit files.\n`,
  );
});

test("agents: each format uses only its documented fields", () => {
  const fields = (format: (typeof AGENT_FORMATS)[number]) => Object.keys(parseFrontmatterLoose(renderAgent(AGENT, format)));
  assert.deepEqual(fields("cursor-md"), ["name", "description", "model", "readonly"]);
  assert.deepEqual(fields("copilot-agent-md"), ["name", "description"]);
  assert.deepEqual(fields("gemini-md"), ["name", "description"]);
  assert.deepEqual(fields("antigravity-md"), ["name", "description", "model"]);
  assert.deepEqual(fields("kiro-md"), ["name", "description"]);
  assert.deepEqual(fields("junie-md"), ["name", "description"]);
  assert.deepEqual(fields("augment-md"), ["name", "description"]);
  assert.ok(renderAgent(AGENT, "opencode-md").includes('mode: "subagent"\npermission:\n  edit: "deny"\n'));
  assert.ok(renderAgent(AGENT, "cursor-md").includes("readonly: true"));
});

test("agents: edit access drops the read-only restrictions", () => {
  const editor = AGENT.replace("access: read-only", "access: edit");
  assert.ok(!renderAgent(editor, "claude-md").includes("tools:"));
  assert.ok(renderAgent(editor, "cursor-md").includes("readonly: false"));
  assert.ok(!renderAgent(editor, "opencode-md").includes("permission"));
  assert.ok(!renderAgent(editor, "codex-toml").includes("sandbox_mode"));
});

test("agents: Codex TOML uses a literal multi-line string, or an escaped one when the body contains '''", () => {
  assert.equal(
    renderAgent(AGENT, "codex-toml"),
    `name = "probe"\ndescription = "Checks things: carefully, with \\"quotes\\" and #hashes."\nsandbox_mode = "read-only"\ndeveloper_instructions = '''\nYou check things. You never edit files.\n'''\n`,
  );
  const tricky = renderAgent(AGENT.replace("You check things.", "Use ''' and \\ carefully."), "codex-toml");
  assert.ok(tricky.includes('developer_instructions = """\nUse \'\'\' and \\\\ carefully.'));
});

test("every kit agent renders in every format", () => {
  for (const file of readdirSync(path.join(KIT_ROOT, "agents"))) {
    for (const format of AGENT_FORMATS) assert.ok(renderAgent(kitFile(`agents/${file}`), format).length > 0, `${file} as ${format}`);
  }
});

test("an agent without a valid access field is refused", () => {
  assert.throws(() => renderAgent(AGENT.replace("access: read-only", "access: admin"), "claude-md"), /access must be "read-only" or "edit"/);
});

test("instructions: Claude gets an @AGENTS.md import; Gemini gets AGENTS.md added without losing GEMINI.md", () => {
  assert.equal(claudeImportBlock(), "@AGENTS.md\n");
  const fresh = mergeJson(null, [geminiContextAddition()]);
  assert.deepEqual(JSON.parse(fresh.text).context.fileName, ["GEMINI.md", "AGENTS.md"]);
  const custom = '{ "context": { "fileName": "RULES.md" } }';
  assert.deepEqual(JSON.parse(mergeJson(custom, [geminiContextAddition()]).text).context.fileName, ["RULES.md", "AGENTS.md"]);
});

test("format hooks: one documented entry per tool, identified by its command", () => {
  const claude = formatHookAddition("claude-settings");
  assert.deepEqual(claude.path, ["hooks", "PostToolUse"]);
  const [group] = claude.items as { hooks: { command: string }[] }[];
  assert.equal(group.hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/.agent-kit/format.mjs" --from claude');
  const cursor = mergeJson(null, [formatHookAddition("cursor-hooks")], ".cursor/hooks.json", formatHookSeed("cursor-hooks"));
  assert.deepEqual(JSON.parse(cursor.text), { version: 1, hooks: { afterFileEdit: [{ command: "node .agent-kit/format.mjs --from cursor" }] } });
  const devin = formatHookAddition("devin-hooks");
  assert.deepEqual(devin.items, [{ command: "node .agent-kit/format.mjs --from devin", powershell: "node .agent-kit/format.mjs --from devin", show_output: false }]);
});

test("secret guard: Claude deny rules and ignore-file lines", () => {
  assert.deepEqual(secretGuardAddition().items, ["Read(./.env)", "Read(./.env.*)", "Read(./**/.env)", "Read(./**/.env.*)", "Read(./secrets/**)"]);
  assert.equal(secretGuardIgnoreLines(), ".env\n.env.*\nsecrets/\n");
});

/** Frontmatter keys including nested blocks (rendered output may nest one level). */
function parseFrontmatterLoose(text: string): Record<string, true> {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)![1];
  return Object.fromEntries(block.split("\n").filter((l) => /^\w/.test(l)).map((l) => [l.split(":")[0], true]));
}
