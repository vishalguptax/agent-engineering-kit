import { existsSync } from "node:fs";
import path from "node:path";
import { agentFileName, chooseLocations, readsOf } from "./locations.js";
import type { ToolId, ToolProfile } from "./profiles.js";

export interface Collision {
  toolId: ToolId;
  kind: "skill" | "agent";
  name: string;
  /** Where the other copy is: a project-relative path, or one starting with "~/" for the home folder. */
  where: string;
}

export interface CollisionInput {
  projectDir: string;
  homeDir: string;
  tools: ToolProfile[];
  skillNames: string[];
  agentNames: string[];
}

/**
 * Finds skills and agents with the kit's names in other folders the selected tools read (in the project and in
 * the user's personal folders). Those would sit next to, or override, the kit's copy. The folders the kit
 * writes to are skipped: an existing file there is an ordinary conflict the planner already handles.
 */
export function findCollisions({ projectDir, homeDir, tools, skillNames, agentNames }: CollisionInput): Collision[] {
  const ownSkillDirs = chooseLocations(tools, "skills").chosen.map((l) => l.dir);
  const ownAgentDirs = chooseLocations(tools, "agents").chosen.map((l) => l.dir);
  const collisions: Collision[] = [];

  for (const tool of tools) {
    const skillDirs = [
      ...(tool.skills?.reads ?? []).filter((dir) => !ownSkillDirs.includes(dir)).map((dir) => ({ dir, base: projectDir, label: dir })),
      ...(tool.homeSkills ?? []).map((dir) => ({ dir, base: homeDir, label: `~/${dir}` })),
    ];
    for (const name of skillNames) {
      for (const { dir, base, label } of skillDirs) {
        if (existsSync(path.join(base, dir, name, "SKILL.md"))) collisions.push({ toolId: tool.id, kind: "skill", name, where: `${label}/${name}` });
      }
    }

    const agentReads = readsOf(tool, "agents");
    if (agentReads === "reference") continue;
    for (const name of agentNames) {
      for (const location of agentReads.filter((l) => !ownAgentDirs.includes(l.dir))) {
        const file = `${location.dir}/${agentFileName(name, location.format!)}`;
        if (existsSync(path.join(projectDir, file))) collisions.push({ toolId: tool.id, kind: "agent", name, where: file });
      }
    }
  }
  return collisions;
}
