import { AGENT_REFERENCE_DIR } from "../core/layout.js";
import type { ToolProfile } from "./profiles.js";

/** What the kit can give one tool, per kind of thing it installs. */
export type CapabilityState = "yes" | "reference" | "note" | "none";
export interface Capability {
  state: CapabilityState;
  /** One plain sentence: where it goes, or why it isn't installed. */
  detail: string;
}
export interface ToolCapabilities {
  rules: Capability;
  skills: Capability;
  agents: Capability;
  format: Capability;
  secretGuard: Capability;
}

export const CAPABILITY_LABELS: Record<keyof ToolCapabilities, string> = {
  rules: "Rules",
  skills: "Skills",
  agents: "Agents",
  format: "Format on edit",
  secretGuard: "Secret guard",
};

export function capabilitiesOf(tool: ToolProfile): ToolCapabilities {
  return { rules: rules(tool), skills: skills(tool), agents: agents(tool), format: format(tool), secretGuard: secretGuard(tool) };
}

function rules(tool: ToolProfile): Capability {
  const spec = tool.instructions;
  switch (spec.kind) {
    case "agents-md":
      return { state: "yes", detail: "Reads the kit's block in AGENTS.md." };
    case "claude-import":
      return { state: "yes", detail: "Reads AGENTS.md through a one-line @AGENTS.md import in CLAUDE.md." };
    case "gemini-context":
      return { state: "yes", detail: "Reads AGENTS.md once it's added to context.fileName in .gemini/settings.json." };
    case "note":
      return { state: "note", detail: spec.note };
  }
}

function skills(tool: ToolProfile): Capability {
  if (!tool.skills) return { state: "none", detail: `${tool.name} has no skills support.` };
  return { state: "yes", detail: `Skills in ${tool.skills.reads[0]} (or a shared folder it also reads).` };
}

function agents(tool: ToolProfile): Capability {
  if (!tool.agents) return { state: "none", detail: `${tool.name} has no sub-agents.` };
  if ("reference" in tool.agents) return { state: "reference", detail: `${tool.agents.reference} The skills point to ${AGENT_REFERENCE_DIR}/ instead.` };
  return { state: "yes", detail: `Agents in ${tool.agents.reads[0].dir} (or a shared folder it also reads).` };
}

function format(tool: ToolProfile): Capability {
  if (!tool.formatHook) return { state: "none", detail: `${tool.name} has no documented after-edit hook; use the pre-commit checks.` };
  if (tool.formatHook.kind === "note") return { state: "note", detail: tool.formatHook.note };
  return { state: "yes", detail: `After-edit hook in ${tool.formatHook.file}.` };
}

function secretGuard(tool: ToolProfile): Capability {
  const spec = tool.secretGuard;
  if (!spec) return { state: "none", detail: `${tool.name} has no way to block file reads.` };
  if (spec.kind === "note") return { state: "note", detail: spec.note };
  if (spec.kind === "claude-settings") return { state: "yes", detail: `Deny rules in ${spec.file}.` };
  return { state: "yes", detail: `Entries in ${spec.file}.${spec.note ? ` ${spec.note}` : ""}` };
}
