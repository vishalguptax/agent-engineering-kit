import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AGENT_REFERENCE_DIR, PLAN_TEMPLATE_PATH, RULEBOOK_PATH } from "../src/core/layout.js";
import { CATEGORIES, INSTALLER_ROOT, loadManifest, type Artifact, type Manifest } from "../src/core/manifest.js";

export const COMPONENTS_DOC_PATH = path.join(INSTALLER_ROOT, "..", "docs", "components.md");


/** docs/components.md, generated from the manifest so the docs can't drift from what the installer does. */
export function renderComponentsDoc(manifest: Manifest): string {
  const nameOf = (id: string) => manifest.components.find((c) => c.id === id)?.name ?? id;
  const lines = [
    "# Components",
    "",
    "<!-- Generated from installer/kit.manifest.json by `npm run docs` in installer/. Don't edit by hand. -->",
    "",
    "Everything the installer can put into a project, grouped the way the installer shows it. Source files live in [`kit/`](../kit).",
    "",
    "| Preset | Installs |",
    "|---|---|",
    ...Object.entries(manifest.presets).map(([preset, ids]) => `| ${preset} | ${ids.map(nameOf).join(", ")} |`),
    "",
    "Dependencies are added automatically; required components are always installed.",
  ];
  for (const category of CATEGORIES) {
    const components = manifest.components.filter((c) => c.category === category);
    if (components.length === 0) continue;
    lines.push("", `## ${category}`);
    for (const c of components) {
      lines.push("", `### ${c.name}`, "", `\`${c.id}\`${c.required ? " · always installed" : ""} · ${c.summary}`, "");
      lines.push(`- **What it is:** ${c.explanation.what}`, `- **When it's used:** ${c.explanation.when}`, `- **Example:** \`${c.explanation.example}\``);
      if (c.dependsOn.length > 0) lines.push(`- **Also installs:** ${c.dependsOn.map(nameOf).join(", ")}`);
      if (c.external.length > 0) lines.push(`- **Needs (not installed by the tool):** ${c.external.join("; ")}`);
      lines.push(`- **Installs:** ${c.artifacts.map(describeArtifact).join("; ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Where an artifact ends up, in words (the exact paths depend on the tools selected; see supported-tools.md). */
function describeArtifact(artifact: Artifact): string {
  switch (artifact.kind) {
    case "rulebook":
      return `\`${RULEBOOK_PATH}\``;
    case "template":
      return `\`${PLAN_TEMPLATE_PATH}\``;
    case "instructions":
      return "a marked block in `AGENTS.md` (plus a `@AGENTS.md` import in `CLAUDE.md` for Claude Code and a setting for Gemini CLI)";
    case "skill":
      return `the \`${artifact.name}\` skill in each selected tool's skills folder`;
    case "agent":
      return `the \`${artifact.name}\` agent in each selected tool's agent format, plus \`${AGENT_REFERENCE_DIR}/${artifact.name}.md\``;
    case "format-hook":
      return "`.agent-kit/format.mjs` and an after-edit hook for each tool that documents one";
    case "secret-guard":
      return "deny rules or ignore-file entries for each tool that supports them";
    case "checks":
      return "`.agent-kit/check.sh`, `.agent-kit/checks.conf`, `.agent-kit/protected`, and a git pre-commit hook when it's safe to add";
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(COMPONENTS_DOC_PATH, renderComponentsDoc(loadManifest()));
  console.log(`Wrote ${COMPONENTS_DOC_PATH}`);
}
