---
name: learn
description: Turn a mistake or correction into a concise, permanent fix so it doesn't happen again. Use when the user corrects the agent or says "remember this", "don't do that again", or "add this to the rules".
disable-model-invocation: true
---

# Learn — make a correction permanent

The lesson is what the user said when starting this skill; if they said nothing specific, use the most recent correction in this conversation.

A lesson about *how this team works* (where plans go, the test policy, commit style, when to ask first) belongs in the **Workflow Preferences** section of the project instructions; create that section if it's missing.

1. Identify the underlying mistake and what would have prevented it.
2. Put the fix in **exactly one place**, the most reliable one that works:
   - **Can a check catch it?** If `.agent-kit/checks.conf` exists and a command (lint rule, test, script) could detect it, propose that check. Automation beats instructions.
   - **Is it a step in a workflow?** Propose the change to that skill's steps.
   - **Otherwise it's a rule.** Write **one specific, actionable line** for the project instructions (`AGENTS.md`, outside the kit's marked block):
     - ✅ "Use `apiClient` from `src/lib/api` for all HTTP calls; never call fetch directly."
     - ❌ "Write good API code."
3. Check that nothing similar already exists; if it does, sharpen it instead of adding a duplicate.
4. Show me the proposed change and where it goes. **Apply it only after I approve.**
5. Keep the instructions short and high-signal. If you notice obsolete or redundant rules, suggest removing them.
