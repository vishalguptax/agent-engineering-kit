/** Where the hook script lives, relative to the project root (or to ~/.claude in a global Claude install). */
export const FORMAT_SCRIPT = ".agent-kit/format.mjs";
/**
 * The format-on-edit hook entry for a tool, in its documented format. Each entry calls
 * `node .agent-kit/format.mjs --from <tool>`, so the script reads exactly that tool's payload.
 */
export function formatHookAddition(kind, mode = "project") {
    switch (kind) {
        case "claude-settings": {
            const script = mode === "global" ? `$HOME/.claude/${FORMAT_SCRIPT}` : `$CLAUDE_PROJECT_DIR/${FORMAT_SCRIPT}`;
            return {
                path: ["hooks", "PostToolUse"],
                items: [{ matcher: "Edit|MultiEdit|Write", hooks: [{ type: "command", command: `node "${script}" --from claude`, timeout: 30 }] }],
                identity: "hooks.*.command",
            };
        }
        case "cursor-hooks":
            // Cursor runs project hooks from the project root.
            return { path: ["hooks", "afterFileEdit"], items: [{ command: `node ${FORMAT_SCRIPT} --from cursor` }], identity: "command" };
        case "devin-hooks": {
            // Windsurf/Devin runs `command` with bash and `powershell` on Windows, from the workspace root.
            const command = `node ${FORMAT_SCRIPT} --from devin`;
            return { path: ["hooks", "post_write_code"], items: [{ command, powershell: command, show_output: false }], identity: "command" };
        }
    }
}
/** The starting object for a new hooks file. */
export function formatHookSeed(kind) {
    return kind === "cursor-hooks" ? { version: 1 } : {};
}
