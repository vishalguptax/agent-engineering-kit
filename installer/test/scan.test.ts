import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadManifest } from "../src/core/manifest.js";
import { scan } from "../src/core/scan.js";
import { projectTarget } from "../src/core/target.js";
import { makeFixture, tempDir } from "./fixtures.js";

const manifest = loadManifest();

test("finds existing Claude setup and the stack in a project", () => {
  const result = scan(manifest, projectTarget(makeFixture("existing-settings")), tempDir("kit-home-"));
  assert.equal(result.folderProblem, null);
  assert.equal(result.found.settingsJson, true);
  assert.deepEqual(result.found.agents, ["verifier"]);
  assert.equal(result.found.claudeMd, true);
  assert.equal(result.found.agentsMd, false);
  assert.deepEqual(result.stack, ["JavaScript/Node.js (pnpm)"]);
  assert.equal(result.settingsProblem, null);
  assert.equal(result.record, null);
});

test("reports invalid settings.json and AGENTS.md-only projects", () => {
  assert.match(scan(manifest, projectTarget(makeFixture("invalid-settings"))).settingsProblem ?? "", /not valid JSON/);
  const agents = scan(manifest, projectTarget(makeFixture("agents-only")));
  assert.equal(agents.found.agentsMd, true);
  assert.deepEqual(agents.stack, ["Python"]);
});

test("detects Matt Pocock's skills from the plugin registry or skill folders", () => {
  const project = projectTarget(makeFixture("empty"));
  const home = tempDir("kit-home-");
  assert.equal(scan(manifest, project, home).mattSkills.isDetected, false);

  mkdirSync(path.join(home, ".claude", "plugins"), { recursive: true });
  writeFileSync(
    path.join(home, ".claude", "plugins", "installed_plugins.json"),
    JSON.stringify({ version: 2, plugins: { "mattpocock-skills@claude-plugins-official": [] } }),
  );
  assert.deepEqual(scan(manifest, project, home).mattSkills.evidence, ["plugin mattpocock-skills@claude-plugins-official"]);

  const other = projectTarget(makeFixture("empty"));
  mkdirSync(path.join(other.root, ".claude", "skills", "tdd"), { recursive: true });
  assert.equal(scan(manifest, other, tempDir("kit-home-")).mattSkills.isDetected, true);
});

test("a missing folder is reported, not crashed on", () => {
  assert.match(scan(manifest, projectTarget("/definitely/not/here")).folderProblem ?? "", /does not exist/);
});

test("detects a frontend stack from package.json dependencies or Flutter", () => {
  const web = makeFixture("empty");
  writeFileSync(path.join(web, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" } }));
  assert.equal(scan(manifest, projectTarget(web)).hasFrontend, true);
  const api = makeFixture("empty");
  writeFileSync(path.join(api, "package.json"), JSON.stringify({ dependencies: { express: "5.0.0" } }));
  assert.equal(scan(manifest, projectTarget(api)).hasFrontend, false);
  const flutter = makeFixture("empty");
  writeFileSync(path.join(flutter, "pubspec.yaml"), "dependencies:\n  flutter:\n    sdk: flutter\n");
  assert.equal(scan(manifest, projectTarget(flutter)).hasFrontend, true);
});
