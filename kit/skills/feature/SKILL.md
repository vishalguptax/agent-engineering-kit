---
name: feature
description: Full end-to-end workflow for building a feature or non-trivial change - explore, align, plan, build test-first, verify, simplify, review, and report. Uses this kit's agents and, when installed, Matt Pocock's skills (grilling, domain-modeling, codebase-design, tdd, code-review).
disable-model-invocation: true
---

# Feature workflow

The task is what the user asked for when starting this skill. Follow `docs/agent-engineering/RULES.md` throughout. The project's instructions (`AGENTS.md`, `CLAUDE.md`), including its **Workflow Preferences** section if there is one, take priority over the steps below (e.g. where plans go, the test policy, the commit style).

> Matt Pocock's skills (grilling, domain-modeling, codebase-design, tdd, diagnosing-bugs, code-review) are optional. If one isn't available, do that phase by following `docs/agent-engineering/RULES.md` §2, and say once which skill is missing.

## Phase 0 — Context (no edits)
1. Use the **project-conventions** skill: stack, real commands, conventions, reusable building blocks.
2. Read the domain glossary (`GLOSSARY.md`, or `CONTEXT.md` in older setups) and relevant ADRs if they exist. Use the project's vocabulary in all names, plans, and messages.
3. Use the **code-explorer** agent on the area the task touches.

## Phase 1 — Align (no edits)
4. List every detail of the request (each requirement, constraint, example, and wording that matters). Then interview me, one focused question at a time (the **grilling** skill if available), until every important branch is resolved. Don't start building while real ambiguity remains.
5. If new domain terms or hard-to-reverse decisions come up, update the glossary and ADRs (the **domain-modeling** skill if available) and show me the changes.

## Phase 2 — Plan (no edits except the plan file)
6. Use the **code-architect** agent (with the explorer's report and the agreed decisions) to design the change, applying the **codebase-design** skill's guidance if available: deep modules, a lot of behaviour behind a small interface.
7. Write the plan to `docs/plans/NNN-<slug>.md` (or where the Workflow Preferences say) using `docs/agent-engineering/plan-template.md` (NNN = next number in that folder). Make sure that:
   - every requirement is **Must** or **Flexible**, and No-Gos and Rabbit Holes are explicit;
   - every **Done When** item is binary and observable (rewrite "handles", "supports", "works with", "properly");
   - the **Detail check** table accounts for every detail from step 4 — each one is a requirement, a No-Go, or an open question.
8. Present the plan and **STOP until I approve it**. Set its status to Approved.
9. If `.agent-kit/protected` exists, add the plan's acceptance tests to it, so they can't be weakened while building.

## Phase 3 — Build test-first
10. One slice at a time, red → green → refactor (the **tdd** skill if available). The code must work after every slice. Add a dated line to the plan's Build log after each slice.
    - No test setup for this kind of code: agree in Phase 2 how each slice will be checked instead (a command and its expected output, a request and response, a screen), run that check before and after the slice, and recommend adding tests in the report. Don't set up a test framework unless the plan includes it.
11. Surgical changes only: nothing outside the plan. If the plan proves wrong, STOP and re-plan with me. If a bug or unexpected failure appears, diagnose it properly (the **diagnosing-bugs** skill if available) instead of guessing.

## Phase 4 — Verify
12. Use the **verify-change** skill. Fix every failure you introduced (never by weakening tests, suppressing warnings, or swallowing errors) until it passes, or report clearly what can't be verified.

## Phase 5 — Simplify
13. Use the **code-simplifier** agent on the changed code. Verify again afterwards.

## Phase 6 — Review
14. Review the diff for standards and against the plan (the **code-review** skill if available, or your tool's built-in review).
15. Also use the reviewer agents that apply:
    - **test-analyzer** — always.
    - **silent-failure-hunter** — when the change has error handling, I/O, network, parsing, or async code.
    - **security-reviewer** — when it touches auth, user input, APIs, data, files, payments, secrets/config, or dependencies.
    - **frontend-reviewer** (if installed) — when it touches UI.
16. Fix all must-fix and in-scope should-fix findings, verify again, and confirm the Anti-Slop Checklist (§8 of the rules).

## Phase 7 — Report
17. Check every Done When item and record the evidence in the plan; set its status to Done.
18. Report: what changed and why, files touched, verification commands and results, assumptions, anything NOT verified, and out-of-scope issues noticed (not fixed).
19. Don't commit or push unless I ask (the **ship** skill).
