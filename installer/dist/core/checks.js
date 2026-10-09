import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { projectScripts } from "./scan.js";
import { readTargetFile } from "./target.js";
export const CHECK_SCRIPT = ".agent-kit/check.sh";
export const CHECKS_CONF = ".agent-kit/checks.conf";
export const PROTECTED_LIST = ".agent-kit/protected";
export const PRE_COMMIT_HOOK = ".git/hooks/pre-commit";
/** The one line a pre-commit hook needs to run the checks. */
export const HOOK_LINE = 'sh "$(git rev-parse --show-toplevel)/.agent-kit/check.sh" --staged';
const CHECKS_HEADER = `# Commands to run before each commit, one per line as "name: command".
# Every command must pass for the commit to go through. Lines starting with # are ignored.
# Run them yourself any time with: sh .agent-kit/check.sh
`;
export const PROTECTED_TEMPLATE = `# Files agents must not change while building: one shell glob per line (* also matches /).
# The feature skill adds a plan's acceptance tests here. Remove a line to allow changes again.
`;
export const PRE_COMMIT_SCRIPT = `#!/bin/sh
# Agent Engineering Kit: run the project's checks before each commit (see .agent-kit/checks.conf).
exec ${HOOK_LINE}
`;
/** checks.conf: the header, then the user's confirmed commands (or commented examples if there are none). */
export function renderChecksConf(commands) {
    const body = commands.trim();
    return body ? `${CHECKS_HEADER}\n${body}\n` : `${CHECKS_HEADER}# Examples:\n# lint: npm run lint\n# test: npm test\n`;
}
/** Check commands from the project's own scripts: package.json scripts, then Makefile targets. */
export function suggestChecks(target) {
    const { scripts, makeTargets } = projectScripts(target);
    const lines = [];
    const pick = (name, candidates) => {
        const script = candidates.find((c) => scripts.has(c));
        if (script)
            lines.push(`${name}: ${scripts.get(script)}`);
    };
    pick("format", ["format:check", "fmt:check", "check:format"]);
    pick("lint", ["lint"]);
    pick("typecheck", ["typecheck", "type-check", "check-types", "tsc"]);
    pick("test", ["test"]);
    if (lines.length === 0)
        for (const name of ["lint", "typecheck", "check", "test"])
            if (makeTargets.includes(name))
                lines.push(`${name}: make ${name}`);
    return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}
/**
 * Git never lets a clone install hooks, so neither does the installer on its behalf: the hook is written only when
 * everything it runs comes from the kit. A project that already has its own checks.conf or check.sh (e.g. a cloned
 * repo) gets the line to add by hand, after reading them. "Our hook" is recognised by its exact content, never by
 * the install record, which the project could have forged.
 */
export function hookPlacement(target, kitCheckScript) {
    const git = (...args) => spawnSync("git", args, { cwd: target.root, encoding: "utf8" });
    const inside = git("rev-parse", "--is-inside-work-tree");
    if (inside.error || inside.status !== 0)
        return { kind: "no-git" };
    const hooksPath = git("rev-parse", "--git-path", "hooks").stdout.trim();
    if (git("config", "core.hooksPath").stdout.trim() !== "")
        return { kind: "manual", reason: "this repo sets core.hooksPath" };
    for (const [marker, tool] of [[".husky", "husky"], ["lefthook.yml", "lefthook"], [".pre-commit-config.yaml", "the pre-commit framework"]]) {
        if (existsSync(path.join(target.root, marker)))
            return { kind: "manual", reason: `this repo uses ${tool}` };
    }
    if (hooksPath !== ".git/hooks")
        return { kind: "manual", reason: "this checkout keeps its git hooks outside the project folder (a worktree or submodule)" };
    const hook = readTargetFile(target, PRE_COMMIT_HOOK);
    if (hook === PRE_COMMIT_SCRIPT)
        return { kind: "write" };
    if (hook !== null)
        return { kind: "manual", reason: "this repo already has a pre-commit hook" };
    if (readTargetFile(target, CHECKS_CONF) !== null) {
        return { kind: "manual", reason: `this project already has its own ${CHECKS_CONF}, which the hook would run on every commit. Read it first` };
    }
    const script = readTargetFile(target, CHECK_SCRIPT);
    if (script !== null && script !== kitCheckScript) {
        return { kind: "manual", reason: `this project already has its own ${CHECK_SCRIPT}, which the hook would run on every commit. Read it first` };
    }
    return { kind: "write" };
}
