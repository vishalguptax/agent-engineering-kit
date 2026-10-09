# Agent Engineering Kit

**Make your AI coding agents ship clean, maintainable code instead of AI slop.** It works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, Antigravity, Windsurf, Kiro, opencode and [more](docs/supported-tools.md), with any tech stack, in any existing project.

Left alone, coding agents guess APIs, sprawl across files and call untested work "done". This kit gives them the habits of a careful senior engineer, and a safe installer puts it into your project in a couple of minutes, in each tool's own format:
- **Plan first.** Align before coding, and make small, surgical changes.
- **Verify with evidence.** Real checks, not "should work".
- **Clean up and review.** A simplify pass and focused reviewers for tests, silent failures, security and UI, plus a rule file that learns from your corrections.
- **Enforce it (optional).** A git pre-commit check runs your project's own lint and tests, whichever agent made the change.

It brings together:
- **Boris Cherny's** (creator of Claude Code) workflow: plan first, a shared CLAUDE.md that learns from mistakes, simplifier and verify agents, an auto-format hook, and verification as the main lever.
- **Matt Pocock's skills** for day-to-day work: aligning by grilling, shared domain language (`GLOSSARY.md`), TDD, disciplined debugging, code review, and deep-module design.
- **Principles** from the Karpathy guidelines, Superpowers and Addy Osmani's agent-skills, written into one rulebook, plus a plan template with must-haves, no-gos and a binary "Done When".

## Quick start

**Let your AI agent install it.** Paste this into your coding agent (Claude Code, Codex, Cursor, Copilot, Gemini CLI…) in your project:

```text
Install the Agent Engineering Kit in this project. Read and follow https://raw.githubusercontent.com/vishalguptax/agent-engineering-kit/main/docs/install-with-an-agent.md. Ask me before anything that changes my files.
```

The agent reads your project to work out its stack, commands, folders and conventions, shows you what it found and where it found it, asks only what the code can't tell it, and then runs the installer with your approval. It never guesses, and it never copies kit files by hand, so backups, update and uninstall all work.

**Or run the installer yourself.** You need [Node.js](https://nodejs.org) 18 or newer. In your terminal, run:

```sh
npx agent-engineering-kit
```

There's nothing to clone or install first. That opens the installer in your browser. It walks you through these steps:
1. **Choose where it goes:** a project folder, or `~/.claude` for all your projects (Claude Code only).
2. **See what's already there:** the AI tools the project uses, existing rules, git status and stack.
3. **Pick your AI tools.** Tools found in the project are pre-selected, and each card shows what that tool gets.
4. **Pick the parts:** each one has a plain-English "What is this?".
5. **Describe your project** for the agent (optional), and confirm the pre-commit checks if you chose them.
6. **Review every change as a diff,** with the tools that read each file. Nothing is written until you confirm.
7. **Install.** Files that change are backed up first; `AGENTS.md`, `CLAUDE.md` and settings files are merged, never overwritten.
8. **Copy the follow-up commands** for your tools.

| No browser? (SSH, server) | Scripting or CI? |
|---|---|
| `npx agent-engineering-kit --terminal` gives the same steps as prompts. | `npx agent-engineering-kit --target ./my-app --tools claude-code,codex,cursor --preset recommended --yes` |

`--list-tools` prints the tool ids. Without `--tools`, the installer uses the tools it finds in the project (or the ones from the last install).

## Supported tools

`AGENTS.md` holds the rules for every tool, and shared folders like `.agents/skills/` are written once. Each tool gets what it supports:

| Tool | Rules | Skills | Sub-agents | Format on edit | Secret guard |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cursor | ✓ | ✓ | ✓ | ✓ | ✓ |
| OpenAI Codex | ✓ | ✓ | ✓ | note | note |
| GitHub Copilot | ✓ | ✓ | ✓ | note | note |
| Gemini CLI, Kiro | ✓ | ✓ | ✓ | note | ✓ |
| Antigravity, opencode | ✓ | ✓ | ✓ | note | note |
| Windsurf / Devin Desktop | ✓ | ✓ | as reference | ✓ | ✓ |
| Junie, Augment, Kilo Code | ✓ | ✓ | ✓ | varies | varies |
| Grok Build, Cline, Zed, Amp, Warp | ✓ | ✓ | as reference | — | note |
| Aider | note | — | — | — | ✓ |
| Any other agent that reads AGENTS.md | ✓ | ✓ | as reference | — | — |

"As reference" means the tool has no sub-agents, so the skills tell it to read the agent's instructions and do that review itself. "Note" means it can't be set safely from the project, so the installer tells you the exact steps. The full, generated matrix with reasons and doc links is in [docs/supported-tools.md](docs/supported-tools.md).

Run it again at any time to **update**, **add or remove parts**, or **uninstall**. Uninstall removes only what the kit added and keeps your own edits. Removing one tool keeps the files your other tools still use. Running it twice with the same choices changes nothing. You can also [install by hand](docs/manual-install.md). From a clone of this repo, `node installer/dist/index.js` does the same as `npx agent-engineering-kit`.

## What's inside

| Part | What it does |
|---|---|
| **Engineering rules** | The rulebook (`.agent-kit/RULES.md`): stack, workflow, principles, code quality, testing, security, UI, a review checklist, debugging and git. Reference only: skills and agents open the section they need |
| **Agent instructions** | A short block in `AGENTS.md` (about 600 tokens) with the always-on rules as pass/fail lines and what "done" means, for every tool, between markers so it can be updated or removed cleanly (Claude Code gets a one-line `@AGENTS.md` import in `CLAUDE.md`) |
| **Agents** | Task-shaped helpers, each with one job and its own context:<br>`code-explorer` (maps existing code) and `code-architect` (designs the change)<br>`verifier` (runs real checks, reports evidence) and `code-simplifier` (cleans up without changing behavior)<br>`test-analyzer`, `silent-failure-hunter`, `security-reviewer`, and optional `frontend-reviewer` (focused reviews) |
| **Skills** | `feature` (plan file + full pipeline), `quick-fix` (small changes), `verify-change` (proof it works), `ship` (commits + PR), `learn` (turns a correction into a rule), and `project-conventions` (detects your stack and commands) |
| **Auto-format hook** | Formats every file the agent edits with *your* project's formatter (`.agent-kit/format.mjs`, run by Node) |
| **Secret guard** | Stops agents from reading `.env` files and `secrets/` |
| **Pre-commit checks** (optional) | Runs the commands in `.agent-kit/checks.conf` before each commit and refuses changes to protected files such as acceptance tests |

Full details for each part are in [docs/components.md](docs/components.md).

## Who does what

The kit doesn't duplicate Matt Pocock's skills; it builds on them.

| Need | Comes from |
|---|---|
| Rules & principles | kit: engineering rules |
| Align before coding | Matt: `/grill-with-docs`, `/grill-me`, `grilling` |
| Shared vocabulary / decisions | Matt: `domain-modeling` → `GLOSSARY.md`, ADRs |
| Understand existing code | kit: `code-explorer` |
| Design | kit: `code-architect` + Matt: `codebase-design`, `/improve-codebase-architecture` |
| Build | Matt: `tdd` |
| Debug | Matt: `diagnosing-bugs` |
| Review | Matt: `code-review` (or built-in `/code-review`) + kit: `test-analyzer`, `silent-failure-hunter`, `security-reviewer`, `frontend-reviewer` |
| Verify | kit: `verifier`, `/verify-change` (and Claude Code's built-in `/verify` for running the app) |
| Clean up | kit: `code-simplifier`, or built-in `/simplify` |
| Detect stack/commands | kit: `project-conventions` |
| Formatting & secrets safety | kit: hook + secret guard |
| Commit/PR | kit: `/ship` |
| Learn from mistakes | kit: `/learn` |
| Long tasks across sessions | Matt: `/handoff` |

## Daily usage

| Situation | Do this |
|---|---|
| New feature / multi-file change | `/feature <description>` (or "use the feature skill" in tools without slash commands) |
| Small, contained fix | `/quick-fix <description>` |
| Before saying it's done | `/verify-change` |
| Just want to think it through | `/grill-with-docs` |
| Bug | Describe it; the agent uses `diagnosing-bugs` (or say "diagnose this") |
| Before committing | "review the diff" (code-review) → `/ship` |
| Agent made a mistake you corrected | `/learn <lesson>` |
| Every few days | `/improve-codebase-architecture` |
| Session getting long | `/handoff`, then continue in a new session |

**Tips:**
- Start in your tool's plan mode when not using `/feature`.
- Keep `AGENTS.md` short, and never skip verification.
- Make the workflow fit your team: add a **Workflow Preferences** section to the project part of `AGENTS.md` (where plans go, the test policy, commit style, when to ask first). The skills read it before their own defaults, and updates never touch it.
- Prefer permission allowlists over `--dangerously-skip-permissions`.
- Review any third-party skill or MCP server before installing it.
- Don't also install Superpowers or another full workflow framework; overlapping instructions make the agent inconsistent.

## Repository layout

```
agent-engineering-kit/
├── kit/          what gets installed: rules, AGENTS.md block, agents, skills, hook, checks
├── installer/    the installer (GUI, terminal wizard, CLI); built code in installer/dist
├── docs/         documentation about the kit and the installer
└── DESIGN.md     design system for the installer UI
```

| Document | For |
|---|---|
| [docs/components.md](docs/components.md) | Every installable part: what it is, when it's used, files |
| [docs/supported-tools.md](docs/supported-tools.md) | What each AI tool gets, and why |
| [docs/how-it-works.md](docs/how-it-works.md) | How the installer merges, backs up, updates, uninstalls, and stays safe |
| [docs/install-with-an-agent.md](docs/install-with-an-agent.md) | What your AI agent follows when you paste the install prompt |
| [docs/manual-install.md](docs/manual-install.md) | Installing without the installer |
| [docs/working-habits.md](docs/working-habits.md) | Habits and plugins for the people using the agent (from Boris Cherny and others) |
| [DESIGN.md](DESIGN.md) | Design system for the installer's UI ([DESIGN.md format](https://github.com/google-labs-code/design.md)) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developing the installer, adding a component or a tool, running tests |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each version |

## Notes

- **`npx` downloads only the installer and the kit** (about 100 kB, no dependencies).
- **The installer needs nothing extra.** It doesn't install Matt Pocock's skills or run any plugin command; the final screen gives you the commands to paste. Once running, it makes no network calls.
- **Renamed Matt Pocock skills:** Matt's repo changes often. If a skill used by `/feature` gets renamed, update [`kit/skills/feature/SKILL.md`](kit/skills/feature/SKILL.md). `/feature` falls back to §2 of the rulebook if a skill is missing.
- **Windows:** the installer and the format hook run on Node, so they work as is. The optional pre-commit check is a POSIX `sh` script, which Git for Windows provides.
- **Pre-commit checks have limits:** `.git/hooks` isn't shared by clones (each developer installs it), `git commit --no-verify` skips it, and `checks.conf` runs on every commit, so review changes to it like code.

## License

[MIT](LICENSE)
