---
name: verify
description: Run the project's real format, lint, type-check, test, and build commands and exercise the actual behavior to prove a change works. Use before claiming any task is done, or when the user asks to verify, test, or check the work.
---

# Verify — prove it works

1. Use the **verifier** agent to run all checks and exercise the real behavior of the current change. If `.agent-kit/check.sh` exists, it must pass too (`sh .agent-kit/check.sh`).
2. If anything fails because of the current change:
   - find the root cause (the **diagnosing-bugs** skill if available, for anything non-obvious) and fix it — never by weakening tests, skipping checks, adding suppression comments, or swallowing errors;
   - run verification again;
   - repeat until it passes, or until 3 attempts on the same failure; then stop and report.
3. Pre-existing failures unrelated to the change: don't fix them silently; report them separately.
4. Final output: the verifier's result table, what was fixed, and an explicit list of anything NOT verified.

Never say "done", "works", or "fixed" without this evidence.
