import { createHash } from "node:crypto";
import path from "node:path";
import { isToolId } from "../tools/profiles.js";
import { isKnownAdded } from "./json-merge.js";
import { installablePaths, knownJsonAdditions, retiredReferencePaths } from "./layout.js";
import { BACKUP_PREFIX, KIT_STATE_DIR, claudeDirRel, legacyBackupPrefix, legacyRecordRel, readTargetFile, recordRel } from "./target.js";
export function hashText(text) {
    return createHash("sha256").update(text, "utf8").digest("hex");
}
/** Paths earlier kit versions wrote that are no longer used; allowed in a record so Update can remove them. */
function legacyPaths(manifest, target) {
    const claude = target.mode === "global" ? "" : ".claude/";
    return ["docs/AGENT_ENGINEERING_RULES.md", `${claude}hooks/format.sh`, ...retiredReferencePaths(manifest)].flatMap((p) => [p, `${p}.kit-new`]);
}
/**
 * Reads and validates the install record (or a pre-release record, converted). The record lives in the user's
 * project, which may be an untrusted clone, so every path in it must be one the installer could have written.
 */
export function readRecord(target, manifest) {
    const current = readTargetFile(target, recordRel());
    const legacy = current === null ? readTargetFile(target, legacyRecordRel(target)) : null;
    const text = current ?? legacy;
    if (text === null)
        return null;
    const rel = current !== null ? recordRel() : legacyRecordRel(target);
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        throw new Error(`The install record ${rel} is damaged (${error.message}). Move it aside to install fresh; the installer will then treat existing files as yours.`);
    }
    const record = current !== null ? parsed : fromVersion1(parsed, manifest);
    const problems = recordProblems(record, manifest, target);
    if (problems.length > 0) {
        throw new Error(`The install record ${rel} can't be trusted: ${problems.join("; ")}. That is nothing the installer writes, so it won't act on this record. ` +
            "If you didn't edit it by hand, someone else may have; move it aside and run the installer again.");
    }
    return record;
}
/** True when the record on disk is still in the pre-release location (apply removes it after writing the new one). */
export function hasLegacyRecord(target) {
    return readTargetFile(target, recordRel()) === null && readTargetFile(target, legacyRecordRel(target)) !== null;
}
/** Converts a pre-release (Claude Code only) record into the current shape. */
function fromVersion1(value, manifest) {
    const v1 = value;
    if (!Array.isArray(v1?.filesCreated) || !Array.isArray(v1?.filesModified))
        return v1;
    const rename = (id) => manifest.componentRenames[id] ?? id;
    const known = new Set(manifest.components.map((c) => c.id));
    const entry = (old) => {
        const converted = { path: old.path, componentIds: old.componentIds.map(rename), toolIds: ["claude-code"], installedHash: old.installedHash };
        if (old.originalBackup)
            converted.originalBackup = old.originalBackup;
        if (old.snippet)
            converted.block = "html";
        if (old.userContent)
            converted.userContent = true;
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
function recordProblems(record, manifest, target) {
    const isStringList = (value) => Array.isArray(value) && value.every((v) => typeof v === "string");
    if (typeof record !== "object" ||
        record === null ||
        record.schemaVersion !== 2 ||
        !isStringList(record.components) ||
        !isStringList(record.createdDirs) ||
        !isStringList(record.backups) ||
        !Array.isArray(record.tools) ||
        !record.tools.every((t) => typeof t === "string" && isToolId(t)) ||
        !Array.isArray(record.filesCreated) ||
        !Array.isArray(record.filesModified)) {
        return ["it doesn't have the expected structure"];
    }
    const problems = [];
    const allowedFiles = new Set([...installablePaths(manifest, target), ...legacyPaths(manifest, target)]);
    const allowedDirs = creatableDirs(allowedFiles, target);
    const knownAdditions = knownJsonAdditions(target);
    const backupPrefixes = [BACKUP_PREFIX, legacyBackupPrefix(target)];
    const isPlainRelative = (p) => !path.posix.isAbsolute(p) && !/^[a-zA-Z]:/.test(p) && !p.split(/[\\/]/).includes("..");
    const isBackupPath = (p) => backupPrefixes.some((prefix) => p.startsWith(prefix)) && isPlainRelative(p);
    for (const entry of [...record.filesCreated, ...record.filesModified]) {
        if (typeof entry?.path !== "string" || typeof entry.installedHash !== "string" || !isStringList(entry.componentIds) || !isStringList(entry.toolIds)) {
            problems.push("a file entry has the wrong structure");
            continue;
        }
        if (!allowedFiles.has(entry.path))
            problems.push(`it lists "${entry.path}"`);
        if (entry.jsonAdded !== undefined && !isKnownAdded(entry.jsonAdded, knownAdditions))
            problems.push(`it claims the kit added entries to "${entry.path}" that the kit never writes`);
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
        if (!allowedDirs.has(dir))
            problems.push(`it lists the folder "${dir}"`);
    }
    for (const backup of record.backups) {
        if (!isBackupPath(backup))
            problems.push(`it lists the backup folder "${backup}"`);
    }
    return problems;
}
/** Folders the installer may create: its own folder, Claude's folder, and every folder above an installable path. */
function creatableDirs(files, target) {
    const dirs = new Set([KIT_STATE_DIR, claudeDirRel(target)]);
    for (const file of files) {
        for (let dir = path.posix.dirname(file); dir !== "."; dir = path.posix.dirname(dir))
            dirs.add(dir);
    }
    return dirs;
}
export function findEntry(record, rel) {
    return record?.filesCreated.find((e) => e.path === rel) ?? record?.filesModified.find((e) => e.path === rel);
}
