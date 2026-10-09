# Components

<!-- Generated from installer/kit.manifest.json by `npm run docs` in installer/. Don't edit by hand. -->

Everything the installer can put into a project, grouped the way the installer shows it. Source files live in [`kit/`](../kit).

| Preset | Installs |
|---|---|
| recommended | Engineering rules, Agent instructions (AGENTS.md), code-explorer agent, code-architect agent, verifier agent, code-simplifier agent, test-analyzer agent, silent-failure-hunter agent, security-reviewer agent, /feature workflow, /fix, /verify, /ship, /learn, project-conventions skill, Auto-format hook, Secret guard |
| minimal | Engineering rules, Agent instructions (AGENTS.md), Auto-format hook |
| everything | Engineering rules, Agent instructions (AGENTS.md), code-explorer agent, code-architect agent, verifier agent, code-simplifier agent, test-analyzer agent, silent-failure-hunter agent, security-reviewer agent, frontend-reviewer agent, /feature workflow, /fix, /verify, /ship, /learn, project-conventions skill, Auto-format hook, Secret guard, Pre-commit checks |

Dependencies are added automatically; required components are always installed.

## Rules

### Engineering rules

`rules` · always installed · The rulebook: plan first, keep it simple, verify before saying done.

- **What it is:** One Markdown file with the kit's principles: think before coding, plan, make surgical changes, verify with real checks, simplify, and review your own diff. It works for any tech stack and any AI tool.
- **When it's used:** Always. The instructions block in AGENTS.md points every tool to it (Claude Code imports it directly). The skills and agents refer to it too.
- **Example:** `You don't trigger it. Once installed, the agent follows it automatically.`
- **Installs:** `docs/agent-engineering/RULES.md`; `docs/agent-engineering/plan-template.md`

## Project instructions

### Agent instructions (AGENTS.md)

`instructions` · A short block in AGENTS.md that switches the rules on for every tool.

- **What it is:** Adds a marked block to AGENTS.md, which almost every AI coding tool reads: it points to the rulebook and says when to use the feature, fix, verify and learn skills. Claude Code gets a one-line @AGENTS.md import in CLAUDE.md, and Gemini CLI a one-line setting, so they read it too. The block sits between marker comments, so it can be updated or removed cleanly.
- **When it's used:** Your tools load it at the start of every session.
- **Example:** `Open AGENTS.md after install: the block is between <!-- agent-engineering-kit:start --> and <!-- agent-engineering-kit:end -->.`
- **Also installs:** Engineering rules
- **Installs:** a marked block in `AGENTS.md` (plus a `@AGENTS.md` import in `CLAUDE.md` for Claude Code and a setting for Gemini CLI)

## Agents

### verifier agent

`verifier` · A strict QA subagent that runs the real checks and reports evidence.

- **What it is:** An agent that finds your project's format, lint, type-check, test and build commands, runs them, exercises the changed behavior, and reports PASS/FAIL with the actual output. It reads and runs things but does not edit code.
- **When it's used:** Before the agent says a task is done. /verify and /feature use it automatically.
- **Example:** `"Use the verifier subagent to check this change."`
- **Installs:** the `verifier` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/verifier.md`

### code-simplifier agent

`code-simplifier` · Cleans up working code without changing what it does.

- **What it is:** An agent that goes over only the code changed in the current task. It removes dead code, duplication, needless abstraction and narration comments, then re-runs the checks.
- **When it's used:** After an implementation works and before review. /feature uses it (Claude Code's built-in /simplify is an alternative).
- **Example:** `"Run the code-simplifier on what we just built."`
- **Installs:** the `code-simplifier` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/code-simplifier.md`

### security-reviewer agent

`security-reviewer` · A read-only security audit of the current change.

- **What it is:** An agent that checks the diff for leaked secrets, injection, XSS, missing auth checks, path traversal, unsafe dependencies and similar issues, and reports only concrete findings.
- **When it's used:** For changes that touch auth, user input, APIs, files, secrets, payments or dependencies. /feature and /ship call it when relevant.
- **Example:** `"Have the security-reviewer look at this diff."`
- **Installs:** the `security-reviewer` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/security-reviewer.md`

### code-explorer agent

`code-explorer` · Maps how existing code works before anything is changed.

- **What it is:** A read-only agent that traces an area of the codebase end to end (entry points, data flow, key files, patterns to reuse) and reports back with file:line references, so the main conversation's context stays clean.
- **When it's used:** At the start of a feature or change in unfamiliar code. /feature runs it first.
- **Example:** `"Use the code-explorer subagent to map how checkout works."`
- **Installs:** the `code-explorer` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/code-explorer.md`

### code-architect agent

`code-architect` · Designs how a change should fit the codebase, before code is written.

- **What it is:** A read-only agent that turns the task and the explorer's findings into one implementation blueprint: files to touch, interfaces, data flow, test plan, and build order in small verifiable slices. It recommends the simplest design that reuses existing patterns.
- **When it's used:** After exploring and before building anything beyond a trivial change. /feature uses it to draft the plan you approve.
- **Example:** `"Have the code-architect design the CSV export."`
- **Installs:** the `code-architect` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/code-architect.md`

### silent-failure-hunter agent

`silent-failure-hunter` · Finds errors that get swallowed or hidden in the change.

- **What it is:** A read-only reviewer that looks for empty catches, ignored error codes, unawaited promises, and fallbacks that make a failure look like success, and reports each with a concrete fix.
- **When it's used:** When reviewing changes with error handling, I/O, network, parsing, or async code. /feature and /ship call it when relevant.
- **Example:** `"Run the silent-failure-hunter on this diff."`
- **Installs:** the `silent-failure-hunter` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/silent-failure-hunter.md`

### test-analyzer agent

`test-analyzer` · Checks that the tests really prove the change works.

- **What it is:** A read-only reviewer that maps every changed behavior to the tests that cover it, flags missing edge cases and error paths, and catches skipped, weakened or flaky tests.
- **When it's used:** Before declaring a change done or opening a PR. /feature and /ship call it on every change.
- **Example:** `"Have the test-analyzer check coverage for this change."`
- **Installs:** the `test-analyzer` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/test-analyzer.md`

### frontend-reviewer agent

`frontend-reviewer` · Reviews UI changes: design system, accessibility, states, responsiveness.

- **What it is:** A read-only reviewer for UI changes. It checks the change follows the project's DESIGN.md or existing components, handles loading/empty/error states, is accessible and responsive, and doesn't hurt performance. With browser tools it also looks at the real screens.
- **When it's used:** When a change touches components, pages, styles, or client-side code. Pre-selected when the installer detects a frontend stack.
- **Example:** `"Have the frontend-reviewer check the new settings page."`
- **Installs:** the `frontend-reviewer` agent in each selected tool's agent format, plus `docs/agent-engineering/agents/frontend-reviewer.md`

## Workflows/Skills

### /feature workflow

`feature` · The full pipeline: explore → align → design → build test-first → verify → simplify → review.

- **What it is:** A slash command that walks the agent through the whole lifecycle for a feature. It explores the code, interviews you, designs a blueprint, waits for your approval, builds with TDD, then runs the verifier, code-simplifier and the reviewers before reporting.
- **When it's used:** For any new feature or multi-file change.
- **Example:** `/feature add CSV export to the reports page`
- **Also installs:** Engineering rules, project-conventions skill, code-explorer agent, code-architect agent, verifier agent, code-simplifier agent, test-analyzer agent, silent-failure-hunter agent, security-reviewer agent
- **Needs (not installed by the tool):** Matt Pocock's skills plugin (grilling, tdd, code-review, …). Without it, /feature falls back to the rules file.
- **Installs:** the `feature` skill in each selected tool's skills folder

### /fix

`fix` · Small, contained fixes with a quick verify loop.

- **What it is:** A skill for clear, small changes: it sizes the change first, reproduces a bug with a failing test, makes the smallest correct fix, and verifies. If the change grows past about 6 files or 2 modules, it stops and switches to /feature.
- **When it's used:** For bug fixes and small changes where the solution is obvious.
- **Example:** `/fix the date picker shows yesterday in UTC+ timezones`
- **Also installs:** Engineering rules, /verify
- **Installs:** the `fix` skill in each selected tool's skills folder

### /verify

`verify` · Prove a change works, fixing and retrying until it passes.

- **What it is:** Runs the verifier subagent. If something fails because of the current change, the agent fixes the root cause and verifies again, up to 3 attempts, and never weakens tests to get a pass.
- **When it's used:** Before saying anything is done, or whenever you want proof.
- **Example:** `/verify`
- **Also installs:** verifier agent
- **Needs (not installed by the tool):** Optional: Matt Pocock's diagnosing-bugs skill for hard failures.
- **Installs:** the `verify` skill in each selected tool's skills folder

### /ship

`ship` · Focused commits and a pull request description.

- **What it is:** Checks that verification and review have passed, groups the changes into focused commits with clear messages, and writes a PR description. It only pushes or opens a PR if you ask it to.
- **When it's used:** When you're ready to commit.
- **Example:** `/ship pr`
- **Also installs:** /verify, test-analyzer agent, silent-failure-hunter agent, security-reviewer agent
- **Needs (not installed by the tool):** Optional: Matt Pocock's code-review skill for the review gate.
- **Installs:** the `ship` skill in each selected tool's skills folder

### /learn

`learn` · Turn a correction into a permanent project rule.

- **What it is:** When you correct the agent, /learn writes the lesson as one specific rule and proposes where it goes in CLAUDE.md. It applies the rule only after you approve.
- **When it's used:** Right after the agent makes a mistake you don't want repeated.
- **Example:** `/learn always use the apiClient wrapper, never fetch directly`
- **Installs:** the `learn` skill in each selected tool's skills folder

### project-conventions skill

`project-conventions` · Detects your stack, real commands and conventions before writing code.

- **What it is:** A read-only skill that looks at your manifests, scripts, CI and a few existing files to learn how your project is built and written, so new code matches it.
- **When it's used:** The agent uses it automatically in new projects or unfamiliar areas. /feature runs it first.
- **Example:** `"Use the project-conventions skill and fill in the project section of CLAUDE.md."`
- **Also installs:** Engineering rules
- **Installs:** the `project-conventions` skill in each selected tool's skills folder

## Hooks & Safety

### Auto-format hook

`format-hook` · Formats every file Claude edits, using your project's own formatter.

- **What it is:** A small Node script plus an after-edit hook for the tools that document one (Claude Code, Cursor, Windsurf). After each edit it runs the formatter your project already has (Prettier, Biome, ruff, gofmt, rustfmt, …). It never blocks the agent and does nothing if no formatter is found.
- **When it's used:** Automatically, after every file edit in those tools. For other tools, use the optional pre-commit check.
- **Example:** `Nothing to trigger. Edited files simply come out formatted.`
- **Needs (not installed by the tool):** Node.js 18+ (the hook is a small Node script); Your project's formatter (optional)
- **Installs:** `.agent-kit/format.mjs` and an after-edit hook for each tool that documents one

### Secret guard

`secret-guard` · Stops Claude from reading .env files and secrets/.

- **What it is:** Keeps agents out of .env files and a secrets/ folder in each tool's own way: deny rules in Claude Code's settings, and ignore files for Cursor, Gemini CLI, Windsurf, Kiro, Junie, Augment and Aider. For tools that can't be configured from the repo, the installer tells you what to set.
- **When it's used:** Always active once installed.
- **Example:** `If an agent tries to read .env, the read is refused.`
- **Installs:** deny rules or ignore-file entries for each tool that supports them

### Pre-commit checks

`checks` · Runs your project's checks before every commit, whichever AI tool (or person) made the change.

- **What it is:** A small script, .agent-kit/check.sh, that runs the commands you list in .agent-kit/checks.conf (format, lint, type-check, test) and refuses commits that change files listed in .agent-kit/protected, such as acceptance tests an agent must not weaken. A git pre-commit hook runs it, so it works the same for every tool. If your repo already manages hooks (husky, lefthook, pre-commit), the installer shows the one line to add instead.
- **When it's used:** On every git commit, and whenever the verify skill runs.
- **Example:** `git commit → "check test: npm test … FAILED" → the commit is stopped until the tests pass.`
- **Needs (not installed by the tool):** git; A POSIX shell (Git for Windows includes one)
- **Installs:** `.agent-kit/check.sh`, `.agent-kit/checks.conf`, `.agent-kit/protected`, and a git pre-commit hook when it's safe to add
