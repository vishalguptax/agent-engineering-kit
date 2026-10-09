import type { AgentFormat } from "../tools/profiles.js";
import { parseFrontmatter, renderFrontmatter, type Frontmatter } from "./frontmatter.js";

export const AGENT_FORMATS = [
  "claude-md",
  "cursor-md",
  "copilot-agent-md",
  "gemini-md",
  "antigravity-md",
  "kiro-md",
  "opencode-md",
  "junie-md",
  "augment-md",
  "codex-toml",
] as const satisfies readonly AgentFormat[];

interface Agent {
  name: string;
  description: string;
  isReadOnly: boolean;
  body: string;
}

/** Claude Code's tools for agents that must not edit files. */
const CLAUDE_READ_ONLY_TOOLS = "Read, Grep, Glob, Bash";

/**
 * Renders a kit agent (neutral frontmatter: name, description, access) in a tool's format, using only the
 * fields that tool documents. Where a tool has no documented way to restrict editing, the agent's
 * instructions (which say it never edits) are the only safeguard.
 */
export function renderAgent(source: string, format: AgentFormat): string {
  const agent = parseAgent(source);
  if (format === "codex-toml") return renderCodexToml(agent);
  return renderFrontmatter(markdownFields(agent, format), agent.body);
}

function markdownFields(agent: Agent, format: Exclude<AgentFormat, "codex-toml">): Frontmatter {
  const identity = { name: agent.name, description: agent.description };
  switch (format) {
    case "claude-md":
      return { ...identity, ...(agent.isReadOnly ? { tools: CLAUDE_READ_ONLY_TOOLS } : {}), model: "inherit" };
    case "cursor-md":
      return { ...identity, model: "inherit", readonly: agent.isReadOnly };
    case "antigravity-md":
      return { ...identity, model: "inherit" };
    case "opencode-md":
      return { description: agent.description, mode: "subagent", ...(agent.isReadOnly ? { permission: { edit: "deny" } } : {}) };
    case "copilot-agent-md":
    case "gemini-md":
    case "kiro-md":
    case "junie-md":
    case "augment-md":
      return identity;
  }
}

/** Codex agent file: TOML with the instructions in a multi-line string (literal unless the text contains '''). */
function renderCodexToml(agent: Agent): string {
  const instructions = agent.body.replace(/^\n+/, "");
  const block = instructions.includes("'''")
    ? `"""\n${instructions.replace(/\\/g, "\\\\").replace(/"""/g, '""\\"')}"""`
    : `'''\n${instructions}'''`;
  const lines = [
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${JSON.stringify(agent.description)}`,
    ...(agent.isReadOnly ? ['sandbox_mode = "read-only"'] : []),
    `developer_instructions = ${block}`,
  ];
  return `${lines.join("\n")}\n`;
}

function parseAgent(source: string): Agent {
  const { data, body } = parseFrontmatter(source, "agent");
  const label = `agent "${String(data.name)}"`;
  const unknown = Object.keys(data).filter((key) => !["name", "description", "access"].includes(key));
  if (unknown.length > 0) throw new Error(`${label}: unsupported frontmatter field(s) ${unknown.join(", ")}.`);
  if (typeof data.name !== "string" || typeof data.description !== "string") throw new Error(`${label}: needs a name and a description.`);
  if (data.access !== "read-only" && data.access !== "edit") throw new Error(`${label}: access must be "read-only" or "edit".`);
  return { name: data.name, description: data.description, isReadOnly: data.access === "read-only", body };
}
