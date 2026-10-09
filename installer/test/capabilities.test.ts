import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilitiesOf } from "../src/tools/capabilities.js";
import { TOOL_PROFILES, toolById } from "../src/tools/profiles.js";

test("every tool has a plain-English answer for every capability", () => {
  for (const tool of TOOL_PROFILES) {
    for (const [kind, capability] of Object.entries(capabilitiesOf(tool))) {
      assert.ok(capability.detail.length > 10, `${tool.id} ${kind}`);
    }
  }
});

test("capabilities reflect the profiles", () => {
  const claude = capabilitiesOf(toolById("claude-code"));
  assert.deepEqual(Object.values(claude).map((c) => c.state), ["yes", "yes", "yes", "yes", "yes"]);
  const windsurf = capabilitiesOf(toolById("windsurf"));
  assert.equal(windsurf.agents.state, "reference");
  assert.equal(windsurf.format.state, "yes");
  const aider = capabilitiesOf(toolById("aider"));
  assert.equal(aider.rules.state, "note");
  assert.equal(aider.skills.state, "none");
  assert.equal(capabilitiesOf(toolById("codex")).format.state, "note");
});
