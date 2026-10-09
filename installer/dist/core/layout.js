import { renderAgent } from "../render/agent.js";
import { FORMAT_SCRIPT, formatHookAddition, formatHookSeed } from "../render/hooks.js";
import { claudeImportBlock, geminiContextAddition } from "../render/instructions.js";
import { secretGuardAddition, secretGuardIgnoreLines } from "../render/secret-guard.js";
import { renderSkill } from "../render/skill.js";
import { agentFileName, chooseLocations } from "../tools/locations.js";
import { TOOL_PROFILES, toolById } from "../tools/profiles.js";
import { CHECK_SCRIPT, CHECKS_CONF, HOOK_LINE, PRE_COMMIT_HOOK, PRE_COMMIT_SCRIPT, PROTECTED_LIST, PROTECTED_TEMPLATE, renderChecksConf } from "./checks.js";
import { readKitFile } from "./kit.js";
import { KIT_STATE_DIR } from "./target.js";
/** The kit's reference files live in its own folder, so a project's docs/ stays the project's. */
export const RULEBOOK_PATH = `${KIT_STATE_DIR}/RULES.md`;
export const PLAN_TEMPLATE_PATH = `${KIT_STATE_DIR}/plan-template.md`;
export const AGENT_REFERENCE_DIR = `${KIT_STATE_DIR}/agents`;
/** Where kit 1.0 and 1.1 put those reference files. */
const RETIRED_REFERENCE_DIR = "docs/agent-engineering";
const GEMINI_SETTINGS = ".gemini/settings.json";
/** A global install's root is ~/.claude itself (Claude Code only), so Claude's own folders lose their prefix there. */
function inTarget(target, rel) {
    return target.mode === "global" ? rel.replace(/^\.claude\//, "") : rel;
}
/** Every file the selected components need for the selected tools, rendered in each tool's format. */
export function desiredLayout({ manifest, target, components, tools, checks = "", hookPlacement }) {
    const files = new Map();
    const notes = [];
    const allToolIds = tools.map((t) => t.id);
    const isGlobal = target.mode === "global";
    const add = (desired) => {
        const file = { ...desired, path: inTarget(target, desired.path) };
        files.set(file.path, mergeDesired(files.get(file.path), file));
    };
    const copy = (path, content, componentId, toolIds = allToolIds) => add({ kind: "copy", path, content, componentIds: [componentId], toolIds });
    const kitText = (source) => readKitFile(manifest, source, target);
    const note = (tool, text) => notes.push(`${tool.name}: ${text}`);
    const skillLocations = chooseLocations(tools, "skills");
    const agentLocations = chooseLocations(tools, "agents");
    const readers = (dir, kind) => tools
        .filter((t) => (kind === "skills" ? t.skills?.reads.includes(dir) : t.agents && "reads" in t.agents && t.agents.reads.some((l) => l.dir === dir)))
        .map((t) => t.id);
    for (const component of components) {
        for (const artifact of component.artifacts) {
            switch (artifact.kind) {
                case "rulebook":
                    copy(RULEBOOK_PATH, kitText(artifact.source), component.id);
                    break;
                case "template":
                    copy(PLAN_TEMPLATE_PATH, kitText(artifact.source), component.id);
                    break;
                case "instructions": {
                    const block = kitText(artifact.source);
                    if (isGlobal) {
                        add({ kind: "block", path: "CLAUDE.md", content: block, style: "html", isHub: true, componentIds: [component.id], toolIds: allToolIds });
                        break;
                    }
                    add({ kind: "block", path: "AGENTS.md", content: block, style: "html", isHub: true, componentIds: [component.id], toolIds: allToolIds });
                    for (const tool of tools) {
                        const spec = tool.instructions;
                        if (spec.kind === "claude-import") {
                            add({ kind: "block", path: "CLAUDE.md", content: claudeImportBlock(), style: "html", isHub: false, componentIds: [component.id], toolIds: [tool.id] });
                        }
                        else if (spec.kind === "gemini-context") {
                            const addition = geminiContextAddition();
                            add({ kind: "json", path: GEMINI_SETTINGS, additions: [addition], seed: {}, componentIds: [component.id], toolIds: [tool.id] });
                        }
                        else if (spec.kind === "note") {
                            note(tool, spec.note);
                        }
                    }
                    break;
                }
                case "skill":
                    for (const location of skillLocations.chosen) {
                        const content = renderSkill(kitText(`skills/${artifact.name}/SKILL.md`), artifact.name);
                        copy(`${location.dir}/${artifact.name}/SKILL.md`, content, component.id, readers(location.dir, "skills"));
                    }
                    break;
                case "agent": {
                    const source = kitText(`agents/${artifact.name}.md`);
                    copy(`${AGENT_REFERENCE_DIR}/${artifact.name}.md`, source, component.id);
                    for (const location of agentLocations.chosen) {
                        const format = location.format;
                        copy(`${location.dir}/${agentFileName(artifact.name, format)}`, renderAgent(source, format), component.id, readers(location.dir, "agents"));
                    }
                    break;
                }
                case "format-hook": {
                    const hooked = tools.flatMap((tool) => {
                        const spec = tool.formatHook;
                        if (spec?.kind === "note")
                            note(tool, spec.note);
                        return spec && spec.kind !== "note" ? [{ tool, spec }] : [];
                    });
                    if (hooked.length === 0)
                        break;
                    copy(FORMAT_SCRIPT, kitText(artifact.source), component.id, hooked.map(({ tool }) => tool.id));
                    for (const { tool, spec } of hooked) {
                        const addition = formatHookAddition(spec.kind, target.mode);
                        add({ kind: "json", path: spec.file, additions: [addition], seed: formatHookSeed(spec.kind), componentIds: [component.id], toolIds: [tool.id] });
                    }
                    break;
                }
                case "checks": {
                    if (isGlobal) {
                        notes.push("Pre-commit checks are per project, so they were left out of the global install.");
                        break;
                    }
                    copy(CHECK_SCRIPT, kitText(artifact.source), component.id);
                    add({ kind: "copy", path: CHECKS_CONF, content: renderChecksConf(checks), createOnly: true, componentIds: [component.id], toolIds: allToolIds });
                    add({ kind: "copy", path: PROTECTED_LIST, content: PROTECTED_TEMPLATE, createOnly: true, componentIds: [component.id], toolIds: allToolIds });
                    if (hookPlacement?.kind === "write") {
                        add({ kind: "copy", path: PRE_COMMIT_HOOK, content: PRE_COMMIT_SCRIPT, createOnly: true, executable: true, componentIds: [component.id], toolIds: allToolIds });
                    }
                    else if (hookPlacement?.kind === "manual") {
                        notes.push(`Checks: ${hookPlacement.reason}, so the installer didn't touch your git hooks. Add this line to your pre-commit hook: ${HOOK_LINE}`);
                    }
                    else {
                        notes.push(`Checks: this folder is not a git repository, so there's no pre-commit hook. Run them with: sh ${CHECK_SCRIPT}`);
                    }
                    break;
                }
                case "secret-guard":
                    for (const tool of tools) {
                        const spec = tool.secretGuard;
                        if (!spec)
                            continue;
                        if (spec.kind === "note") {
                            note(tool, spec.note);
                        }
                        else if (spec.kind === "claude-settings") {
                            add({ kind: "json", path: spec.file, additions: [secretGuardAddition()], seed: {}, componentIds: [component.id], toolIds: [tool.id] });
                        }
                        else {
                            add({ kind: "block", path: spec.file, content: secretGuardIgnoreLines(), style: "hash", isHub: false, componentIds: [component.id], toolIds: [tool.id] });
                            if (spec.note)
                                note(tool, spec.note);
                        }
                    }
                    break;
            }
        }
    }
    const installsKind = (kind) => components.some((c) => c.artifacts.some((a) => a.kind === kind));
    if (!isGlobal) {
        for (const [kind, choice] of [["skill", skillLocations], ["agent", agentLocations]]) {
            if (!installsKind(kind))
                continue;
            for (const { toolId, dirs } of choice.duplicates) {
                note(toolById(toolId), `reads both ${dirs.join(" and ")}, which your other tools need, so it will list each kit ${kind} twice (identical copies).`);
            }
        }
    }
    return { files: [...files.values()], notes };
}
/** Two artifacts that want the same file must agree; JSON additions combine. */
function mergeDesired(existing, next) {
    if (!existing)
        return next;
    const componentIds = [...new Set([...existing.componentIds, ...next.componentIds])];
    const toolIds = [...new Set([...existing.toolIds, ...next.toolIds])];
    if (existing.kind === "json" && next.kind === "json") {
        return { ...existing, additions: [...existing.additions, ...next.additions], componentIds, toolIds };
    }
    if (existing.kind === next.kind && "content" in existing && "content" in next && existing.content === next.content) {
        return { ...existing, componentIds, toolIds };
    }
    throw new Error(`The kit wants two different versions of ${next.path}. This is a bug in the kit; please report it.`);
}
/** Hook commands the pre-release installer added to Claude's settings, so their entries are still recognised as the kit's. */
const VERSION_1_HOOK_COMMANDS = { project: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/format.sh', global: '"$HOME"/.claude/hooks/format.sh' };
/** Every JSON entry any kit version writes in this mode: what an install record may claim the kit added. */
export function knownJsonAdditions(target) {
    const hookKinds = new Set(TOOL_PROFILES.flatMap((tool) => (tool.formatHook && tool.formatHook.kind !== "note" ? [tool.formatHook.kind] : [])));
    return [
        secretGuardAddition(),
        geminiContextAddition(),
        ...[...hookKinds].map((kind) => formatHookAddition(kind, target.mode)),
        { path: ["hooks", "PostToolUse"], items: [{ hooks: [{ type: "command", command: VERSION_1_HOOK_COMMANDS[target.mode] }] }], identity: "hooks.*.command" },
    ];
}
function agentNames(manifest) {
    return manifest.components.flatMap((c) => c.artifacts.flatMap((a) => (a.kind === "agent" ? [a.name] : [])));
}
/** The reference files at their kit 1.0/1.1 paths: still valid in install records, so Update can remove them. */
export function retiredReferencePaths(manifest) {
    return [`${RETIRED_REFERENCE_DIR}/RULES.md`, `${RETIRED_REFERENCE_DIR}/plan-template.md`, ...agentNames(manifest).map((name) => `${RETIRED_REFERENCE_DIR}/agents/${name}.md`)];
}
/** Every path the installer could ever write in this target, for any tool and component (validates untrusted records). */
export function installablePaths(manifest, target) {
    const tools = target.mode === "global" ? [toolById("claude-code")] : TOOL_PROFILES;
    const skillNames = [...manifest.components.flatMap((c) => c.artifacts.flatMap((a) => (a.kind === "skill" ? [a.name] : []))), ...manifest.retiredSkills];
    const agents = agentNames(manifest);
    const paths = new Set([RULEBOOK_PATH, PLAN_TEMPLATE_PATH, "AGENTS.md", "CLAUDE.md", GEMINI_SETTINGS, FORMAT_SCRIPT, CHECK_SCRIPT, CHECKS_CONF, PROTECTED_LIST]);
    for (const name of agents)
        paths.add(`${AGENT_REFERENCE_DIR}/${name}.md`);
    for (const tool of tools) {
        for (const dir of tool.skills?.reads ?? [])
            for (const name of skillNames)
                paths.add(inTarget(target, `${dir}/${name}/SKILL.md`));
        if (tool.agents && "reads" in tool.agents) {
            for (const location of tool.agents.reads)
                for (const name of agents)
                    paths.add(inTarget(target, `${location.dir}/${agentFileName(name, location.format)}`));
        }
        for (const spec of [tool.formatHook, tool.secretGuard])
            if (spec && "file" in spec)
                paths.add(inTarget(target, spec.file));
    }
    for (const p of [...paths])
        paths.add(`${p}.kit-new`);
    // The git hook is only ever created (never modified), so it has no .kit-new twin; see record validation.
    if (target.mode === "project")
        paths.add(PRE_COMMIT_HOOK);
    return paths;
}
