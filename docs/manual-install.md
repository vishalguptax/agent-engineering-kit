# Installing by hand

**Prefer the installer** (`npx agent-engineering-kit`). It does all of this for you, in each tool's own format, safely and reversibly. Use this page only if you can't run Node.js 18+.

> Files you copy by hand aren't recorded, so the installer can't update or uninstall them later. Put the `AGENTS.md` block between the markers shown below, so a later installer run replaces it instead of adding a second copy.

## 1. The core (every tool)

| From `kit/` | To your project |
|---|---|
| `rules/RULES.md` | `docs/agent-engineering/RULES.md` |
| `templates/plan-template.md` | `docs/agent-engineering/plan-template.md` |
| `agents/*.md` | `docs/agent-engineering/agents/` (the agents' instructions; tools without sub-agents follow these) |
| `skills/*/` | `.agents/skills/` (read by most tools; see the table below) |

Then add the contents of `kit/instructions/agents-block.md` to the end of `AGENTS.md` (create it if needed), wrapped in markers:

```md
<!-- agent-engineering-kit:start -->
…contents of kit/instructions/agents-block.md…
<!-- agent-engineering-kit:end -->
```

If a file already exists with different content, compare the two before deciding which to keep. That's enough for any tool that reads `AGENTS.md` and `.agents/skills/`.

## 2. Per tool

| Tool | Also do this |
|---|---|
| Claude Code | Add a marked block containing `@AGENTS.md` to `CLAUDE.md` (same markers as above). Copy `skills/*/` to `.claude/skills/` and `agents/*.md` to `.claude/agents/` (Claude Code doesn't read `.agents/skills/`). In each agent, replace `access: read-only` with `tools: Read, Grep, Glob, Bash`, and remove `access: edit`. |
| Gemini CLI | In `.gemini/settings.json`, set `"context": { "fileName": ["GEMINI.md", "AGENTS.md"] }` (keep any names already there). |
| Kiro | Copy `skills/*/` to `.kiro/skills/`. |
| Aider | Add `read: AGENTS.md` to `.aider.conf.yml`. |
| Others | Nothing more for rules and skills. Sub-agent folders and formats differ per tool; [supported-tools.md](supported-tools.md) lists each one, or let the installer write them. |

## 3. Safety (optional)

- **Secret guard.** For Claude Code, add `"Read(./.env)"`, `"Read(./.env.*)"` and `"Read(./secrets/**)"` to `permissions.deny` in `.claude/settings.json`. For tools with an ignore file (`.cursorignore`, `.geminiignore`, `.codeiumignore`, `.aiignore`, `.augmentignore`, `.aiderignore`, `.kiroignore`), add `.env`, `.env.*` and `secrets/`, one per line. Kiro also needs `.kiroignore` added to its `kiroAgent.agentIgnoreFiles` setting. Check JSON files are still valid.
- **Format on edit.** Copy `hooks/format.mjs` to `.agent-kit/format.mjs`. It needs Node, so if you can't run the installer you probably can't use it.
- **Pre-commit checks.** Copy `checks/check.sh` to `.agent-kit/check.sh`, list your commands in `.agent-kit/checks.conf` as `name: command` lines, and add `sh "$(git rev-parse --show-toplevel)/.agent-kit/check.sh" --staged` to `.git/hooks/pre-commit`.

## 4. Finish

1. Install Matt Pocock's skills: `/plugin install mattpocock-skills@claude-plugins-official` in Claude Code, or `npx skills@latest add mattpocock/skills` for other tools (not both). Then run `/setup-matt-pocock-skills` once in the repo.
2. Fill in the project section of `AGENTS.md` (above the kit's block) using Appendix A of the rulebook, or ask the agent: *"Use the project-conventions skill to fill in the project section of AGENTS.md."*
3. Restart your tools and check the skills appear.
4. Commit `AGENTS.md`, `docs/`, the tool folders and `GLOSSARY.md` so your team shares them.

## All projects (global, Claude Code only)

Put the files in `~/.claude/` instead: `agents/`, `skills/`, `docs/agent-engineering/`, and the block from step 1 in `~/.claude/CLAUDE.md` (no `AGENTS.md` globally). Then change the project-relative paths so they point into `~/.claude`:
- In the block: `@docs/agent-engineering/` → `@~/.claude/docs/agent-engineering/`.
- In the skills and agents: `` `docs/agent-engineering/ `` → `` `~/.claude/docs/agent-engineering/ ``.

Project files win over global ones when names clash.
