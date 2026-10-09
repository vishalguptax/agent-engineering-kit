import { createHash } from "node:crypto";
import path from "node:path";
import { isToolId, type ToolId } from "../tools/profiles.js";
import { isKnownAdded, type JsonAdded } from "./json-merge.js";
import { installablePaths, knownJsonAdditions } from "./layout.js";
import type { Manifest } from "./manifest.js";
import type { CommentStyle } from "./text-block.js";
import { BACKUP_PREFIX, KIT_STATE_DIR, claudeDirRel, legacyBackupPrefix, legacyRecordRel, readTargetFile, recordRel, type Target } from "./target.js";

/** One file the installer wrote. Paths are POSIX-style, relative to the target root. */
export interface RecordEntry {
  path: string;
  componentIds: string[];
  /** The tools that read this file. */
  toolIds: ToolId[];
  /** sha256 of the file right after the installer last wrote it; tells us if the user edited it since. */
  installedHash: string;
  /** Modified files only: the copy of the file from before the kit first touched it. */
  originalBackup?: string;
  /** JSON merges only: exactly what the kit added to the file. */
  jsonAdded?: JsonAdded;
  /** Files where the kit owns a marked block: the comment style of its markers. */
  block?: CommentStyle;
  /** The file holds project info the user typed into the installer; uninstall only removes the kit's block. */
  userContent?: boolean;
}

/** Contents of <target>/.agent-kit/install.json. */
export interface InstallRecord {
  schemaVersion: 2;
  kitVersion: string;
  mode: Target["mode"];
  installedAt: string;
  updatedAt: string;
  components: string[];
  tools: ToolId[];
  filesCreated: RecordEntry[];
  filesModified: RecordEntry[];
  /** Folders the installer created; removed on uninstall only if empty. */
  createdDirs: string[];
  /** Backup folders, oldest first. */
  backups: string[];
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Paths the pre-release installer wrote that are no longer used; allowed in a migrated record so they can be removed. */
function legacyPaths(target: Target): string[] {
  const claude = target.mode === "global" ? "" : ".claude/";
  return ["docs/AGENT_ENGINEERING_RULES.md", `${claude}hooks/format.sh`, `${claude}skills/simplify/SKILL.md`].flatMap((p) => [p, `${p}.kit-new`]);
}

/**
 * Reads and validates the install record (or a pre-release record, converted). The record lives in the user's
 * project, which may be an untrusted clone, so every path in it must be one the installer could have written.
 */
export function readRecord(target: Target, manifest: Manifest): InstallRecord | null {
  const current = readTargetFile(target, recordRel());
  const legacy = current === null ? readTargetFile(target, legacyRecordRel(target)) : null;
  const text = current ?? legacy;
  if (text === null) return null;
  const rel = current !== null ? recordRel() : legacyRecordRel(target);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`The install record ${rel} is damaged (${(error as Error).message}). Move it aside to install fresh; the installer will then treat existing files as yours.`);
  }
  const record = current !== null ? (parsed as InstallRecord) : fromVersion1(parsed, manifest);
  const problems = recordProblems(record, manifest, target);
  if (problems.length > 0) {
    throw new Error(
      `The install record ${rel} can't be trusted: ${problems.join("; ")}. That is nothing the installer writes, so it won't act on this record. ` +
        "If you didn't edit it by hand, someone else may have; move it aside and run the installer again.",
    );
  }
  return record;
}

/** True when the record on disk is still in the pre-release location (apply removes it after writing the new one). */
export function hasLegacyRecord(target: Target): boolean {
  return readTargetFile(target, recordRel()) === null && readTargetFile(target, legacyRecordRel(target)) !== null;
}

interface Version1Entry {
  path: string;
  componentIds: string[];
  installedHash: string;
  originalBackup?: string;
  settingsAdded?: { deny: string[]; hookCommands: string[]; createdKeys: string[] };
  snippet?: boolean;
  userContent?: boolean;
}

/** Converts a pre-release (Claude Code only) record into the current shape. */
function fromVersion1(value: unknown, manifest: Manifest): InstallRecord {
  const v1 = value as Omit<InstallRecord, "schemaVersion" | "tools" | "filesCreated" | "filesModified"> & { filesCreated: Version1Entry[]; filesModified: Version1Entry[] };
  if (!Array.isArray(v1?.filesCreated) || !Array.isArray(v1?.filesModified)) return v1 as unknown as InstallRecord;
  const rename = (id: string) => manifest.componentRenames[id] ?? id;
  const known = new Set(manifest.components.map((c) => c.id));
  const entry = (old: Version1Entry): RecordEntry => {
    const converted: RecordEntry = { path: old.path, componentIds: old.componentIds.map(rename), toolIds: ["claude-code"], installedHash: old.installedHash };
    if (old.originalBackup) converted.originalBackup = old.originalBackup;
    if (old.snippet) converted.block = "html";
    if (old.userContent) converted.userContent = true;
    if (old.settingsAdded) {
      const { deny, hookCommands, createdKeys } = old.settingsAdded;
      converted.jsonAdded = {
        additions: [
          ...(deny.length > 0 ? [{ path: ["permissions", "deny"], items: deny }] : []),
          ...(hookCommands.length > 0
            ? [{ path: ["hooks", "PostToolUse"], items: [{ hooks: hookCommands.map((command) => ({ type: "command", command })) }], identity: "hooks.*.command" }]
            : []),
        ],
        createdKeys,
        coerced: [],
      };
    }
    return converted;
  };
  return {
    ...v1,
    schemaVersion: 2,
    components: Array.isArray(v1.components) ? v1.components.map(rename).filter((id) => known.has(id)) : v1.components,
    tools: ["claude-code"],
    filesCreated: v1.filesCreated.map(entry),
    filesModified: v1.filesModified.map(entry),
  };
}

function recordProblems(record: InstallRecord, manifest: Manifest, target: Target): string[] {
  const isStringList = (value: unknown) => Array.isArray(value) && value.every((v) => typeof v === "string");
  if (
    typeof record !== "object" ||
    record === null ||
    record.schemaVersion !== 2 ||
    !isStringList(record.components) ||
    !isStringList(record.createdDirs) ||
    !isStringList(record.backups) ||
    !Array.isArray(record.tools) ||
    !record.tools.every((t) => typeof t === "string" && isToolId(t)) ||
    !Array.isArray(record.filesCreated) ||
    !Array.isArray(record.filesModified)
  ) {
    return ["it doesn't have the expected structure"];
  }

  const problems: string[] = [];
  const allowedFiles = new Set([...installablePaths(manifest, target), ...legacyPaths(target)]);
  const allowedDirs = creatableDirs(allowedFiles, target);
  const knownAdditions = knownJsonAdditions(target);
  const backupPrefixes = [BACKUP_PREFIX, legacyBackupPrefix(target)];
  const isPlainRelative = (p: string) => !path.posix.isAbsolute(p) && !/^[a-zA-Z]:/.test(p) && !p.split(/[\\/]/).includes("..");
  const isBackupPath = (p: string) => backupPrefixes.some((prefix) => p.startsWith(prefix)) && isPlainRelative(p);

  for (const entry of [...record.filesCreated, ...record.filesModified]) {
    if (typeof entry?.path !== "string" || typeof entry.installedHash !== "string" || !isStringList(entry.componentIds) || !isStringList(entry.toolIds)) {
      problems.push("a file entry has the wrong structure");
      continue;
    }
    if (!allowedFiles.has(entry.path)) problems.push(`it lists "${entry.path}"`);
    if (entry.jsonAdded !== undefined && !isKnownAdded(entry.jsonAdded, knownAdditions)) problems.push(`it claims the kit added entries to "${entry.path}" that the kit never writes`);
    // The installer only ever creates the git hook, so a "restore from backup" for it would be a forgery
    // aimed at running code on the next commit.
    if (entry.path.startsWith(".git/") && (entry.originalBackup !== undefined || record.filesModified.includes(entry))) {
      problems.push(`it claims to have modified "${entry.path}"`);
    }
    const backup = entry.originalBackup;
    if (backup !== undefined && (typeof backup !== "string" || !isBackupPath(backup) || !backup.endsWith(`/${entry.path}`))) {
      problems.push(`it points to a backup at "${String(backup)}"`);
    }
  }
  for (const dir of record.createdDirs) {
    if (!allowedDirs.has(dir)) problems.push(`it lists the folder "${dir}"`);
  }
  for (const backup of record.backups) {
    if (!isBackupPath(backup)) problems.push(`it lists the backup folder "${backup}"`);
  }
  return problems;
}

/** Folders the installer may create: its own folder, Claude's folder, and every folder above an installable path. */
function creatableDirs(files: Set<string>, target: Target): Set<string> {
  const dirs = new Set<string>([KIT_STATE_DIR, claudeDirRel(target)]);
  for (const file of files) {
    for (let dir = path.posix.dirname(file); dir !== "."; dir = path.posix.dirname(dir)) dirs.add(dir);
  }
  return dirs;
}

export function findEntry(record: InstallRecord | null, rel: string): RecordEntry | undefined {
  return record?.filesCreated.find((e) => e.path === rel) ?? record?.filesModified.find((e) => e.path === rel);
}
