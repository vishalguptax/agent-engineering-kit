import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type FixtureKind = "empty" | "existing-settings" | "agents-only" | "invalid-settings";

export const USER_SETTINGS = {
  model: "opus",
  permissions: { allow: ["Bash(npm test)"], deny: ["Read(./.env)"] },
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./scripts/guard.sh" }] }],
  },
};

export function tempDir(prefix = "kit-fixture-"): string {
  return realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/** Builds one of the fixture projects from the spec in a fresh temp folder. */
export function makeFixture(kind: FixtureKind): string {
  const dir = tempDir(`kit-${kind}-`);
  const write = (rel: string, content: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  };
  switch (kind) {
    case "empty":
      break;
    case "existing-settings":
      write("package.json", '{ "name": "acme", "scripts": { "test": "vitest" } }\n');
      write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
      write(".claude/settings.json", JSON.stringify(USER_SETTINGS, null, 4) + "\n");
      write(".claude/agents/verifier.md", "---\nname: verifier\n---\nMy own verifier.\n");
      write("CLAUDE.md", "# Acme\n\nUse pnpm.\n");
      break;
    case "agents-only":
      write("pyproject.toml", "[project]\nname = 'acme'\n");
      write("AGENTS.md", "# Agents\n\nRun `uv run pytest`.\n");
      break;
    case "invalid-settings":
      write("go.mod", "module acme\n");
      write(".claude/settings.json", '{\n  "permissions": {\n    "deny": [\n  }\n');
      break;
  }
  return dir;
}

/** Map of every file (relative path → sha256) under `dir`, skipping paths that start with any `skip` prefix. */
export function snapshotTree(dir: string, skip: string[] = []): Record<string, string> {
  const snapshot: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(dir, abs).split(path.sep).join("/");
      if (skip.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      if (entry.isDirectory()) {
        snapshot[`${rel}/`] = "dir";
        walk(abs);
      } else {
        snapshot[rel] = createHash("sha256").update(readFileSync(abs)).digest("hex");
      }
    }
  };
  walk(dir);
  return snapshot;
}

export function read(dir: string, rel: string): string {
  return readFileSync(path.join(dir, rel), "utf8");
}
