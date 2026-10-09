import type { Manifest } from "./manifest.js";

export interface Selection {
  /** Component ids in manifest order. */
  selected: string[];
  /** For components that were added automatically: who needed them ("required" for required ones). */
  reasons: Record<string, string[]>;
}

/** A preset's components; `suggested` (from the scan) are added to the recommended preset only. */
export function presetSelection(manifest: Manifest, preset: string, suggested: string[] = []): string[] {
  const members = manifest.presets[preset];
  if (!members) {
    throw new Error(`Unknown preset "${preset}". Choose one of: ${Object.keys(manifest.presets).join(", ")}.`);
  }
  return resolveSelection(manifest, preset === "recommended" ? [...members, ...suggested] : members).selected;
}

/** Components worth pre-selecting for this project, e.g. the frontend reviewer when a frontend stack is found. */
export function suggestedComponents(manifest: Manifest, signals: { hasFrontend: boolean }): string[] {
  return manifest.components.filter((c) => c.suggestFor === "frontend" && signals.hasFrontend).map((c) => c.id);
}

/** Adds required components and all transitive dependencies of the requested ones. Renamed ids map to their new names. */
export function resolveSelection(manifest: Manifest, requestedIds: string[]): Selection {
  const byId = new Map(manifest.components.map((c) => [c.id, c]));
  const requested = [...new Set(requestedIds.map((id) => manifest.componentRenames[id] ?? id))];
  for (const id of requested) {
    if (!byId.has(id)) {
      throw new Error(`Unknown component "${id}". Known components: ${[...byId.keys()].join(", ")}.`);
    }
  }

  const chosen = new Set(requested);
  const reasons: Record<string, string[]> = {};
  const addReason = (id: string, why: string) => {
    if (chosen.has(id)) return;
    (reasons[id] ??= []).includes(why) || reasons[id].push(why);
  };

  const included = new Set<string>();
  const include = (id: string) => {
    if (included.has(id)) return;
    included.add(id);
    for (const dep of byId.get(id)!.dependsOn) {
      addReason(dep, id);
      include(dep);
    }
  };
  for (const c of manifest.components) {
    if (c.required) {
      addReason(c.id, "required");
      include(c.id);
    }
  }
  requested.forEach(include);

  return { selected: manifest.components.map((c) => c.id).filter((id) => included.has(id)), reasons };
}

/** Why `id` can't be unchecked: selected components that depend on it directly, or "required". */
export function blockersFor(manifest: Manifest, selected: string[], id: string): string[] {
  if (manifest.components.find((c) => c.id === id)?.required) return ["required"];
  return manifest.components.filter((c) => selected.includes(c.id) && c.dependsOn.includes(id)).map((c) => c.id);
}
