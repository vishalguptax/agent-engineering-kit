# installer/

The Agent Engineering Kit installer: a local GUI, a terminal wizard, and a scriptable CLI, all on one core.

- **Using it:** see the [repo README](../README.md#quick-start) and [docs/how-it-works.md](../docs/how-it-works.md), which cover flags, screens, merges, backups, uninstall and safety.
- **Developing it:** see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Layout

```
installer/
├── kit.manifest.json   every installable component: the single source of truth for GUI, CLI and docs
├── src/
│   ├── index.ts        entry: flags → CLI, terminal wizard, or GUI
│   ├── cli.ts          flag-driven mode
│   ├── wizard.ts       terminal prompts (same steps as the GUI)
│   ├── terminal.ts     shared terminal input/output
│   ├── args.ts         flag parsing and usage text
│   ├── core/           scan, plan, apply, merge, uninstall, record, path safety (no UI code)
│   ├── tools/          one profile per AI tool (data), detection, shared-folder choice, capabilities
│   ├── render/         per-format writers: skills, agents (Markdown variants, Codex TOML), hooks, secret guard
│   └── server/         127.0.0.1 server with a per-session token, plus a JSON API for ui/
├── ui/                 plain HTML/CSS/JS front end (design system: ../DESIGN.md)
├── scripts/            dev scripts (npm run docs → ../docs/components.md and ../docs/supported-tools.md)
├── test/               node:test suites and fixtures
└── dist/               compiled output, committed so users need no npm install
```

The kit content it installs lives in [`../kit/`](../kit) and is read at runtime.

## Scripts

| Command | Does |
|---|---|
| `npm test` | All tests |
| `npm run typecheck` | Type-check src, tests and scripts |
| `npm run dev` | Run the GUI from source |
| `npm run build` | Rebuild `dist/` (commit it) |
| `npm run docs` | Regenerate `../docs/components.md` and `../docs/supported-tools.md` (commit them) |
| `npm run audit-profiles` | List every tool's docs links, oldest check first, to re-verify the profiles |

Dependencies are dev-only and pinned: `typescript` (build), `tsx` (run TypeScript in dev and tests), `@types/node`.
