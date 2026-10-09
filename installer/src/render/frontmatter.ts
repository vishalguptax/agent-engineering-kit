/**
 * The small YAML subset used in Markdown frontmatter. The kit's own sources are parsed as flat `key: value` lines;
 * rendered output may add one level of nesting (e.g. opencode's `permission:` block). Strings are written
 * JSON-quoted, which is valid YAML and safe for any text (colons, #, quotes).
 */

export type FrontmatterValue = string | boolean | number | { [key: string]: string | boolean | number };
export type Frontmatter = Record<string, FrontmatterValue>;

export function parseFrontmatter(text: string, label: string): { data: Frontmatter; body: string } {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  if (!match) throw new Error(`${label} must start with a --- frontmatter block.`);
  const data: Frontmatter = {};
  for (const [index, line] of match[1].split("\n").entries()) {
    if (line.trim() === "") continue;
    const entry = /^([A-Za-z][\w-]*):(?: (.*))?$/.exec(line);
    if (!entry || entry[2] === undefined || entry[2] === "") {
      throw new Error(`${label}: frontmatter line ${index + 2} isn't a simple "key: value" line.`);
    }
    data[entry[1]] = parseScalar(entry[2].trim(), label);
  }
  return { data, body: normalized.slice(match[0].length) };
}

export function renderFrontmatter(data: Frontmatter, body: string): string {
  const lines = Object.entries(data).flatMap(([key, value]) =>
    typeof value === "object" ? [`${key}:`, ...Object.entries(value).map(([k, v]) => `  ${k}: ${formatScalar(v)}`)] : [`${key}: ${formatScalar(value)}`],
  );
  return `---\n${lines.join("\n")}\n---\n${body.startsWith("\n") ? body : `\n${body}`}`;
}

function parseScalar(raw: string, label: string): string | boolean | number {
  if (raw === "true" || raw === "false") return raw === "true";
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      throw new Error(`${label}: the quoted value ${raw} isn't a valid string.`);
    }
  }
  return raw;
}

function formatScalar(value: string | boolean | number): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}
