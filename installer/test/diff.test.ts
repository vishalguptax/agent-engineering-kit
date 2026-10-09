import { test } from "node:test";
import assert from "node:assert/strict";
import { unifiedDiff } from "../src/core/diff.js";

test("identical text has no diff", () => {
  assert.equal(unifiedDiff("a\nb\n", "a\nb\n"), "");
});

test("a new file is shown entirely as additions", () => {
  assert.equal(unifiedDiff(null, "a\nb\n"), "@@ -0,0 +1,2 @@\n+a\n+b");
});

test("insertions, deletions and changes are shown with context", () => {
  const before = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].join("\n");
  const after = ["1", "2", "3", "4", "FIVE", "6", "7", "8", "9", "10", "11"].join("\n");
  assert.equal(
    unifiedDiff(before, after),
    [
      "@@ -2,9 +2,10 @@",
      " 2", " 3", " 4", "-5", "+FIVE", " 6", " 7", " 8", " 9", " 10", "+11",
    ].join("\n"),
  );
});

test("distant changes become separate hunks", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
  const changed = [...lines];
  changed[1] = "changed 2";
  changed[27] = "changed 28";
  const hunks = unifiedDiff(lines.join("\n"), changed.join("\n")).split("\n").filter((l) => l.startsWith("@@"));
  assert.deepEqual(hunks, ["@@ -1,5 +1,5 @@", "@@ -25,6 +25,6 @@"]);
});
