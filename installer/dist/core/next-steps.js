import { toolById } from "../tools/profiles.js";
/** Steps the installer deliberately does not do itself (it never runs plugin or package commands). */
export function nextSteps(scan, selected, tools) {
    const hasMatt = scan.mattSkills.isDetected;
    const skillTools = tools.map(toolById).filter((tool) => tool.skills !== null);
    const steps = [];
    for (const tool of skillTools) {
        if (tool.mattSkillsCommand)
            steps.push({ text: `Install Matt Pocock's skills in ${tool.name}`, command: tool.mattSkillsCommand, isDone: hasMatt });
    }
    if (skillTools.some((tool) => !tool.mattSkillsCommand)) {
        steps.push({ text: "Install Matt Pocock's skills for your other tools (it asks which ones)", command: "npx skills@latest add mattpocock/skills", isDone: hasMatt });
    }
    if (steps.length > 0) {
        const where = scan.target.mode === "global" ? "Set them up once in each repo you work in" : "Set them up once in this repo";
        steps.push({ text: where, command: "/setup-matt-pocock-skills", isDone: hasMatt });
    }
    steps.push({ text: "Restart your AI tools so they load the new rules, skills and agents." });
    for (const id of tools)
        for (const text of toolById(id).nextSteps ?? [])
            steps.push({ text });
    if (scan.target.mode === "project" && selected.includes("instructions")) {
        steps.push({
            text: "Fill in the project section of AGENTS.md, or ask your agent to do it",
            command: "Use the project-conventions skill to fill in the project section of AGENTS.md.",
        });
    }
    return steps;
}
