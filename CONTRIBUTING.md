# Contributing

Thanks for helping. This repo has two parts:

- **`kit/`**: what gets installed into people's projects (rules, the AGENTS.md block, agents, skills, the format hook, the pre-commit check). It's Markdown written once for every tool, a Node script and a POSIX `sh` script.
- **`installer/`**: the tool that installs it (GUI, terminal wizard, CLI). It's TypeScript on Node.js 18+, with no runtime dependencies.

Work the way the kit asks agents to work (see [`kit/rules/RULES.md`](kit/rules/RULES.md)): plan first, make small focused changes, test first for logic, verify for real, and explain *why* in commits and PRs.

## Set up

```sh
cd installer
npm install          # dev tools only: typescript, tsx, @types/node
npm test             # all tests (node:test)
npm run typecheck
npm run dev          # run the GUI from source
npx tsx src/index.ts --terminal          # terminal wizard from source
npx tsx src/index.ts --target /tmp/x --dry-run
```

Before opening a PR:
- Run `npm run build` and commit `installer/dist/`. Users run it directly; a test fails if it's stale.
- Run `npm run docs` and commit `docs/components.md` and `docs/supported-tools.md`. They're generated from the manifest and the tool profiles; a test fails if either is stale.

## Change kit content

Edit files under `kit/`. The installer reads them live, so run it against a scratch project to see the result.

- **Write for every tool.** Say "the feature skill" or "the verifier agent", not Claude-only syntax like `$ARGUMENTS` or a specific tool name. Skills and agents have one canonical frontmatter (`name`, `description`, plus `disable-model-invocation` for skills and `access: read-only|edit` for agents); the renderers in `installer/src/render/` turn it into each tool's format.

- **Adding or removing a file** means updating [`installer/kit.manifest.json`](installer/kit.manifest.json). The manifest test fails if a kit file isn't listed or a listed file is missing.
- **Writing a project-relative path** like `docs/agent-engineering/RULES.md` into a file? Global installs need it to point into `~/.claude`. Add a `globalRewrites` entry for it.
- **Bump `kitVersion`** in the manifest and add a [CHANGELOG](CHANGELOG.md) entry for anything users will notice.

## Add a component

All installer behaviour comes from the manifest; there's no per-component code. Components list *what* they install; the tool profiles decide *where* and in which format.

1. Add the file(s) under `kit/`, e.g. `kit/agents/doc-writer.md` (frontmatter: `name`, `description`, `access`).
2. Add an entry to `components` in `installer/kit.manifest.json`:
   ```json
   {
     "id": "doc-writer",
     "name": "doc-writer agent",
     "category": "Agents",
     "summary": "One line shown next to the checkbox.",
     "explanation": {
       "what": "Plain English: what it is.",
       "when": "When the agent or user uses it.",
       "example": "\"Use the doc-writer agent on this module.\""
     },
     "artifacts": [{ "kind": "agent", "name": "doc-writer" }],
     "dependsOn": [],
     "external": [],
     "required": false
   }
   ```
   - `category` is one of `Rules`, `Agents`, `Workflows/Skills`, `Hooks & Safety`, `Project instructions`.
   - An artifact's `kind` is `rulebook`, `template`, `instructions`, `skill` (reads `kit/skills/<name>/SKILL.md`), `agent` (reads `kit/agents/<name>.md`), `format-hook`, `secret-guard` or `checks`. Kinds with a `source` read it relative to `kit/`.
3. Add the id to the presets that should include it.
4. Run `npm run docs && npm test`.

## Add a tool

Tools are data. Only a new *format* needs code.

1. **Read the tool's official docs** and note the URLs: which instruction file it reads, its skill and agent folders (in priority order), its agent file fields, its after-edit hook payload, and how it blocks file reads. Use only what's documented; anything else becomes a `note`.
2. **Add a profile** to `TOOL_PROFILES` in [`installer/src/tools/profiles.ts`](installer/src/tools/profiles.ts) and its id to `ToolId`. Set `checked` to today's date. Detection markers in `detect.project` pre-select the tool; `detect.home`/`commands`/`macApps` only show "installed".
3. **New agent format?** Add it to `AgentFormat` and to `renderAgent` in `installer/src/render/agent.ts`, with a golden test in `test/render.test.ts`. A new hook payload needs a `--from` reader in `kit/hooks/format.mjs` and a fixture in `test/format-hook.test.ts`.
4. **Add tests** in `test/plan.test.ts` for the files the tool gets, alone and alongside a tool that shares its folders. `profileProblems` (run by `test/tools.test.ts`) catches inconsistent profiles.
5. Run `npm run docs && npm test`, and install into a scratch project with `--tools <id> --dry-run`.

`npm run audit-profiles` prints every profile's docs links, oldest check first, as a checklist for re-verifying the tools.

## Change the installer

- **Core logic** lives in `installer/src/core/`: scan, plan, apply, merge, uninstall, the record and path safety. It has no UI code, and the three front ends (`src/cli.ts`, `src/wizard.ts`, `src/server/` + `ui/`) only call into it. Keep it that way.
- **Write the test first** for any logic change. Fixtures for the five project shapes (empty, existing settings, AGENTS.md only, already installed, invalid settings) are in `installer/test/fixtures.ts`.
- **Treat the target project as untrusted.** Read and write only through `resolveInside` / `readTargetFile`, and never trust paths from `.agent-kit/install.json` without validating them. `installer/test/security.test.ts` holds the regression tests; add one for any new file operation.
- **No runtime dependencies.** If you think one is needed, open an issue first explaining why.

## Change the UI

[`DESIGN.md`](DESIGN.md) is the design system, in the [DESIGN.md format](https://github.com/google-labs-code/design.md). Follow it, and change tokens in `DESIGN.md` and `installer/ui/style.css` together; `installer/test/design.test.ts` checks they match. Check every UI change in a real browser in light mode, dark mode and at phone width.

## Releasing

The repo root is the npm package; `files` in the root `package.json` limits it to the built installer, its UI, the manifest and `kit/`.
1. Bump `version` in `package.json` and `kitVersion` in `installer/kit.manifest.json`, and add a CHANGELOG entry.
2. Check the contents with `npm pack --dry-run`, and try the tarball: `npx ./agent-engineering-kit-<version>.tgz --target /tmp/try --dry-run`.
3. Run `npm publish`. `prepublishOnly` rebuilds `dist/`, regenerates the docs and runs the tests first.

## Pull requests

Keep each PR to one concern. Describe what changed and why, how you tested it (commands plus results, screenshots for UI), and any risks. The kit's `/ship` skill writes this for you.
