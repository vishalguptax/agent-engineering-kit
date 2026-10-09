# Instructions for an AI agent: install the Agent Engineering Kit

> **Human:** open your coding agent (Claude Code, Codex, Cursor, Copilot, Gemini CLI…) in your project and say:
> *"Read `agent-engineering-kit/docs/install-with-an-agent.md` and follow it."*
> (or give it this file's GitHub link).

You are installing the Agent Engineering Kit into the project in the current working directory. Use the kit's own installer. Don't copy files by hand: the installer merges safely, backs up, records what it did and can uninstall cleanly. Copying by hand would create duplicates the installer can't track. Ask the user before every choice that changes their files.

`KIT` below stands for the installer command: `npx agent-engineering-kit` (nothing to download first), or `node <path-to>/agent-engineering-kit/installer/dist/index.js` if the user has a local copy.

## Steps

1. **Check Node.js.** Run `node --version`; it must be 18 or newer. If Node isn't available, tell the user, and only with their approval follow [`manual-install.md`](manual-install.md) instead, asking before overwriting anything.

2. **Choose the AI tools with the user.** Run `KIT --list-tools` to see the ids and what each tool gets. Ask which tools their team uses in this project (include yourself). Without `--tools`, the installer picks the tools it finds in the project.

3. **Preview.** Run:
   ```sh
   KIT --target . --tools <ids> --dry-run
   ```
   Summarize the output for the user:
   - **The scan.** Existing setup, stack, the AI tools found, and uncommitted changes (if any, suggest they commit or stash first).
   - **The plan.** What will be created, merged (settings files) or appended (`AGENTS.md`, `CLAUDE.md`), and the diffs.
   - **The notes.** What a tool can't get and what the user should do instead.
   - **Any CONFLICT.** A file of theirs that differs from the kit's version.
   - **Any blocker**, e.g. invalid `settings.json`. Help them fix it; never overwrite it.

4. **Choose components with the user.** The default is the Recommended preset. Explain the parts from [`components.md`](components.md) in plain words. If they want less, use `--preset minimal` or `--components a,b,c` (ids are in `components.md`; dependencies are added automatically). Re-run the dry run with their choice.

5. **Resolve conflicts with the user.** For each CONFLICT, show the diff and ask: keep theirs, use the kit's version (theirs is backed up), or save the kit's version next to it as `<name>.kit-new`.
   - If they want the same choice for every conflict, pass `--on-conflict keep|kit|kit-new`.
   - If they want different choices per file, ask them to run the guided installer themselves, which asks per file. In Claude Code they can type: `! KIT --terminal`.

6. **Pre-commit checks (optional).** The `checks` component (Everything preset) runs commands before each commit. Ask whether they want it, and which commands. Pre-filled from their scripts; they can edit `.agent-kit/checks.conf` afterwards.

7. **Install.** Run the same command without `--dry-run`, adding `--yes` and the user's choices:
   ```sh
   KIT --target . --tools <ids> --preset recommended --on-conflict keep --yes
   ```
   Report what changed and where the backup is.

8. **Fill in the project section.**
   - Use the `project-conventions` skill (now installed) to detect the stack, the exact install/dev/format/lint/type-check/test/build commands, key folders and conventions.
   - Ask the user what the code can't tell you.
   - Draft the project section using the template in Appendix A of `docs/agent-engineering/RULES.md`. Show it to the user, and once they approve, add it to `AGENTS.md` *above* the `<!-- agent-engineering-kit:start -->` marker. Never edit inside the markers; the installer owns that block.

9. **Matt Pocock's skills.** The installer's output says whether they were found. If not, give the user the commands it printed (`/plugin install mattpocock-skills@claude-plugins-official` in Claude Code, or `npx skills@latest add mattpocock/skills` for other tools), then `/setup-matt-pocock-skills`. They must run these themselves.

10. **Verify.**
    - Every JSON file the installer changed is valid JSON.
    - The format hook works (if installed): pipe `{"tool_input":{"file_path":"<an existing source file>"}}` into `node .agent-kit/format.mjs --from claude`. It must exit 0, and `git diff` should show nothing unexpected.
    - If checks were installed: `sh .agent-kit/check.sh` passes.

11. **Report** what was added, merged or skipped, and the installer's notes. Remind the user to restart their tools and check the skills and agents loaded. Don't commit unless they ask.

## Global install

To install for all of the user's projects, use `--global` instead of `--target .`, which installs into `~/.claude`. Global installs are Claude Code only. Skip steps 2 and 8: the project section belongs in each project's own `AGENTS.md`.

## Update or uninstall later

- **Update:** run the same command again. It re-plans against the current kit and shows what changed.
- **Uninstall:** `KIT --target . --uninstall --dry-run`, then without `--dry-run` and with `--yes` once the user agrees. It removes only what the kit added and keeps the user's edits.
