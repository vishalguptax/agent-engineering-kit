# Changelog

This project follows [Semantic Versioning](https://semver.org). The kit version lives in `installer/kit.manifest.json` (`kitVersion`) and is written into every install record.

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
