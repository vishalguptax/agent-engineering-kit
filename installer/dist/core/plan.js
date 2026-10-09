import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import { findCollisions } from "../tools/collisions.js";
import { toolById } from "../tools/profiles.js";
import { unifiedDiff } from "./diff.js";
import { combineAdded, isEmptyAdded, mergeJson, staleAdded, subtractAdded, unmergeJson } from "./json-merge.js";
import { CHECKS_CONF, hookPlacement, renderChecksConf, suggestChecks } from "./checks.js";
import { readKitFile } from "./kit.js";
import { desiredLayout } from "./layout.js";
import { resolveInside } from "./paths.js";
import { extractProjectTemplate, hasProjectSection, renderProjectSection } from "./project-info.js";
import { findEntry, hasLegacyRecord, hashText, readRecord } from "./record.js";
import { hasBlock, insertBeforeBlock, upsertBlock } from "./text-block.js";
import { absolute, readTargetFile } from "./target.js";
import { planRemovals } from "./uninstall.js";
export const CONFLICT_CHOICES = ["keep", "kit", "kit-new"];
/**
 * Works out every change needed so the target holds exactly what the selected components need for the selected
 * tools: new and changed files, and removal of kit files that are no longer needed. Reads files, never writes.
 */
export function planInstall({ manifest, target, selected, tools: toolIds, projectInfo, homeDir = os.homedir(), checks }) {
    const plan = { target, selected, tools: toolIds, actions: [], blockers: [], notes: [], updatesRecord: false };
    if (target.mode === "global" && toolIds.some((id) => id !== "claude-code")) {
        return { ...plan, blockers: ["Global installs (~/.claude) are for Claude Code only. Install other tools per project."] };
    }
    let record;
    try {
        record = readRecord(target, manifest);
    }
    catch (error) {
        return { ...plan, blockers: [error.message] };
    }
    const tools = toolIds.map(toolById);
    const components = manifest.components.filter((c) => selected.includes(c.id));
    const attempt = (step) => {
        try {
            step();
        }
        catch (error) {
            plan.blockers.push(error.message);
        }
    };
    attempt(() => {
        const checksArtifact = target.mode === "project" ? components.flatMap((c) => c.artifacts).find((a) => a.kind === "checks") : undefined;
        const currentConf = checksArtifact && checks !== undefined ? readTargetFile(target, CHECKS_CONF) : null;
        if (currentConf !== null && currentConf !== renderChecksConf(checks)) {
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
        for (const file of layout.files)
            attempt(() => plan.actions.push(planFile(file, { manifest, target, record, projectInfo, notes: plan.notes })));
        if (record)
            attempt(() => plan.actions.push(...planRemovals(target, record, new Set(layout.files.map((f) => f.path)))));
    });
    if (target.mode === "project") {
        plan.notes.push(...toolWarnings(target, tools));
        attempt(() => plan.notes.push(...collisionNotes(target, tools, components, homeDir)));
        plan.notes.push(...plansFolderNotes(target, components, projectInfo));
    }
    plan.blockers.push(...pathBlockers(target, plan.actions));
    plan.updatesRecord = recordChanges(target, record, plan);
    return plan;
}
/** Whether running the plan changes anything: a file (a conflict counts only if not kept) or the install record. */
export function hasChanges(plan, isConflictKept) {
    return plan.updatesRecord || plan.actions.some((a) => a.kind !== "SKIP" && !(a.kind === "CONFLICT" && isConflictKept(a.path)));
}
function recordChanges(target, record, plan) {
    if (hasLegacyRecord(target) || plan.actions.some((a) => a.dropEntry))
        return true;
    if (!record)
        return false;
    if (!sameSet(record.components, plan.selected) || !sameSet(record.tools, plan.tools))
        return true;
    return plan.actions.some((a) => {
        const entry = a.kind === "SKIP" ? findEntry(record, a.path) : undefined;
        return entry !== undefined && (!sameSet(entry.componentIds, a.componentIds) || !sameSet(entry.toolIds, a.toolIds));
    });
}
function sameSet(a, b) {
    return a.length === b.length && a.every((x) => b.includes(x));
}
/** Every action's path must resolve inside the target (no traversal, no symlink escapes). */
export function pathBlockers(target, actions) {
    return actions.flatMap((action) => {
        try {
            resolveInside(target.root, action.path);
            return [];
        }
        catch (error) {
            return [error.message];
        }
    });
}
export function fileAction(fields) {
    return { ...fields, diff: unifiedDiff(fields.before, fields.after) };
}
function planFile(file, context) {
    switch (file.kind) {
        case "copy":
            return planCopy(file, context);
        case "json":
            return planJson(file, context);
        case "block":
            return file.isHub ? planHub(file, context) : planBlock(file, context);
    }
}
function planCopy(file, { target, record }) {
    const current = readTargetFile(target, file.path);
    const base = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, after: file.content, executable: file.executable };
    if (current === null)
        return fileAction({ ...base, kind: "CREATE", summary: `Create ${file.path}.` });
    if (file.createOnly)
        return fileAction({ ...base, after: current, kind: "SKIP", summary: "Yours to edit; the installer leaves it as it is." });
    if (current === file.content)
        return fileAction({ ...base, kind: "SKIP", summary: "Already identical to the kit's version." });
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
function planJson(file, { target, record }) {
    const current = readTargetFile(target, file.path);
    const recorded = findEntry(record, file.path)?.jsonAdded;
    const stale = recorded ? staleAdded(recorded, file.additions) : null;
    const hasStale = stale !== null && !isEmptyAdded(stale);
    const base = current !== null && hasStale ? unmergeJson(current, stale, file.path) : current;
    const merged = mergeJson(base, file.additions, file.path, file.seed);
    const jsonState = recorded ? combineAdded(hasStale ? subtractAdded(recorded, stale) : recorded, merged.added) : merged.added;
    const fields = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, after: merged.text, jsonState };
    if (current === null)
        return fileAction({ ...fields, kind: "CREATE", summary: `Create ${file.path} with the kit's entries.` });
    if (merged.text === current)
        return fileAction({ ...fields, kind: "SKIP", summary: "Already contains the kit's entries." });
    const removing = hasStale ? " Outdated kit entries are removed." : "";
    return fileAction({ ...fields, kind: "MERGE", summary: `Add the kit's entries.${removing} Nothing of yours is removed or changed.` });
}
/** A file where the kit owns one marked block (CLAUDE.md's import, ignore files). */
function planBlock(file, { target }) {
    const current = readTargetFile(target, file.path);
    const fields = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, block: file.style };
    // A file holding exactly the block's lines (e.g. the pre-release installer's plain "@AGENTS.md" CLAUDE.md) is adopted: wrapped in markers.
    if (current !== null && !hasBlock(current, file.style) && current.trim() === file.content.trim()) {
        const after = upsertBlock(null, file.content, file.style).text;
        return fileAction({ ...fields, after, kind: "UPDATE", summary: `${file.path} already has exactly these lines; they get the kit's markers so updates and uninstall can find them.` });
    }
    const { text, changed } = upsertBlock(current, file.content, file.style);
    if (!changed)
        return fileAction({ ...fields, after: text, kind: "SKIP", summary: "The kit's block is already up to date." });
    if (current === null)
        return fileAction({ ...fields, after: text, kind: "CREATE", summary: `Create ${file.path} with the kit's block.` });
    const summary = hasBlock(current, file.style) ? "Replace the kit's block with the current version." : "Append the kit's block to the end.";
    return fileAction({ ...fields, after: text, kind: "APPEND", summary });
}
/** The main instructions file: the kit's block, plus (once) the user's project section or the template to fill in. */
function planHub(file, { manifest, target, projectInfo, notes }) {
    const current = readTargetFile(target, file.path);
    const fields = { path: file.path, componentIds: file.componentIds, toolIds: file.toolIds, before: current, block: file.style };
    const section = target.mode === "project" && projectInfo ? renderProjectSection(projectInfo) : null;
    if (projectInfo && target.mode === "global")
        notes.push("Project info is only written for project installs, so it was left out of the global CLAUDE.md.");
    let base = current;
    let userContent = false;
    if (section && hasProjectSection(target)) {
        notes.push('This project already has a "## Project Overview" section, so your project info was not added. Edit that section directly.');
    }
    else if (section) {
        base = current === null ? section : insertBeforeBlock(current, section);
        userContent = true;
    }
    else if (current === null && target.mode === "project" && !hasProjectSection(target)) {
        base = projectTemplate(manifest, target);
    }
    const { text, changed } = upsertBlock(base, file.content, file.style);
    if (!changed && !userContent)
        return fileAction({ ...fields, after: text, kind: "SKIP", summary: "The kit's block is already up to date." });
    const withInfo = userContent ? " Your project info goes above it." : "";
    if (current === null) {
        const summary = base === null ? `Create ${file.path} with the kit's block.` : `Create ${file.path} with a project section to fill in, plus the kit's block.`;
        return fileAction({ ...fields, after: text, kind: "CREATE", summary: `${summary}${withInfo}`, userContent });
    }
    const summary = hasBlock(current, file.style) ? "Replace the kit's block with the current version." : `Append the kit's block to the end of ${file.path}.`;
    return fileAction({ ...fields, after: text, kind: "APPEND", summary: `${summary}${withInfo}`, userContent });
}
function projectTemplate(manifest, target) {
    const rulebook = manifest.components.flatMap((c) => c.artifacts).find((a) => a.kind === "rulebook");
    return rulebook?.kind === "rulebook" ? extractProjectTemplate(readKitFile(manifest, rulebook.source, target)) : null;
}
/** Where kit 1.0 and 1.1 had the feature skill write plans. */
const RETIRED_PLANS_DIR = "docs/plans";
const PLANS_PREFERENCE = /^\s*-\s*Plans:/im;
/** Plans from an earlier kit version in docs/plans/: say how to keep using that folder, unless the project already says where plans go. */
function plansFolderNotes(target, components, projectInfo) {
    if (target.mode !== "project" || !components.some((c) => c.id === "feature"))
        return [];
    // The project may be an untrusted clone: a symlinked or unreadable file just means "no".
    const quietly = (read, fallback) => {
        try {
            return read();
        }
        catch {
            return fallback;
        }
    };
    const hasPlans = quietly(() => readdirSync(resolveInside(target.root, RETIRED_PLANS_DIR)).some((name) => name.endsWith(".md")), false);
    if (!hasPlans)
        return [];
    const instructions = ["AGENTS.md", "CLAUDE.md"].map((file) => quietly(() => readTargetFile(target, file), null));
    if ([projectInfo?.workflow, projectInfo?.markdown, ...instructions].some((text) => PLANS_PREFERENCE.test(text ?? "")))
        return [];
    return [`Plans: you have plans in ${RETIRED_PLANS_DIR}/, but the feature skill now writes new ones to .agent-kit/plans/. To keep using ${RETIRED_PLANS_DIR}/, add "- Plans: ${RETIRED_PLANS_DIR}/" under Workflow Preferences in AGENTS.md.`];
}
/** Profile warnings whose trigger file exists in the project (e.g. Zed would read another rules file first). */
function toolWarnings(target, tools) {
    return tools.flatMap((tool) => (tool.warnings ?? []).filter((w) => w.ifExists.some((rel) => existsSync(absolute(target, rel)))).map((w) => `${tool.name}: ${w.message}`));
}
/** Same-named skills or agents elsewhere that a selected tool would also see (or prefer). */
function collisionNotes(target, tools, components, homeDir) {
    const names = (kind) => components.flatMap((c) => c.artifacts.flatMap((a) => (a.kind === kind ? [a.name] : [])));
    return findCollisions({ projectDir: target.root, homeDir, tools, skillNames: names("skill"), agentNames: names("agent") }).map((c) => `${toolById(c.toolId).name} also sees your own "${c.name}" ${c.kind} at ${c.where}, next to the kit's. Rename or remove one so the tool doesn't pick the wrong one.`);
}
