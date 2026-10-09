import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectTools } from "../tools/detect.js";
import { readRecord } from "./record.js";
import { parseJsonObject } from "./json-merge.js";
import { claudeDirRel, readTargetFile } from "./target.js";
/** Skills that ship with Matt Pocock's skills; finding any of them means the plugin is probably installed. */
const MATT_SKILL_NAMES = ["tdd", "grill-me", "grill-with-docs", "grilling", "diagnosing-bugs", "domain-modeling", "codebase-design", "handoff"];
const STACK_MARKERS = [
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
const LOCKFILES = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
];
function checkFolder(target) {
    const folder = target.mode === "global" && !existsSync(target.root) ? path.dirname(target.root) : target.root;
    if (!existsSync(folder))
        return `${folder} does not exist.`;
    if (!statSync(folder).isDirectory())
        return `${folder} is not a folder.`;
    try {
        accessSync(folder, constants.W_OK);
    }
    catch {
        return `${folder} is not writable by your user.`;
    }
    return null;
}
export function scan(manifest, target, homeDir = os.homedir()) {
    const folderProblem = checkFolder(target);
    const rel = (p) => path.posix.join(claudeDirRel(target), p);
    const has = (p) => existsSync(path.join(target.root, p));
    const settingsRel = rel("settings.json");
    let settingsProblem = null;
    let settingsText = null;
    try {
        settingsText = folderProblem ? null : readTargetFile(target, settingsRel);
        if (settingsText !== null)
            parseJsonObject(settingsText, settingsRel);
    }
    catch (error) {
        settingsProblem = error.message;
    }
    let record = null;
    let recordProblem = null;
    try {
        record = folderProblem ? null : readRecord(target, manifest);
    }
    catch (error) {
        recordProblem = error.message;
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
function listNames(dir) {
    return existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith(".")).sort() : [];
}
function gitStatus(dir) {
    const result = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
    if (result.error)
        return null;
    if (result.status !== 0)
        return { isRepo: false, uncommittedChanges: 0 };
    return { isRepo: true, uncommittedChanges: result.stdout.split("\n").filter(Boolean).length };
}
function detectStack(dir) {
    const files = readdirSync(dir);
    const labels = new Set();
    for (const [marker, label] of STACK_MARKERS) {
        if (files.some((f) => (typeof marker === "string" ? f === marker : marker.test(f))))
            labels.add(label);
    }
    const manager = packageManager(dir);
    if (manager && labels.has("JavaScript/Node.js")) {
        labels.delete("JavaScript/Node.js");
        labels.add(`JavaScript/Node.js (${manager})`);
    }
    return [...labels];
}
const FRONTEND_PACKAGES = ["react", "react-dom", "vue", "svelte", "@angular/core", "next", "nuxt", "solid-js", "preact", "astro", "@remix-run/react", "lit", "react-native", "expo"];
function detectFrontend(dir) {
    if (existsSync(path.join(dir, "index.html")))
        return true;
    const pubspec = path.join(dir, "pubspec.yaml");
    if (existsSync(pubspec) && /^\s+flutter:/m.test(readFileSync(pubspec, "utf8")))
        return true;
    const packageJson = path.join(dir, "package.json");
    if (!existsSync(packageJson))
        return false;
    try {
        const pkg = JSON.parse(readFileSync(packageJson, "utf8"));
        const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        return names.some((name) => FRONTEND_PACKAGES.includes(name));
    }
    catch {
        return false;
    }
}
export function projectScripts(target) {
    const scripts = new Map();
    const packageJson = readTargetFile(target, "package.json");
    if (packageJson !== null) {
        try {
            const names = Object.keys(JSON.parse(packageJson).scripts ?? {});
            const manager = packageManager(target.root) ?? "npm";
            const run = manager === "npm" || manager === "bun" ? `${manager} run` : manager;
            for (const name of names)
                scripts.set(name, `${run} ${name}`);
        }
        catch {
            // An unreadable package.json gives no suggestions; the user types the commands instead.
        }
    }
    const makefile = readTargetFile(target, "Makefile");
    const makeTargets = makefile === null ? [] : [...new Set([...makefile.matchAll(/^([A-Za-z0-9][\w-]*):(?!=)/gm)].map((m) => m[1]))];
    return { scripts, makeTargets };
}
export function packageManager(dir) {
    return LOCKFILES.find(([file]) => existsSync(path.join(dir, file)))?.[1] ?? null;
}
function detectMattSkills(target, homeDir) {
    const evidence = [];
    const skillDirs = [path.join(homeDir, ".claude", "skills"), path.join(homeDir, ".agents", "skills")];
    if (target.mode === "project")
        skillDirs.push(path.join(target.root, ".claude", "skills"), path.join(target.root, ".agents", "skills"));
    for (const dir of skillDirs) {
        const found = listNames(dir).filter((name) => MATT_SKILL_NAMES.includes(name));
        if (found.length > 0)
            evidence.push(`${found.join(", ")} in ${dir}`);
    }
    const pluginsFile = path.join(homeDir, ".claude", "plugins", "installed_plugins.json");
    if (existsSync(pluginsFile)) {
        try {
            const plugins = Object.keys(JSON.parse(readFileSync(pluginsFile, "utf8")).plugins ?? {});
            evidence.push(...plugins.filter((name) => /mattpocock/i.test(name)).map((name) => `plugin ${name}`));
        }
        catch {
            // An unreadable plugin registry just means we can't detect the plugin; the scan still works.
        }
    }
    return { isDetected: evidence.length > 0, evidence };
}
