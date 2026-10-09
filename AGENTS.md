## Project Overview
The Agent Engineering Kit: rules, agents, skills and hooks that make AI coding agents ship clean code, plus a safe GUI/terminal/CLI installer that puts them into any project in each tool's format.
- Tech stack: TypeScript (strict, ES2022, NodeNext) on Node.js 18+, npm, tests with node:test via tsx, no runtime dependencies. Kit content is Markdown, a Node script and a POSIX sh script. No linter/formatter configured.

## Commands
Run these inside `installer/`:
- Install: `npm install`
- Test: `npm test` (from the repo root, `npm test` does the same)
- Single test file: `npx tsx --test test/<name>.test.ts`
- Type-check: `npm run typecheck`
- Build: `npm run build` (commit `installer/dist/`)
- Regenerate docs: `npm run docs` (commit `docs/components.md`, `docs/supported-tools.md`)
- Run GUI from source: `npm run dev`; dry-run against a scratch dir: `npx tsx src/index.ts --target /tmp/x --dry-run`
- Website (from the repo root): `node scripts/build-site.mjs` (`--offline` skips live numbers and images); its tests run with `npm test`

## Key Directories
- `kit/`: what gets installed (agents, checks, hooks, instructions, rules, skills, templates)
- `installer/src/core/`: scan, plan, apply, merge, uninstall, record, path safety (no UI code)
- `installer/src/cli.ts`, `installer/src/wizard.ts`, `installer/src/server/` + `installer/ui/`: the three front ends
- `installer/src/tools/profiles.ts`: per-tool profiles; `installer/src/render/`: per-tool format renderers
- `installer/kit.manifest.json`: every component and preset
- `installer/test/`: node:test tests and fixtures
- `docs/`: user docs (`components.md` and `supported-tools.md` are generated)
- `site/`: the website (static HTML; `site/DESIGN.md` is its design system); `scripts/build-site.mjs` fills its `bake:` regions

## Conventions
- Kit content is written for every tool: no Claude-only syntax; canonical frontmatter only.
- Tests use `node:test` + `node:assert/strict`, one file per core module in `installer/test/`.
- Read and write target files only through `resolveInside` / `readTargetFile`; treat the target project as untrusted.
- UI tokens in `DESIGN.md` and `installer/ui/style.css` stay in sync.

## Do / Don't (learned from past mistakes)
- Do update `installer/kit.manifest.json` when adding or removing a kit file; add `globalRewrites` for project-relative paths.
- Do commit a rebuilt `installer/dist/` and regenerated docs (tests fail if they're stale), and the rebuilt site after changing `CHANGELOG.md`, `kit/`, the manifest or the version (`node scripts/build-site.mjs --offline`).
- Don't add runtime dependencies without opening an issue first.
- Do write the test first for any logic change, and add a security test for any new file operation.

## Workflow Preferences
- Bump `kitVersion` and add a CHANGELOG entry for user-visible changes.
- One concern per PR; describe what, why, how tested, risks.
- Check UI changes in a browser: light, dark, phone width.

<!-- agent-engineering-kit:start -->
## Engineering rules (Agent Engineering Kit)
These rules apply to every task; this file's other instructions and the project's own conventions take priority. For detail, open only the section you need in `.agent-kit/RULES.md`: §1 stack, §2 workflow, §3 principles, §4 code quality, §5 testing, §6 security, §7 UI, §8 review checklist, §9 debugging, §10 git.

**Before coding**
- If the request is ambiguous, ask one focused question. Never guess silently; state each assumption you make.
- For anything beyond a trivial fix, get a plan approved before editing code.
- Read the code you'll change, and 2–3 existing files of the same kind; match their style and patterns.
- Use only APIs you have confirmed exist in the installed versions.
- Write down what "done" means as checks that pass or fail: a test, a command and its output, an observable result.

**While coding**
- Every changed line traces to the request. Unrelated problems go in the report, not the diff.
- Add no features, options, abstractions or dependencies that weren't asked for.
- Never delete, skip or weaken a test, suppress a lint or type error, or swallow an error to make a check pass.
- Put no secrets, credentials or environment-specific values in code.
- Use the domain terms in `GLOSSARY.md` (or `CONTEXT.md`), if present.

**Done means all of these are true**
- The project's format, lint, type-check, test and build commands pass (those that exist).
- The changed behavior was exercised for real, not only compiled.
- New or changed logic has a test, or the report says why not.
- The diff passes the review checklist (§8): no dead code, debug output, commented-out code or narrating comments.
- The report lists what changed, the commands run and their results, and anything not verified. Without that evidence, it isn't done.

**Workflows**
- Features or multi-file changes: the **feature** skill. Small, contained fixes: the **quick-fix** skill. Before saying done: the **verify-change** skill. To commit: the **ship** skill. For anything non-trivial, align with me before coding.
- When a skill says "use the X agent": delegate to your tool's X sub-agent if it has one; otherwise read `.agent-kit/agents/X.md` and do that work yourself, in a separate pass.
- When I correct a mistake, propose a lasting fix with the **learn** skill.
<!-- agent-engineering-kit:end -->
