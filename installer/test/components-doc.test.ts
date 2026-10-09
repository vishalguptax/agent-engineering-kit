import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadManifest } from "../src/core/manifest.js";
import { COMPONENTS_DOC_PATH, renderComponentsDoc } from "../scripts/components-doc.js";

test("docs/components.md matches kit.manifest.json (run `npm run docs` if this fails)", () => {
  assert.equal(readFileSync(COMPONENTS_DOC_PATH, "utf8"), renderComponentsDoc(loadManifest()));
});

test("every component and its explanation appear in the generated doc", () => {
  const manifest = loadManifest();
  const doc = renderComponentsDoc(manifest);
  for (const component of manifest.components) {
    assert.ok(doc.includes(`### ${component.name}`), component.id);
    assert.ok(doc.includes(component.explanation.what), component.id);
  }
});
