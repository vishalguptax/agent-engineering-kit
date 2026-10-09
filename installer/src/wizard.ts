import os from "node:os";
import path from "node:path";
import { applyPlan } from "./core/apply.js";
import type { Manifest } from "./core/manifest.js";
import { hasChanges, planInstall, type ConflictChoice, type Plan } from "./core/plan.js";
import { hasProjectSection, suggestProjectInfo, type ProjectInfo } from "./core/project-info.js";
import { blockersFor, presetSelection, resolveSelection, suggestedComponents } from "./core/resolve.js";
import { scan, type ScanResult } from "./core/scan.js";
import { suggestChecks } from "./core/checks.js";
import { CAPABILITY_LABELS, capabilitiesOf, type ToolCapabilities } from "./tools/capabilities.js";
import { defaultTools } from "./tools/detect.js";
import { TOOL_PROFILES, type ToolId } from "./tools/profiles.js";
import { globalTarget, projectTarget, type Target } from "./core/target.js";
import { planUninstall } from "./core/uninstall.js";
import { createPrompter, describePlan, describeResult, describeScan, InputEndedError, type Prompter } from "./terminal.js";

export interface WizardOptions {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  /** Relative folder paths are resolved against this. */
  cwd?: string;
  homeDir?: string;
}

type Flow = "install" | "update" | "uninstall";

const PROJECT_FIELDS: [key: keyof ProjectInfo, label: string, isMultiline: boolean][] = [
  ["overview", "What does this project do? (one or two lines)", false],
  ["stack", "Tech stack", false],
  ["commands", "Commands (install, run, test, lint, build)", true],
  ["keyDirs", "Key folders and what lives in them", true],
  ["conventions", "Conventions the agent should copy (naming, errors, testing, …)", true],
  ["doDont", "Do / Don't (hard rules, lessons learned)", true],
  ["notes", "Anything else the agent should know (domain terms, gotchas, links)", true],
];

const CONFLICT_ANSWERS: Record<string, ConflictChoice> = { k: "keep", u: "kit", s: "kit-new" };

/** The guided installer for terminals without a browser: the same steps as the GUI, as prompts. */
export async function runWizard(manifest: Manifest, options: WizardOptions): Promise<number> {
  const prompter = createPrompter(options.input, options.output);
  const say = (...lines: string[]) => options.output.write(`${lines.join("\n")}\n`);
  try {
    return await guide(manifest, prompter, say, { cwd: options.cwd ?? process.cwd(), homeDir: options.homeDir ?? os.homedir() });
  } catch (error) {
    if (!(error instanceof InputEndedError)) throw error;
    say("", error.message);
    return 1;
  } finally {
    prompter.close();
  }
}

async function guide(manifest: Manifest, prompter: Prompter, say: (...lines: string[]) => void, env: { cwd: string; homeDir: string }): Promise<number> {
  say(
    "Agent Engineering Kit installer",
    "Sets up your AI coding tools to plan first, keep changes small, verify their work and stay out of your secrets.",
    "You'll see every change before anything is written. Nothing of yours is overwritten without asking.",
    "",
  );
  const choose = async (question: string, choices: string[], fallback = 1): Promise<number> => {
    say(question, ...choices.map((choice, i) => `  ${i + 1}) ${choice}`));
    for (;;) {
      const answer = Number(await prompter.ask(`Choose [${fallback}]: `, String(fallback)));
      if (Number.isInteger(answer) && answer >= 1 && answer <= choices.length) return answer;
      say(`Please type a number from 1 to ${choices.length}.`);
    }
  };

  const isGlobal = (await choose("Where should the kit go?", ["A project folder", "Global: ~/.claude (applies to all your projects)"])) === 2;
  const { target, scanned } = isGlobal ? withScan(manifest, globalTarget(env.homeDir), env.homeDir) : await askProject(manifest, prompter, say, env);
  if (scanned.folderProblem) {
    say(`! ${scanned.folderProblem}`);
    return 1;
  }
  if (scanned.recordProblem) {
    say(`! ${scanned.recordProblem}`);
    return 1;
  }
  say("", ...describeScan(scanned), "");

  let flow: Flow = "install";
  if (scanned.record) {
    const action = await choose("The kit is already installed here. What would you like to do?", ["Update to the current kit", "Add or remove components or tools", "Uninstall", "Quit"]);
    if (action === 4) return 0;
    flow = action === 1 ? "update" : action === 3 ? "uninstall" : "install";
  }

  let plan: Plan;
  if (flow === "uninstall") {
    plan = planUninstall(manifest, target);
  } else {
    let tools = defaultTools(target.mode, target.root, scanned.record?.tools);
    if (flow === "install" && target.mode === "project") tools = await pickTools(prompter, say, tools, scanned);
    let start: string[];
    if (scanned.record) {
      start = scanned.record.components;
    } else {
      const presets = ["recommended", "minimal", "everything"];
      const minimal = manifest.presets.minimal.map((id) => manifest.components.find((c) => c.id === id)?.name ?? id).join(", ");
      const preset = await choose("Start from a preset:", ["Recommended", `Minimal (${minimal})`, "Everything"]);
      start = presetSelection(manifest, presets[preset - 1], suggestedComponents(manifest, scanned));
    }
    const selected = flow === "update" ? start : await pickComponents(manifest, prompter, say, start);
    const isProjectInstall = flow === "install" && target.mode === "project";
    const projectInfo = isProjectInstall && selected.includes("instructions") ? await askProjectInfo(prompter, say, target, scanned) : undefined;
    const checks = isProjectInstall && selected.includes("checks") ? await askChecks(prompter, say, target) : undefined;
    plan = planInstall({ manifest, target, selected, tools, projectInfo, checks, homeDir: env.homeDir });
  }

  say(...describePlan(plan));
  if (plan.blockers.length > 0) {
    say("", "Can't continue until this is fixed:", ...plan.blockers.map((b) => `  - ${b}`));
    return 1;
  }
  const resolutions: Record<string, ConflictChoice> = {};
  for (const action of plan.actions.filter((a) => a.kind === "CONFLICT")) {
    const name = path.posix.basename(action.path);
    for (;;) {
      const answer = (await prompter.ask(`\n${action.path} differs from the kit's version: (k)eep mine, (u)se the kit's (yours is backed up), (s)ave the kit's as ${name}.kit-new [k]: `, "k")).toLowerCase();
      if (CONFLICT_ANSWERS[answer[0]]) {
        resolutions[action.path] = CONFLICT_ANSWERS[answer[0]];
        break;
      }
      say("Please type k, u or s.");
    }
  }
  if (!hasChanges(plan, (p) => resolutions[p] === "keep")) {
    say("", "Nothing to change: everything is already in place.");
    return 0;
  }
  const verb = flow === "uninstall" ? "Uninstall" : "Apply these changes";
  if (!/^y(es)?$/i.test(await prompter.ask(`\n${verb}? [y/N]: `))) {
    say("Cancelled. Nothing was written.");
    return 1;
  }
  say(...describeResult(applyPlan({ manifest, plan, resolutions }), scanned, plan, flow === "uninstall"));
  return 0;
}

function withScan(manifest: Manifest, target: Target, homeDir: string) {
  return { target, scanned: scan(manifest, target, homeDir) };
}

async function askProject(manifest: Manifest, prompter: Prompter, say: (...lines: string[]) => void, env: { cwd: string; homeDir: string }) {
  for (;;) {
    const answer = await prompter.ask(`Project folder [${env.cwd}]: `, env.cwd);
    const folder = answer === "~" || answer.startsWith("~/") ? path.join(env.homeDir, answer.slice(1)) : path.resolve(env.cwd, answer);
    const result = withScan(manifest, projectTarget(folder), env.homeDir);
    if (!result.scanned.folderProblem) return result;
    say(`! ${result.scanned.folderProblem}`);
  }
}

/** Toggle loop over the AI tools; at least one must stay selected. */
async function pickTools(prompter: Prompter, say: (...lines: string[]) => void, start: ToolId[], scanned: ScanResult): Promise<ToolId[]> {
  let selected = [...start];
  const show = () =>
    say(
      "",
      "Which AI tools should the kit be installed for? ([x] = yes)",
      ...TOOL_PROFILES.map((tool, i) => {
        const where = scanned.tools.inProject.includes(tool.id) ? " (used in this project)" : scanned.tools.onMachine.includes(tool.id) ? " (installed on this machine)" : "";
        return `  [${selected.includes(tool.id) ? "x" : " "}] ${String(i + 1).padStart(2)}. ${tool.name}${where}`;
      }),
    );
  show();
  for (;;) {
    const answer = await prompter.ask("Type a number to toggle it, ?number to see what it gets, or press Enter to continue: ");
    if (answer === "") {
      if (selected.length > 0) return TOOL_PROFILES.map((t) => t.id).filter((id) => selected.includes(id));
      say("Choose at least one tool. \"Any other agent\" covers tools that read AGENTS.md.");
      continue;
    }
    const tool = TOOL_PROFILES[Number(answer.replace(/^\?/, "")) - 1];
    if (!tool) {
      say("That isn't one of the numbers above.");
      continue;
    }
    if (answer.startsWith("?")) {
      const capabilities = capabilitiesOf(tool);
      say("", tool.name, ...(Object.keys(CAPABILITY_LABELS) as (keyof ToolCapabilities)[]).map((kind) => `  ${CAPABILITY_LABELS[kind]}: ${capabilities[kind].detail}`));
      continue;
    }
    selected = selected.includes(tool.id) ? selected.filter((id) => id !== tool.id) : [...selected, tool.id];
    show();
  }
}

/** The commands the pre-commit check runs, starting from the ones found in the project's scripts. */
async function askChecks(prompter: Prompter, say: (...lines: string[]) => void, target: Target): Promise<string> {
  const suggested = suggestChecks(target);
  say("", 'Commands to run before each commit, one per line as "name: command". Finish with an empty line.');
  if (suggested) say("Suggested from your project's scripts (press Enter to keep):", ...suggested.trimEnd().split("\n").map((line) => `    ${line}`));
  return prompter.askLines("> ", suggested);
}

/** Toggle loop over the components, with explanations and the same dependency rules as the GUI. */
async function pickComponents(manifest: Manifest, prompter: Prompter, say: (...lines: string[]) => void, start: string[]): Promise<string[]> {
  let { selected, reasons } = resolveSelection(manifest, start);
  const nameOf = (id: string) => manifest.components.find((c) => c.id === id)?.name ?? id;
  const show = () =>
    say(
      "",
      "Components ([x] = will be installed):",
      ...manifest.components.map((c, i) => {
        const why = reasons[c.id]?.filter((r) => r !== "required").map(nameOf);
        const note = c.required ? " (always installed)" : why?.length ? ` (needed by ${why.join(", ")})` : "";
        return `  [${selected.includes(c.id) ? "x" : " "}] ${String(i + 1).padStart(2)}. ${c.name}: ${c.summary}${note}`;
      }),
    );

  show();
  for (;;) {
    const answer = await prompter.ask("Type a number to toggle it, ?number to explain it, or press Enter to continue: ");
    if (answer === "") break;
    const component = manifest.components[Number(answer.replace(/^\?/, "")) - 1];
    if (!component) {
      say("That isn't one of the numbers above.");
      continue;
    }
    if (answer.startsWith("?")) {
      const { what, when, example } = component.explanation;
      say("", component.name, `  What it is: ${what}`, `  When it's used: ${when}`, `  Example: ${example}`);
      if (component.dependsOn.length > 0) say(`  Also installs: ${component.dependsOn.map(nameOf).join(", ")}`);
      if (component.external.length > 0) say(`  Needs (not installed by this tool): ${component.external.join("; ")}`);
      continue;
    }
    const isSelected = selected.includes(component.id);
    const blockers = isSelected ? blockersFor(manifest, selected, component.id) : [];
    if (blockers.length > 0) {
      say(blockers.includes("required") ? `${component.name} is always installed.` : `${component.name} can't be removed while ${blockers.map(nameOf).join(", ")} ${blockers.length === 1 ? "is" : "are"} selected.`);
      continue;
    }
    ({ selected, reasons } = resolveSelection(manifest, isSelected ? selected.filter((id) => id !== component.id) : [...selected, component.id]));
    show();
  }
  return selected;
}

async function askProjectInfo(prompter: Prompter, say: (...lines: string[]) => void, target: Target, scanned: ScanResult): Promise<ProjectInfo | undefined> {
  if (hasProjectSection(target)) {
    say("", "Your CLAUDE.md/AGENTS.md already has a \"## Project Overview\" section, so no project questions. Edit it directly whenever you like.");
    return undefined;
  }
  const answer = await prompter.ask("\nDescribe your project for the agent now? It becomes the project section of AGENTS.md and stays yours. [y/N]: ");
  if (!/^y/i.test(answer)) return undefined;

  const suggestion = suggestProjectInfo(target, scanned.stack);
  const info: ProjectInfo = {};
  for (const [key, label, isMultiline] of PROJECT_FIELDS) {
    const suggested = suggestion[key] ?? "";
    if (!isMultiline) {
      info[key] = await prompter.ask(`${label}${suggested ? ` [${suggested}]` : ""}: `, suggested);
      continue;
    }
    say("", `${label}. Several lines are fine; finish with an empty line.`);
    if (suggested) say("Suggested from your project files (press Enter to keep):", ...suggested.split("\n").map((line) => `    ${line}`));
    info[key] = await prompter.askLines("> ", suggested);
  }
  return info;
}
