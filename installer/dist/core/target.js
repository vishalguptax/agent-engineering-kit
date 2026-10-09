import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveInside } from "./paths.js";
export function projectTarget(dir) {
    return { mode: "project", root: path.resolve(dir) };
}
export function globalTarget(homeDir = os.homedir()) {
    return { mode: "global", root: path.join(homeDir, ".claude") };
}
/** Claude Code's own folder: `.claude` in a project, the target root itself for a global install. */
export function claudeDirRel(target) {
    return target.mode === "global" ? "" : ".claude";
}
/** The installer's own folder in the target: install record, backups and kit scripts. */
export const KIT_STATE_DIR = ".agent-kit";
export const BACKUP_PREFIX = `${KIT_STATE_DIR}/backup/`;
export function recordRel() {
    return `${KIT_STATE_DIR}/install.json`;
}
export function backupRel(stamp) {
    return `${BACKUP_PREFIX}${stamp}`;
}
/** Where kit 1.x kept its install record. Only read, to migrate an older install. */
export function legacyRecordRel(target) {
    return path.posix.join(claudeDirRel(target), ".kit-install.json");
}
/** Where kit 1.x kept its backups (still referenced by migrated records). */
export function legacyBackupPrefix(target) {
    return `${path.posix.join(claudeDirRel(target), ".kit-backup")}/`;
}
/** Absolute path for a POSIX-style path relative to the target root. */
export function absolute(target, rel) {
    return path.join(target.root, ...rel.split("/"));
}
/**
 * Current contents of a target file, or null if it doesn't exist.
 * Throws for paths that escape the target or are symlinks, so nothing outside the target is ever read.
 */
export function readTargetFile(target, rel) {
    const file = resolveInside(target.root, rel);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
}
