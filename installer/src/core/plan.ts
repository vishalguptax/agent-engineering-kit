import { existsSync } from "node:fs";
import os from "node:os";
import { findCollisions } from "../tools/collisions.js";
import { toolById, type ToolId, type ToolProfile } from "../tools/profiles.js";
import { unifiedDiff } from "./diff.js";
import { combineAdded, isEmptyAdded, mergeJson, staleAdded, subtractAdded, unmergeJson, type JsonAdded } from "./json-merge.js";
import { CHECKS_CONF, hookPlacement, renderChecksConf, suggestChecks } from "./checks.js";
import { readKitFile } from "./kit.js";
import { desiredLayout, type DesiredFile } from "./layout.js";
import type { Manifest } from "./manifest.js";
import { resolveInside } from "./paths.js";
import { extractProjectTemplate, hasProjectSection, renderProjectSection, type ProjectInfo } from "./project-info.js";
import { findEntry, hasLegacyRecord, hashText, readRecord, type InstallRecord } from "./record.js";
import { hasBlock, insertBeforeBlock, upsertBlock, type CommentStyle } from "./text-block.js";
import { absolute, readTargetFile, type Target } from "./target.js";
import { planRemovals } from "./uninstall.js";

export type ActionKind = "CREATE" | "MERGE" | "APPEND" | "UPDATE" | "SKIP" | "CONFLICT" | "REMOVE";
export type ConflictChoice = "keep" | "kit" | "kit-new";
export const CONFLICT_CHOICES: ConflictChoice[] = ["keep", "kit", "kit-new"];

/** One planned change to one file. Nothing is written until apply() runs the plan. */
export interface Action {
  /** POSIX-style path relative to the target root; unique within a plan. */
  path: string;
  kind: ActionKind;
  componentIds: string[];
  /** The selected tools that read this file. */
  toolIds: ToolId[];
  /** Plain-English description for the preview. */
  summary: string;
  before: string | null;
  /** New contents; null means the file is deleted (REMOVE). For CONFLICT this is the kit's version. */
  after: string | null;
  diff: string;
  /** JSON files: what the install record should hold as "added by the kit" after this action. */
  jsonState?: JsonAdded;
  /** The file holds the kit's marked block (with this comment style). */
  block?: CommentStyle;
  /** The new contents include project info the user typed in; that part belongs to the user. */
  userContent?: boolean;
  /** Removals: forget this file in the install record afterwards. */
  dropEntry?: boolean;
  /** The file must be executable (the git pre-commit hook). */
  executable?: boolean;
}

export interface Plan {
  target: Target;
  /** Components installed after this plan runs. */
  selected: string[];
  /** Tools installed for after this plan runs. */
  tools: ToolId[];
  actions: Action[];
  /** Problems that stop the install, e.g. invalid settings.json. apply() refuses a plan with blockers. */
  blockers: string[];
  /** Things the user should know that don't stop the install. */
  notes: string[];
  /** The install record changes even where no file does: a pre-release record to convert, or other components, tools or file owners. */
  updatesRecord: boolean;
}

export interface PlanInput {
  manifest: Manifest;
  target: Target;
  /** Fully resolved component selection (see resolveSelection). */
  selected: string[];
  tools: ToolId[];
  /** Optional "About your project" answers, written as the user's own section next to the kit's block. */
  projectInfo?: ProjectInfo;
  /** Home folder, for the check against same-named personal skills (defaults to the real one). */
  homeDir?: string;
  /** Check commands the user confirmed (checks component); defaults to the ones suggested from the project. */
  checks?: string;
}

/**
 * Works out every change needed so the target holds exactly what the selected components need for the selected
 * tools: new and changed files, and removal of kit files that are no longer needed. Reads files, never writes.
 */
export function planInstall({ manifest, target, selected, tools: toolIds, projectInfo, homeDir = os.homedir(), checks }: PlanInput): Plan {
  const plan: Plan = { target, selected, tools: toolIds, actions: [], blockers: [], notes: [], updatesRecord: false };
  if (target.mode === "global" && toolIds.some((id) => id !== "claude-code")) {
    return { ...plan, blockers: ["Global installs (~/.claude) are for Claude Code only. Install other tools per project."] };
  }
  let record: InstallRecord | null;
  try {
    record = readRecord(target, manifest);
  } catch (error) {
    return { ...plan, blockers: [(error as Error).message] };
  }

  const tools = toolIds.map(toolById);
  const components = manifest.components.filter((c) => selected.includes(c.id));
  const attempt = (step: () => void) => {
    try {
      step();
    } catch (error) {
      plan.blockers.push((error as Error).message);
    }
  };

  attempt(() => {
    const checksArtifact = target.mode === "project" ? components.flatMap((c) => c.artifacts).find((a) => a.kind === "checks") : undefined;
    const currentConf = checksArtifact && checks !== undefined ? readTargetFile(target, CHECKS_CONF) : null;
    if (currentConf !== null && currentConf !== renderChecksConf(checks!)) {
      plan.notes.push(`Checks: ${CHECKS_CONF} already exists, so it was kept and the commands you entered weren't written. Edit it to change the checks.`);
    }
    const layout = desiredLayout({
      manifest,
      target,
      components,
      tools,
      checks: checks ?? (checksArtifact ? suggestChecks(target) : ""),
      hookPlacement: checksArtifact ? hookPlacement(target, readKitFile(manifest, checksArtifact.source, target)) : undefined,
    });
    plan.notes.push(...layout.notes);
    for (const file of layout.files) attempt(() => plan.actions.push(planFile(file, { manifest, target, record, projectInfo, notes: plan.notes })));
    if (record) attempt(() => plan.actions.push(...planRemovals(target, record, new Set(layout.files.map((f) => f.path)))));
  });

  if (target.mode === "project") {
    plan.notes.push(...toolWarnings(target, tools));
    attempt(() => plan.notes.push(...collisionNotes(target, tools, components, homeDir)));
  }
  plan.blockers.push(...pathBlockers(target, plan.actions));
  plan.updatesRecord = recordChanges(target, record, plan);
  return plan;
}

/** Whether running the plan changes anything: a file (a conflict counts only if not kept) or the install record. */
export function hasChanges(plan: Plan, isConflictKept: (path: string) => boolean): boolean {
  return plan.updatesRecord || plan.actions.some((a) => a.kind !== "SKIP" && !(a.kind === "CONFLICT" && isConflictKept(a.path)));
}

function recordChanges(target: Target, record: InstallRecord | null, plan: Plan): boolean {
  if (hasLegacyRecord(target) || plan.actions.some((a) => a.dropEntry)) return true;
  if (!record) return false;
  if (!sameSet(record.components, plan.selected) || !sameSet(record.tools, plan.tools)) return true;
  return plan.actions.some((a) => {
    const entry = a.kind === "SKIP" ? findEntry(record, a.path) : undefined;
    return entry !== undefined && (!sameSet(entry.componentIds, a.componentIds) || !sameSet(entry.toolIds, a.toolIds));
  });
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Every action's path must resolve inside the target (no traversal, no symlink escapes). */
export function pathBlockers(target: Target, actions: Action[]): string[] {
  return actions.flatMap((action) => {
    try {
      resolveInside(target.root, action.path);
      return [];
    } catch (error) {
      return [(error as Error).message];
    }
  });
}

export function fileAction(fields: Omit<Action, "diff">): Action {
  return { ...fields, diff: unifiedDiff(fields.before, fields.after) };
}

interface PlanContext {
  manifest: Manifest;
  target: Target;
  record: InstallRecord | null;
  projectInfo?: ProjectInfo;
  notes: string[];
}

function planFile(file: DesiredFile, context: PlanContext): Action {
  switch (file.kind) {
    case "copy":
      return planCopy(file, context);
    case "json":
      return planJson(file, context);
    case "block":
      return file.isHub ? planHub(file, context) : planBlock(file, context);
  }
}

function planCopy(file: Extract<DesiredFile, { kind: "copy" }>, { target, record }: PlanContext): Action {
  const current = readTargetFile(target, file.path);
  const base = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, after: file.content, executable: file.executable };
  if (current === null) return fileAction({ ...base, kind: "CREATE", summary: `Create ${file.path}.` });
  if (file.createOnly) return fileAction({ ...base, after: current, kind: "SKIP", summary: "Yours to edit; the installer leaves it as it is." });
  if (current === file.content) return fileAction({ ...base, kind: "SKIP", summary: "Already identical to the kit's version." });
  const entry = findEntry(record, file.path);
  if (entry && hashText(current) === entry.installedHash) {
    return fileAction({ ...base, kind: "UPDATE", summary: "The kit's version changed and you haven't edited this file, so it will be updated." });
  }
  return fileAction({ ...base, kind: "CONFLICT", summary: "Your file differs from the kit's version. Choose what to keep." });
}

/**
 * Brings a JSON config to the desired kit entries: entries the kit added before but no longer wants are removed
 * (by identity), missing ones are added, and nothing of the user's is touched.
 */
function planJson(file: Extract<DesiredFile, { kind: "json" }>, { target, record }: PlanContext): Action {
  const current = readTargetFile(target, file.path);
  const recorded = findEntry(record, file.path)?.jsonAdded;
  const stale = recorded ? staleAdded(recorded, file.additions) : null;
  const hasStale = stale !== null && !isEmptyAdded(stale);
  const base = current !== null && hasStale ? unmergeJson(current, stale, file.path) : current;
  const merged = mergeJson(base, file.additions, file.path, file.seed);
  const jsonState = recorded ? combineAdded(hasStale ? subtractAdded(recorded, stale) : recorded, merged.added) : merged.added;
  const fields = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, after: merged.text, jsonState };
  if (current === null) return fileAction({ ...fields, kind: "CREATE", summary: `Create ${file.path} with the kit's entries.` });
  if (merged.text === current) return fileAction({ ...fields, kind: "SKIP", summary: "Already contains the kit's entries." });
  const removing = hasStale ? " Outdated kit entries are removed." : "";
  return fileAction({ ...fields, kind: "MERGE", summary: `Add the kit's entries.${removing} Nothing of yours is removed or changed.` });
}

/** A file where the kit owns one marked block (CLAUDE.md's import, ignore files). */
function planBlock(file: Extract<DesiredFile, { kind: "block" }>, { target }: PlanContext): Action {
  const current = readTargetFile(target, file.path);
  const fields = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, block: file.style };
  // A file holding exactly the block's lines (e.g. the pre-release installer's plain "@AGENTS.md" CLAUDE.md) is adopted: wrapped in markers.
  if (current !== null && !hasBlock(current, file.style) && current.trim() === file.content.trim()) {
    const after = upsertBlock(null, file.content, file.style).text;
    return fileAction({ ...fields, after, kind: "UPDATE", summary: `${file.path} already has exactly these lines; they get the kit's markers so updates and uninstall can find them.` });
  }
  const { text, changed } = upsertBlock(current, file.content, file.style);
  if (!changed) return fileAction({ ...fields, after: text, kind: "SKIP", summary: "The kit's block is already up to date." });
  if (current === null) return fileAction({ ...fields, after: text, kind: "CREATE", summary: `Create ${file.path} with the kit's block.` });
  const summary = hasBlock(current, file.style) ? "Replace the kit's block with the current version." : "Append the kit's block to the end.";
  return fileAction({ ...fields, after: text, kind: "APPEND", summary });
}

/** The main instructions file: the kit's block, plus (once) the user's project section or the template to fill in. */
function planHub(file: Extract<DesiredFile, { kind: "block" }>, { manifest, target, projectInfo, notes }: PlanContext): Action {
  const current = readTargetFile(target, file.path);
  const fields = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, block: file.style };
  const section = target.mode === "project" && projectInfo ? renderProjectSection(projectInfo) : null;
  if (projectInfo && target.mode === "global") notes.push("Project info is only written for project installs, so it was left out of the global CLAUDE.md.");

  let base = current;
  let userContent = false;
  if (section && hasProjectSection(target)) {
    notes.push('This project already has a "## Project Overview" section, so your project info was not added. Edit that section directly.');
  } else if (section) {
    base = current === null ? section : insertBeforeBlock(current, section);
    userContent = true;
  } else if (current === null && target.mode === "project" && !hasProjectSection(target)) {
    base = projectTemplate(manifest, target);
  }

  const { text, changed } = upsertBlock(base, file.content, file.style);
  if (!changed && !userContent) return fileAction({ ...fields, after: text, kind: "SKIP", summary: "The kit's block is already up to date." });
  const withInfo = userContent ? " Your project info goes above it." : "";
  if (current === null) {
    const summary = base === null ? `Create ${file.path} with the kit's block.` : `Create ${file.path} with a project section to fill in, plus the kit's block.`;
    return fileAction({ ...fields, after: text, kind: "CREATE", summary: `${summary}${withInfo}`, userContent });
  }
  const summary = hasBlock(current, file.style) ? "Replace the kit's block with the current version." : `Append the kit's block to the end of ${file.path}.`;
  return fileAction({ ...fields, after: text, kind: "APPEND", summary: `${summary}${withInfo}`, userContent });
}

function projectTemplate(manifest: Manifest, target: Target): string | null {
  const rulebook = manifest.components.flatMap((c) => c.artifacts).find((a) => a.kind === "rulebook");
  return rulebook?.kind === "rulebook" ? extractProjectTemplate(readKitFile(manifest, rulebook.source, target)) : null;
}

/** Profile warnings whose trigger file exists in the project (e.g. Zed would read another rules file first). */
function toolWarnings(target: Target, tools: ToolProfile[]): string[] {
  return tools.flatMap((tool) =>
    (tool.warnings ?? []).filter((w) => w.ifExists.some((rel) => existsSync(absolute(target, rel)))).map((w) => `${tool.name}: ${w.message}`),
  );
}

/** Same-named skills or agents elsewhere that a selected tool would also see (or prefer). */
function collisionNotes(target: Target, tools: ToolProfile[], components: Manifest["components"], homeDir: string): string[] {
  const names = (kind: "skill" | "agent") => components.flatMap((c) => c.artifacts.flatMap((a) => (a.kind === kind ? [a.name] : [])));
  return findCollisions({ projectDir: target.root, homeDir, tools, skillNames: names("skill"), agentNames: names("agent") }).map(
    (c) => `${toolById(c.toolId).name} also sees your own "${c.name}" ${c.kind} at ${c.where}, next to the kit's. Rename or remove one so the tool doesn't pick the wrong one.`,
  );
}
