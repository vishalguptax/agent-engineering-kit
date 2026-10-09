---
name: fix
description: Small, contained change or bug fix with a quick verify loop - when the change is clear and touches only a few files. Escalates to the feature workflow when it grows.
disable-model-invocation: true
---

# Fix workflow

The change is what the user asked for when starting this skill. Follow `docs/agent-engineering/RULES.md`.

1. **Size it first.** Find the files the fix needs. If it needs more than about 6 files, more than 2 modules, a new dependency, or a design decision I haven't made, stop and say so: this belongs in the **feature** skill.
2. **Reproduce or pin down** the problem: for a bug, write a test that fails because of it (or state why a test isn't possible). For a small change, state the observable result that will prove it's done.
3. **Make the smallest correct change.** Match the surrounding style; touch nothing unrelated.
4. **Verify** with the **verify** skill. The new test must pass, and nothing else may break.
5. **Report** in a few lines: the cause, the change, the evidence. Don't commit unless I ask (the **ship** skill).

If the fix turns out bigger than step 1 suggested, stop and switch to the **feature** skill instead of growing the change.
