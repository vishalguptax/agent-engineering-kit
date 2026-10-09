import { randomBytes } from "node:crypto";
import { closeSync, constants, copyFileSync, existsSync, fchmodSync, lstatSync, mkdirSync, openSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import type { Manifest } from "./manifest.js";
import { resolveInside } from "./paths.js";
import type { Action, ConflictChoice, Plan } from "./plan.js";
import { findEntry, hashText, readRecord, type InstallRecord, type RecordEntry } from "./record.js";
import { absolute, backupRel, legacyRecordRel, readTargetFile, recordRel, type Target } from "./target.js";

export interface ApplyInput {
  manifest: Manifest;
  plan: Plan;
  /** For CONFLICT actions, keyed by path. Missing means "keep" (the user's file is never overwritten by default). */
  resolutions?: Record<string, ConflictChoice>;
  now?: Date;
}

export interface ApplyResult {
  /** Paths written or deleted, relative to the target root. */
  changedFiles: string[];
  /** Absolute path of this run's backup folder, or null if nothing needed backing up. */
  backupDir: string | null;
  /** Conflicts where the user's version was kept. */
  keptConflicts: string[];
}

interface FileWrite {
  action: Action;
  path: string;
  /** null deletes the file. */
  content: string | null;
}

/** Runs a plan: checks every path, backs up, writes, then updates the install record. */
export function applyPlan({ manifest, plan, resolutions = {}, now = new Date() }: ApplyInput): ApplyResult {
  if (plan.blockers.length > 0) throw new Error(`Nothing was changed:\n- ${plan.blockers.join("\n- ")}`);
  const { target } = plan;

  const keptConflicts: string[] = [];
  const writes: FileWrite[] = [];
  for (const action of plan.actions) {
    const write = toWrite(action, resolutions[action.path] ?? "keep");
    if (action.kind === "CONFLICT" && !write) keptConflicts.push(action.path);
    if (write && readTargetFile(target, write.path) !== write.content) writes.push(write);
  }
  if (writes.length === 0 && !plan.updatesRecord) return { changedFiles: [], backupDir: null, keptConflicts };
  const existing = readRecord(target, manifest);

  for (const write of writes) resolveInside(target.root, write.path);
  resolveInside(target.root, recordRel());

  const record = existing ?? newRecord(manifest, target, now);
  const backup = backupFiles(target, writes, now);
  if (backup) record.backups.push(backup.dir);

  for (const write of writes) {
    const file = resolveInside(target.root, write.path);
    if (write.content === null) {
      unlinkSync(file);
      continue;
    }
    record.createdDirs.push(...ensureDir(target, path.dirname(file)));
    writeAtomically(target, write.path, write.content, write.action.executable && write.path === write.action.path);
  }

  updateEntries(record, plan, writes, backup);
  record.kitVersion = manifest.kitVersion;
  record.updatedAt = now.toISOString();
  record.components = plan.selected;
  record.tools = plan.tools;
  saveRecordAndTidy(target, record);

  return {
    changedFiles: writes.map((w) => w.path),
    backupDir: backup ? absolute(target, backup.dir) : null,
    keptConflicts,
  };
}

function toWrite(action: Action, choice: ConflictChoice): FileWrite | null {
  switch (action.kind) {
    case "SKIP":
      return null;
    case "CONFLICT":
      if (choice === "keep") return null;
      return { action, path: choice === "kit-new" ? `${action.path}.kit-new` : action.path, content: action.after };
    default:
      return { action, path: action.path, content: action.after };
  }
}

/**
 * Writes via a fresh, unpredictable temp file opened with O_EXCL (so a planted file or symlink can't be
 * followed), sets permissions on the open handle, re-checks the destination, then renames into place.
 */
function writeAtomically(target: Target, rel: string, content: string, isExecutable = false) {
  const file = resolveInside(target.root, rel);
  const keepMode = isExecutable ? 0o755 : existsSync(file) ? statSync(file).mode & 0o777 : undefined;
  const temp = `${file}.${randomBytes(8).toString("hex")}.kit-tmp`;
  const fd = openSync(temp, "wx", 0o644);
  try {
    writeSync(fd, content);
    if (keepMode !== undefined && process.platform !== "win32") fchmodSync(fd, keepMode);
  } finally {
    closeSync(fd);
  }
  try {
    resolveInside(target.root, rel);
    renameSync(temp, file);
  } catch (error) {
    unlinkSync(temp);
    throw error;
  }
}

function newRecord(manifest: Manifest, target: Target, now: Date): InstallRecord {
  const iso = now.toISOString();
  return {
    schemaVersion: 2,
    kitVersion: manifest.kitVersion,
    mode: target.mode,
    installedAt: iso,
    updatedAt: iso,
    components: [],
    tools: [],
    filesCreated: [],
    filesModified: [],
    createdDirs: [],
    backups: [],
  };
}

/** Copies every existing file that is about to change into .agent-kit/backup/<timestamp>/. */
function backupFiles(target: Target, writes: FileWrite[], now: Date): { dir: string; paths: Set<string> } | null {
  const existing = writes.filter((w) => existsSync(absolute(target, w.path)));
  if (existing.length === 0) return null;
  const stamp = now.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
  let dir = backupRel(stamp);
  for (let n = 2; existsSync(absolute(target, dir)); n++) dir = backupRel(`${stamp}-${n}`);
  for (const write of existing) {
    const copy = resolveInside(target.root, `${dir}/${write.path}`);
    mkdirSync(path.dirname(copy), { recursive: true });
    copyFileSync(resolveInside(target.root, write.path), copy, constants.COPYFILE_EXCL);
  }
  return { dir, paths: new Set(existing.map((w) => w.path)) };
}

/** mkdir -p that returns the folders it created (relative to the target root), so uninstall can remove them. */
function ensureDir(target: Target, dir: string): string[] {
  const missing: string[] = [];
  for (let current = dir; !existsSync(current); current = path.dirname(current)) missing.push(current);
  mkdirSync(dir, { recursive: true });
  return missing.map((abs) => path.relative(target.root, abs).split(path.sep).join("/"));
}

function updateEntries(record: InstallRecord, plan: Plan, writes: FileWrite[], backup: { dir: string; paths: Set<string> } | null) {
  for (const action of plan.actions) {
    const write = writes.find((w) => w.action === action);
    if (action.dropEntry || write?.content === null) {
      removeEntry(record, action.path);
      continue;
    }
    if (!write) {
      // Unchanged file, possibly with new owners (e.g. a tool that shared it was removed).
      const entry = action.kind === "SKIP" ? findEntry(record, action.path) : undefined;
      if (entry) Object.assign(entry, { componentIds: action.componentIds, toolIds: action.toolIds });
      continue;
    }
    const isMainFile = write.path === action.path;
    const fields: Omit<RecordEntry, "path" | "originalBackup"> = {
      componentIds: action.componentIds,
      toolIds: action.toolIds,
      installedHash: hashText(write.content!),
      ...(isMainFile && action.jsonState ? { jsonAdded: action.jsonState } : {}),
      ...(isMainFile && action.block ? { block: action.block } : {}),
    };
    const entry = findEntry(record, write.path);
    if (entry) {
      // Project info, once added, stays the user's: keep the flag across later updates.
      Object.assign(entry, fields, entry.userContent || action.userContent ? { userContent: true } : {});
      continue;
    }
    const created: RecordEntry = { path: write.path, ...fields, ...(isMainFile && action.userContent ? { userContent: true } : {}) };
    if (backup?.paths.has(write.path)) record.filesModified.push({ ...created, originalBackup: `${backup.dir}/${write.path}` });
    else record.filesCreated.push(created);
  }
}

function removeEntry(record: InstallRecord, rel: string) {
  record.filesCreated = record.filesCreated.filter((e) => e.path !== rel);
  record.filesModified = record.filesModified.filter((e) => e.path !== rel);
}

/** Writes the record, or deletes it once nothing is installed; then removes folders the kit created that are now empty. */
function saveRecordAndTidy(target: Target, record: InstallRecord) {
  const recordFile = resolveInside(target.root, recordRel());
  const isEmpty = record.components.length === 0 && record.filesCreated.length === 0 && record.filesModified.length === 0;
  if (isEmpty) {
    if (existsSync(recordFile)) unlinkSync(recordFile);
  } else {
    record.createdDirs.push(...ensureDir(target, path.dirname(recordFile)));
  }

  // Deepest first, so a parent is empty by the time we reach it. The record file keeps its own folder alive.
  // Only real, empty folders inside the target are removed; a failure here must not stop the record being saved.
  const deepestFirst = [...new Set(record.createdDirs)].sort((a, b) => b.split("/").length - a.split("/").length);
  record.createdDirs = deepestFirst.filter((rel) => {
    try {
      const dir = resolveInside(target.root, rel);
      if (!existsSync(dir)) return false;
      const isRecordFolder = !isEmpty && dir === path.dirname(recordFile);
      if (isRecordFolder || !lstatSync(dir).isDirectory() || readdirSync(dir).length > 0) return true;
      rmdirSync(dir);
      return false;
    } catch {
      return true;
    }
  });
  if (!isEmpty) writeAtomically(target, recordRel(), `${JSON.stringify(record, null, 2)}\n`);
  // A pre-release record has now been migrated (or the install removed): its old file goes too.
  const legacyFile = resolveInside(target.root, legacyRecordRel(target));
  if (existsSync(legacyFile)) unlinkSync(legacyFile);
}

