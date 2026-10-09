import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** installer/ (this file lives in installer/src/core or installer/dist/core). */
export const INSTALLER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The installable kit content: <repo>/kit. Its files are read live at runtime, so edits show up immediately. */
export const KIT_ROOT = path.join(path.dirname(INSTALLER_ROOT), "kit");

/** Component categories, in the order the installer and docs show them. */
export const CATEGORIES = ["Rules", "Project instructions", "Agents", "Workflows/Skills", "Hooks & Safety"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * What a component installs, independent of any tool. Where each artifact goes, and in which format,
 * is decided per selected tool by src/core/layout.ts using the tool profiles.
 */
export type Artifact =
  | { kind: "rulebook"; source: string }
  | { kind: "template"; source: string }
  | { kind: "instructions"; source: string }
  | { kind: "skill"; name: string }
  | { kind: "agent"; name: string }
  | { kind: "format-hook"; source: string }
  | { kind: "secret-guard" }
  | { kind: "checks"; source: string };

export interface Component {
  id: string;
  name: string;
  category: Category;
  summary: string;
  explanation: { what: string; when: string; example: string };
  artifacts: Artifact[];
  dependsOn: string[];
  external: string[];
  required: boolean;
  /** Pre-select in the recommended preset when the scan finds this kind of project. */
  suggestFor?: SuggestSignal;
}

export type SuggestSignal = "frontend";
const SUGGEST_SIGNALS: SuggestSignal[] = ["frontend"];

export interface Manifest {
  kitVersion: string;
  ignore: string[];
  /** Global (~/.claude) installs only: project-relative paths in kit text rewritten to point into ~/.claude. */
  globalRewrites: { from: string; to: string }[];
  /** Old component ids (from earlier kit versions' install records) and their current names. */
  componentRenames: Record<string, string>;
  /** Skill names earlier kit versions installed: still valid in install records, so Update can remove them. */
  retiredSkills: string[];
  presets: Record<string, string[]>;
  components: Component[];
}

/** The kit files an artifact is built from, relative to kit/. */
export function artifactSources(artifact: Artifact): string[] {
  switch (artifact.kind) {
    case "skill":
      return [`skills/${artifact.name}/SKILL.md`];
    case "agent":
      return [`agents/${artifact.name}.md`];
    case "secret-guard":
      return [];
    default:
      return [artifact.source];
  }
}

const MANIFEST_PATH = path.join(INSTALLER_ROOT, "kit.manifest.json");

export function loadManifest(manifestPath = MANIFEST_PATH): Manifest {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const problems = validateManifest(manifest);
  if (problems.length > 0) {
    throw new Error(`Invalid ${path.basename(manifestPath)}:\n- ${problems.join("\n- ")}`);
  }
  return manifest;
}

/** Returns human-readable problems; empty means valid. */
export function validateManifest(manifest: Manifest): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const component of manifest.components) {
    if (ids.has(component.id)) problems.push(`duplicate id "${component.id}"`);
    ids.add(component.id);
  }
  const skillNames = new Set(manifest.components.flatMap((c) => c.artifacts.flatMap((a) => (a.kind === "skill" ? [a.name] : []))));
  for (const name of manifest.retiredSkills) {
    if (skillNames.has(name)) problems.push(`retired skill "${name}" is still a current skill`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) problems.push(`retired skill "${name}" isn't a valid skill name`);
  }
  for (const component of manifest.components) {
    if (component.suggestFor !== undefined && !SUGGEST_SIGNALS.includes(component.suggestFor)) {
      problems.push(`"${component.id}": suggestFor must be one of ${SUGGEST_SIGNALS.join(", ")}`);
    }
    for (const dep of component.dependsOn) {
      if (!ids.has(dep)) problems.push(`"${component.id}" depends on unknown component "${dep}"`);
    }
    for (const artifact of component.artifacts) {
      for (const source of artifactSources(artifact)) {
        if (!isSafeRelativePath(source)) problems.push(`"${component.id}": source "${source}" must be a relative path inside the kit`);
      }
      if ((artifact.kind === "skill" || artifact.kind === "agent") && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(artifact.name)) {
        problems.push(`"${component.id}": ${artifact.kind} name "${artifact.name}" must be lowercase letters, digits and hyphens`);
      }
    }
  }
  for (const [preset, members] of Object.entries(manifest.presets)) {
    for (const id of members) {
      if (!ids.has(id)) problems.push(`preset "${preset}" references unknown component "${id}"`);
    }
  }
  const cycle = findCycle(manifest.components);
  if (cycle) problems.push(`dependency cycle: ${cycle.join(" → ")}`);
  return problems;
}

function isSafeRelativePath(p: string): boolean {
  if (p === "" || path.isAbsolute(p) || /^[a-zA-Z]:/.test(p)) return false;
  return !p.split(/[\\/]/).includes("..");
}

function findCycle(components: Component[]): string[] | null {
  const byId = new Map(components.map((c) => [c.id, c]));
  const done = new Set<string>();
  const visit = (id: string, trail: string[]): string[] | null => {
    if (trail.includes(id)) return [...trail.slice(trail.indexOf(id)), id];
    if (done.has(id)) return null;
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      const cycle = visit(dep, [...trail, id]);
      if (cycle) return cycle;
    }
    done.add(id);
    return null;
  };
  for (const c of components) {
    const cycle = visit(c.id, []);
    if (cycle) return cycle;
  }
  return null;
}

/** All files in the kit (POSIX-style relative paths) that are not matched by manifest.ignore. */
export function listKitFiles(manifest: Manifest, kitRoot = KIT_ROOT): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(kitRoot, abs).split(path.sep).join("/");
      if (matchesAny(rel, manifest.ignore) || entry.name === "node_modules") continue;
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) files.push(rel);
    }
  };
  walk(kitRoot);
  return files.sort();
}

/** Minimal glob support for the ignore list: exact paths, "dir/**", and "**\/name". */
function matchesAny(rel: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.startsWith("**/")) return path.posix.basename(rel) === pattern.slice(3);
    if (pattern.endsWith("/**")) {
      const dir = pattern.slice(0, -3);
      return rel === dir || rel.startsWith(`${dir}/`);
    }
    return rel === pattern;
  });
}
