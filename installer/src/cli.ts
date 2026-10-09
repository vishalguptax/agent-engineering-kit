import { readFileSync } from "node:fs";
import type { CliOptions } from "./args.js";
import { applyPlan } from "./core/apply.js";
import type { Manifest } from "./core/manifest.js";
import { hasChanges, planInstall, type Plan } from "./core/plan.js";
import { presetSelection, resolveSelection, suggestedComponents } from "./core/resolve.js";
import { scan, type ScanResult } from "./core/scan.js";
import { globalTarget, projectTarget } from "./core/target.js";
import { planUninstall } from "./core/uninstall.js";
import { defaultTools } from "./tools/detect.js";
import { createPrompter, describePlan, describeResult, describeScan } from "./terminal.js";

/** Non-interactive (flag-driven) mode. Returns the process exit code. */
export async function runCli(manifest: Manifest, options: CliOptions): Promise<number> {
  const target = options.isGlobal ? globalTarget() : projectTarget(options.target!);
  const scanned = scan(manifest, target);
  if (scanned.folderProblem) return fail(scanned.folderProblem);
  if (scanned.recordProblem) return fail(scanned.recordProblem);
  print(describeScan(scanned));

  let plan: Plan;
  if (options.isUninstall) {
    plan = planUninstall(manifest, target);
  } else {
    const { selected, reasons } = resolveSelection(manifest, chooseComponents(manifest, options, scanned));
    for (const [id, why] of Object.entries(reasons)) {
      if (!why.includes("required")) console.log(`  + ${id} (needed by ${why.join(", ")})`);
    }
    const projectInfo = options.projectInfoFile ? { markdown: readFileSync(options.projectInfoFile, "utf8") } : undefined;
    const tools = options.tools ?? defaultTools(target.mode, target.root, scanned.record?.tools);
    plan = planInstall({ manifest, target, selected, tools, projectInfo });
  }

  print(describePlan(plan, () => ` [${options.onConflict}]`));
  if (plan.blockers.length > 0) return fail(`Stopped before changing anything:\n- ${plan.blockers.join("\n- ")}`);
  if (!hasChanges(plan, () => options.onConflict === "keep")) {
    console.log("\nNothing to change: everything is already in place.");
    return 0;
  }
  if (options.isDryRun) {
    console.log("\nDry run: nothing was written.");
    return 0;
  }
  if (!options.isYes && !(await confirm("\nApply these changes? [y/N] "))) {
    console.log("Cancelled. Nothing was written.");
    return 1;
  }

  const resolutions = Object.fromEntries(plan.actions.filter((a) => a.kind === "CONFLICT").map((a) => [a.path, options.onConflict]));
  const result = applyPlan({ manifest, plan, resolutions });
  print(describeResult(result, scanned, plan, options.isUninstall));
  return 0;
}

/** Explicit choice first; otherwise update what's installed; otherwise the recommended preset. */
function chooseComponents(manifest: Manifest, options: CliOptions, scanned: ScanResult): string[] {
  if (options.components) return options.components;
  const suggested = suggestedComponents(manifest, scanned);
  if (options.preset) return presetSelection(manifest, options.preset, suggested);
  return scanned.record?.components ?? presetSelection(manifest, "recommended", suggested);
}

async function confirm(question: string): Promise<boolean> {
  const prompter = createPrompter(process.stdin, process.stdout);
  try {
    return /^y(es)?$/i.test(await prompter.ask(question));
  } finally {
    prompter.close();
  }
}

function print(lines: string[]) {
  console.log(lines.join("\n"));
}

function fail(message: string): number {
  console.error(`\nError: ${message}`);
  return 1;
}
