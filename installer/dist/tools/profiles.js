/**
 * Everything the installer knows about each AI coding tool, as data. Formats have code (src/render); tools don't.
 * Sources are the tools' official docs, checked on the date in `checked`. Only documented behaviour goes here:
 * anything a tool's docs don't confirm is a `note` for the user, never a guess.
 */
const CHECKED = "2026-10-09";
const CLAUDE_AGENTS = { dir: ".claude/agents", format: "claude-md" };
export const TOOL_PROFILES = [
    {
        id: "claude-code",
        name: "Claude Code",
        docs: ["https://code.claude.com/docs/en/memory", "https://code.claude.com/docs/en/skills", "https://code.claude.com/docs/en/sub-agents", "https://code.claude.com/docs/en/hooks"],
        checked: CHECKED,
        detect: { project: ["CLAUDE.md", ".claude"], home: [".claude"], commands: ["claude"] },
        instructions: { kind: "claude-import" },
        skills: { reads: [".claude/skills"] },
        homeSkills: [".claude/skills"],
        agents: { reads: [CLAUDE_AGENTS] },
        formatHook: { kind: "claude-settings", file: ".claude/settings.json" },
        secretGuard: { kind: "claude-settings", file: ".claude/settings.json" },
        nextSteps: ["Claude Code: run /agents and type / to check the agents and skills loaded."],
        mattSkillsCommand: "/plugin install mattpocock-skills@claude-plugins-official",
    },
    {
        id: "codex",
        name: "OpenAI Codex",
        docs: ["https://learn.chatgpt.com/docs/agent-configuration/agents-md", "https://learn.chatgpt.com/docs/build-skills", "https://learn.chatgpt.com/docs/agent-configuration/subagents", "https://learn.chatgpt.com/docs/hooks"],
        checked: CHECKED,
        detect: { project: [".codex"], home: [".codex"], commands: ["codex"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills"] },
        homeSkills: [".agents/skills"],
        agents: { reads: [{ dir: ".codex/agents", format: "codex-toml" }] },
        formatHook: { kind: "note", note: "Codex hooks don't report which file was edited (only the patch text), so the kit doesn't install a format hook for Codex. The optional pre-commit check covers formatting." },
        secretGuard: { kind: "note", note: "Codex blocks file access through permission profiles in .codex/config.toml, which also change its whole sandbox policy. If you want it, add a profile that denies \"**/.env*\" yourself." },
    },
    {
        id: "cursor",
        name: "Cursor",
        docs: ["https://cursor.com/docs/context/rules", "https://cursor.com/docs/context/skills", "https://cursor.com/docs/context/subagents", "https://cursor.com/docs/agent/hooks", "https://cursor.com/docs/context/ignore-files"],
        checked: CHECKED,
        detect: { project: [".cursor", ".cursorrules", ".cursorignore"], home: [".cursor"], commands: ["cursor", "cursor-agent"], macApps: ["Cursor.app"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills", ".cursor/skills", ".claude/skills", ".codex/skills"] },
        homeSkills: [".agents/skills", ".cursor/skills", ".claude/skills", ".codex/skills"],
        agents: { reads: [{ dir: ".cursor/agents", format: "cursor-md" }, CLAUDE_AGENTS, { dir: ".codex/agents", format: "codex-toml" }] },
        formatHook: { kind: "cursor-hooks", file: ".cursor/hooks.json" },
        secretGuard: { kind: "ignore-file", file: ".cursorignore" },
    },
    {
        id: "copilot",
        name: "GitHub Copilot",
        docs: ["https://code.visualstudio.com/docs/copilot/customization/custom-instructions", "https://code.visualstudio.com/docs/copilot/customization/agent-skills", "https://code.visualstudio.com/docs/copilot/customization/custom-agents", "https://docs.github.com/en/copilot/reference/customization-cheat-sheet"],
        checked: CHECKED,
        detect: { project: [".github/copilot-instructions.md", ".github/instructions", ".github/agents", ".github/prompts", ".github/skills"], home: [".copilot"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".github/skills", ".claude/skills", ".agents/skills"] },
        homeSkills: [".copilot/skills", ".claude/skills", ".agents/skills"],
        agents: { reads: [{ dir: ".github/agents", format: "copilot-agent-md" }, CLAUDE_AGENTS] },
        formatHook: { kind: "note", note: "Copilot's hook input doesn't document which file was edited, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting." },
        secretGuard: { kind: "note", note: "Copilot can't be told to skip .env from inside the repo. Use content exclusion in your GitHub repository or organization settings (not supported in VS Code agent mode)." },
    },
    {
        id: "gemini",
        name: "Gemini CLI",
        docs: ["https://geminicli.com/docs/cli/gemini-md", "https://geminicli.com/docs/cli/skills", "https://geminicli.com/docs/core/subagents", "https://geminicli.com/docs/cli/gemini-ignore"],
        checked: CHECKED,
        detect: { project: ["GEMINI.md", ".gemini"], home: [".gemini"], commands: ["gemini"] },
        instructions: { kind: "gemini-context" },
        skills: { reads: [".agents/skills", ".gemini/skills"] },
        homeSkills: [".agents/skills", ".gemini/skills"],
        agents: { reads: [{ dir: ".gemini/agents", format: "gemini-md" }] },
        formatHook: { kind: "note", note: "Gemini CLI's hook input doesn't document the edited file's path, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting." },
        secretGuard: { kind: "ignore-file", file: ".geminiignore" },
    },
    {
        id: "antigravity",
        name: "Google Antigravity",
        docs: ["https://antigravity.google/docs/rules", "https://antigravity.google/docs/skills", "https://antigravity.google/docs/subagents", "https://antigravity.google/docs/permissions"],
        checked: CHECKED,
        detect: { project: [".agents/rules", ".agents/workflows", ".agents/hooks.json", ".agents/mcp_config.json", ".agent"], home: [".gemini/antigravity", ".gemini/config"], commands: ["agy"], macApps: ["Antigravity.app"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills"] },
        homeSkills: [".gemini/config/skills", ".gemini/antigravity/skills"],
        agents: { reads: [{ dir: ".agents/agents", format: "antigravity-md" }] },
        formatHook: { kind: "note", note: "Antigravity's hook input doesn't document the edited file's path, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting." },
        secretGuard: { kind: "note", note: "Set a deny rule for read_file(.env) in Antigravity's permission settings (Settings UI, or ~/.gemini/antigravity-cli/settings.json for the CLI)." },
    },
    {
        id: "grok",
        name: "Grok Build",
        docs: ["https://docs.x.ai/build/features/project-rules", "https://docs.x.ai/build/features/skills-plugins-marketplaces", "https://docs.x.ai/build/features/permissions"],
        checked: CHECKED,
        detect: { project: [".grok"], home: [".grok"], commands: ["grok"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".grok/skills", ".claude/skills"] },
        homeSkills: [".grok/skills", ".agents/skills"],
        agents: { reference: "Grok Build's custom agent file format isn't documented yet." },
        formatHook: null,
        secretGuard: { kind: "note", note: "Add a deny rule for reading .env to [permission] rules in .grok/config.toml." },
    },
    {
        id: "windsurf",
        name: "Windsurf / Devin Desktop",
        docs: ["https://docs.devin.ai/desktop/cascade/memories", "https://docs.devin.ai/desktop/cascade/skills", "https://docs.devin.ai/desktop/cascade/hooks", "https://docs.devin.ai/desktop/context-awareness/windsurf-ignore"],
        checked: CHECKED,
        detect: { project: [".windsurf", ".devin", ".windsurfrules", ".codeiumignore"], home: [".codeium/windsurf"], macApps: ["Windsurf.app", "Devin Desktop.app"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills", ".devin/skills", ".windsurf/skills"] },
        homeSkills: [".agents/skills", ".codeium/windsurf/skills"],
        agents: { reference: "Cascade has no file-based sub-agents." },
        formatHook: { kind: "devin-hooks", file: ".devin/hooks.json" },
        secretGuard: { kind: "ignore-file", file: ".codeiumignore" },
    },
    {
        id: "kiro",
        name: "Kiro",
        docs: ["https://kiro.dev/docs/steering/", "https://kiro.dev/docs/skills/", "https://kiro.dev/docs/custom-agents/creating/", "https://kiro.dev/docs/kiroignore/"],
        checked: CHECKED,
        detect: { project: [".kiro", ".kiroignore"], home: [".kiro"], commands: ["kiro", "kiro-cli"], macApps: ["Kiro.app"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".kiro/skills"] },
        homeSkills: [".kiro/skills"],
        agents: { reads: [{ dir: ".kiro/agents", format: "kiro-md" }] },
        formatHook: { kind: "note", note: "Kiro's hook input doesn't document the edited file's path, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting." },
        secretGuard: { kind: "ignore-file", file: ".kiroignore", note: "Kiro only uses .kiroignore after you add it to the kiroAgent.agentIgnoreFiles setting (IDE only)." },
    },
    {
        id: "opencode",
        name: "opencode",
        docs: ["https://opencode.ai/docs/rules/", "https://opencode.ai/docs/skills/", "https://opencode.ai/docs/agents/", "https://opencode.ai/docs/permissions/"],
        checked: CHECKED,
        detect: { project: ["opencode.json", "opencode.jsonc", ".opencode"], home: [".config/opencode"], commands: ["opencode"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".opencode/skills", ".claude/skills", ".agents/skills"] },
        homeSkills: [".config/opencode/skills", ".claude/skills", ".agents/skills"],
        agents: { reads: [{ dir: ".opencode/agents", format: "opencode-md" }] },
        formatHook: { kind: "note", note: "opencode formats edited files with its own built-in formatters; configure them under \"formatter\" in opencode.json if needed." },
        secretGuard: { kind: "note", note: "opencode already denies reading .env and .env.* by default. If you keep secrets elsewhere, add them under \"permission\" > \"read\" in opencode.json." },
    },
    {
        id: "kilo",
        name: "Kilo Code",
        docs: ["https://kilo.ai/docs/customize/agents-md", "https://kilo.ai/docs/customize/skills", "https://kilo.ai/docs/customize/custom-subagents", "https://kilo.ai/docs/customize/context/kilocodeignore"],
        checked: CHECKED,
        detect: { project: ["kilo.jsonc", "kilo.json", ".kilo", ".kilocode"], home: [".config/kilo", ".kilo"], commands: ["kilo"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills", ".kilo/skills"] },
        homeSkills: [".agents/skills", ".kilo/skills"],
        agents: { reads: [{ dir: ".kilo/agents", format: "opencode-md" }] },
        formatHook: null,
        secretGuard: { kind: "note", note: "Add \"permission\": { \"read\": { \"*.env\": \"deny\" } } to kilo.jsonc (the installer doesn't edit files with comments)." },
    },
    {
        id: "junie",
        name: "JetBrains Junie",
        docs: ["https://junie.jetbrains.com/docs/guidelines-and-memory.html", "https://junie.jetbrains.com/docs/agent-skills.html", "https://junie.jetbrains.com/docs/junie-cli-subagents.html"],
        checked: CHECKED,
        detect: { project: [".junie", ".aiignore"], home: [".junie"], commands: ["junie"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills", ".junie/skills"] },
        homeSkills: [".agents/skills", ".junie/skills"],
        agents: { reads: [{ dir: ".junie/agents", format: "junie-md" }] },
        formatHook: null,
        secretGuard: { kind: "ignore-file", file: ".aiignore", note: "Junie ignores .aiignore in Brave Mode." },
        warnings: [{ ifExists: [".junie/AGENTS.md"], message: "Junie's IDE uses .junie/AGENTS.md instead of the root AGENTS.md when it exists, so it won't see the kit's rules. Add a line to .junie/AGENTS.md that says to follow the root AGENTS.md." }],
        nextSteps: ["Junie: trust this project, because Junie reads .agents/skills only in trusted projects."],
    },
    {
        id: "augment",
        name: "Augment Code",
        docs: ["https://docs.augmentcode.com/cli/rules", "https://docs.augmentcode.com/cli/skills", "https://docs.augmentcode.com/cli/subagents", "https://docs.augmentcode.com/cli/hooks"],
        checked: CHECKED,
        detect: { project: [".augment", ".augmentignore", ".augment-guidelines"], home: [".augment"], commands: ["auggie"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".augment/skills", ".claude/skills", ".agents/skills"] },
        homeSkills: [".augment/skills", ".claude/skills", ".agents/skills"],
        agents: { reads: [{ dir: ".augment/agents", format: "augment-md" }] },
        formatHook: { kind: "note", note: "Augment's hook \"command\" is a script path and its working directory isn't defined, so the kit doesn't install a format hook for it. The optional pre-commit check covers formatting." },
        secretGuard: { kind: "ignore-file", file: ".augmentignore" },
    },
    {
        id: "cline",
        name: "Cline",
        docs: ["https://docs.cline.bot/customization/cline-rules", "https://docs.cline.bot/customization/skills", "https://docs.cline.bot/features/subagents"],
        checked: CHECKED,
        detect: { project: [".clinerules", ".cline", ".clineignore"], home: [".cline"], commands: ["cline"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".cline/skills", ".clinerules/skills", ".claude/skills", ".agents/skills"] },
        homeSkills: [".cline/skills", ".agents/skills"],
        agents: { reference: "Cline's custom agent file format isn't documented yet." },
        formatHook: null,
        secretGuard: { kind: "note", note: "Cline is replacing .clineignore with a guard hook; until then, use its \"Block Ignored File Access\" plugin to keep it out of .env." },
    },
    {
        id: "zed",
        name: "Zed",
        docs: ["https://zed.dev/docs/ai/instructions", "https://zed.dev/docs/ai/skills", "https://zed.dev/docs/ai/tool-permissions"],
        checked: CHECKED,
        detect: { project: [".rules", ".zed"], home: [".config/zed"], commands: ["zed"], macApps: ["Zed.app"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills"] },
        homeSkills: [".agents/skills"],
        agents: { reference: "Zed has no file-based sub-agents." },
        formatHook: null,
        secretGuard: { kind: "note", note: "Deny agent access to .env with agent.tool_permissions in your Zed settings." },
        warnings: [
            {
                ifExists: [".rules", ".cursorrules", ".windsurfrules", ".clinerules", ".github/copilot-instructions.md", "AGENT.md"],
                message: "Zed reads only the first rules file it finds, and this project has one that comes before AGENTS.md, so Zed won't see the kit's rules. Move that file's content into AGENTS.md if you use Zed.",
            },
        ],
    },
    {
        id: "amp",
        name: "Amp",
        docs: ["https://ampcode.com/docs/customize/agents-md", "https://ampcode.com/docs/customize/skills"],
        checked: CHECKED,
        detect: { project: [".amp"], home: [".config/amp"], commands: ["amp"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills", ".claude/skills"] },
        homeSkills: [".config/agents/skills", ".agents/skills", ".config/amp/skills", ".claude/skills"],
        agents: { reference: "Amp creates sub-agents through its plugin API, not files." },
        formatHook: null,
        secretGuard: { kind: "note", note: "Amp has no ignore file; disable file reads of .env through a tool.call plugin or amp.tools.disable." },
    },
    {
        id: "warp",
        name: "Warp",
        docs: ["https://docs.warp.dev/agents/cli/configuration/", "https://docs.warp.dev/agent-platform/capabilities/skills/"],
        checked: CHECKED,
        detect: { project: ["WARP.md", ".warp"], home: [".warp"], commands: ["warp"], macApps: ["Warp.app"] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills", ".warp/skills", ".claude/skills"] },
        homeSkills: [".agents/skills", ".warp/skills"],
        agents: { reference: "Warp's agent profiles are set in the app, not files." },
        formatHook: null,
        secretGuard: { kind: "note", note: "Restrict file reads in your Warp agent profile's permissions." },
    },
    {
        id: "aider",
        name: "Aider",
        docs: ["https://aider.chat/docs/usage/conventions.html", "https://aider.chat/docs/config/options.html"],
        checked: CHECKED,
        detect: { project: [".aider.conf.yml", ".aiderignore"], commands: ["aider"] },
        instructions: { kind: "note", note: "Aider doesn't read AGENTS.md by itself. Add \"read: AGENTS.md\" to .aider.conf.yml (or run aider --read AGENTS.md)." },
        skills: null,
        agents: null,
        formatHook: null,
        secretGuard: { kind: "ignore-file", file: ".aiderignore" },
    },
    {
        id: "generic",
        name: "Any other agent (AGENTS.md)",
        docs: ["https://agents.md/", "https://agentskills.io/specification"],
        checked: CHECKED,
        detect: { project: [] },
        instructions: { kind: "agents-md" },
        skills: { reads: [".agents/skills"] },
        agents: { reference: "Generic agents get the agent instructions as reference files." },
        formatHook: null,
        secretGuard: null,
    },
];
export function toolById(id) {
    const profile = TOOL_PROFILES.find((t) => t.id === id);
    if (!profile)
        throw new Error(`Unknown tool "${id}".`);
    return profile;
}
export function isToolId(value) {
    return TOOL_PROFILES.some((t) => t.id === value);
}
/** Human-readable problems with the profile data; empty means valid. */
export function profileProblems(profiles) {
    const problems = [];
    const seen = new Set();
    const checkPath = (id, p) => {
        if (p === "" || p.startsWith("/") || /^[a-zA-Z]:/.test(p) || p.split("/").includes("..")) {
            problems.push(`${id}: "${p}" must be a relative path inside the project`);
        }
    };
    for (const tool of profiles) {
        if (seen.has(tool.id))
            problems.push(`duplicate tool id "${tool.id}"`);
        seen.add(tool.id);
        if (tool.docs.length === 0)
            problems.push(`${tool.id}: needs at least one docs link`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tool.checked))
            problems.push(`${tool.id}: checked must be YYYY-MM-DD`);
        tool.detect.project.forEach((p) => checkPath(tool.id, p));
        tool.skills?.reads.forEach((p) => checkPath(tool.id, p));
        if (tool.skills && tool.skills.reads.length === 0)
            problems.push(`${tool.id}: skills.reads is empty`);
        if (tool.agents && "reads" in tool.agents) {
            if (tool.agents.reads.length === 0)
                problems.push(`${tool.id}: agents.reads is empty`);
            tool.agents.reads.forEach((l) => checkPath(tool.id, l.dir));
        }
        for (const spec of [tool.formatHook, tool.secretGuard]) {
            if (spec && "file" in spec)
                checkPath(tool.id, spec.file);
        }
    }
    return problems;
}
