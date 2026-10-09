# Changelog

This project follows [Semantic Versioning](https://semver.org). The kit version lives in `installer/kit.manifest.json` (`kitVersion`) and is written into every install record.

## 1.2.3 — 2026-10-09

### Fixes
- **Upgrading with plans in `docs/plans/`:** the preview now says that new plans go to `.agent-kit/plans/` and gives the one line to add to Workflow Preferences to keep using `docs/plans/`. It stays quiet once the project (or the answers being installed) says where plans go.
- **GUI scan:** long labels such as `.claude/settings.json` no longer run into their value.

## 1.2.2 — 2026-10-09

### Fixes
- **Installer backups stay out of git.** Project installs now add `.agent-kit/.gitignore` with `backup/`, so committing `.agent-kit/` doesn't also commit the copies of your files the installer made. An existing `.agent-kit/.gitignore` is left as it is.

### Internal
- A test checks that every rulebook section the block, skills and agents cite (§2, §8, …) exists, so renumbering `RULES.md` can't silently break them.
- CI fails if this repo's own kit install is out of date with `kit/`.

## 1.2.1 — 2026-10-09

### Fixes
- **The installer's scan no longer shows a "docs/" row.** Since 1.2.0 the kit installs nothing under `docs/`, so whether a project has that folder doesn't matter.

### Docs
- **The README credits its sources in a Credits section,** each with a link and what the kit took from it: Boris Cherny, Matt Pocock's skills, the Karpathy guidelines, Superpowers, Addy Osmani's agent-skills and Anthropic's frontend-design.

## 1.2.0 — 2026-10-09

### Leaner for every session
- **The always-on rules are now about 600 tokens instead of about 7,000.** The kit block in `AGENTS.md` carries the core rules inline as pass/fail lines (before coding, while coding, and what "done" means), and no longer `@`-imports the whole rulebook into every Claude Code session. Tools without `@`-imports used to get only a pointer; now every tool gets the same rules.
- **The rulebook is reference.** Skills and agents open the one section they need (§2 workflow, §8 review checklist, §9 debugging, …). Rules repeated in the skills, the block or the plan template were removed from it, so each rule lives in one place; it is half its old size. The setup notes for humans moved to [docs/working-habits.md](docs/working-habits.md), and they are no longer installed into projects.
- **`check.sh` prints only failures,** each with its command and output. A passing run is one line: `checks passed: lint, test`.

### Out of your docs/ folder
- **The kit's files now live in `.agent-kit/`:** `RULES.md`, `plan-template.md` and `agents/` move there from `docs/agent-engineering/`, and the feature skill writes plans to `.agent-kit/plans/` by default. Nothing the kit installs goes in `docs/` any more, so a project's own docs folder (or docs site) stays its own.
- **Updating from 1.0 or 1.1 moves them for you.** The old copies are removed if you haven't edited them, along with `docs/` folders the kit created that are now empty. Existing plans in `docs/plans/` stay where they are; add `- Plans: docs/plans/` to Workflow Preferences to keep using that folder.

## 1.1.0 — 2026-10-09

### Install with your AI agent
- **A copy-paste prompt** (top of the README) lets your coding agent install the kit. It follows [docs/install-with-an-agent.md](docs/install-with-an-agent.md): it works out the stack, commands, folders, conventions and team rules from the project itself, shows you what it found and where, asks only what the code can't tell it, and runs the installer with your approval. Every fact must come from a file or a command; nothing is guessed.
- **New CLI flags** so an agent (or a script) never needs the interactive installer: `--checks <file>` sets the pre-commit commands, and `--resolve <path>=<choice>` picks keep / kit / kit-new for one conflicting file.

### Skills
- **Renamed to avoid clashing with built-in commands:** `fix` is now `quick-fix` (GitHub Copilot Chat has a built-in `/fix`), and `verify` is now `verify-change` (a project `verify` skill would replace Claude Code's built-in `/verify`). Update removes the old skills; the old ids still work in `--components`.
- **Work in projects without tests, git or CI:** the skills and the verifier say what to do instead (an observable check, the list of changed files, what couldn't be verified) rather than stopping or pretending.
- **Workflow Preferences:** an optional section in the project part of `AGENTS.md` (where plans go, test policy, commit style, when to ask first). Every skill reads it before its own defaults; the installer form and wizard have a field for it.

### Fixes
- Updating an install whose skills were renamed no longer reports the install record as untrusted.

## 1.0.0 — 2026-10-09

First public release.

### Kit
- **Engineering rules:** one rulebook (`docs/agent-engineering/RULES.md`) covering planning, simplicity, surgical changes, verification, security, an anti-slop checklist and a definition of done, switched on by a short marked block in `AGENTS.md`.
- **Plan template** with must-haves, no-gos, rabbit holes and a binary "Done When"; the `feature` skill writes plans to `docs/plans/` so work resumes across sessions and tools.
- **Agents:** `code-explorer`, `code-architect`, `verifier`, `code-simplifier`, `test-analyzer`, `silent-failure-hunter`, `security-reviewer`, and optional `frontend-reviewer` (pre-selected when a frontend stack is detected).
- **Skills:** `feature`, `fix`, `verify`, `ship`, `learn`, `project-conventions`, written in neutral wording so they read correctly in any tool.
- **Auto-format hook** (`.agent-kit/format.mjs`, run by Node, so it works on Windows) and a **secret guard** that keeps agents out of `.env` files and `secrets/`.
- **Optional pre-commit checks** (`checks`, in the Everything preset): `.agent-kit/check.sh` runs the commands in `.agent-kit/checks.conf` and refuses commits that change protected files.
- Follows Matt Pocock's conventions (`GLOSSARY.md`, with `CONTEXT.md` still recognized) and respects a project's `DESIGN.md`.

### Every AI coding tool
- **Pick your tools:** Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Antigravity, Grok Build, Windsurf / Devin Desktop, Kiro, opencode, Kilo Code, Junie, Augment, Cline, Zed, Amp, Warp, Aider, or any agent that reads `AGENTS.md`. Tools used in the project are pre-selected. See [docs/supported-tools.md](docs/supported-tools.md).
- **`AGENTS.md` is the hub.** Claude Code gets a one-line `@AGENTS.md` import in `CLAUDE.md`; Gemini CLI gets `AGENTS.md` added to `context.fileName`, keeping `GEMINI.md`.
- **Written once, rendered per tool:** skills go to `.agents/skills/` and to a tool's own folder only where needed; agents are rendered into each tool's format (Markdown variants and Codex TOML), with read-only agents marked using each tool's documented field. Tools without sub-agents follow `docs/agent-engineering/agents/<name>.md` instead.
- Only behaviour the tools' own docs describe is used; anything else is a note in the preview with the exact steps.

### Installer
- **Runs with `npx agent-engineering-kit`.** Nothing to clone; about 100 kB with no dependencies.
- **Three front ends on one core:** a local GUI, a terminal wizard (`--terminal`, used automatically over SSH) and a scriptable CLI (`--tools`, `--preset`, `--components`, `--dry-run`, `--yes`, `--uninstall`, `--list-tools`).
- **Installs anywhere:** into any project for any of the tools, or globally into `~/.claude` for Claude Code.
- **Choose and preview:** pick tools and components with presets and dependency handling, add optional project info, then review a dry-run preview with diffs, the tools that read each file, and a choice per conflict.
- **Merges without overwriting:** JSON settings get format-preserving text edits; `AGENTS.md`, `CLAUDE.md` and ignore files get marked blocks.
- **Reversible:** backups, an install record, update, add or remove tools and components (shared files stay while a tool still needs them), and an uninstall that keeps your edits.
- **Hardened against untrusted projects:** path-safety checks, the install record validated (paths, backups and JSON entries), atomic exclusive writes, a git hook written only when everything it runs comes from the kit, and a token-protected localhost server with a strict CSP.
