# Plan NNN: <short title>

> Written by the feature skill to `.agent-kit/plans/NNN-<slug>.md`. One file per piece of work, so any session or tool can resume it.
> Status: Draft | Approved | Building | Done

## Problem
What is wrong or missing today, for whom, in 2–4 lines. Include the user's own words where they matter.

## Appetite
How much this is worth: e.g. "an afternoon", "two days". The solution must fit the appetite; if it doesn't, cut scope, don't stretch time.

## Requirements
Each requirement gets an ID. Mark it **Must** (the work fails without it) or **Flexible** (may be cut or simplified to stay within the appetite).
- R1 (Must): …
- R2 (Flexible): …

## No-Gos
Things this work explicitly will not do, so they don't creep in.
- …

## Rabbit Holes
Risks that could swallow time, each with a decision:
- **Patch:** solve it simply, here's how …
- **Cut:** drop it; it's a No-Go now.
- **Bound:** allow at most <time/size>, then stop and report.
- **Spike:** investigate before building. State **Investigate** (the question), **Success** (what answers it), **Boundary** (time limit).

## Done When
Binary, observable statements: each one is true or false, checkable by a test, a command, or looking at the result. Write them as "subject → observable result".
- `POST /invoices` with a missing customer → 422 with `{"error":"customer_required"}`
- The settings page at 375px wide → no horizontal scroll

Rewrite vague wording before approval: "handles", "supports", "works with", "improves", "properly" say nothing checkable.

## Slices
Small vertical slices, each independently verifiable, in build order. Name the Done When items each slice satisfies.
1. … (R1; Done When 1) — test first: …

## Detail check
Every detail from the request, and where it landed: a requirement, a No-Go, or an open question. Nothing may be silently dropped.
| Detail from the request | Where it landed |
|---|---|

## Open questions
- …

## Build log
Dated notes as the work progresses: decisions, surprises, what was verified.
