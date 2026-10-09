import { readFileSync } from "node:fs";
import path from "node:path";
import { KIT_ROOT, type Manifest } from "./manifest.js";
import type { Target } from "./target.js";

/** Reads a kit source file live from disk; in global mode applies the manifest's path rewrites. */
export function readKitFile(manifest: Manifest, source: string, target: Target, kitRoot = KIT_ROOT): string {
  const text = readFileSync(path.join(kitRoot, ...source.split("/")), "utf8");
  return target.mode === "project" ? text : manifest.globalRewrites.reduce((acc, { from, to }) => acc.split(from).join(to), text);
}
