import { PRE_COMMIT_SCRIPT } from "./checks.js";
import type { Manifest } from "./manifest.js";
import { unmergeJson } from "./json-merge.js";
import { fileAction, pathBlockers, type Action, type Plan } from "./plan.js";
import { hashText, readRecord, type InstallRecord, type RecordEntry } from "./record.js";
import { removeBlock } from "./text-block.js";
import { readTargetFile, type Target } from "./target.js";

/** Plans a full uninstall from the install record. Touches only files the record lists. */
export function planUninstall(manifest: Manifest, target: Target): Plan {
  const plan: Plan = { target, selected: [], tools: [], actions: [], blockers: [], notes: [], updatesRecord: true };
  try {
    const record = readRecord(target, manifest);
    if (!record) return { ...plan, blockers: ["No install record found here, so there is nothing to uninstall."] };
    plan.actions = planRemovals(target, record, new Set());
  } catch (error) {
    return { ...plan, blockers: [(error as Error).message] };
  }
  return { ...plan, blockers: pathBlockers(target, plan.actions) };
}

/**
 * Undoes the kit's changes to every recorded file that is no longer wanted (`stillWanted` holds the paths of the
 * new layout). Files unchanged since install are deleted (if the kit created them) or restored from backup. Files
 * the user edited since only lose the kit's own parts, or are kept.
 */
export function planRemovals(target: Target, record: InstallRecord, stillWanted: Set<string>): Action[] {
  const entries: [RecordEntry, "created" | "modified"][] = [
    ...record.filesCreated.map((e) => [e, "created"] as [RecordEntry, "created"]),
    ...record.filesModified.map((e) => [e, "modified"] as [RecordEntry, "modified"]),
  ];
  const isWanted = (path: string) => stillWanted.has(path) || (path.endsWith(".kit-new") && stillWanted.has(path.slice(0, -".kit-new".length)));
  return entries.filter(([entry]) => !isWanted(entry.path)).map(([entry, kind]) => planEntryRemoval(target, entry, kind));
}

function planEntryRemoval(target: Target, entry: RecordEntry, kind: "created" | "modified"): Action {
  const current = readTargetFile(target, entry.path);
  const base = { path: entry.path, componentIds: entry.componentIds, toolIds: entry.toolIds, before: current, dropEntry: true };
  const remove = (after: string | null, summary: string) => fileAction({ ...base, after, kind: after === current ? "SKIP" : "REMOVE", summary });

  if (current === null) return remove(null, "Already gone.");
  if (entry.userContent) return remove(removeBlock(current, entry.block ?? "html").text, "Remove only the kit's marked block; your project info stays.");

  // The record could be forged, and git hooks aren't tracked, so a hook is deleted only if it is exactly the kit's.
  if (entry.path.startsWith(".git/") && current !== PRE_COMMIT_SCRIPT) return remove(current, "Kept: this git hook isn't the kit's.");
  const isUnchanged = hashText(current) === entry.installedHash;
  if (isUnchanged && kind === "created") return remove(null, "Delete: the kit created this file and you haven't changed it.");
  if (isUnchanged && entry.originalBackup) {
    const original = readTargetFile(target, entry.originalBackup);
    if (original !== null) return remove(original, `Restore your original from ${entry.originalBackup}.`);
  }
  if (entry.jsonAdded) return remove(unmergeJson(current, entry.jsonAdded, entry.path), "You edited this file since install, so only the kit's entries are removed.");
  if (entry.block) return remove(removeBlock(current, entry.block).text, "You edited this file since install, so only the kit's marked block is removed.");
  return remove(current, "Kept: you edited this file after install, so it's yours now.");
}
