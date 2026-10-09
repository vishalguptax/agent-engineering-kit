import { createInterface } from "node:readline";
import type { ApplyResult } from "./core/apply.js";
import { nextSteps } from "./core/next-steps.js";
import type { ActionKind, Plan } from "./core/plan.js";
import type { ScanResult } from "./core/scan.js";
import { CAPABILITY_LABELS, capabilitiesOf, type CapabilityState, type ToolCapabilities } from "./tools/capabilities.js";
import { TOOL_PROFILES, toolById, type ToolId } from "./tools/profiles.js";

/** Terminal input/output shared by the flag-driven CLI and the interactive wizard. */

const DIFF_KINDS = new Set<ActionKind>(["MERGE", "APPEND", "CONFLICT", "UPDATE", "REMOVE"]);

export class InputEndedError extends Error {
  constructor() {
    super("Input ended before the installer finished. Nothing was written.");
  }
}

export interface Prompter {
  /** Prints `question` and returns the trimmed answer, or `fallback` for an empty answer. */
  ask(question: string, fallback?: string): Promise<string>;
  /** Reads lines until an empty one; returns them joined, or `fallback` if the first line is empty. */
  askLines(question: string, fallback?: string): Promise<string>;
  close(): void;
}

/** Reads answers line by line. Lines that arrive early (piped input, tests) are buffered, not lost. */
export function createPrompter(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Prompter {
  const rl = createInterface({ input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const nextLine = async (): Promise<string> => {
    const { value, done } = await lines.next();
    if (done) throw new InputEndedError();
    return String(value);
  };
  return {
    async ask(question, fallback = "") {
      output.write(question);
      const answer = (await nextLine()).trim();
      return answer === "" ? fallback : answer;
    },
    async askLines(question, fallback = "") {
      output.write(question);
      const collected: string[] = [];
      for (let line = await nextLine(); line.trim() !== ""; line = await nextLine()) collected.push(line);
      return collected.length === 0 ? fallback : collected.join("\n");
    },
    close: () => rl.close(),
  };
}

export function describeScan(scan: ScanResult): string[] {
  const { found } = scan;
  const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "none");
  const yesNo = (value: boolean) => (value ? "found" : "not found");
  const rows: [string, string][] = [
    [".claude/", yesNo(found.claudeDir)],
    [".claude/settings.json", scan.settingsProblem ? "found, but it isn't valid JSON" : yesNo(found.settingsJson)],
    ["Claude skills", list(found.skills)],
    ["Claude agents", list(found.agents)],
    ["CLAUDE.md", yesNo(found.claudeMd)],
  ];
  if (scan.target.mode === "project") {
    rows.push(["AGENTS.md", yesNo(found.agentsMd)], ["Glossary", found.glossary ?? "not found"]);
    const git = !scan.git ? "git not available" : !scan.git.isRepo ? "not a git repository" : scan.git.uncommittedChanges ? `${scan.git.uncommittedChanges} uncommitted change(s)` : "clean";
    rows.push(["Git", git], ["Stack", list(scan.stack)]);
  }
  if (scan.target.mode === "project") {
    const names = (ids: ToolId[]) => (ids.length > 0 ? ids.map((id) => toolById(id).name).join(", ") : "none found");
    rows.push(["AI tools", `${names(scan.tools.inProject)} (on this machine: ${names(scan.tools.onMachine)})`]);
  }
  rows.push(["Matt's skills", scan.mattSkills.isDetected ? "found" : "not found (you'll get the install command at the end)"]);
  rows.push(["This kit", scan.record ? `installed (v${scan.record.kitVersion}, ${scan.record.components.length} components)` : "not installed yet"]);

  const lines = [`Target: ${scan.target.root} (${scan.target.mode})`, ...rows.map(([label, value]) => `  ${label.padEnd(14)} ${value}`)];
  if (scan.git?.uncommittedChanges) lines.push("! Uncommitted changes: commit or stash first so the install is easy to review and undo.");
  if (scan.settingsProblem) lines.push(`! ${scan.settingsProblem}`);
  return lines;
}

export function describePlan(plan: Plan, conflictLabel: (path: string) => string = () => ""): string[] {
  const lines = ["", "Plan:"];
  for (const action of plan.actions) {
    const label = action.kind === "CONFLICT" ? conflictLabel(action.path) : "";
    lines.push(`  ${action.kind.padEnd(8)} ${action.path}${label}  ${action.summary}`);
    if (DIFF_KINDS.has(action.kind) && action.diff) lines.push(...action.diff.split("\n").map((line) => `      | ${line}`));
  }
  lines.push(...plan.notes.map((note) => `  note: ${note}`));
  return lines;
}

export function describeResult(result: ApplyResult, scan: ScanResult, plan: Plan, isUninstall: boolean): string[] {
  const lines = ["", `Done: ${result.changedFiles.length} file(s) changed.`];
  if (result.backupDir) lines.push(`Backup of the files that changed: ${result.backupDir}`);
  if (result.keptConflicts.length > 0) lines.push(`Kept your version of: ${result.keptConflicts.join(", ")}`);
  if (isUninstall) return lines;
  lines.push("", "Next steps (the installer doesn't do these itself):");
  for (const step of nextSteps(scan, plan.selected, plan.tools)) {
    if (!step.isDone) lines.push(`  - ${step.text}${step.command ? `:  ${step.command}` : ""}`);
  }
  return lines;
}

const STATE_WORDS: Record<CapabilityState, string> = { yes: "yes", reference: "as reference", note: "note", none: "–" };

/** The supported tools and what each one gets (for --list-tools and the wizard). */
export function describeTools(): string[] {
  return TOOL_PROFILES.flatMap((tool) => {
    const capabilities = capabilitiesOf(tool);
    const summary = (Object.keys(CAPABILITY_LABELS) as (keyof ToolCapabilities)[])
      .map((kind) => `${CAPABILITY_LABELS[kind].toLowerCase()}: ${STATE_WORDS[capabilities[kind].state]}`)
      .join(" · ");
    return [`${tool.name} (${tool.id})`, `    ${summary}`];
  });
}

/** Whether applying the plan would change anything (conflicts count only if they won't be kept). */
