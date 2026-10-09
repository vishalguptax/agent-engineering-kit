---
name: ship
description: Prepare the verified, reviewed change for delivery - final checks, focused commits with good messages, and a pull request description. Only when the user explicitly asks to commit, push, or open a PR.
disable-model-invocation: true
---

# Ship — commit and PR

Do what the user asked for when starting this skill: prepare commits (the default), push, or open a PR. Never more than that. The project's instructions (`AGENTS.md`, `CLAUDE.md`), including its **Workflow Preferences** section if there is one, take priority over the steps below.

If the project isn't a git repository, stop: say so and summarize the changed files and the suggested commit message instead.

1. **Gate:** confirm the **verify-change** skill passed and the review found no open must-fix issues in this session (code review plus the reviewer agents that apply: test-analyzer, silent-failure-hunter, security-reviewer, frontend-reviewer). If not, run them first.
2. **Inspect:** `git status` and `git diff`. Make sure no secrets, env files, build output, debug code, or unrelated changes are included. Exclude anything unrelated and tell me.
3. **Commits:** group changes into focused commits (one concern each). Follow the project's commit convention (Workflow Preferences, then `git log` and CONTRIBUTING); default to Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). Messages explain **why**, not just what.
4. **PR description** (use the project's PR template if one exists): summary and motivation; approach and key decisions; how it was tested (commands and results, screenshots for UI); risks, rollout notes, follow-ups. Link the plan in `.agent-kit/plans/` (or where the Workflow Preferences put plans) if there is one.
5. **Push or open a PR only if I asked for it.** Never force-push, rewrite shared history, or merge without explicit permission.
