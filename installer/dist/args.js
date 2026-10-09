import { parseArgs } from "node:util";
import { CONFLICT_CHOICES } from "./core/plan.js";
import { isToolId, TOOL_PROFILES } from "./tools/profiles.js";
export const USAGE = `Agent Engineering Kit installer

Usage:
  node installer/dist/index.js                 Open the GUI in your browser
  node installer/dist/index.js --terminal      Guided install in the terminal (no browser needed)
  node installer/dist/index.js [options]       Scriptable, no prompts with --yes

Options:
  --target <path>          Install into this project folder
  --global                 Install into ~/.claude (applies to all your projects)
  --preset <name>          recommended | minimal | everything (default: recommended,
                           or what is already installed when updating)
  --components a,b,c       Exact components to install (dependencies are added)
  --tools a,b,c            AI tools to install for (default: the ones this project uses)
  --dry-run                Show what would change; write nothing
  --yes                    Don't ask for confirmation
  --on-conflict <choice>   keep (default) | kit | kit-new, for files that differ from the kit
  --resolve <path>=<choice>  The choice for one conflicting file; repeat for more.
                           Overrides --on-conflict for that file.
  --checks <file>          Commands for the pre-commit checks, one "name: command" per line
                           (checks component; default: suggested from your scripts)
  --project-info <file>    Markdown describing your project, added to AGENTS.md once,
                           outside the kit's block (it stays yours)
  --uninstall              Undo the kit's changes using the install record
  --terminal               Guided prompts in the terminal. Used automatically over SSH
                           or on Linux without a display.
  --no-open                GUI: print the URL instead of opening a browser
  --list-tools             Show the supported AI tools and what each one gets
  --help                   Show this help`;
export function parseCliArgs(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            target: { type: "string" },
            global: { type: "boolean", default: false },
            preset: { type: "string" },
            components: { type: "string" },
            tools: { type: "string" },
            "dry-run": { type: "boolean", default: false },
            yes: { type: "boolean", default: false },
            uninstall: { type: "boolean", default: false },
            "project-info": { type: "string" },
            "on-conflict": { type: "string", default: "keep" },
            resolve: { type: "string", multiple: true },
            checks: { type: "string" },
            "no-open": { type: "boolean", default: false },
            terminal: { type: "boolean", default: false },
            help: { type: "boolean", default: false },
            "list-tools": { type: "boolean", default: false },
        },
        strict: true,
    });
    if (values.target && values.global)
        throw new Error("Use either --target <path> or --global, not both.");
    if (values.preset && values.components)
        throw new Error("Use either --preset or --components, not both.");
    const onConflict = values["on-conflict"];
    if (!CONFLICT_CHOICES.includes(onConflict)) {
        throw new Error(`--on-conflict must be one of: ${CONFLICT_CHOICES.join(", ")}.`);
    }
    return {
        target: values.target,
        isGlobal: values.global,
        preset: values.preset,
        components: values.components?.split(",").map((id) => id.trim()).filter(Boolean),
        tools: values.tools === undefined ? undefined : parseTools(values.tools),
        isDryRun: values["dry-run"],
        isYes: values.yes,
        isUninstall: values.uninstall,
        projectInfoFile: values["project-info"],
        onConflict,
        resolutions: parseResolutions(values.resolve ?? []),
        checksFile: values.checks,
        shouldOpenBrowser: !values["no-open"],
        isTerminal: values.terminal,
        isHelp: values.help,
        isListTools: values["list-tools"],
    };
}
function parseResolutions(values) {
    const resolutions = {};
    for (const value of values) {
        const at = value.lastIndexOf("=");
        const [file, choice] = [value.slice(0, at), value.slice(at + 1)];
        if (at <= 0 || !CONFLICT_CHOICES.includes(choice)) {
            throw new Error(`--resolve needs <path>=<choice>, with the choice one of: ${CONFLICT_CHOICES.join(", ")} (got "${value}").`);
        }
        resolutions[file] = choice;
    }
    return resolutions;
}
function parseTools(value) {
    const ids = value.split(",").map((id) => id.trim()).filter(Boolean);
    const unknown = ids.filter((id) => !isToolId(id));
    if (unknown.length > 0 || ids.length === 0) {
        throw new Error(`Unknown tool(s): ${unknown.join(", ") || "(none given)"}. Choose from: ${TOOL_PROFILES.map((t) => t.id).join(", ")}.`);
    }
    return ids;
}
