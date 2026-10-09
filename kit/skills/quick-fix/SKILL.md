---
name: quick-fix
description: Small, contained change or bug fix with a quick verify loop - when the change is clear and touches only a few files. Escalates to the feature workflow when it grows.
disable-model-invocation: true
---

# Quick fix

The change is what the user asked for when starting this skill. Follow the kit's rules, and for a bug also §9 of `.agent-kit/RULES.md`. The project's instructions (`AGENTS.md`, `CLAUDE.md`), including its **Workflow Preferences** section if there is one, take priority over the steps below.

1. **Size it first.** Find the files the fix needs. If it needs more than about 6 files, more than 2 modules, a new dependency, or a design decision I haven't made, stop and say so: this belongs in the **feature** skill.
2. **Pin down the problem** and decide what will prove the fix:
   - The project has tests: write a test that fails because of the bug (or that checks the new behavior), and watch it fail.
   - No test for this kind of code is possible or the project has no test setup: state the exact observable check instead (a command and its expected output, a request and its response, a screen and what it shows), and run it once to see the problem. Mention that a test would be worth adding; don't set up a test framework unasked.
3. **Make the smallest correct change.** Match the surrounding style; touch nothing unrelated.
4. **Verify** with the **verify-change** skill. The check from step 2 must now pass, and nothing else may break.
5. **Report** in a few lines: the cause, the change, the evidence, and anything not verified. Don't commit unless I ask (the **ship** skill).

If the fix turns out bigger than step 1 suggested, stop and switch to the **feature** skill instead of growing the change.
