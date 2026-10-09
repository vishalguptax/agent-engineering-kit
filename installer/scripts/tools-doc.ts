import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { INSTALLER_ROOT } from "../src/core/manifest.js";
import { CAPABILITY_LABELS, capabilitiesOf, type CapabilityState, type ToolCapabilities } from "../src/tools/capabilities.js";
import { TOOL_PROFILES, type ToolProfile } from "../src/tools/profiles.js";

export const TOOLS_DOC_PATH = path.join(INSTALLER_ROOT, "..", "docs", "supported-tools.md");

const MARKS: Record<CapabilityState, string> = { yes: "✓", reference: "as reference", note: "note", none: "—" };
const KINDS = Object.keys(CAPABILITY_LABELS) as (keyof ToolCapabilities)[];

/** docs/supported-tools.md, generated from the tool profiles so the docs can't drift from what the installer writes. */
export function renderToolsDoc(profiles: ToolProfile[] = TOOL_PROFILES): string {
  const lines = [
    "# Supported tools",
    "",
    "<!-- Generated from installer/src/tools/profiles.ts by `npm run docs` in installer/. Don't edit by hand. -->",
    "",
    "Pick your tools in the installer (or pass `--tools a,b,c`; `--list-tools` prints this list). The kit is written once and installed in each tool's own format. Shared files such as `AGENTS.md` and `.agents/skills/` are written once for every tool that reads them.",
    "",
    "- **✓** the installer writes it.",
    "- **as reference** the tool has no file-based sub-agents, so the skills tell it to read `docs/agent-engineering/agents/<name>.md` and do that review itself.",
    "- **note** it can't be set safely from the project, so the preview tells you exactly what to do.",
    "- **—** the tool doesn't support it. The optional pre-commit checks still apply, whichever tool made the change.",
    "",
    "Only behaviour the tools' own docs describe is used. Global installs (`--global`) are Claude Code only.",
    "",
    `| Tool | id | ${KINDS.map((kind) => CAPABILITY_LABELS[kind]).join(" | ")} |`,
    `|---|---|${KINDS.map(() => "---").join("|")}|`,
    ...profiles.map((tool) => {
      const caps = capabilitiesOf(tool);
      return `| ${tool.name} | \`${tool.id}\` | ${KINDS.map((kind) => MARKS[caps[kind].state]).join(" | ")} |`;
    }),
  ];
  for (const tool of profiles) {
    const caps = capabilitiesOf(tool);
    lines.push("", `## ${tool.name}`, "");
    for (const kind of KINDS) lines.push(`- **${CAPABILITY_LABELS[kind]}:** ${caps[kind].detail}`);
    if (tool.detect.project.length > 0) lines.push(`- **Detected by:** ${tool.detect.project.map((p) => `\`${p}\``).join(", ")}`);
    for (const warning of tool.warnings ?? []) lines.push(`- **Warning** (if ${warning.ifExists.map((p) => `\`${p}\``).join(" or ")} exists): ${warning.message}`);
    for (const step of tool.nextSteps ?? []) lines.push(`- **After installing:** ${step.replace(`${tool.name}: `, "")}`);
    lines.push(`- **Docs** (checked ${tool.checked}): ${tool.docs.map((url) => `<${url}>`).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(TOOLS_DOC_PATH, renderToolsDoc());
  console.log(`Wrote ${TOOLS_DOC_PATH}`);
}
