# Supported tools

<!-- Generated from installer/src/tools/profiles.ts by `npm run docs` in installer/. Don't edit by hand. -->

Pick your tools in the installer (or pass `--tools a,b,c`; `--list-tools` prints this list). The kit is written once and installed in each tool's own format. Shared files such as `AGENTS.md` and `.agents/skills/` are written once for every tool that reads them.

- **✓** the installer writes it.
- **as reference** the tool has no file-based sub-agents, so the skills tell it to read `.agent-kit/agents/<name>.md` and do that review itself.
- **note** it can't be set safely from the project, so the preview tells you exactly what to do.
- **—** the tool doesn't support it. The optional pre-commit checks still apply, whichever tool made the change.

Only behaviour the tools' own docs describe is used. Global installs (`--global`) are Claude Code only.

| Tool | id | Rules | Skills | Agents | Format on edit | Secret guard |
|---|---|---|---|---|---|---|
| Claude Code | `claude-code` | ✓ | ✓ | ✓ | ✓ | ✓ |
| OpenAI Codex | `codex` | ✓ | ✓ | ✓ | note | note |
| Cursor | `cursor` | ✓ | ✓ | ✓ | ✓ | ✓ |
| GitHub Copilot | `copilot` | ✓ | ✓ | ✓ | note | note |
| Gemini CLI | `gemini` | ✓ | ✓ | ✓ | note | ✓ |
| Google Antigravity | `antigravity` | ✓ | ✓ | ✓ | note | note |
| Grok Build | `grok` | ✓ | ✓ | as reference | — | note |
| Windsurf / Devin Desktop | `windsurf` | ✓ | ✓ | as reference | ✓ | ✓ |
| Kiro | `kiro` | ✓ | ✓ | ✓ | note | ✓ |
| opencode | `opencode` | ✓ | ✓ | ✓ | note | note |
| Kilo Code | `kilo` | ✓ | ✓ | ✓ | — | note |
| JetBrains Junie | `junie` | ✓ | ✓ | ✓ | — | ✓ |
| Augment Code | `augment` | ✓ | ✓ | ✓ | note | ✓ |
| Cline | `cline` | ✓ | ✓ | as reference | — | note |
| Zed | `zed` | ✓ | ✓ | as reference | — | note |
| Amp | `amp` | ✓ | ✓ | as reference | — | note |
| Warp | `warp` | ✓ | ✓ | as reference | — | note |
| Aider | `aider` | note | — | — | — | ✓ |
| Any other agent (AGENTS.md) | `generic` | ✓ | ✓ | as reference | — | — |

## Claude Code

- **Rules:** Reads AGENTS.md through a one-line @AGENTS.md import in CLAUDE.md.
- **Skills:** Skills in .claude/skills (or a shared folder it also reads).
- **Agents:** Agents in .claude/agents (or a shared folder it also reads).
- **Format on edit:** After-edit hook in .claude/settings.json.
- **Secret guard:** Deny rules in .claude/settings.json.
- **Detected by:** `CLAUDE.md`, `.claude`
- **After installing:** run /agents and type / to check the agents and skills loaded.
- **Docs** (checked 2026-10-09): <https://code.claude.com/docs/en/memory>, <https://code.claude.com/docs/en/skills>, <https://code.claude.com/docs/en/sub-agents>, <https://code.claude.com/docs/en/hooks>

## OpenAI Codex

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Agents in .codex/agents (or a shared folder it also reads).
- **Format on edit:** Codex hooks don't report which file was edited (only the patch text), so the kit doesn't install a format hook for Codex. The optional pre-commit check covers formatting.
- **Secret guard:** Codex blocks file access through permission profiles in .codex/config.toml, which also change its whole sandbox policy. If you want it, add a profile that denies "**/.env*" yourself.
- **Detected by:** `.codex`
- **Docs** (checked 2026-10-09): <https://learn.chatgpt.com/docs/agent-configuration/agents-md>, <https://learn.chatgpt.com/docs/build-skills>, <https://learn.chatgpt.com/docs/agent-configuration/subagents>, <https://learn.chatgpt.com/docs/hooks>

## Cursor

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Agents in .cursor/agents (or a shared folder it also reads).
- **Format on edit:** After-edit hook in .cursor/hooks.json.
- **Secret guard:** Entries in .cursorignore.
- **Detected by:** `.cursor`, `.cursorrules`, `.cursorignore`
- **Docs** (checked 2026-10-09): <https://cursor.com/docs/context/rules>, <https://cursor.com/docs/context/skills>, <https://cursor.com/docs/context/subagents>, <https://cursor.com/docs/agent/hooks>, <https://cursor.com/docs/context/ignore-files>

## GitHub Copilot

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .github/skills (or a shared folder it also reads).
- **Agents:** Agents in .github/agents (or a shared folder it also reads).
- **Format on edit:** Copilot's hook input doesn't document which file was edited, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting.
- **Secret guard:** Copilot can't be told to skip .env from inside the repo. Use content exclusion in your GitHub repository or organization settings (not supported in VS Code agent mode).
- **Detected by:** `.github/copilot-instructions.md`, `.github/instructions`, `.github/agents`, `.github/prompts`, `.github/skills`
- **Docs** (checked 2026-10-09): <https://code.visualstudio.com/docs/copilot/customization/custom-instructions>, <https://code.visualstudio.com/docs/copilot/customization/agent-skills>, <https://code.visualstudio.com/docs/copilot/customization/custom-agents>, <https://docs.github.com/en/copilot/reference/customization-cheat-sheet>

## Gemini CLI

- **Rules:** Reads AGENTS.md once it's added to context.fileName in .gemini/settings.json.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Agents in .gemini/agents (or a shared folder it also reads).
- **Format on edit:** Gemini CLI's hook input doesn't document the edited file's path, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting.
- **Secret guard:** Entries in .geminiignore.
- **Detected by:** `GEMINI.md`, `.gemini`
- **Docs** (checked 2026-10-09): <https://geminicli.com/docs/cli/gemini-md>, <https://geminicli.com/docs/cli/skills>, <https://geminicli.com/docs/core/subagents>, <https://geminicli.com/docs/cli/gemini-ignore>

## Google Antigravity

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Agents in .agents/agents (or a shared folder it also reads).
- **Format on edit:** Antigravity's hook input doesn't document the edited file's path, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting.
- **Secret guard:** Set a deny rule for read_file(.env) in Antigravity's permission settings (Settings UI, or ~/.gemini/antigravity-cli/settings.json for the CLI).
- **Detected by:** `.agents/rules`, `.agents/workflows`, `.agents/hooks.json`, `.agents/mcp_config.json`, `.agent`
- **Docs** (checked 2026-10-09): <https://antigravity.google/docs/rules>, <https://antigravity.google/docs/skills>, <https://antigravity.google/docs/subagents>, <https://antigravity.google/docs/permissions>

## Grok Build

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .grok/skills (or a shared folder it also reads).
- **Agents:** Grok Build's custom agent file format isn't documented yet. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** Grok Build has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Add a deny rule for reading .env to [permission] rules in .grok/config.toml.
- **Detected by:** `.grok`
- **Docs** (checked 2026-10-09): <https://docs.x.ai/build/features/project-rules>, <https://docs.x.ai/build/features/skills-plugins-marketplaces>, <https://docs.x.ai/build/features/permissions>

## Windsurf / Devin Desktop

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Cascade has no file-based sub-agents. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** After-edit hook in .devin/hooks.json.
- **Secret guard:** Entries in .codeiumignore.
- **Detected by:** `.windsurf`, `.devin`, `.windsurfrules`, `.codeiumignore`
- **Docs** (checked 2026-10-09): <https://docs.devin.ai/desktop/cascade/memories>, <https://docs.devin.ai/desktop/cascade/skills>, <https://docs.devin.ai/desktop/cascade/hooks>, <https://docs.devin.ai/desktop/context-awareness/windsurf-ignore>

## Kiro

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .kiro/skills (or a shared folder it also reads).
- **Agents:** Agents in .kiro/agents (or a shared folder it also reads).
- **Format on edit:** Kiro's hook input doesn't document the edited file's path, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting.
- **Secret guard:** Entries in .kiroignore. Kiro only uses .kiroignore after you add it to the kiroAgent.agentIgnoreFiles setting (IDE only).
- **Detected by:** `.kiro`, `.kiroignore`
- **Docs** (checked 2026-10-09): <https://kiro.dev/docs/steering/>, <https://kiro.dev/docs/skills/>, <https://kiro.dev/docs/custom-agents/creating/>, <https://kiro.dev/docs/kiroignore/>

## opencode

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .opencode/skills (or a shared folder it also reads).
- **Agents:** Agents in .opencode/agents (or a shared folder it also reads).
- **Format on edit:** opencode formats edited files with its own built-in formatters; configure them under "formatter" in opencode.json if needed.
- **Secret guard:** opencode already denies reading .env and .env.* by default. If you keep secrets elsewhere, add them under "permission" > "read" in opencode.json.
- **Detected by:** `opencode.json`, `opencode.jsonc`, `.opencode`
- **Docs** (checked 2026-10-09): <https://opencode.ai/docs/rules/>, <https://opencode.ai/docs/skills/>, <https://opencode.ai/docs/agents/>, <https://opencode.ai/docs/permissions/>

## Kilo Code

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Agents in .kilo/agents (or a shared folder it also reads).
- **Format on edit:** Kilo Code has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Add "permission": { "read": { "*.env": "deny" } } to kilo.jsonc (the installer doesn't edit files with comments).
- **Detected by:** `kilo.jsonc`, `kilo.json`, `.kilo`, `.kilocode`
- **Docs** (checked 2026-10-09): <https://kilo.ai/docs/customize/agents-md>, <https://kilo.ai/docs/customize/skills>, <https://kilo.ai/docs/customize/custom-subagents>, <https://kilo.ai/docs/customize/context/kilocodeignore>

## JetBrains Junie

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Agents in .junie/agents (or a shared folder it also reads).
- **Format on edit:** JetBrains Junie has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Entries in .aiignore. Junie ignores .aiignore in Brave Mode.
- **Detected by:** `.junie`, `.aiignore`
- **Warning** (if `.junie/AGENTS.md` exists): Junie's IDE uses .junie/AGENTS.md instead of the root AGENTS.md when it exists, so it won't see the kit's rules. Add a line to .junie/AGENTS.md that says to follow the root AGENTS.md.
- **After installing:** Junie: trust this project, because Junie reads .agents/skills only in trusted projects.
- **Docs** (checked 2026-10-09): <https://junie.jetbrains.com/docs/guidelines-and-memory.html>, <https://junie.jetbrains.com/docs/agent-skills.html>, <https://junie.jetbrains.com/docs/junie-cli-subagents.html>

## Augment Code

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .augment/skills (or a shared folder it also reads).
- **Agents:** Agents in .augment/agents (or a shared folder it also reads).
- **Format on edit:** Augment's hook "command" is a script path and its working directory isn't defined, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting.
- **Secret guard:** Entries in .augmentignore.
- **Detected by:** `.augment`, `.augmentignore`, `.augment-guidelines`
- **Docs** (checked 2026-10-09): <https://docs.augmentcode.com/cli/rules>, <https://docs.augmentcode.com/cli/skills>, <https://docs.augmentcode.com/cli/subagents>, <https://docs.augmentcode.com/cli/hooks>

## Cline

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .cline/skills (or a shared folder it also reads).
- **Agents:** Cline's custom agent file format isn't documented yet. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** Cline has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Cline is replacing .clineignore with a guard hook; until then, use its "Block Ignored File Access" plugin to keep it out of .env.
- **Detected by:** `.clinerules`, `.cline`, `.clineignore`
- **Docs** (checked 2026-10-09): <https://docs.cline.bot/customization/cline-rules>, <https://docs.cline.bot/customization/skills>, <https://docs.cline.bot/features/subagents>

## Zed

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Zed has no file-based sub-agents. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** Zed has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Deny agent access to .env with agent.tool_permissions in your Zed settings.
- **Detected by:** `.rules`, `.zed`
- **Warning** (if `.rules` or `.cursorrules` or `.windsurfrules` or `.clinerules` or `.github/copilot-instructions.md` or `AGENT.md` exists): Zed reads only the first rules file it finds, and this project has one that comes before AGENTS.md, so Zed won't see the kit's rules. Move that file's content into AGENTS.md if you use Zed.
- **Docs** (checked 2026-10-09): <https://zed.dev/docs/ai/instructions>, <https://zed.dev/docs/ai/skills>, <https://zed.dev/docs/ai/tool-permissions>

## Amp

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Amp creates sub-agents through its plugin API, not files. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** Amp has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Amp has no ignore file; disable file reads of .env through a tool.call plugin or amp.tools.disable.
- **Detected by:** `.amp`
- **Docs** (checked 2026-10-09): <https://ampcode.com/docs/customize/agents-md>, <https://ampcode.com/docs/customize/skills>

## Warp

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Warp's agent profiles are set in the app, not files. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** Warp has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Restrict file reads in your Warp agent profile's permissions.
- **Detected by:** `WARP.md`, `.warp`
- **Docs** (checked 2026-10-09): <https://docs.warp.dev/agents/cli/configuration/>, <https://docs.warp.dev/agent-platform/capabilities/skills/>

## Aider

- **Rules:** Aider doesn't read AGENTS.md by itself. Add "read: AGENTS.md" to .aider.conf.yml (or run aider --read AGENTS.md).
- **Skills:** Aider has no skills support.
- **Agents:** Aider has no sub-agents.
- **Format on edit:** Aider has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Entries in .aiderignore.
- **Detected by:** `.aider.conf.yml`, `.aiderignore`
- **Docs** (checked 2026-10-09): <https://aider.chat/docs/usage/conventions.html>, <https://aider.chat/docs/config/options.html>

## Any other agent (AGENTS.md)

- **Rules:** Reads the kit's block in AGENTS.md.
- **Skills:** Skills in .agents/skills (or a shared folder it also reads).
- **Agents:** Generic agents get the agent instructions as reference files. The skills point to .agent-kit/agents/ instead.
- **Format on edit:** Any other agent (AGENTS.md) has no documented after-edit hook; use the pre-commit checks.
- **Secret guard:** Any other agent (AGENTS.md) has no way to block file reads.
- **Docs** (checked 2026-10-09): <https://agents.md/>, <https://agentskills.io/specification>
