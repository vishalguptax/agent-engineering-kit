import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveInside } from "./paths.js";

/**
 * Where the kit is installed. In project mode `root` is the project folder;
 * in global mode it is ~/.claude itself, and dests drop their ".claude/" prefix.
 */
export interface Target {
  mode: "project" | "global";
  root: string;
}

export function projectTarget(dir: string): Target {
  return { mode: "project", root: path.resolve(dir) };
}

export function globalTarget(homeDir = os.homedir()): Target {
  return { mode: "global", root: path.join(homeDir, ".claude") };
}

/** Claude Code's own folder: `.claude` in a project, the target root itself for a global install. */
export function claudeDirRel(target: Target): string {
  return target.mode === "global" ? "" : ".claude";
}

/** The installer's own folder in the target: install record, backups and kit scripts. */
export const KIT_STATE_DIR = ".agent-kit";
export const BACKUP_PREFIX = `${KIT_STATE_DIR}/backup/`;

export function recordRel(): string {
  return `${KIT_STATE_DIR}/install.json`;
}

export function backupRel(stamp: string): string {
  return `${BACKUP_PREFIX}${stamp}`;
}

/** Where the pre-release installer kept its install record. Only read, to migrate such an install. */
export function legacyRecordRel(target: Target): string {
  return path.posix.join(claudeDirRel(target), ".kit-install.json");
}

/** Where the pre-release installer kept its backups (still referenced by migrated records). */
export function legacyBackupPrefix(target: Target): string {
  return `${path.posix.join(claudeDirRel(target), ".kit-backup")}/`;
}

/** Absolute path for a POSIX-style path relative to the target root. */
export function absolute(target: Target, rel: string): string {
  return path.join(target.root, ...rel.split("/"));
}

/**
 * Current contents of a target file, or null if it doesn't exist.
 * Throws for paths that escape the target or are symlinks, so nothing outside the target is ever read.
 */
export function readTargetFile(target: Target, rel: string): string | null {
  const file = resolveInside(target.root, rel);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}
