import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectTools, type DetectedTools } from "../tools/detect.js";
import type { Manifest } from "./manifest.js";
import { readRecord, type InstallRecord } from "./record.js";
import { parseJsonObject } from "./json-merge.js";
import { claudeDirRel, readTargetFile, type Target } from "./target.js";

export interface ScanResult {
  target: Target;
  /** Why the folder can't be used, or null if it's fine. */
  folderProblem: string | null;
  found: {
    claudeDir: boolean;
    settingsJson: boolean;
    skills: string[];
    agents: string[];
    claudeMd: boolean;
    agentsMd: boolean;
    /** The domain glossary file: GLOSSARY.md, or CONTEXT.md in older setups. */
    glossary: string | null;
    docsDir: boolean;
  };
  settingsProblem: string | null;
  /** null when git isn't installed or this is the global target. */
  git: { isRepo: boolean; uncommittedChanges: number } | null;
  stack: string[];
  /** A UI framework was found (JS framework dependency, Flutter, or an index.html at the root). */
  hasFrontend: boolean;
  /** AI tools this project already uses, and ones installed on this machine. */
  tools: DetectedTools;
  mattSkills: { isDetected: boolean; evidence: string[] };
  record: InstallRecord | null;
  recordProblem: string | null;
}

/** Skills that ship with Matt Pocock's skills; finding any of them means the plugin is probably installed. */
const MATT_SKILL_NAMES = ["tdd", "grill-me", "grill-with-docs", "grilling", "diagnosing-bugs", "domain-modeling", "codebase-design", "handoff"];

const STACK_MARKERS: [file: string | RegExp, label: string][] = [
  ["package.json", "JavaScript/Node.js"],
  ["tsconfig.json", "TypeScript"],
  ["pyproject.toml", "Python"],
  ["requirements.txt", "Python"],
  ["go.mod", "Go"],
  ["Cargo.toml", "Rust"],
  ["pom.xml", "Java (Maven)"],
  [/^build\.gradle(\.kts)?$/, "Java/Kotlin (Gradle)"],
  [/\.(csproj|sln)$/, ".NET"],
  ["Gemfile", "Ruby"],
  ["composer.json", "PHP"],
  ["pubspec.yaml", "Dart/Flutter"],
  ["Package.swift", "Swift"],
  ["mix.exs", "Elixir"],
];

const LOCKFILES: [file: string, manager: string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];

function checkFolder(target: Target): string | null {
  const folder = target.mode === "global" && !existsSync(target.root) ? path.dirname(target.root) : target.root;
  if (!existsSync(folder)) return `${folder} does not exist.`;
  if (!statSync(folder).isDirectory()) return `${folder} is not a folder.`;
  try {
    accessSync(folder, constants.W_OK);
  } catch {
    return `${folder} is not writable by your user.`;
  }
  return null;
}

export function scan(manifest: Manifest, target: Target, homeDir = os.homedir()): ScanResult {
  const folderProblem = checkFolder(target);
  const rel = (p: string) => path.posix.join(claudeDirRel(target), p);
  const has = (p: string) => existsSync(path.join(target.root, p));
  const settingsRel = rel("settings.json");

  let settingsProblem: string | null = null;
  let settingsText: string | null = null;
  try {
    settingsText = folderProblem ? null : readTargetFile(target, settingsRel);
    if (settingsText !== null) parseJsonObject(settingsText, settingsRel);
  } catch (error) {
    settingsProblem = (error as Error).message;
  }

  let record: InstallRecord | null = null;
  let recordProblem: string | null = null;
  try {
    record = folderProblem ? null : readRecord(target, manifest);
  } catch (error) {
    recordProblem = (error as Error).message;
  }

  return {
    target,
    folderProblem,
    found: {
      claudeDir: target.mode === "global" ? has("") : has(".claude"),
      settingsJson: settingsText !== null || settingsProblem !== null,
      skills: listNames(path.join(target.root, rel("skills"))),
      agents: listNames(path.join(target.root, rel("agents"))).map((name) => name.replace(/\.md$/, "")),
      claudeMd: has("CLAUDE.md"),
      agentsMd: target.mode === "project" && has("AGENTS.md"),
      glossary: target.mode === "project" ? (["GLOSSARY.md", "CONTEXT.md"].find(has) ?? null) : null,
      docsDir: has("docs"),
    },
    settingsProblem,
    git: target.mode === "project" && !folderProblem ? gitStatus(target.root) : null,
    stack: target.mode === "project" && !folderProblem ? detectStack(target.root) : [],
    hasFrontend: target.mode === "project" && !folderProblem && detectFrontend(target.root),
    tools: target.mode === "project" && !folderProblem ? detectTools(target.root, { homeDir }) : { inProject: ["claude-code"], onMachine: [] },
    mattSkills: detectMattSkills(target, homeDir),
    record,
    recordProblem,
  };
}

function listNames(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith(".")).sort() : [];
}

function gitStatus(dir: string): ScanResult["git"] {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
  if (result.error) return null;
  if (result.status !== 0) return { isRepo: false, uncommittedChanges: 0 };
  return { isRepo: true, uncommittedChanges: result.stdout.split("\n").filter(Boolean).length };
}

function detectStack(dir: string): string[] {
  const files = readdirSync(dir);
  const labels = new Set<string>();
  for (const [marker, label] of STACK_MARKERS) {
    if (files.some((f) => (typeof marker === "string" ? f === marker : marker.test(f)))) labels.add(label);
  }
  const manager = packageManager(dir);
  if (manager && labels.has("JavaScript/Node.js")) {
    labels.delete("JavaScript/Node.js");
    labels.add(`JavaScript/Node.js (${manager})`);
  }
  return [...labels];
}

const FRONTEND_PACKAGES = ["react", "react-dom", "vue", "svelte", "@angular/core", "next", "nuxt", "solid-js", "preact", "astro", "@remix-run/react", "lit", "react-native", "expo"];

function detectFrontend(dir: string): boolean {
  if (existsSync(path.join(dir, "index.html"))) return true;
  const pubspec = path.join(dir, "pubspec.yaml");
  if (existsSync(pubspec) && /^\s+flutter:/m.test(readFileSync(pubspec, "utf8"))) return true;
  const packageJson = path.join(dir, "package.json");
  if (!existsSync(packageJson)) return false;
  try {
    const pkg = JSON.parse(readFileSync(packageJson, "utf8")) as { dependencies?: object; devDependencies?: object };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    return names.some((name) => FRONTEND_PACKAGES.includes(name));
  } catch {
    return false;
  }
}

/** The JS package manager, from the lockfile; null if there is none. */
/** The project's runnable commands: package.json scripts (with the right package manager) and Makefile targets. */
export interface ProjectScripts {
  /** Script name → the command that runs it, e.g. "test" → "pnpm test". */
  scripts: Map<string, string>;
  makeTargets: string[];
}

export function projectScripts(target: Target): ProjectScripts {
  const scripts = new Map<string, string>();
  const packageJson = readTargetFile(target, "package.json");
  if (packageJson !== null) {
    try {
      const names = Object.keys((JSON.parse(packageJson) as { scripts?: Record<string, string> }).scripts ?? {});
      const manager = packageManager(target.root) ?? "npm";
      const run = manager === "npm" || manager === "bun" ? `${manager} run` : manager;
      for (const name of names) scripts.set(name, `${run} ${name}`);
    } catch {
      // An unreadable package.json gives no suggestions; the user types the commands instead.
    }
  }
  const makefile = readTargetFile(target, "Makefile");
  const makeTargets = makefile === null ? [] : [...new Set([...makefile.matchAll(/^([A-Za-z0-9][\w-]*):(?!=)/gm)].map((m) => m[1]))];
  return { scripts, makeTargets };
}

export function packageManager(dir: string): string | null {
  return LOCKFILES.find(([file]) => existsSync(path.join(dir, file)))?.[1] ?? null;
}

function detectMattSkills(target: Target, homeDir: string): ScanResult["mattSkills"] {
  const evidence: string[] = [];
  const skillDirs = [path.join(homeDir, ".claude", "skills"), path.join(homeDir, ".agents", "skills")];
  if (target.mode === "project") skillDirs.push(path.join(target.root, ".claude", "skills"), path.join(target.root, ".agents", "skills"));
  for (const dir of skillDirs) {
    const found = listNames(dir).filter((name) => MATT_SKILL_NAMES.includes(name));
    if (found.length > 0) evidence.push(`${found.join(", ")} in ${dir}`);
  }
  const pluginsFile = path.join(homeDir, ".claude", "plugins", "installed_plugins.json");
  if (existsSync(pluginsFile)) {
    try {
      const plugins = Object.keys((JSON.parse(readFileSync(pluginsFile, "utf8")) as { plugins?: object }).plugins ?? {});
      evidence.push(...plugins.filter((name) => /mattpocock/i.test(name)).map((name) => `plugin ${name}`));
    } catch {
      // An unreadable plugin registry just means we can't detect the plugin; the scan still works.
    }
  }
  return { isDetected: evidence.length > 0, evidence };
}
