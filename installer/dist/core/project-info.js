import { markersFor } from "./text-block.js";
import { projectScripts } from "./scan.js";
import { readTargetFile } from "./target.js";
/** Heading that marks an existing project section; the installer never adds a second one. */
export const PROJECT_HEADING = /^## Project Overview\b/m;
const MAX_SUGGESTED_COMMANDS = 12;
/** Whether CLAUDE.md or AGENTS.md already has a project section. Unreadable files (e.g. symlinks) count as no. */
export function hasProjectSection(target) {
    return ["CLAUDE.md", "AGENTS.md"].some((file) => {
        try {
            return PROJECT_HEADING.test(readTargetFile(target, file) ?? "");
        }
        catch {
            return false;
        }
    });
}
/** The project section for CLAUDE.md/AGENTS.md, following Appendix A of the rules. null if nothing was filled in. */
export function renderProjectSection(info) {
    const clean = (value) => value?.replace(/\r\n/g, "\n").trim() ?? "";
    if (clean(info.markdown))
        return checked(`${clean(info.markdown)}\n`);
    const overview = [clean(info.overview), clean(info.stack) && `- Tech stack: ${clean(info.stack)}`].filter(Boolean).join("\n");
    const sections = [
        ["Project Overview", overview],
        ["Commands", clean(info.commands)],
        ["Key Directories", clean(info.keyDirs)],
        ["Conventions", clean(info.conventions)],
        ["Do / Don't (learned from past mistakes)", clean(info.doDont)],
        ["Additional Context", clean(info.notes)],
    ];
    const filled = sections.filter(([, body]) => body !== "").map(([title, body]) => `## ${title}\n${body}\n`);
    return filled.length === 0 ? null : checked(filled.join("\n"));
}
function checked(section) {
    const { start, end } = markersFor("html");
    if (section.includes(start) || section.includes(end)) {
        throw new Error("The project info contains the kit's marker comments; please remove them.");
    }
    return section;
}
/** Pre-fills the form from the project's own files, so users only correct instead of typing. */
export function suggestProjectInfo(target, stack) {
    return { stack: stack.join(", "), commands: suggestCommands(target).join("\n") };
}
function suggestCommands(target) {
    const { scripts, makeTargets } = projectScripts(target);
    return [...[...scripts].map(([name, command]) => `- ${name}: \`${command}\``), ...makeTargets.map((name) => `- ${name}: \`make ${name}\``)].slice(0, MAX_SUGGESTED_COMMANDS);
}
/** The "Project-Specific Section Template" code block from Appendix A of the rules file. */
export function extractProjectTemplate(rulesText) {
    const appendix = rulesText.indexOf("## Appendix A");
    if (appendix === -1)
        return null;
    const fence = /```md\r?\n([\s\S]*?)```/.exec(rulesText.slice(appendix));
    return fence ? fence[1] : null;
}
