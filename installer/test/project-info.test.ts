import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { applyPlan } from "../src/core/apply.js";
import { markersFor } from "../src/core/text-block.js";
import { loadManifest } from "../src/core/manifest.js";
import { planInstall } from "../src/core/plan.js";
import { renderProjectSection, suggestProjectInfo } from "../src/core/project-info.js";
import { readRecord } from "../src/core/record.js";
import { projectTarget } from "../src/core/target.js";
import { planUninstall } from "../src/core/uninstall.js";
import { makeFixture, read } from "./fixtures.js";

const MARKER_START = markersFor("html").start;

const manifest = loadManifest();
const INFO = { overview: "Invoice API for small shops.", stack: "TypeScript, Fastify, Postgres", commands: "- Test: pnpm test", notes: "Money is always integer cents." };

test("renders only the sections the user filled in", () => {
  assert.equal(
    renderProjectSection(INFO),
    "## Project Overview\nInvoice API for small shops.\n- Tech stack: TypeScript, Fastify, Postgres\n\n" +
      "## Commands\n- Test: pnpm test\n\n## Additional Context\nMoney is always integer cents.\n",
  );
  assert.equal(renderProjectSection({ overview: "  ", notes: "" }), null);
  assert.equal(renderProjectSection({ markdown: "# Mine\nverbatim\n" }), "# Mine\nverbatim\n");
});

test("suggests stack and commands from the project's own files", () => {
  const dir = makeFixture("existing-settings");
  writeFileSync(path.join(dir, "Makefile"), "build:\n\tgo build\n.PHONY: build\nlint: deps\n\tgolangci-lint run\n");
  const suggestion = suggestProjectInfo(projectTarget(dir), ["JavaScript/Node.js (pnpm)"]);
  assert.equal(suggestion.stack, "JavaScript/Node.js (pnpm)");
  assert.equal(suggestion.commands, "- test: `pnpm test`\n- build: `make build`\n- lint: `make lint`");
});

test("a new AGENTS.md gets the user's project section instead of the empty template", () => {
  const dir = makeFixture("empty");
  const plan = planInstall({ manifest, target: projectTarget(dir), selected: ["instructions"], tools: ["claude-code"], projectInfo: INFO });
  const agentsMd = plan.actions.find((a) => a.path === "AGENTS.md")!.after!;
  assert.ok(agentsMd.startsWith("## Project Overview\nInvoice API"));
  assert.ok(!agentsMd.includes("- Install:"), "no empty template on top of real info");
  assert.ok(agentsMd.indexOf("Invoice API") < agentsMd.indexOf(MARKER_START));
});

test("an existing AGENTS.md gets the section before the kit's block; re-running changes nothing", () => {
  const dir = makeFixture("agents-only");
  const target = projectTarget(dir);
  applyPlan({ manifest, plan: planInstall({ manifest, target, selected: ["instructions"], tools: ["codex"], projectInfo: INFO }) });
  const text = read(dir, "AGENTS.md");
  assert.ok(text.startsWith("# Agents\n\nRun `uv run pytest`.\n\n## Project Overview\n"));
  assert.ok(text.indexOf("Money is always") < text.indexOf(MARKER_START));

  const again = planInstall({ manifest, target, selected: ["instructions"], tools: ["codex"], projectInfo: { ...INFO, overview: "Different" } });
  assert.equal(again.actions.find((a) => a.path === "AGENTS.md")!.kind, "SKIP");
  assert.match(again.notes.join(), /already has a "## Project Overview" section/);
});

test("uninstall keeps the user's project info even in an AGENTS.md the kit created", () => {
  const dir = makeFixture("empty");
  const target = projectTarget(dir);
  applyPlan({ manifest, plan: planInstall({ manifest, target, selected: ["instructions"], tools: ["codex"], projectInfo: INFO }) });
  assert.equal(readRecord(target, manifest)!.filesCreated.find((e) => e.path === "AGENTS.md")!.userContent, true);
  applyPlan({ manifest, plan: planUninstall(manifest, target) });
  assert.equal(read(dir, "AGENTS.md"), renderProjectSection(INFO));
});
