import { test } from "node:test";
import assert from "node:assert/strict";
import { appendToArray, findJsonErrorOffset, insertIntoObject, removeFromArray, removeFromObject } from "../src/core/json-edit.js";

test("appending to a one-line array stays on one line and leaves everything else alone", () => {
  const text = '{\n    "allow": ["a"],\n    "deny": ["x"]\n}';
  assert.equal(appendToArray(text, ["deny"], "y"), '{\n    "allow": ["a"],\n    "deny": ["x", "y"]\n}');
});

test("appending to a multi-line array copies the element indentation", () => {
  const text = '{\n  "deny": [\n    "x"\n  ]\n}\n';
  assert.equal(appendToArray(text, ["deny"], "y"), '{\n  "deny": [\n    "x",\n    "y"\n  ]\n}\n');
});

test("appending an object to an empty array expands it using the file's indent", () => {
  const text = '{\n\t"hooks": []\n}';
  assert.equal(appendToArray(text, ["hooks"], { a: 1 }), '{\n\t"hooks": [\n\t\t{\n\t\t\t"a": 1\n\t\t}\n\t]\n}');
});

test("inserting a key into an object matches the member indentation and CRLF endings", () => {
  const text = '{\r\n    "model": "opus"\r\n}\r\n';
  assert.equal(
    insertIntoObject(text, [], "permissions", { deny: ["x"] }),
    '{\r\n    "model": "opus",\r\n    "permissions": {\r\n        "deny": [\r\n            "x"\r\n        ]\r\n    }\r\n}\r\n',
  );
  assert.equal(insertIntoObject("{}", [], "a", [1]), '{\n  "a": [\n    1\n  ]\n}');
});

test("removing is the exact inverse of inserting", () => {
  const original = '{\n    "allow": ["a"],\n    "deny": [\n        "x"\n    ]\n}\n';
  const added = insertIntoObject(appendToArray(original, ["deny"], "y"), [], "hooks", { b: true });
  const withoutHooks = removeFromObject(added, [], "hooks");
  assert.equal(removeFromArray(withoutHooks, ["deny"], 1), original);
  assert.equal(removeFromArray('["a", "b"]', [], 0), '["b"]');
  assert.equal(removeFromArray('{"x": ["only"]}', ["x"], 0), '{"x": []}');
});

test("paths can go through arrays", () => {
  const text = '{"hooks": {"Post": [{"hooks": [{"c": 1}, {"c": 2}]}]}}';
  assert.equal(removeFromArray(text, ["hooks", "Post", 0, "hooks"], 1), '{"hooks": {"Post": [{"hooks": [{"c": 1}]}]}}');
});

test("finds the offset of the first syntax error", () => {
  assert.equal(findJsonErrorOffset('{"a": 1}'), null);
  assert.equal(findJsonErrorOffset('{\n  "deny": [\n  }\n'), 16, 'points at the stray }');
  assert.equal(findJsonErrorOffset('{"a": 1} extra'), 9);
  assert.equal(findJsonErrorOffset('{"a": tru}'), 6);
});
