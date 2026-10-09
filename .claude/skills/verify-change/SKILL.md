---
name: "verify-change"
description: "Prove a change works - run the project's real format, lint, type-check, test, and build commands and exercise the actual behavior, fixing and retrying until it passes. Use before claiming any task is done, or when the user asks to verify, test, or check the work."
---

# Verify a change

The project's instructions (`AGENTS.md`, `CLAUDE.md`), including its **Workflow Preferences** section if there is one, take priority over the steps below.

1. Use the **verifier** agent to run all checks and exercise the real behavior of the current change. If `.agent-kit/check.sh` exists, it must pass too (`sh .agent-kit/check.sh`). Where the project lacks something, verify with what it has instead of skipping:
   - **No tests** for the changed code: exercise the behavior directly (run the command, call the endpoint, open the screen) and show the result.
   - **No lint, type-check, or build step:** say so; don't invent one.
   - **Not a git repository:** list the files you changed yourself, since `git diff` can't.
   - **Can't run something here** (needs credentials, hardware, a service): say exactly what wasn't run and how the user can check it.
2. If anything fails because of the current change:
   - find the root cause (the **diagnosing-bugs** skill if available, for anything non-obvious) and fix it — never by weakening tests, skipping checks, adding suppression comments, or swallowing errors;
   - run verification again;
   - repeat until it passes, or until 3 attempts on the same failure; then stop and report.
3. Pre-existing failures unrelated to the change: don't fix them silently; report them separately.
4. Final output: the verifier's result table, what was fixed, and an explicit list of anything NOT verified.

Never say "done", "works", or "fixed" without this evidence.
