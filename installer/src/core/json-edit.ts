/**
 * Minimal, format-preserving JSON edits: insert/remove one member or element and leave every
 * other byte of the file untouched. New content copies the surrounding indentation and line endings.
 */

type JsonPath = (string | number)[];

interface JsonNode {
  kind: "object" | "array" | "value";
  start: number;
  /** Offset just after the node. */
  end: number;
  /** Object members (in order). */
  members?: { key: string; keyStart: number; value: JsonNode }[];
  /** Array elements (in order). */
  elements?: JsonNode[];
}

class JsonSyntaxError extends Error {
  constructor(readonly offset: number) {
    super(`Invalid JSON at offset ${offset}`);
  }
}

/** Offset of the first syntax error in `text`, or null if it is valid JSON. */
export function findJsonErrorOffset(text: string): number | null {
  try {
    parseTree(text);
    return null;
  } catch (error) {
    if (error instanceof JsonSyntaxError) return error.offset;
    throw error;
  }
}

export function lineAndColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

export function insertIntoObject(text: string, path: JsonPath, key: string, value: unknown): string {
  const node = nodeAt(text, path, "object");
  const member = `${JSON.stringify(key)}: `;
  const last = node.members!.at(-1);
  if (!last) return fillEmpty(text, node, member, value);
  if (!isMultiline(text, node)) {
    return splice(text, last.value.end, 0, `, ${member}${JSON.stringify(value)}`);
  }
  const indent = lineIndent(text, last.keyStart);
  return splice(text, last.value.end, 0, `,${eolOf(text)}${indent}${member}${render(text, value, indent)}`);
}

export function appendToArray(text: string, path: JsonPath, value: unknown): string {
  const node = nodeAt(text, path, "array");
  const last = node.elements!.at(-1);
  if (!last) return fillEmpty(text, node, "", value);
  if (!isMultiline(text, node)) return splice(text, last.end, 0, `, ${JSON.stringify(value)}`);
  const indent = lineIndent(text, last.start);
  return splice(text, last.end, 0, `,${eolOf(text)}${indent}${render(text, value, indent)}`);
}

export function removeFromObject(text: string, path: JsonPath, key: string): string {
  const node = nodeAt(text, path, "object");
  const index = node.members!.findIndex((m) => m.key === key);
  if (index === -1) return text;
  const spans = node.members!.map((m) => ({ start: m.keyStart, end: m.value.end }));
  return removeSpan(text, node, spans, index);
}

export function removeFromArray(text: string, path: JsonPath, index: number): string {
  const node = nodeAt(text, path, "array");
  return removeSpan(text, node, node.elements!, index);
}

/** Replaces the value at `path` with `rawJson` (already-serialised JSON text), leaving everything else as is. */
export function replaceValue(text: string, path: JsonPath, rawJson: string): string {
  const node = findNode(parseTree(text), path);
  if (!node) throw new Error(`No JSON value at ${path.join(".") || "the top level"}.`);
  return splice(text, node.start, node.end - node.start, rawJson);
}

/** The original text of the value at `path`, or undefined if the path doesn't exist. */
export function rawValueAt(text: string, path: JsonPath): string | undefined {
  const node = findNode(parseTree(text), path);
  return node ? text.slice(node.start, node.end) : undefined;
}

/** The parsed value at `path`, or undefined if the path doesn't exist. */
export function valueAt(text: string, path: JsonPath): unknown {
  const node = findNode(parseTree(text), path);
  return node ? JSON.parse(text.slice(node.start, node.end)) : undefined;
}

// ---------- editing helpers ----------

/** Removes item `index` together with exactly one separating comma, so insert + remove round-trips. */
function removeSpan(text: string, container: JsonNode, spans: { start: number; end: number }[], index: number): string {
  if (spans.length === 1) return splice(text, container.start + 1, container.end - 1 - (container.start + 1), "");
  if (index > 0) return splice(text, spans[index - 1].end, spans[index].end - spans[index - 1].end, "");
  return splice(text, spans[0].start, spans[1].start - spans[0].start, "");
}

/** `{}` or `[]` becomes a multi-line container holding one item, indented one level deeper than its line. */
function fillEmpty(text: string, node: JsonNode, prefix: string, value: unknown): string {
  const outer = lineIndent(text, node.start);
  const inner = outer + indentUnit(text);
  const eol = eolOf(text);
  const body = `${eol}${inner}${prefix}${render(text, value, inner)}${eol}${outer}`;
  return splice(text, node.start + 1, node.end - 1 - (node.start + 1), body);
}

function render(text: string, value: unknown, indent: string): string {
  return JSON.stringify(value, null, indentUnit(text)).replace(/\n/g, eolOf(text) + indent);
}

function isMultiline(text: string, node: JsonNode): boolean {
  return text.slice(node.start, node.end).includes("\n");
}

function lineIndent(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))![0];
}

function indentUnit(text: string): string {
  const match = /\n([ \t]+)\S/.exec(text);
  if (!match) return "  ";
  return match[1].startsWith("\t") ? "\t" : match[1];
}

/** The line ending the file already uses. */
export function eolOf(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function splice(text: string, start: number, length: number, insert: string): string {
  return text.slice(0, start) + insert + text.slice(start + length);
}

function nodeAt(text: string, path: JsonPath, kind: "object" | "array"): JsonNode {
  const node = findNode(parseTree(text), path);
  if (!node || node.kind !== kind) throw new Error(`Expected a JSON ${kind} at ${path.join(".") || "the top level"}.`);
  return node;
}

function findNode(root: JsonNode, path: JsonPath): JsonNode | undefined {
  let node: JsonNode | undefined = root;
  for (const step of path) {
    if (!node) return undefined;
    node = typeof step === "number" ? node.elements?.[step] : node.members?.find((m) => m.key === step)?.value;
  }
  return node;
}

// ---------- parser ----------

/** Recursive-descent parser that records where every node starts and ends. Throws JsonSyntaxError. */
function parseTree(text: string): JsonNode {
  let i = 0;
  const fail = (): never => {
    throw new JsonSyntaxError(i);
  };
  const skipWhitespace = () => {
    while (i < text.length && " \t\r\n".includes(text[i])) i++;
  };
  const expect = (literal: string) => {
    if (!text.startsWith(literal, i)) fail();
    i += literal.length;
  };
  const parseString = (): string => {
    const start = i;
    expect('"');
    while (text[i] !== '"') {
      if (i >= text.length || text[i] < " ") fail();
      i += text[i] === "\\" ? 2 : 1;
    }
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const parseValue = (): JsonNode => {
    skipWhitespace();
    const start = i;
    if (text[i] === "{") {
      const members: NonNullable<JsonNode["members"]> = [];
      parseItems("}", () => {
        skipWhitespace();
        const keyStart = i;
        const key = parseString();
        skipWhitespace();
        expect(":");
        members.push({ key, keyStart, value: parseValue() });
      });
      return { kind: "object", start, end: i, members };
    }
    if (text[i] === "[") {
      const elements: JsonNode[] = [];
      parseItems("]", () => elements.push(parseValue()));
      return { kind: "array", start, end: i, elements };
    }
    if (text[i] === '"') {
      parseString();
      return { kind: "value", start, end: i };
    }
    const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!literal) fail();
    i += literal![0].length;
    return { kind: "value", start, end: i };
  };
  const parseItems = (close: string, parseItem: () => void) => {
    i++;
    skipWhitespace();
    if (text[i] === close) {
      i++;
      return;
    }
    for (;;) {
      parseItem();
      skipWhitespace();
      if (text[i] === close) {
        i++;
        return;
      }
      expect(",");
    }
  };

  const root = parseValue();
  skipWhitespace();
  if (i < text.length) fail();
  return root;
}
