## Engineering rules (Agent Engineering Kit)
Before any task, read and follow @docs/agent-engineering/RULES.md (start with §0, "The Short Version"). This file's other instructions and the project's own conventions take priority over it.

- Use the domain vocabulary in `GLOSSARY.md` (or `CONTEXT.md` in older setups), if present, for all names and messages.
- Features or multi-file changes: use the **feature** skill. Small, contained fixes: the **fix** skill. For anything non-trivial, align with me before coding.
- Before claiming a task is done, verify it (the **verify** skill) and report the evidence.
- When a skill says "use the X agent": delegate to your tool's X sub-agent if it has one; otherwise read `docs/agent-engineering/agents/X.md` and do that work yourself, in a separate pass.
- When I correct a mistake, propose a rule for this file (the **learn** skill).
