/** Claude Code `permissions.deny` rules that keep the agent out of env files and a secrets/ folder. */
export function secretGuardAddition() {
    return { path: ["permissions", "deny"], items: ["Read(./.env)", "Read(./.env.*)", "Read(./**/.env)", "Read(./**/.env.*)", "Read(./secrets/**)"] };
}
/** The same paths for gitignore-style ignore files (.cursorignore, .geminiignore, .codeiumignore, …). */
export function secretGuardIgnoreLines() {
    return ".env\n.env.*\nsecrets/\n";
}
