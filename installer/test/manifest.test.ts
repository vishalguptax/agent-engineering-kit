import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { KIT_ROOT, artifactSources, listKitFiles, loadManifest, validateManifest, type Manifest } from "../src/core/manifest.js";

const manifest = loadManifest();

test("every kit file is covered by the manifest (or explicitly ignored)", () => {
  const sources = new Set(manifest.components.flatMap((c) => c.artifacts.flatMap(artifactSources)));
  const missing = listKitFiles(manifest).filter((file) => !sources.has(file));
  assert.deepEqual(missing, [], `Kit files not in kit.manifest.json: ${missing.join(", ")}`);
});

test("every manifest source file exists in the kit", () => {
  const absent = manifest.components
    .flatMap((c) => c.artifacts.flatMap(artifactSources))
    .filter((source) => !existsSync(path.join(KIT_ROOT, source)));
  assert.deepEqual(absent, [], `Manifest points to missing files: ${absent.join(", ")}`);
});

test("the shipped manifest passes validation", () => {
  assert.deepEqual(validateManifest(manifest), []);
});

function withComponents(overrides: Partial<Manifest["components"][number]>[]): Manifest {
  const base = manifest.components[0];
  return { ...manifest, presets: {}, components: overrides.map((o) => ({ ...base, ...o })) };
}

test("validation catches duplicate ids, unknown deps, cycles and unsafe dests", () => {
  assert.match(validateManifest(withComponents([{ id: "a" }, { id: "a" }])).join(), /duplicate id "a"/);
  assert.match(validateManifest(withComponents([{ id: "a", dependsOn: ["nope"] }])).join(), /unknown component "nope"/);
  assert.match(
    validateManifest(withComponents([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }])).join(),
    /dependency cycle/,
  );
  const unsafe = withComponents([{ id: "a", artifacts: [{ kind: "rulebook", source: "../outside.md" }] }]);
  assert.match(validateManifest(unsafe).join(), /must be a relative path inside the kit/);
  const absolute = withComponents([{ id: "a", artifacts: [{ kind: "template", source: "/etc/passwd" }] }]);
  assert.match(validateManifest(absolute).join(), /must be a relative path inside the kit/);
  const badName = withComponents([{ id: "a", artifacts: [{ kind: "skill", name: "Bad_Name" }] }]);
  assert.match(validateManifest(badName).join(), /lowercase letters, digits and hyphens/);
});

test("presets only reference known components", () => {
  const bad = { ...manifest, presets: { minimal: ["ghost"] } };
  assert.match(validateManifest(bad).join(), /preset "minimal" references unknown component "ghost"/);
});

test("suggestFor only accepts known signals", () => {
  assert.match(validateManifest(withComponents([{ id: "a", suggestFor: "mobile" as never }])).join(), /suggestFor/);
});
