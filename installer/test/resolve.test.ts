import { test } from "node:test";
import assert from "node:assert/strict";
import { loadManifest } from "../src/core/manifest.js";
import { blockersFor, presetSelection, resolveSelection, suggestedComponents } from "../src/core/resolve.js";

const manifest = loadManifest();

test("presets resolve to their listed components (plus required ones)", () => {
  assert.deepEqual(presetSelection(manifest, "minimal").sort(), ["format-hook", "instructions", "rules"]);
  assert.equal(presetSelection(manifest, "everything").length, manifest.components.length);
  assert.throws(() => presetSelection(manifest, "nope"), /Unknown preset "nope"/);
});

test("selecting /feature pulls in its dependencies transitively and explains why", () => {
  const { selected, reasons } = resolveSelection(manifest, ["feature"]);
  for (const id of ["verifier", "code-simplifier", "security-reviewer", "project-conventions", "rules"]) {
    assert.ok(selected.includes(id), `${id} should be selected`);
  }
  assert.deepEqual(reasons["verifier"], ["feature"]);
  assert.deepEqual(reasons["feature"], undefined, "explicitly chosen components have no auto-reason");
  assert.ok(reasons["rules"]?.includes("feature"));
});

test("/ship pulls in /verify-change, which pulls in the verifier agent", () => {
  const { selected, reasons } = resolveSelection(manifest, ["ship"]);
  assert.ok(selected.includes("verify-change") && selected.includes("verifier"));
  assert.deepEqual(reasons["verifier"], ["verify-change"]);
});

test("required components are always selected", () => {
  const { selected, reasons } = resolveSelection(manifest, []);
  assert.deepEqual(selected, ["rules"]);
  assert.deepEqual(reasons["rules"], ["required"]);
});

test("unknown component ids are an error, not silently ignored", () => {
  assert.throws(() => resolveSelection(manifest, ["feture"]), /Unknown component "feture"/);
});

test("a component cannot be deselected while a selected component depends on it", () => {
  const { selected } = resolveSelection(manifest, ["feature"]);
  assert.deepEqual(blockersFor(manifest, selected, "verifier"), ["feature"]);
  assert.deepEqual(blockersFor(manifest, selected, "feature"), []);
  assert.deepEqual(blockersFor(manifest, ["learn", "rules"], "rules"), ["required"]);
});

test("suggested components join the recommended preset only", () => {
  assert.ok(!presetSelection(manifest, "recommended").includes("frontend-reviewer"));
  assert.ok(presetSelection(manifest, "recommended", ["frontend-reviewer"]).includes("frontend-reviewer"));
  assert.ok(!presetSelection(manifest, "minimal", ["frontend-reviewer"]).includes("frontend-reviewer"));
  assert.deepEqual(suggestedComponents(manifest, { hasFrontend: true }), ["frontend-reviewer"]);
  assert.deepEqual(suggestedComponents(manifest, { hasFrontend: false }), []);
});

test("a renamed component id from the pre-release installer still resolves to its new name", () => {
  assert.deepEqual(resolveSelection(manifest, ["claude-snippet", "instructions"]).selected.filter((id) => id === "instructions"), ["instructions"]);
});
