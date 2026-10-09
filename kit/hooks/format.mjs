#!/usr/bin/env node
// Agent Engineering Kit — format-on-edit hook.
// Formats the file an AI tool just edited with the project's own formatter (Prettier, Biome, ruff, gofmt, …).
// Usage: node .agent-kit/format.mjs --from claude|cursor|devin   (the tool's hook JSON arrives on stdin)
// It never blocks the agent: whatever happens, it exits 0.
import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

/** Where each tool puts the edited file's path in its hook payload (from the tools' hook docs). */
const PAYLOAD_PATHS = {
  claude: ["tool_input", "file_path"],
  cursor: ["file_path"],
  devin: ["tool_info", "file_path"],
};

const FORMATTER_TIMEOUT_MS = 25_000;
const WEB_EXTENSIONS = /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|json|jsonc|css|scss|less|html|vue|svelte|astro|md|mdx|ya?ml|graphql)$/;

function main() {
  const from = process.argv[process.argv.indexOf("--from") + 1];
  const keys = PAYLOAD_PATHS[from];
  if (!keys) return;
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const edited = keys.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), payload);
  if (typeof edited !== "string" || edited === "") return;

  // Claude Code passes the project root; Cursor and Windsurf run hooks from it.
  const root = realpathSync(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const file = path.resolve(root, edited);
  if (!existsSync(file) || !isInside(root, realpathSync(file))) return;

  const command = formatterFor(file, root);
  if (command) spawnSync(command[0], command.slice(1), { cwd: root, stdio: "ignore", timeout: FORMATTER_TIMEOUT_MS });
}

/** The project's formatter for this file as [program, ...args], or null if it has none. */
function formatterFor(file, root) {
  const has = (relative) => existsSync(path.join(root, relative));
  if (WEB_EXTENSIONS.test(file)) {
    const biome = packageBin(root, "@biomejs/biome", "biome");
    if (biome && (has("biome.json") || has("biome.jsonc"))) return [process.execPath, biome, "format", "--write", file];
    const prettier = packageBin(root, "prettier", "prettier");
    return prettier ? [process.execPath, prettier, "--write", "--ignore-unknown", file] : null;
  }
  const extension = path.extname(file).toLowerCase();
  const byExtension = {
    ".py": () => (onPath("ruff") ? ["ruff", "format", file] : onPath("black") ? ["black", "-q", file] : null),
    ".go": () => (onPath("gofmt") ? ["gofmt", "-w", file] : null),
    ".rs": () => (onPath("rustfmt") ? ["rustfmt", file] : null),
    ".rb": () => (onPath("rubocop") ? ["rubocop", "-a", file] : null),
    ".php": () => (has("vendor/bin/php-cs-fixer") && onPath("php") ? ["php", "vendor/bin/php-cs-fixer", "fix", file] : null),
    ".dart": () => (onPath("dart") ? ["dart", "format", file] : null),
    ".swift": () => (onPath("swift-format") ? ["swift-format", "-i", file] : null),
    ".kt": () => (onPath("ktlint") ? ["ktlint", "-F", file] : null),
    ".kts": () => (onPath("ktlint") ? ["ktlint", "-F", file] : null),
    ".ex": () => (onPath("mix") ? ["mix", "format", file] : null),
    ".exs": () => (onPath("mix") ? ["mix", "format", file] : null),
    ".cs": () => (onPath("dotnet") ? ["dotnet", "format", "--include", file] : null),
  };
  for (const ext of [".c", ".h", ".cpp", ".hpp", ".cc"]) {
    byExtension[ext] = () => (has(".clang-format") && onPath("clang-format") ? ["clang-format", "-i", file] : null);
  }
  return byExtension[extension]?.() ?? null;
}

/** A locally installed package's JS entry point (run with node, so no shell or .cmd shim is needed on Windows). */
function packageBin(root, packageName, binName) {
  const manifestPath = path.join(root, "node_modules", packageName, "package.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const { bin } = JSON.parse(readFileSync(manifestPath, "utf8"));
    const relative = typeof bin === "string" ? bin : bin?.[binName];
    return relative ? path.join(root, "node_modules", packageName, relative) : null;
  } catch {
    return null;
  }
}

function onPath(program) {
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  return (process.env.PATH ?? "").split(path.delimiter).some((dir) =>
    extensions.some((ext) => {
      try {
        accessSync(path.join(dir, program + ext.toLowerCase()), process.platform === "win32" ? constants.F_OK : constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }),
  );
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

try {
  main();
} catch {
  // A formatting problem must never interrupt the agent.
}
process.exitCode = 0;
