import { test } from "node:test";
import assert from "node:assert/strict";
import { JsonParseError, mergeJson, unmergeJson, type ArrayAddition } from "../src/core/json-merge.js";

const HOOK = "node .agent-kit/format.mjs --from claude";
const DENY: ArrayAddition = { path: ["permissions", "deny"], items: ["Read(./.env)", "Read(./secrets/**)"] };
const HOOKS: ArrayAddition = {
  path: ["hooks", "PostToolUse"],
  items: [{ matcher: "Edit|MultiEdit|Write", hooks: [{ type: "command", command: HOOK, timeout: 30 }] }],
  identity: "hooks.*.command",
};
const BOTH = [DENY, HOOKS];

test("creates a file from scratch with 2-space indent and a trailing newline", () => {
  const result = mergeJson(null, BOTH);
  assert.equal(result.changed, true);
  assert.deepEqual(JSON.parse(result.text), {
    permissions: { deny: DENY.items },
    hooks: { PostToolUse: HOOKS.items },
  });
  assert.ok(result.text.startsWith('{\n  "permissions"'));
  assert.ok(result.text.endsWith("}\n"));
});

test("keeps the user's own entries untouched and appends only what's missing", () => {
  const existing = JSON.stringify(
    {
      model: "opus",
      permissions: { allow: ["Bash(npm test)"], deny: ["Read(./.env)", "WebFetch"] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./guard.sh" }] }],
        PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "./lint.sh" }] }],
      },
    },
    null,
    4,
  );
  const result = mergeJson(existing, BOTH);
  const merged = JSON.parse(result.text);
  assert.equal(merged.model, "opus");
  assert.deepEqual(merged.permissions.allow, ["Bash(npm test)"]);
  assert.deepEqual(merged.permissions.deny, ["Read(./.env)", "WebFetch", "Read(./secrets/**)"]);
  assert.deepEqual(merged.hooks.PreToolUse, [{ matcher: "Bash", hooks: [{ type: "command", command: "./guard.sh" }] }]);
  assert.equal(merged.hooks.PostToolUse.length, 2);
  assert.deepEqual(result.added, {
    additions: [
      { path: ["permissions", "deny"], items: ["Read(./secrets/**)"] },
      { path: ["hooks", "PostToolUse"], items: HOOKS.items, identity: "hooks.*.command" },
    ],
    createdKeys: [],
    coerced: [],
  });
  assert.ok(result.text.includes('\n    "model"'), "4-space indent is preserved");
});

test("merging again adds nothing and leaves the text byte-for-byte identical", () => {
  const once = mergeJson(null, BOTH).text;
  const twice = mergeJson(once, BOTH);
  assert.equal(twice.changed, false);
  assert.equal(twice.text, once);
});

test("an item counts as present when any nested identity matches", () => {
  const existing = JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: HOOK }] }] } });
  assert.equal(mergeJson(existing, [HOOKS]).changed, false);
});

test("a scalar where an array is expected is turned into an array, and restored on unmerge", () => {
  const existing = '{\n  "context": {\n    "fileName": "GEMINI.md"\n  }\n}\n';
  const addition: ArrayAddition = { path: ["context", "fileName"], items: ["AGENTS.md"], coerceScalar: true };
  const result = mergeJson(existing, [addition]);
  assert.deepEqual(JSON.parse(result.text).context.fileName, ["GEMINI.md", "AGENTS.md"]);
  assert.deepEqual(result.added.coerced, [{ path: ["context", "fileName"], original: "GEMINI.md" }]);
  assert.equal(unmergeJson(result.text, result.added), existing);
});

test("without coerceScalar a scalar is refused, not overwritten", () => {
  assert.throws(() => mergeJson('{"permissions": {"deny": "x"}}', [DENY]), /"permissions.deny" is not an array/);
  assert.throws(() => mergeJson('{"permissions": "all"}', [DENY]), /"permissions" is not an object/);
});

test("tab indentation and CRLF line endings are preserved", () => {
  const { text } = mergeJson('{\r\n\t"model": "opus"\r\n}\r\n', [DENY]);
  assert.ok(text.includes('\r\n\t"permissions": {\r\n\t\t"deny"'));
  assert.ok(!/[^\r]\n/.test(text), "no bare LF line endings");
});

test("invalid JSON is refused with the line and column of the problem", () => {
  assert.throws(
    () => mergeJson('{\n  "a": 1,\n  oops\n}', BOTH, ".claude/settings.json"),
    (error: unknown) => error instanceof JsonParseError && /\.claude\/settings\.json is not valid JSON \(line 3/.test(error.message),
  );
  assert.throws(() => mergeJson("[]", BOTH), /must be a JSON object/);
});

test("unmerge removes exactly what was added and drops containers it created once empty", () => {
  const existing = JSON.stringify({ permissions: { deny: ["WebFetch"] }, hooks: { PreToolUse: [] } }, null, 2) + "\n";
  const merged = mergeJson(existing, BOTH);
  assert.deepEqual(merged.added.createdKeys, ["hooks.PostToolUse"]);
  assert.equal(unmergeJson(merged.text, merged.added), existing);
});

test("unmerge keeps containers the kit created if the user has put their own entries in them", () => {
  const merged = mergeJson("{}", BOTH);
  const edited = JSON.parse(merged.text);
  edited.permissions.deny.push("WebFetch");
  const restored = JSON.parse(unmergeJson(JSON.stringify(edited, null, 2), merged.added));
  assert.deepEqual(restored, { permissions: { deny: ["WebFetch"] } });
});

test("unmerge removes only the kit's nested entry when the user added their own next to it", () => {
  const merged = JSON.parse(mergeJson("{}", [HOOKS]).text);
  merged.hooks.PostToolUse[0].hooks.push({ type: "command", command: "./mine.sh" });
  const restored = JSON.parse(unmergeJson(JSON.stringify(merged), mergeJson("{}", [HOOKS]).added));
  assert.deepEqual(restored.hooks.PostToolUse, [{ matcher: "Edit|MultiEdit|Write", hooks: [{ type: "command", command: "./mine.sh" }] }]);
});

test("whenMissing writes the tool's default first, records only the kit's items, and unmerge drops the key again", () => {
  const addition: ArrayAddition = { path: ["context", "fileName"], items: ["AGENTS.md"], coerceScalar: true, whenMissing: ["GEMINI.md"] };
  const original = '{\n  "theme": "dark"\n}\n';
  const first = mergeJson(original, [addition]);
  assert.deepEqual(JSON.parse(first.text).context.fileName, ["GEMINI.md", "AGENTS.md"]);
  assert.deepEqual(first.added.additions[0].items, ["AGENTS.md"]);
  assert.equal(mergeJson(first.text, [addition]).changed, false, "a second merge sees nothing to add");
  assert.equal(unmergeJson(first.text, first.added), original);
  const userSet = mergeJson('{ "context": { "fileName": "CONTEXT.md" } }', [addition]);
  assert.deepEqual(JSON.parse(userSet.text).context.fileName, ["CONTEXT.md", "AGENTS.md"], "an existing setting is extended, not given the default");
});
