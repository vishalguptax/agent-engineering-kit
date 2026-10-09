import type { ArrayAddition } from "../core/json-merge.js";

/** Claude Code `permissions.deny` rules that keep the agent out of env files and a secrets/ folder. */
export function secretGuardAddition(): ArrayAddition {
  return { path: ["permissions", "deny"], items: ["Read(./.env)", "Read(./.env.*)", "Read(./**/.env)", "Read(./**/.env.*)", "Read(./secrets/**)"] };
}

/** The same paths for gitignore-style ignore files (.cursorignore, .geminiignore, .codeiumignore, …). */
export function secretGuardIgnoreLines(): string {
  return ".env\n.env.*\nsecrets/\n";
}
