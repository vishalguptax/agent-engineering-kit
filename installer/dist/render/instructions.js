/** The marked block that makes Claude Code load AGENTS.md (Claude reads AGENTS.md alone only without a CLAUDE.md). */
export function claudeImportBlock() {
    return "@AGENTS.md\n";
}
/**
 * Makes Gemini CLI read AGENTS.md by adding it to `context.fileName`. Without that setting Gemini reads only
 * GEMINI.md, so a new setting starts from that default and keeps it.
 */
export function geminiContextAddition() {
    return { path: ["context", "fileName"], items: ["AGENTS.md"], coerceScalar: true, whenMissing: ["GEMINI.md"] };
}
