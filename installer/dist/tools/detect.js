import { accessSync, constants, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TOOL_PROFILES } from "./profiles.js";
export function detectTools(projectDir, options = {}) {
    const homeDir = options.homeDir ?? os.homedir();
    const searchPath = (options.pathEnv ?? process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
    const appsDir = options.appsDir !== undefined ? options.appsDir : process.platform === "darwin" ? "/Applications" : null;
    const inProject = TOOL_PROFILES.filter((t) => t.detect.project.some((marker) => existsSync(path.join(projectDir, marker)))).map((t) => t.id);
    const onMachine = TOOL_PROFILES.filter((t) => (t.detect.home ?? []).some((marker) => existsSync(path.join(homeDir, marker))) ||
        (t.detect.commands ?? []).some((command) => isOnPath(command, searchPath)) ||
        (appsDir !== null && (t.detect.macApps ?? []).some((app) => existsSync(path.join(appsDir, app))))).map((t) => t.id);
    return { inProject, onMachine };
}
/** Looks for an executable on PATH directly (no shell), honouring PATHEXT on Windows. */
function isOnPath(command, searchPath) {
    const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
    return searchPath.some((dir) => extensions.some((ext) => {
        const candidate = path.join(dir, command + ext.toLowerCase());
        try {
            accessSync(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
            return true;
        }
        catch {
            return false;
        }
    }));
}
/**
 * The tools to install for when the user hasn't chosen: Claude Code for a global install, otherwise what the
 * kit was installed for before, otherwise the tools this project already uses, otherwise the generic AGENTS.md set.
 */
export function defaultTools(mode, projectDir, recordedTools) {
    if (mode === "global")
        return ["claude-code"];
    if (recordedTools && recordedTools.length > 0)
        return recordedTools;
    const { inProject } = detectTools(projectDir);
    return inProject.length > 0 ? inProject : ["generic"];
}
