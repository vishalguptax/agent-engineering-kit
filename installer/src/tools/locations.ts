import { TOOL_PROFILES, type AgentFormat, type ToolId, type ToolProfile } from "./profiles.js";

export interface Location {
  dir: string;
  /** Agent file format; skills use the one canonical SKILL.md format everywhere. */
  format?: AgentFormat;
}

export interface LocationChoice {
  /** Folders the installer writes to, in order. */
  chosen: Location[];
  /** Which chosen folder each selected tool is served by. */
  coverage: Map<ToolId, Location>;
  /** Tools that read more than one chosen folder, so they see the kit's copies twice. */
  duplicates: { toolId: ToolId; dirs: string[] }[];
  /** Tools with no file-based sub-agents (agents only): they get the agent instructions as reference files. */
  asReference: ToolId[];
}

/**
 * Picks where skills or agents are written for the selected tools. Tools are taken in the fixed profile order:
 * a tool already served by a chosen folder adds nothing; otherwise its preferred folder is added. The order is
 * fixed so adding or removing a tool never reshuffles the others.
 */
export function chooseLocations(selected: ToolProfile[], kind: "skills" | "agents"): LocationChoice {
  const ordered = TOOL_PROFILES.filter((t) => selected.some((s) => s.id === t.id));
  const chosen: Location[] = [];
  const coverage = new Map<ToolId, Location>();
  const asReference: ToolId[] = [];

  for (const tool of ordered) {
    const reads = readsOf(tool, kind);
    if (reads === "reference") {
      asReference.push(tool.id);
      continue;
    }
    if (reads.length === 0) continue;
    const served = chosen.find((location) => reads.some((r) => sameLocation(r, location)));
    if (served) {
      coverage.set(tool.id, served);
      continue;
    }
    chosen.push(reads[0]);
    coverage.set(tool.id, reads[0]);
  }

  const duplicates = ordered.flatMap((tool) => {
    const reads = readsOf(tool, kind);
    if (reads === "reference") return [];
    const seen = chosen.filter((location) => reads.some((r) => sameLocation(r, location)));
    return seen.length > 1 ? [{ toolId: tool.id, dirs: seen.map((l) => l.dir) }] : [];
  });
  return { chosen, coverage, duplicates, asReference };
}

/** The folders a tool reads for this kind, "reference" for tools without file-based sub-agents, or [] if unsupported. */
export function readsOf(tool: ToolProfile, kind: "skills" | "agents"): Location[] | "reference" {
  if (kind === "skills") return tool.skills ? tool.skills.reads.map((dir) => ({ dir })) : [];
  if (!tool.agents) return [];
  return "reference" in tool.agents ? "reference" : tool.agents.reads;
}

function sameLocation(a: Location, b: Location): boolean {
  return a.dir === b.dir && a.format === b.format;
}

/** The file name an agent gets in a folder of the given format. */
export function agentFileName(name: string, format: AgentFormat): string {
  if (format === "codex-toml") return `${name}.toml`;
  if (format === "copilot-agent-md") return `${name}.agent.md`;
  return `${name}.md`;
}
