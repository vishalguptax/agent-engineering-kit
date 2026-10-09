---
name: project-conventions
description: Detect the project's tech stack, real commands, and coding conventions before writing code. Use automatically when starting work in a new project or an unfamiliar area of the codebase, or before creating new files.
---

# Project conventions discovery

Run this before writing code in an unfamiliar project or area. Read-only. Start from the project instructions (`AGENTS.md`, `CLAUDE.md`): what they state, including **Workflow Preferences**, wins over what you infer. Every finding must come from a file you read or a command you ran; if something can't be found, say "not found" rather than guessing.

## 1. Stack
Inspect manifests/configs: `package.json` + lockfile, `tsconfig.json`, framework configs, `pyproject.toml`/`requirements*.txt`, `go.mod`, `Cargo.toml`, `pom.xml`/`build.gradle*`, `*.csproj`, `Gemfile`, `composer.json`, `pubspec.yaml`, `Package.swift`, `mix.exs`, `Dockerfile`, `Makefile`/`justfile`, `.github/workflows/*`.
Note: language(s), framework(s), package manager, test framework, linter/formatter, and versions of key libraries.

## 2. Commands
Find the exact commands for install, dev, format, lint, type-check, test (all + single file), and build — from project instructions → package scripts / Makefile / task runner → CI workflows → README/CONTRIBUTING. Use the project's package manager. If a command can't be found, say so; don't invent one.

## 3. Conventions
Read 2–3 existing files of the same kind as what you'll write (component, route, service, model, test). Note:
- folder placement and file naming
- naming style, import style, module boundaries
- error handling, logging, validation patterns
- state management / data fetching / dependency injection patterns
- test location, style, fixtures, and mocking approach
- shared utilities and components that should be reused
- the design system for UI work: `DESIGN.md` at the root if present, otherwise the existing tokens, theme, and components

## 4. How work is checked here
Note what exists and what doesn't: a test suite (and for which parts), CI, a git repository, `.agent-kit/checks.conf`. Where there are no tests, find how the project is checked in practice (scripts, a dev server, manual steps in the README) so verification can use that.

## 5. Output
Summarize briefly (stack, commands, key conventions, reusable building blocks) and keep following them. If the project instructions file lacks the commands section, suggest adding it (see Appendix A in `docs/agent-engineering/RULES.md`).
