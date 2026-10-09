# Changelog

This project follows [Semantic Versioning](https://semver.org). The kit version lives in `installer/kit.manifest.json` (`kitVersion`) and is written into every install record.

## 2.0.0 — 2026-10-09

The kit now works with every major AI coding tool, not just Claude Code.

### Every tool
- **Pick your tools:** Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Antigravity, Grok Build, Windsurf / Devin Desktop, Kiro, opencode, Kilo Code, Junie, Augment, Cline, Zed, Amp, Warp, Aider, or any agent that reads `AGENTS.md`. Tools used in the project are pre-selected. See [docs/supported-tools.md](docs/supported-tools.md).
- **`AGENTS.md` is the hub** for the rules. Claude Code gets a one-line `@AGENTS.md` import in `CLAUDE.md`; Gemini CLI gets `AGENTS.md` added to `context.fileName`.
- **Written once, rendered per tool:** skills go to `.agents/skills/` and each tool's own folder only where needed; agents are rendered into each tool's format (Markdown variants and Codex TOML), with read-only agents marked using each tool's documented field. Tools without sub-agents follow `docs/agent-engineering/agents/<name>.md` instead.
- **Format hook rewritten in Node** (`.agent-kit/format.mjs`) for Claude Code, Cursor and Windsurf/Devin; it works on Windows without bash.
- **Secret guard per tool:** settings deny rules or ignore-file blocks, and plain instructions where a tool can't be set from the project.
- **Hardened against untrusted projects:** a git hook is written only when everything it runs comes from the kit, uninstall never deletes a git hook that isn't exactly the kit's, and an install record may only claim JSON entries the kit actually writes.
- **CLI:** `--tools a,b,c` and `--list-tools`. The GUI and terminal wizard have a new "AI tools" step, and the preview shows which tools read each file.

### Kit
- **Neutral wording** in the rules, skills and agents, so they read correctly in any tool.
- **New `fix` skill** for small changes; `feature` now writes a plan file (`docs/plans/`) from a new plan template with must-haves, no-gos, rabbit holes and a binary "Done When".
- **Optional pre-commit checks** (`checks`, in the Everything preset): `.agent-kit/check.sh` runs the commands in `.agent-kit/checks.conf` and refuses commits that change protected files. The hook is added only when no other pre-commit hook or hook manager is in use; otherwise you get the line to add.
- Rulebook moved to `docs/agent-engineering/RULES.md`.

### Upgrading from 1.x
- Run the installer again and choose **Update**. The preview shows every change: the block moves from `CLAUDE.md` to `AGENTS.md` (with `CLAUDE.md` keeping a marked import), the rulebook moves, and the install record moves from `.claude/.kit-install.json` to `.agent-kit/install.json`. Files you edited are kept or offered as conflicts, never silently replaced.
- The `claude-snippet` component is now `instructions`; old ids still work in `--components`.

## 1.0.0 — 2026-10-09

First public release.

### Kit
- **Engineering rules** rulebook and a CLAUDE.md snippet that switches it on.
- **Agents:** `code-explorer`, `code-architect`, `verifier`, `code-simplifier`, `test-analyzer`, `silent-failure-hunter`, `security-reviewer`, and optional `frontend-reviewer` (pre-selected when a frontend stack is detected).
- **Skills:** `/feature`, `/verify`, `/ship`, `/learn`, `project-conventions`. Cleanup uses the `code-simplifier` agent or Claude Code's built-in `/simplify`.
- Follows Matt Pocock's current conventions (`GLOSSARY.md`, with `CONTEXT.md` still recognized) and respects a project's `DESIGN.md`.
- **Auto-format hook**, and a secret guard that denies reading `.env` and `secrets/`.

### Installer
- **Runs with `npx agent-engineering-kit`.** Nothing to clone; the package is about 70 kB with no dependencies.
- **Three front ends on one core:** a local GUI, a terminal wizard (`--terminal`, used automatically over SSH) and a scriptable CLI.
- **Installs anywhere:** into any project, or globally into `~/.claude` with paths rewritten.
- **Choose and preview:** pick components with presets and dependency handling, add optional project info, then review a dry-run preview with diffs and a choice per conflict.
- **Merges without overwriting:** settings.json gets format-preserving text edits; CLAUDE.md gets a marked block (or goes via the AGENTS.md route).
- **Reversible:** backups, an install record, update, add/remove components, and an uninstall that keeps your edits.
- **Hardened:** path-safety checks, the install record treated as untrusted, atomic exclusive writes, a token-protected localhost server with a strict CSP.
