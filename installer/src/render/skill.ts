import { parseFrontmatter, renderFrontmatter, type Frontmatter } from "./frontmatter.js";

/** Agent Skills spec (agentskills.io/specification) limits. */
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const ALLOWED_FIELDS = ["name", "description", "disable-model-invocation"];

/**
 * The one SKILL.md every tool gets: spec frontmatter (name, description) plus `disable-model-invocation` for
 * skills that only run when asked (documented by Claude Code, Cursor, Copilot and Grok; others ignore it).
 * Every location gets this same text, so tools that see two copies see identical ones.
 */
export function renderSkill(source: string, folderName: string): string {
  const label = `skill "${folderName}"`;
  const { data, body } = parseFrontmatter(source, label);
  const unknown = Object.keys(data).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unknown.length > 0) throw new Error(`${label}: unsupported frontmatter field(s) ${unknown.join(", ")}.`);
  const { name, description } = data;
  if (typeof name !== "string" || !NAME_PATTERN.test(name) || name.length > MAX_NAME_LENGTH) {
    throw new Error(`${label}: name must be 1-${MAX_NAME_LENGTH} lowercase letters, digits and hyphens.`);
  }
  if (name !== folderName) throw new Error(`${label}: name "${name}" must match its folder name.`);
  if (typeof description !== "string" || description.trim() === "") throw new Error(`${label}: needs a description.`);
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error(`${label}: description is over ${MAX_DESCRIPTION_LENGTH} characters.`);

  const frontmatter: Frontmatter = { name, description };
  if (data["disable-model-invocation"] === true) frontmatter["disable-model-invocation"] = true;
  return renderFrontmatter(frontmatter, body);
}
