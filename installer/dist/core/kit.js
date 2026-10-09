import { readFileSync } from "node:fs";
import path from "node:path";
import { KIT_ROOT } from "./manifest.js";
/** Reads a kit source file live from disk; in global mode applies the manifest's path rewrites. */
export function readKitFile(manifest, source, target, kitRoot = KIT_ROOT) {
    const text = readFileSync(path.join(kitRoot, ...source.split("/")), "utf8");
    return target.mode === "project" ? text : manifest.globalRewrites.reduce((acc, { from, to }) => acc.split(from).join(to), text);
}
