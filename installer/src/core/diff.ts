type Op = { kind: " " | "-" | "+"; text: string };

const CONTEXT_LINES = 3;
/** Above this many line pairs the LCS table gets too big; fall back to "replace everything". */
const MAX_LCS_CELLS = 4_000_000;

/** Unified diff hunks (no file header) for the preview screen. Empty string means no difference. */
export function unifiedDiff(before: string | null, after: string | null): string {
  const ops = diffLines(toLines(before ?? ""), toLines(after ?? ""));
  if (ops.every((op) => op.kind === " ")) return "";
  return buildHunks(ops).join("\n");
}

function toLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function diffLines(a: string[], b: string[]): Op[] {
  if (a.length * b.length > MAX_LCS_CELLS) {
    return [...a.map((text) => ({ kind: "-" as const, text })), ...b.map((text) => ({ kind: "+" as const, text }))];
  }
  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", text: a[i++] });
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: "-", text: a[i++] });
    } else {
      ops.push({ kind: "+", text: b[j++] });
    }
  }
  while (i < a.length) ops.push({ kind: "-", text: a[i++] });
  while (j < b.length) ops.push({ kind: "+", text: b[j++] });
  return ops;
}

function buildHunks(ops: Op[]): string[] {
  const changed = ops.flatMap((op, index) => (op.kind === " " ? [] : [index]));
  const ranges: [number, number][] = [];
  for (const index of changed) {
    const start = Math.max(0, index - CONTEXT_LINES);
    const end = Math.min(ops.length - 1, index + CONTEXT_LINES);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) last[1] = end;
    else ranges.push([start, end]);
  }

  const output: string[] = [];
  for (const [start, end] of ranges) {
    const before = ops.slice(0, start);
    const hunk = ops.slice(start, end + 1);
    const oldStart = before.filter((op) => op.kind !== "+").length;
    const newStart = before.filter((op) => op.kind !== "-").length;
    const oldCount = hunk.filter((op) => op.kind !== "+").length;
    const newCount = hunk.filter((op) => op.kind !== "-").length;
    output.push(`@@ -${rangeLabel(oldStart, oldCount)} +${rangeLabel(newStart, newCount)} @@`);
    output.push(...hunk.map((op) => op.kind + op.text));
  }
  return output;
}

function rangeLabel(start: number, count: number): string {
  return `${count === 0 ? start : start + 1},${count}`;
}
