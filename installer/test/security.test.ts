import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPlan } from "../src/core/apply.js";
import { loadManifest } from "../src/core/manifest.js";
import { planInstall } from "../src/core/plan.js";
import { presetSelection } from "../src/core/resolve.js";
import { hashText } from "../src/core/record.js";
import { projectTarget } from "../src/core/target.js";
import { planUninstall } from "../src/core/uninstall.js";
import { makeFixture, tempDir } from "./fixtures.js";

// Regression tests for attacks from an untrusted project (e.g. a cloned repo) found in security review.

const manifest = loadManifest();

function outsideFile(content: string): string {
  const file = path.join(tempDir("kit-outside-"), "victim.txt");
  writeFileSync(file, content);
  return file;
}

function plantRecord(dir: string, record: object) {
  mkdirSync(path.join(dir, ".claude"), { recursive: true });
  const base = { kitVersion: "1.0.0", mode: "project", installedAt: "", updatedAt: "", components: ["evil"], filesCreated: [], filesModified: [], createdDirs: [], backups: [] };
  writeFileSync(path.join(dir, ".claude/.kit-install.json"), JSON.stringify({ ...base, ...record }));
}

test("a planted <file>.kit-tmp symlink can't redirect the write outside the project", () => {
  const dir = makeFixture("existing-settings");
  const victim = outsideFile("export PATH=safe\n");
  symlinkSync(victim, path.join(dir, "CLAUDE.md.kit-tmp"));
  symlinkSync(victim, path.join(dir, ".claude/settings.json.kit-tmp"));
  applyPlan({ manifest, plan: planInstall({ manifest, target: projectTarget(dir), selected: ["rules", "instructions", "secret-guard"], tools: ["claude-code"] }) });
  assert.equal(readFileSync(victim, "utf8"), "export PATH=safe\n");
  assert.ok(readFileSync(path.join(dir, "CLAUDE.md"), "utf8").includes("agent-engineering-kit:start"));
});

test("a forged install record can't copy a file from outside the project into it", () => {
  const dir = makeFixture("empty");
  writeFileSync(path.join(dir, "notes.md"), "hello\n");
  const secret = outsideFile("SECRET-KEY-MATERIAL\n");
  plantRecord(dir, {
    filesModified: [{ path: "notes.md", componentIds: ["evil"], installedHash: hashText("hello\n"), originalBackup: path.relative(dir, secret) }],
  });
  const plan = planInstall({ manifest, target: projectTarget(dir), selected: ["rules"], tools: ["claude-code"] });
  assert.match(plan.blockers.join(), /install record/);
  assert.throws(() => applyPlan({ manifest, plan }));
  assert.equal(readFileSync(path.join(dir, "notes.md"), "utf8"), "hello\n");
});

test("a forged backup path inside .kit-backup that is a symlink is refused too", () => {
  const dir = makeFixture("empty");
  const secret = outsideFile("SECRET\n");
  writeFileSync(path.join(dir, "CLAUDE.md"), "x\n");
  mkdirSync(path.join(dir, ".claude/.kit-backup/2026"), { recursive: true });
  symlinkSync(secret, path.join(dir, ".claude/.kit-backup/2026/CLAUDE.md"));
  plantRecord(dir, {
    components: ["claude-snippet"],
    filesModified: [{ path: "CLAUDE.md", componentIds: ["claude-snippet"], installedHash: hashText("x\n"), originalBackup: ".claude/.kit-backup/2026/CLAUDE.md" }],
  });
  const plan = planUninstall(manifest, projectTarget(dir));
  assert.ok(plan.blockers.length > 0, "planning refuses");
  assert.ok(!JSON.stringify(plan.actions).includes("SECRET"));
});

test("a forged record can't make the installer delete folders outside the project", () => {
  const dir = makeFixture("empty");
  const outside = tempDir("kit-outside-");
  mkdirSync(path.join(outside, "emptydir"));
  plantRecord(dir, { components: [], createdDirs: [path.relative(dir, path.join(outside, "emptydir"))] });
  const plan = planInstall({ manifest, target: projectTarget(dir), selected: ["rules"], tools: ["claude-code"] });
  assert.match(plan.blockers.join(), /install record/);
  assert.ok(existsSync(path.join(outside, "emptydir")));
});

test("a forged record can't make uninstall delete project files the kit never writes", () => {
  const dir = makeFixture("empty");
  mkdirSync(path.join(dir, ".git"));
  writeFileSync(path.join(dir, ".git/config"), "[core]\n");
  writeFileSync(path.join(dir, "package-lock.json"), "{}\n");
  plantRecord(dir, {
    components: ["rules"],
    filesCreated: [
      { path: ".git/config", componentIds: ["rules"], installedHash: hashText("[core]\n") },
      { path: "package-lock.json", componentIds: ["rules"], installedHash: hashText("{}\n") },
    ],
  });
  const plan = planUninstall(manifest, projectTarget(dir));
  assert.match(plan.blockers.join(), /install record/);
  assert.ok(existsSync(path.join(dir, ".git/config")) && existsSync(path.join(dir, "package-lock.json")));
});

test("a symlinked CLAUDE.md pointing outside is a blocker, and its contents never reach the preview", () => {
  const dir = makeFixture("empty");
  const secret = outsideFile("PRIVATE KEY\n");
  symlinkSync(secret, path.join(dir, "CLAUDE.md"));
  const plan = planInstall({ manifest, target: projectTarget(dir), selected: ["rules", "instructions"], tools: ["claude-code"] });
  assert.match(plan.blockers.join(), /symlink/);
  assert.ok(!JSON.stringify(plan.actions).includes("PRIVATE KEY"));
});

test("a forged jsonAdded can't make the installer remove the user's own settings entries", () => {
  const dir = makeFixture("empty");
  const settings = { permissions: { deny: ["Bash(rm -rf:*)"] }, hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "my-guard" }] }] } };
  mkdirSync(path.join(dir, ".claude"), { recursive: true });
  writeFileSync(path.join(dir, ".claude/settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
  const text = readFileSync(path.join(dir, ".claude/settings.json"), "utf8");
  mkdirSync(path.join(dir, ".agent-kit"), { recursive: true });
  writeFileSync(
    path.join(dir, ".agent-kit/install.json"),
    JSON.stringify({
      schemaVersion: 2, kitVersion: "1.0.0", mode: "project", installedAt: "", updatedAt: "", components: ["secret-guard"], tools: ["claude-code"],
      filesCreated: [], createdDirs: [], backups: [],
      filesModified: [{
        path: ".claude/settings.json", componentIds: ["secret-guard"], toolIds: ["claude-code"], installedHash: hashText("other\n"),
        jsonAdded: {
          additions: [
            { path: ["permissions", "deny"], items: ["Bash(rm -rf:*)"] },
            { path: ["hooks", "PreToolUse"], items: [{ hooks: [{ type: "command" }] }], identity: "hooks.*.type" },
          ],
          createdKeys: [], coerced: [],
        },
      }],
    }),
  );
  for (const plan of [planInstall({ manifest, target: projectTarget(dir), selected: ["rules"], tools: ["claude-code"] }), planUninstall(manifest, projectTarget(dir))]) {
    assert.match(plan.blockers.join(), /install record/);
  }
  assert.equal(readFileSync(path.join(dir, ".claude/settings.json"), "utf8"), text);
});

test("a docs/plans symlink pointing outside the project isn't followed for the plans hint", () => {
  const dir = makeFixture("empty");
  const outside = tempDir("kit-outside-");
  writeFileSync(path.join(outside, "001-secret.md"), "x\n");
  mkdirSync(path.join(dir, "docs"));
  symlinkSync(outside, path.join(dir, "docs/plans"), "dir");
  const result = planInstall({ manifest, target: projectTarget(dir), selected: presetSelection(manifest, "recommended"), tools: ["claude-code"], homeDir: tempDir("kit-home-") });
  assert.ok(!result.notes.some((n) => n.includes("docs/plans/")));
});
