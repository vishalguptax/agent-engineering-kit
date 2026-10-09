import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPlan } from "../src/core/apply.js";
import { loadManifest } from "../src/core/manifest.js";
import { hasChanges, planInstall, type ConflictChoice } from "../src/core/plan.js";
import { hashText, readRecord } from "../src/core/record.js";
import { presetSelection, resolveSelection } from "../src/core/resolve.js";
import { globalTarget, projectTarget, type Target } from "../src/core/target.js";
import { markersFor } from "../src/core/text-block.js";
import { planUninstall } from "../src/core/uninstall.js";
import type { ToolId } from "../src/tools/profiles.js";
import { makeFixture, read, snapshotTree, tempDir, USER_SETTINGS, type FixtureKind } from "./fixtures.js";

const { start: MARKER_START, end: MARKER_END } = markersFor("html");
const manifest = loadManifest();
const recommended = presetSelection(manifest, "recommended");
const homeDir = tempDir("kit-home-");
const CLAUDE: ToolId[] = ["claude-code"];

function plan(target: Target, selected = recommended, tools: ToolId[] = CLAUDE) {
  return planInstall({ manifest, target, selected, tools, homeDir });
}

function install(target: Target, selected = recommended, resolutions: Record<string, ConflictChoice> = {}, tools: ToolId[] = CLAUDE) {
  return applyPlan({ manifest, plan: plan(target, selected, tools), resolutions });
}

function uninstall(target: Target) {
  return applyPlan({ manifest, plan: planUninstall(manifest, target) });
}

/** The project's files as the user sees them: the kit's backups (kept on purpose) are left out. */
function userTree(dir: string, original: Record<string, string>) {
  const tree = snapshotTree(dir, [".agent-kit/backup"]);
  const holdsOnlyBackups = !Object.keys(tree).some((k) => k.startsWith(".agent-kit/") && k !== ".agent-kit/");
  if (!(".agent-kit/" in original) && holdsOnlyBackups) delete tree[".agent-kit/"];
  return tree;
}

for (const kind of ["empty", "existing-settings", "agents-only"] as FixtureKind[]) {
  test(`(${kind}) installing twice with the same choices changes nothing the second time`, () => {
    const target = projectTarget(makeFixture(kind));
    assert.ok(install(target).changedFiles.length > 0);
    const afterFirst = snapshotTree(target.root);
    const second = plan(target);
    const kinds = new Set(second.actions.map((a) => a.kind));
    assert.ok([...kinds].every((k) => k === "SKIP" || k === "CONFLICT"), [...kinds].join(","));
    assert.deepEqual(applyPlan({ manifest, plan: second }).changedFiles, []);
    assert.deepEqual(snapshotTree(target.root), afterFirst, "not even the record is rewritten");
  });
}

test("(d) a project where the kit is already installed plans all SKIPs, for several tools at once", () => {
  const target = projectTarget(makeFixture("empty"));
  const tools: ToolId[] = ["claude-code", "codex", "cursor", "windsurf", "gemini"];
  install(target, recommended, {}, tools);
  assert.deepEqual([...new Set(plan(target, recommended, tools).actions.map((a) => a.kind))], ["SKIP"]);
});

test("Gemini CLI: a second run changes nothing and keeps GEMINI.md in context.fileName", () => {
  const dir = makeFixture("empty");
  install(projectTarget(dir), ["instructions"], {}, ["gemini"]);
  assert.deepEqual(JSON.parse(read(dir, ".gemini/settings.json")).context.fileName, ["GEMINI.md", "AGENTS.md"]);
  const again = plan(projectTarget(dir), ["instructions"], ["gemini"]);
  assert.deepEqual(again.actions.filter((a) => a.kind !== "SKIP").map((a) => `${a.kind} ${a.path}`), []);
});

test("dropping a tool that owns no files of its own still updates the record, and every entry's owners", () => {
  const dir = makeFixture("empty");
  const target = projectTarget(dir);
  install(target, ["instructions"], {}, ["codex", "generic"]);
  const narrowed = plan(target, ["instructions"], ["codex"]);
  assert.ok(narrowed.actions.every((a) => a.kind === "SKIP"));
  assert.ok(hasChanges(narrowed, () => true), "a record-only change counts as a change");
  applyPlan({ manifest, plan: narrowed });
  const record = readRecord(target, manifest)!;
  assert.deepEqual(record.tools, ["codex"]);
  assert.deepEqual(record.filesCreated.find((e) => e.path === "AGENTS.md")?.toolIds, ["codex"]);
  assert.equal(hasChanges(plan(target, ["instructions"], ["codex"]), () => true), false, "and then it's settled");
});

test("updating a 1.0.0 install renames fix and verify to quick-fix and verify-change, without leftovers", () => {
  const dir = makeFixture("empty");
  const target = projectTarget(dir);
  install(target, resolveSelection(manifest, ["quick-fix"]).selected, {}, ["claude-code"]);
  // Rewrite the install as 1.0.0 left it: the old skill folders and component ids.
  const recordFile = path.join(dir, ".agent-kit/install.json");
  for (const [from, to] of [["quick-fix", "fix"], ["verify-change", "verify"]]) {
    const text = read(dir, `.claude/skills/${from}/SKILL.md`).replace(`name: "${from}"`, `name: "${to}"`);
    mkdirSync(path.join(dir, `.claude/skills/${to}`), { recursive: true });
    writeFileSync(path.join(dir, `.claude/skills/${to}/SKILL.md`), text);
    rmSync(path.join(dir, `.claude/skills/${from}`), { recursive: true });
    const record = readFileSync(recordFile, "utf8").replaceAll(`.claude/skills/${from}/`, `.claude/skills/${to}/`).replaceAll(`.claude/skills/${from}"`, `.claude/skills/${to}"`).replaceAll(`"${from}"`, `"${to}"`);
    const entry = JSON.parse(record);
    for (const e of entry.filesCreated) if (e.path === `.claude/skills/${to}/SKILL.md`) e.installedHash = hashText(text);
    writeFileSync(recordFile, JSON.stringify(entry));
  }
  const update = plan(target, resolveSelection(manifest, readRecord(target, manifest)!.components).selected);
  assert.deepEqual(update.blockers, []);
  applyPlan({ manifest, plan: update });
  assert.ok(existsSync(path.join(dir, ".claude/skills/quick-fix/SKILL.md")) && existsSync(path.join(dir, ".claude/skills/verify-change/SKILL.md")));
  assert.ok(!existsSync(path.join(dir, ".claude/skills/fix")) && !existsSync(path.join(dir, ".claude/skills/verify")), "the old skills are removed");
  assert.deepEqual(readRecord(target, manifest)!.components.sort(), ["quick-fix", "rules", "verifier", "verify-change"].sort());
});

test("backs up every file it changes and writes a v2 install record in .agent-kit/", () => {
  const dir = makeFixture("existing-settings");
  const originals = { settings: read(dir, ".claude/settings.json"), claudeMd: read(dir, "CLAUDE.md"), verifier: read(dir, ".claude/agents/verifier.md") };
  const result = install(projectTarget(dir), recommended, { ".claude/agents/verifier.md": "kit" });

  assert.ok(result.backupDir?.includes(`${path.sep}.agent-kit${path.sep}backup${path.sep}`));
  const backup = (rel: string) => readFileSync(path.join(result.backupDir!, rel), "utf8");
  assert.equal(backup(".claude/settings.json"), originals.settings);
  assert.equal(backup("CLAUDE.md"), originals.claudeMd);
  assert.equal(backup(".claude/agents/verifier.md"), originals.verifier);
  assert.ok(!existsSync(path.join(result.backupDir!, "docs")), "new files are not backed up");

  const record = readRecord(projectTarget(dir), manifest)!;
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.kitVersion, manifest.kitVersion);
  assert.deepEqual(record.tools, ["claude-code"]);
  assert.deepEqual(record.components, recommended);
  assert.deepEqual(record.filesModified.map((e) => e.path).sort(), [".claude/agents/verifier.md", ".claude/settings.json", "CLAUDE.md"]);
  assert.ok(record.filesCreated.some((e) => e.path === "AGENTS.md" && e.block === "html"));
  const settingsEntry = record.filesModified.find((e) => e.path === ".claude/settings.json")!;
  assert.equal(settingsEntry.installedHash, hashText(read(dir, ".claude/settings.json")));
  assert.ok(settingsEntry.originalBackup?.startsWith(".agent-kit/backup/"));
  assert.ok(existsSync(path.join(dir, ".agent-kit/install.json")));
  assert.ok(!existsSync(path.join(dir, ".claude/.kit-install.json")));
});

for (const [kind, resolutions, tools] of [
  ["empty", {}, CLAUDE],
  ["existing-settings", { ".claude/agents/verifier.md": "kit" }, CLAUDE],
  ["existing-settings", { ".claude/agents/verifier.md": "kit-new" }, CLAUDE],
  ["agents-only", {}, CLAUDE],
  ["empty", {}, ["claude-code", "codex", "cursor", "gemini", "windsurf", "kiro", "copilot"]],
] as [FixtureKind, Record<string, ConflictChoice>, ToolId[]][]) {
  test(`(${kind}, ${tools.join("+")}, ${JSON.stringify(resolutions)}) uninstall restores the original tree exactly`, () => {
    const target = projectTarget(makeFixture(kind));
    const original = snapshotTree(target.root);
    install(target, recommended, resolutions, tools);
    assert.notDeepEqual(userTree(target.root, original), original);
    assert.deepEqual(planUninstall(manifest, target).blockers, []);
    uninstall(target);
    assert.deepEqual(userTree(target.root, original), original);
    assert.equal(readRecord(target, manifest), null);
  });
}

test("uninstall after the user edited files removes only the kit's parts and keeps their edits", () => {
  const dir = makeFixture("existing-settings");
  const target = projectTarget(dir);
  install(target);

  writeFileSync(path.join(dir, "CLAUDE.md"), read(dir, "CLAUDE.md") + "\n## Project Overview\n- Filled in by me\n");
  const settings = JSON.parse(read(dir, ".claude/settings.json"));
  settings.permissions.allow.push("Bash(pnpm lint)");
  writeFileSync(path.join(dir, ".claude/settings.json"), JSON.stringify(settings, null, 4) + "\n");
  writeFileSync(path.join(dir, ".claude/agents/code-simplifier.md"), "my tweaked simplifier\n");

  assert.match(planUninstall(manifest, target).actions.find((a) => a.path === ".claude/agents/code-simplifier.md")!.summary, /Kept/);
  uninstall(target);

  assert.equal(read(dir, "CLAUDE.md"), "# Acme\n\nUse pnpm.\n\n## Project Overview\n- Filled in by me\n");
  assert.deepEqual(JSON.parse(read(dir, ".claude/settings.json")), {
    ...USER_SETTINGS,
    permissions: { ...USER_SETTINGS.permissions, allow: ["Bash(npm test)", "Bash(pnpm lint)"] },
  });
  assert.equal(read(dir, ".claude/agents/code-simplifier.md"), "my tweaked simplifier\n");
  assert.equal(read(dir, ".claude/agents/verifier.md"), "---\nname: verifier\n---\nMy own verifier.\n", "user's conflicting file never touched");
  assert.ok(!existsSync(path.join(dir, "docs")), "unchanged kit files and their empty folders are removed");
  assert.ok(!existsSync(path.join(dir, "AGENTS.md")));
});

test("deselecting a component removes its files and only its entries in a shared settings file", () => {
  const target = projectTarget(makeFixture("empty"));
  install(target);
  const without = resolveSelection(manifest, recommended.filter((id) => id !== "format-hook")).selected;
  const next = plan(target, without);
  const kinds = Object.fromEntries(next.actions.filter((a) => a.kind !== "SKIP").map((a) => [a.path, a.kind]));
  assert.deepEqual(kinds, { ".agent-kit/format.mjs": "REMOVE", ".claude/settings.json": "MERGE" });

  applyPlan({ manifest, plan: next });
  assert.deepEqual(Object.keys(JSON.parse(read(target.root, ".claude/settings.json"))), ["permissions"]);
  const entry = readRecord(target, manifest)!.filesCreated.find((e) => e.path === ".claude/settings.json")!;
  assert.deepEqual(entry.jsonAdded!.additions.map((a) => a.path.join(".")), ["permissions.deny"]);
  assert.deepEqual(entry.jsonAdded!.createdKeys, ["permissions", "permissions.deny"]);
  assert.deepEqual(plan(target, without).actions.filter((a) => a.kind !== "SKIP"), []);
});

test("removing one of three tools removes only what that tool alone needed", () => {
  const target = projectTarget(makeFixture("empty"));
  install(target, recommended, {}, ["claude-code", "codex", "cursor"]);
  const next = plan(target, recommended, ["claude-code", "codex"]);
  const removed = next.actions.filter((a) => a.kind === "REMOVE").map((a) => a.path).sort();
  assert.deepEqual(removed, [".cursor/hooks.json", ".cursorignore"]);
  applyPlan({ manifest, plan: next });
  for (const kept of ["AGENTS.md", ".claude/skills/feature/SKILL.md", ".agents/skills/feature/SKILL.md", ".codex/agents/verifier.toml"]) {
    assert.ok(existsSync(path.join(target.root, kept)), `${kept} is still needed by the other tools`);
  }
  assert.deepEqual(readRecord(target, manifest)!.tools, ["claude-code", "codex"]);
});

test("update: a kit file the user never edited is UPDATEd; an edited one is a CONFLICT", () => {
  const dir = makeFixture("empty");
  const target = projectTarget(dir);
  install(target);
  // Pretend an older kit version was installed: the files hold old content and the record agrees.
  const recordFile = path.join(dir, ".agent-kit/install.json");
  const record = JSON.parse(readFileSync(recordFile, "utf8"));
  for (const rel of [".claude/agents/verifier.md", ".claude/agents/code-simplifier.md"]) {
    writeFileSync(path.join(dir, rel), "old kit version\n");
    record.filesCreated.find((e: { path: string }) => e.path === rel).installedHash = hashText("old kit version\n");
  }
  writeFileSync(recordFile, JSON.stringify(record));
  writeFileSync(path.join(dir, ".claude/agents/code-simplifier.md"), "old kit version, edited by me\n");

  const kinds = Object.fromEntries(plan(target).actions.map((a) => [a.path, a.kind]));
  assert.equal(kinds[".claude/agents/verifier.md"], "UPDATE");
  assert.equal(kinds[".claude/agents/code-simplifier.md"], "CONFLICT");
});

test("a plan with blockers is refused and nothing is written", () => {
  const dir = makeFixture("invalid-settings");
  const before = snapshotTree(dir);
  assert.throws(() => install(projectTarget(dir)), /not valid JSON/);
  assert.deepEqual(snapshotTree(dir), before);
});

test("a symlink planted after planning is still refused at write time", () => {
  const dir = makeFixture("empty");
  const planned = plan(projectTarget(dir), ["rules"]);
  const outside = tempDir("kit-outside-");
  symlinkSync(outside, path.join(dir, "docs"), "dir");
  assert.throws(() => applyPlan({ manifest, plan: planned }), /outside/);
  assert.deepEqual(snapshotTree(outside), {});
});

test("global install and uninstall with a fake home never leave ~/.claude", () => {
  const home = tempDir("kit-home-");
  mkdirSync(path.join(home, ".claude"));
  writeFileSync(path.join(home, ".claude", "CLAUDE.md"), "# My global rules\n");
  const target = globalTarget(home);
  const original = snapshotTree(home);
  install(target);
  assert.ok(read(home, ".claude/CLAUDE.md").includes(MARKER_START));
  assert.ok(existsSync(path.join(home, ".claude/skills/feature/SKILL.md")));
  assert.ok(existsSync(path.join(home, ".claude/.agent-kit/install.json")));
  assert.deepEqual(Object.keys(snapshotTree(home)).filter((k) => !k.startsWith(".claude")), []);
  uninstall(target);
  assert.deepEqual(snapshotTree(home, [".claude/.agent-kit"]), original);
});

// ---------- migration from the pre-release installer (Claude Code only, record in .claude/.kit-install.json) ----------

const V1_HOOK = '"$CLAUDE_PROJECT_DIR"/.claude/hooks/format.sh';
const V1_BLOCK = `${MARKER_START}\n## Engineering rules\nFollow @docs/AGENT_ENGINEERING_RULES.md in addition to this file.\n${MARKER_END}\n`;

/** Writes the files and record a pre-release install left behind. */
function makeVersion1Install(dir: string, variant: "claude-md" | "agents-route") {
  const write = (rel: string, content: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  };
  const settings = JSON.stringify(
    { permissions: { deny: ["Read(./.env)"] }, hooks: { PostToolUse: [{ matcher: "Edit|MultiEdit|Write", hooks: [{ type: "command", command: V1_HOOK, timeout: 30 }] }] } },
    null,
    2,
  ) + "\n";
  const files: Record<string, string> = {
    "docs/AGENT_ENGINEERING_RULES.md": "# Agent Engineering Rules (v1)\n",
    ".claude/hooks/format.sh": "#!/usr/bin/env bash\nexit 0\n",
    ".claude/agents/verifier.md": "---\nname: verifier\n---\nv1 verifier\n",
    ".claude/settings.json": settings,
  };
  if (variant === "claude-md") files["CLAUDE.md"] = V1_BLOCK;
  else Object.assign(files, { "AGENTS.md": `# Agents\n\n${V1_BLOCK}`, "CLAUDE.md": "@AGENTS.md\n" });
  for (const [rel, content] of Object.entries(files)) write(rel, content);

  const entry = (rel: string, componentIds: string[], extra: object = {}) => ({ path: rel, componentIds, installedHash: hashText(files[rel]), ...extra });
  const filesCreated = [
    entry("docs/AGENT_ENGINEERING_RULES.md", ["rules"]),
    entry(".claude/hooks/format.sh", ["format-hook"]),
    entry(".claude/agents/verifier.md", ["verifier"]),
    entry(".claude/settings.json", ["format-hook", "secret-guard"], {
      settingsAdded: { deny: ["Read(./.env)"], hookCommands: [V1_HOOK], createdKeys: ["permissions", "permissions.deny", "hooks", "hooks.PostToolUse"] },
    }),
    ...(variant === "claude-md"
      ? [entry("CLAUDE.md", ["claude-snippet"], { snippet: true })]
      : [entry("AGENTS.md", ["claude-snippet"], { snippet: true }), entry("CLAUDE.md", ["claude-snippet"])]),
  ];
  write(
    ".claude/.kit-install.json",
    JSON.stringify({
      kitVersion: "1.0.0",
      mode: "project",
      installedAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      components: ["rules", "claude-snippet", "verifier", "format-hook", "secret-guard"],
      filesCreated,
      filesModified: [],
      createdDirs: ["docs", ".claude", ".claude/hooks", ".claude/agents"],
      backups: [],
    }),
  );
}

const MIGRATED = ["rules", "instructions", "verifier", "format-hook", "secret-guard"];

test("migration (block in CLAUDE.md): CLAUDE.md becomes an import, the hub moves to AGENTS.md, the old hook is replaced", () => {
  const dir = makeFixture("empty");
  makeVersion1Install(dir, "claude-md");
  const target = projectTarget(dir);
  const migration = plan(target, MIGRATED);
  assert.deepEqual(migration.blockers, []);
  const kinds = Object.fromEntries(migration.actions.map((a) => [a.path, a.kind]));
  assert.equal(kinds["docs/AGENT_ENGINEERING_RULES.md"], "REMOVE", "the old, unchanged rulebook goes");
  assert.equal(kinds[".claude/hooks/format.sh"], "REMOVE");
  assert.equal(kinds["docs/agent-engineering/RULES.md"], "CREATE");
  assert.equal(kinds["CLAUDE.md"], "APPEND");
  assert.equal(kinds["AGENTS.md"], "CREATE");
  assert.equal(kinds[".claude/agents/verifier.md"], "UPDATE", "unchanged v1 agent is updated");

  applyPlan({ manifest, plan: migration });
  assert.equal(read(dir, "CLAUDE.md"), `${MARKER_START}\n@AGENTS.md\n${MARKER_END}\n`);
  const hooks = JSON.parse(read(dir, ".claude/settings.json")).hooks.PostToolUse.flatMap((g: { hooks: { command: string }[] }) => g.hooks.map((h) => h.command));
  assert.deepEqual(hooks, ['node "$CLAUDE_PROJECT_DIR/.agent-kit/format.mjs" --from claude']);
  assert.ok(!existsSync(path.join(dir, ".claude/.kit-install.json")), "the old record is gone");
  assert.equal(readRecord(target, manifest)!.schemaVersion, 2);
  assert.deepEqual([...new Set(plan(target, MIGRATED).actions.map((a) => a.kind))], ["SKIP"], "a second run changes nothing");
});

test("migration (AGENTS.md route): the plain @AGENTS.md CLAUDE.md is adopted, not duplicated", () => {
  const dir = makeFixture("empty");
  makeVersion1Install(dir, "agents-route");
  const migration = plan(projectTarget(dir), MIGRATED);
  const claude = migration.actions.find((a) => a.path === "CLAUDE.md")!;
  assert.equal(claude.kind, "UPDATE");
  assert.equal(claude.after, `${MARKER_START}\n@AGENTS.md\n${MARKER_END}\n`);
  assert.equal(migration.actions.find((a) => a.path === "AGENTS.md")!.kind, "APPEND");
  applyPlan({ manifest, plan: migration });
  assert.ok(read(dir, "AGENTS.md").startsWith("# Agents\n\n"));
  assert.equal(read(dir, "AGENTS.md").split(MARKER_START).length, 2, "exactly one kit block");
});

test("migration keeps a rulebook the user edited, and installs the new one next to it", () => {
  const dir = makeFixture("empty");
  makeVersion1Install(dir, "claude-md");
  writeFileSync(path.join(dir, "docs/AGENT_ENGINEERING_RULES.md"), "# My edited rules\n");
  const migration = plan(projectTarget(dir), MIGRATED);
  assert.match(migration.actions.find((a) => a.path === "docs/AGENT_ENGINEERING_RULES.md")!.summary, /Kept/);
  applyPlan({ manifest, plan: migration });
  assert.equal(read(dir, "docs/AGENT_ENGINEERING_RULES.md"), "# My edited rules\n");
  assert.ok(existsSync(path.join(dir, "docs/agent-engineering/RULES.md")));
});
