# Working habits for humans

Tool-level practices that support the kit's rules. They're for the person setting up and using the agent, so they live here rather than in the rulebook the agent reads. Names are Claude Code's; most AI coding tools have an equivalent.

## Workflow habits (from Boris Cherny, creator of Claude Code)

- Start non-trivial work in plan mode (Claude Code: Shift+Tab twice). Review and edit the plan, then let the agent build.
- Keep one shared instructions file (`AGENTS.md`) checked into git and maintained by the whole team. Add a line whenever the agent makes a mistake, and keep it small: everything in it is loaded into every session.
- Turn workflows you repeat into skills and check them into git.
- Use sub-agents for focused jobs, such as a **code-simplifier** that cleans up once work is done and a **verifier** that tests end to end.
- Run the formatter after every edit (a hook, in tools that support one), so formatting stays consistent and CI doesn't fail on style.
- Allowlist safe commands through permissions rather than skipping permission checks entirely.
- Let the agent verify its own work: browser automation for UI, tests for logic.
- Connect real tools through MCP (issue tracker, error monitoring, logs, chat) so the agent works from real data. Review any MCP server before installing it.
- Parallel sessions (several terminals, git worktrees) speed things up, but only once the basics above are solid.

## Recommended skills and plugins (install few, not many)

- **Matt Pocock's skills**, the main workflow layer that the kit's feature skill uses when they're installed. In Claude Code: `/plugin install mattpocock-skills@claude-plugins-official`; in other tools: `npx skills@latest add mattpocock/skills -a <tool>` (use one or the other, not both). Then run `/setup-matt-pocock-skills` once per repo. Key skills: `grill-with-docs` / `grill-me` (align before coding; builds `GLOSSARY.md`), `tdd`, `diagnosing-bugs`, `code-review`, `codebase-design`, `improve-codebase-architecture` (run every few days), and `handoff` (continue long work in a new session).
- **frontend-design** (Anthropic, official, Claude Code) avoids generic AI-looking UI: `/plugin install frontend-design@claude-plugins-official`.
- Stack-specific best-practice skills (for example for React or Next.js) where relevant.
- Alternatives that overlap with the above (pick at most one workflow framework, so instructions don't conflict): the Karpathy guidelines (`multica-ai/andrej-karpathy-skills`, a tiny principles-only CLAUDE.md whose principles are already in the kit), Superpowers (`obra/superpowers`, strict and heavy), and Addy Osmani's `agent-skills` (a broad lifecycle set).
- Treat every installed skill or plugin like code you reviewed. A few focused plugins beat many that compete for attention.

## Enforce with automation, not only prompts

- Pre-commit hooks or CI for format, lint, type-check, tests, and build. The kit's optional pre-commit check (`.agent-kit/check.sh`) does this for any tool, and prints only failures, so a passing run costs the agent almost no context.
- Branch protection, with human review required before merge.
- Small PRs, so people actually read them.
