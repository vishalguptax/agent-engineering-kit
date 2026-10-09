import { test } from "node:test";
import assert from "node:assert/strict";
import { markersFor, removeBlock, upsertBlock } from "../src/core/text-block.js";
import { extractProjectTemplate } from "../src/core/project-info.js";

const { start: MARKER_START, end: MARKER_END } = markersFor("html");

const SNIPPET = "## Engineering rules\nFollow @docs/agent-engineering/RULES.md.\n";
const block = `${MARKER_START}\n## Engineering rules\nFollow @docs/agent-engineering/RULES.md.\n${MARKER_END}\n`;

test("a new file gets just the marked block", () => {
  assert.deepEqual(upsertBlock(null, SNIPPET), { text: block, changed: true });
});

test("an existing file gets the block appended after a blank line", () => {
  assert.equal(upsertBlock("# My project\nUse pnpm.\n", SNIPPET).text, `# My project\nUse pnpm.\n\n${block}`);
  assert.equal(upsertBlock("# No newline", SNIPPET).text, `# No newline\n\n${block}`);
});

test("reinstalling replaces the content between the markers instead of appending again", () => {
  const installed = upsertBlock("# Mine\n", "old rules\n").text;
  const updated = upsertBlock(installed + "\n## Notes added later\n", SNIPPET);
  assert.equal(updated.text, `# Mine\n\n${block}\n## Notes added later\n`);
  assert.equal(updated.text.split(MARKER_START).length, 2, "exactly one block");
});

test("an identical block means no change", () => {
  const installed = upsertBlock("# Mine\n", SNIPPET).text;
  assert.deepEqual(upsertBlock(installed, SNIPPET), { text: installed, changed: false });
});

test("CRLF files get a CRLF block", () => {
  const { text } = upsertBlock("# Mine\r\n", SNIPPET);
  assert.ok(text.includes(`${MARKER_START}\r\n## Engineering rules\r\n`));
  assert.ok(!/[^\r]\n/.test(text));
});

test("broken markers are refused instead of guessed at", () => {
  assert.throws(() => upsertBlock(`# Mine\n${MARKER_START}\nhalf a block\n`, SNIPPET), /markers/);
  assert.throws(() => upsertBlock(`${MARKER_END}\n${MARKER_START}\n`, SNIPPET), /markers/);
});

test("removeBlock undoes the append exactly and keeps later user edits", () => {
  const original = "# My project\nUse pnpm.\n";
  const installed = upsertBlock(original, SNIPPET).text;
  assert.deepEqual(removeBlock(installed), { text: original, found: true });
  assert.deepEqual(removeBlock(installed + "\n## Mine\n"), { text: "# My project\nUse pnpm.\n\n## Mine\n", found: true });
  assert.deepEqual(removeBlock(original), { text: original, found: false });
});

test("the project template is read from Appendix A of the rules file", () => {
  const rules = "# Rules\n## Appendix A — Template\n\n```md\n## Project Overview\n- Stack:\n```\n\n## Appendix B\n";
  assert.equal(extractProjectTemplate(rules), "## Project Overview\n- Stack:\n");
  assert.equal(extractProjectTemplate("# no appendix"), null);
});

test("hash-comment files (ignore files, shell scripts) use # markers", () => {
  const { start, end } = markersFor("hash");
  assert.equal(start, "# agent-engineering-kit:start");
  assert.equal(end, "# agent-engineering-kit:end");
  const installed = upsertBlock("node_modules/\n", ".env\nsecrets/\n", "hash").text;
  assert.equal(installed, `node_modules/\n\n${start}\n.env\nsecrets/\n${end}\n`);
  assert.deepEqual(removeBlock(installed, "hash"), { text: "node_modules/\n", found: true });
  assert.equal(upsertBlock(installed, ".env\nsecrets/\n", "hash").changed, false);
});

test("markers of one style are not mistaken for the other", () => {
  const html = upsertBlock(null, "x\n").text;
  assert.deepEqual(removeBlock(html, "hash"), { text: html, found: false });
});
