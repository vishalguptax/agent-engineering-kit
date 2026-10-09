import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToolsDoc, TOOLS_DOC_PATH } from "../scripts/tools-doc.js";
import { TOOL_PROFILES } from "../src/tools/profiles.js";

test("docs/supported-tools.md matches the tool profiles (run `npm run docs` if this fails)", () => {
  assert.equal(readFileSync(TOOLS_DOC_PATH, "utf8"), renderToolsDoc());
});

test("every tool has a matrix row, a section and its docs links", () => {
  const doc = renderToolsDoc();
  for (const tool of TOOL_PROFILES) {
    assert.ok(doc.includes(`| ${tool.name} | \`${tool.id}\` |`), tool.id);
    assert.ok(doc.includes(`## ${tool.name}`), tool.id);
    for (const url of tool.docs) assert.ok(doc.includes(`<${url}>`), url);
  }
});
