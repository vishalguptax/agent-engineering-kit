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
