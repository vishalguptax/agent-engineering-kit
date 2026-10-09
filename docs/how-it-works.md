# How the installer works

The installer puts the contents of [`kit/`](../kit) into a project (or `~/.claude` for Claude Code) without breaking or silently overwriting what's already there, in the format of each AI tool you pick. It reads the kit's files live, so edits to `kit/` show up the next time you run it.

## Four ways to run it

| You have | Run |
|---|---|
| An AI coding agent | Paste the prompt from the [README](../README.md#quick-start). The agent follows [install-with-an-agent.md](install-with-an-agent.md): it gathers the project details from evidence, confirms them with you, and runs the CLI below. |
| A desktop with a browser | `npx agent-engineering-kit` |
| Only a terminal (SSH, server, container) | `npx agent-engineering-kit --terminal`. This mode is also used automatically over SSH or on Linux without a display. |
| A script or CI | `npx agent-engineering-kit --target ./my-app --tools claude-code,codex --preset recommended --yes` |

From a clone of this repo, use `node installer/dist/index.js` in place of `npx agent-engineering-kit`. Recently used folders are remembered in your user config folder (`~/.config/agent-engineering-kit/` or `%APPDATA%\agent-engineering-kit\`).

All of them use the same core logic, so they behave identically.

You can also use the GUI over SSH:
1. Start it with `--no-open`.
2. Forward the port it prints: `ssh -L 8080:127.0.0.1:<port> server`.
3. Open `http://127.0.0.1:8080/?token=…` locally, using the token from the printed URL.

### Flags

```
--target <path>          Install into this project folder
--global                 Install into ~/.claude (Claude Code only; applies to all your projects)
--preset <name>          recommended | minimal | everything
                         (default: recommended, or what is already installed when updating)
--components a,b,c       Exact components (dependencies are added automatically)
--tools a,b,c            AI tools to install for (default: the ones the project uses,
                         or the ones from the last install). --list-tools shows the ids.
--dry-run                Show what would change; write nothing
--yes                    Don't ask for confirmation
--on-conflict <choice>   keep (default) | kit | kit-new, for files that differ from the kit
--resolve <path>=<choice>  The choice for one conflicting file; repeat for more
--checks <file>          Commands for the pre-commit checks, one "name: command" per line
--project-info <file>    Markdown describing your project, added to AGENTS.md once,
                         outside the kit's block (it stays yours)
--uninstall              Undo the kit's changes using the install record
--terminal               Guided prompts in the terminal
--no-open                GUI: print the URL instead of opening a browser
--list-tools             Show the supported AI tools and what each one gets
```

Exit codes: `0` done or nothing to do, `1` stopped (error, blocker, or you said no), `2` bad flags.

## The GUI, screen by screen

The left rail numbers the steps like a manual's table of contents. The current step is marked in the accent colour, and finished ones get a check. The page follows your system's light or dark mode and works down to phone width.

1. **Welcome.** A headline, four lines on what the kit contains (rulebook, agents, workflows, safety), and a stamped "NO SLOP" card promising preview-first, backed-up, cleanly reversible installs.
2. **Target.** Two cards: *An existing project* or *Global: ~/.claude*. For a project, type the path or use **Browse…**, which opens an inline folder list with "Up one level" and "Use this folder". Recently used folders appear below.
3. **Scan.** A spec-sheet table of what's already there:
   - `.claude/`, `settings.json` (and whether it's valid), skills, agents;
   - CLAUDE.md, AGENTS.md, the domain glossary (`GLOSSARY.md`, or `CONTEXT.md` in older setups), `docs/`;
   - git status, the detected stack, and the AI tools the project already uses;
   - Matt Pocock's skills, and whether the kit is already installed.

   Warnings appear for uncommitted changes, invalid settings, or an untrusted install record. If the kit is installed, you get **Update**, **Add or remove components or tools** and **Uninstall**.
4. **AI tools** (project installs). A card per tool. Tools with files in the project (`.cursor/`, `.codex/`, `CLAUDE.md`…) are pre-selected; tools only found on this computer get an "installed" stamp but stay unselected, because the project's team may not use them. Each card shows what the tool gets (rules, skills, agents, format on edit, secret guard) and why. Global installs skip this step: they're Claude Code only.
5. **Components.** Grouped checkboxes with Recommended / Minimal / Everything presets. Each one has a **What is this?** panel: what it is, when it's used, an example, which of your tools get it and how, what it also installs, and what it needs. Dependencies are selected for you with a note saying why, and you can't uncheck something another selected part needs.
6. **About your project** (optional, project installs only). Fields that follow the rulebook's Appendix A: what it does, stack, commands, key folders, conventions, do/don't, workflow preferences, and free-form notes. Stack and commands are pre-filled from `package.json`, lockfiles and `Makefile`. If you chose the pre-commit checks, you confirm their commands here, pre-filled from your project's scripts.
7. **Preview.** Nothing has been written yet. Every file gets a stamp (CREATE, MERGE, APPEND, UPDATE, SKIP, CONFLICT, REMOVE), a one-line explanation, and the tools that read it, with diffs for anything that changes an existing file. Notes explain anything a tool can't get and what to do instead. For each conflict you choose:
   - *Keep mine*;
   - *Use kit version* (yours is backed up);
   - *Save kit version as `<name>.kit-new`*.
8. **Done.** What changed, where the backup is, and the steps the installer deliberately doesn't do itself, each with a **Copy** button:
   - installing Matt Pocock's skills (the Claude Code plugin, or `npx skills@latest add mattpocock/skills` for other tools) and `/setup-matt-pocock-skills`;
   - restarting your tools, plus any tool-specific step (e.g. trusting the project in Junie);
   - filling in the project section of AGENTS.md.

   **Done** stops the installer; closing the tab does too, after a few seconds.

The terminal wizard asks the same questions in the same order: numbered choices (toggle tools and components by number), `?6` to explain component 6, and `k`/`u`/`s` for each conflict.

## Where things go

`AGENTS.md` is the hub: almost every tool reads it. Everything else the kit owns lives in `.agent-kit/`, so your `docs/` folder stays yours. The kit block in `AGENTS.md` holds the always-on rules (about 600 tokens, loaded in every session; a test keeps it under 1k); the rulebook is reference that skills and agents open one section at a time. Each tool then gets its own files only where it can't read a shared one:

```
AGENTS.md                              kit block (marked) + your project section
CLAUDE.md                              Claude Code only: a marked block containing @AGENTS.md
.agents/skills/<name>/SKILL.md         skills, shared by most tools
.claude/skills, .kiro/skills, ...      only for tools that don't read .agents/skills
.claude/agents, .codex/agents/*.toml,  agents, in each tool's format
  .gemini/agents, .github/agents, ...
.agent-kit/RULES.md                    the rulebook (reference, read a section at a time)
.agent-kit/plan-template.md
.agent-kit/agents/*.md                 each agent's instructions, for tools without sub-agents
.agent-kit/plans/                      your plans, written by the feature skill (yours to keep)
.agent-kit/                            also install.json, backup/, format.mjs, and (optional)
                                       check.sh, checks.conf, protected
```

**Choosing shared folders.** Each tool profile lists the skill and agent folders the tool reads, preferred first. Tools are processed in a fixed order: a tool that already reads a chosen folder is covered; otherwise its preferred folder is added. The same choices always give the same layout. Some tools read several folders (Cursor reads `.claude/skills` and `.agents/skills`), so with certain combinations they list a kit skill twice; the copies are byte-identical, and the preview says which tool is affected.

**Agent formats.** The kit's agents have one canonical frontmatter (`name`, `description`, `access: read-only|edit`). Each format keeps only the fields its tool documents: Claude Code gets a tool list, Cursor `readonly`, opencode and Kilo `permission.edit: deny`, and Codex a TOML file with `sandbox_mode = "read-only"`. Tools without sub-agents read `.agent-kit/agents/<name>.md` when a skill says "use the X agent".

The full per-tool table is in [supported-tools.md](supported-tools.md).

## How your files are changed

- **Copies** (agents, skills, rules, hook):
  - A new file is created.
  - An identical file is skipped.
  - A file you've changed is a conflict, and you decide.
  - A file the kit installed earlier that you haven't touched is simply updated.
- **JSON settings** (`.claude/settings.json`, `.cursor/hooks.json`, `.devin/hooks.json`, `.gemini/settings.json`). The kit's entries (deny rules, an after-edit hook, `AGENTS.md` in Gemini's `context.fileName`) are added only if missing; nothing of yours is removed or changed. The edit is made in place as text, so your indentation, line endings and one-line arrays stay as they were. Invalid JSON stops the install with the line and column of the problem, and the file is never overwritten. Fix it, or deselect the parts that change that file.
- **AGENTS.md and CLAUDE.md.** The kit's block goes between `<!-- agent-engineering-kit:start -->` and `<!-- agent-engineering-kit:end -->`. On a re-run or update, the content between the markers is replaced, never appended twice. CLAUDE.md (only when Claude Code is selected) gets a marked block containing just `@AGENTS.md`, below anything you already have.
- **Ignore files** (`.cursorignore`, `.geminiignore`, `.aiderignore`…) get a block between `# agent-engineering-kit:start` and `# agent-engineering-kit:end`.
- **Project info.** What you type goes above the kit's block in AGENTS.md as a normal section, and it's yours. It's added once (never if a `## Project Overview` heading already exists in AGENTS.md or CLAUDE.md), never changed by re-runs, and never removed by uninstall.
- **Pre-commit checks** (optional). `.agent-kit/check.sh`, `checks.conf` and `protected` are created once and then belong to you; updates never overwrite them. `.git/hooks/pre-commit` is written only when there's no existing pre-commit hook, no `core.hooksPath`, no husky / lefthook / pre-commit framework, and the hooks folder is inside the project. Otherwise the preview shows the one line to add to your own hook.
- **Global installs** (Claude Code only) put everything under `~/.claude` and rewrite the project-relative paths to point there: the rules import, the rules path inside skills, and the hook command. The preview shows the rewritten text.

**Running the installer twice with the same choices changes nothing, not even the install record.**

## Backups, the install record, and uninstall

- **Backups.** Before writing, every file that will change is copied to `<target>/.agent-kit/backup/<UTC timestamp>/`. The installer never deletes backups.
- **The install record.** `<target>/.agent-kit/install.json` records:
  - the kit version, the components and the tools;
  - every file created or modified, with a hash of how the installer left it, and which components and tools need it;
  - the exact JSON entries it added, so they can be taken out again;
  - the original backup of each modified file;
  - the folders it created.
- **Update.** Re-plans against the current `kit/` files, so you review the changes like any install. Files the kit no longer installs are removed, using the uninstall rules below.
- **Removing a tool or component** removes only what nothing else still needs. `AGENTS.md` and a shared skills folder stay while any selected tool reads them.
- **Uninstall** only touches files listed in the record:
  - A file the kit created that you haven't changed is deleted.
  - A file it modified that you haven't changed is restored from its original backup.
  - A file you've edited since loses only the kit's parts (its marked block, its JSON entries), or is kept as yours.
  - Empty folders the kit created are removed.
- **Installs from the pre-release (Claude-only) installer** are converted on the next run: the old record (`.claude/.kit-install.json`) is read, the kit's block moves from CLAUDE.md to AGENTS.md (CLAUDE.md keeps a marked `@AGENTS.md` import), and the rulebook moves to `.agent-kit/RULES.md`. Files you edited are kept or shown as conflicts, and everything appears in the preview first.
- **Installs from 1.0 and 1.1** had the rulebook, plan template and agent instructions in `docs/agent-engineering/`. Update moves them to `.agent-kit/` and removes the old copies you haven't edited (an edited one is kept as yours), plus any `docs/` folders the kit created that are now empty. Plans you wrote in `docs/plans/` are not moved; keep them there by adding `- Plans: docs/plans/` to Workflow Preferences, or move them yourself.

## Safety

- **It writes only inside the chosen folder** (or `~/.claude`). Every path is resolved and checked:
  - no `..` escapes;
  - no symlinked folders leading outside;
  - it never reads or writes through a symlink.

  Files are written via a fresh, exclusive temp file and renamed into place.
- **The install record is treated as untrusted**, because a cloned repo could ship a forged one. Every path in it must be one the installer could have written for some tool and component, every JSON entry it says the kit added must be one the kit actually writes, and backups must live under `.agent-kit/backup/` (or the pre-release `.claude/.kit-backup/`). `.git/` paths are accepted only as files the kit created, never restored from a backup. Otherwise the installer refuses to act and explains why.
- **It touches nothing it shouldn't.** It never deletes files it didn't create, makes no network calls, and never runs plugin or package-manager commands. The only external commands it runs are read-only `git` queries (`status`, `rev-parse`, `config core.hooksPath`) and opening your browser.
- **Git hooks only for the kit's own code.** Git never lets a cloned repo install hooks, and neither does the installer on its behalf: it writes `.git/hooks/pre-commit` only when `.agent-kit/check.sh` and `checks.conf` come from the kit. If the project already has its own, you get the line to add after reading them. A hook is recognised as the kit's by its exact content, never by the install record, and uninstall leaves any other hook alone.
- **The format hook runs your project's formatter,** the same trust you give a project when you let an agent edit it. In a project you don't trust, a global install would run that project's formatter (e.g. its `node_modules/.bin/prettier`) when an agent edits a file there.
- **The GUI server is locked down:**
  - It listens on `127.0.0.1` only and needs a random per-session token on every API request.
  - It rejects other `Host` headers, which blocks DNS rebinding, and serves a strict Content-Security-Policy.
  - Requests are validated and bodies are capped at 1 MB.
  - The page renders all data as text, never as HTML.

## Known limitations

- **Windows is not yet tested by hand.** The code paths exist: `cmd /c start` to open the browser, no chmod, and a Node format hook (no bash needed). The optional pre-commit check uses `sh`, which Git for Windows includes.
- **Only Claude Code has been run end to end.** The other tools' files follow their official docs (linked in [supported-tools.md](supported-tools.md)) and are checked by format tests, but haven't been loaded by each tool here.
- **Global installs are Claude Code only.** Other tools would need the whole home folder as the write root, which would weaken the containment checks.
- **Symlinked files stop the install.** If CLAUDE.md (or another target file) is a symlink, the installer won't write through it. The preview explains which file; deselect the parts that write it, or replace the symlink with a real file.
