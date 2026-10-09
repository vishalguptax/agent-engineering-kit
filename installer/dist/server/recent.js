import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
/** Per-user config folder: %APPDATA% on Windows, $XDG_CONFIG_HOME or ~/.config elsewhere. Survives npx updates. */
const CONFIG_DIR = process.platform === "win32"
    ? path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "agent-engineering-kit")
    : path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "agent-engineering-kit");
const RECENT_FILE = path.join(CONFIG_DIR, "recent.json");
const MAX_RECENT = 8;
/** Recently used project folders, newest first. Stored in the user's config folder, never in the target. */
export function readRecent(file = RECENT_FILE) {
    try {
        const value = JSON.parse(readFileSync(file, "utf8"));
        return Array.isArray(value) ? value.filter((p) => typeof p === "string") : [];
    }
    catch {
        return [];
    }
}
export function rememberRecent(folder, file = RECENT_FILE) {
    const next = [folder, ...readRecent(file).filter((p) => p !== folder)].slice(0, MAX_RECENT);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
}
