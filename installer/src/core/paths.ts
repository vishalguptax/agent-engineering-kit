import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export class PathSafetyError extends Error {}

/**
 * Resolves `rel` against `root` and guarantees the result stays inside `root`:
 * no `..` escapes, no absolute paths, no symlinked folders that lead outside,
 * and the target itself must not be a symlink (we never write through one).
 */
export function resolveInside(root: string, rel: string): string {
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    throw new PathSafetyError(`Refusing absolute path "${rel}"; only paths inside ${root} are allowed.`);
  }
  const realRoot = realpathAllowingMissing(root);
  const target = path.resolve(realRoot, rel);
  if (!isInside(realRoot, target)) {
    throw new PathSafetyError(`Refusing "${rel}": it resolves outside ${root}.`);
  }

  // The nearest existing folder on the way up. Above the root only when the root doesn't exist yet (a first global
  // install), and then nothing below it can be a symlink; inside the root, it must not lead outside.
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (isInside(realRoot, ancestor) && !isInside(realRoot, realpathSync(ancestor))) {
    throw new PathSafetyError(`Refusing "${rel}": ${ancestor} is a symlink that leads outside ${root}.`);
  }
  if (ancestor === target && lstatSync(target).isSymbolicLink()) {
    throw new PathSafetyError(`Refusing "${rel}": it is a symlink, and the installer never writes through symlinks.`);
  }
  return target;
}

/** realpath of `p`, where trailing parts that don't exist yet (e.g. a new ~/.claude) are kept as-is. */
function realpathAllowingMissing(p: string): string {
  const absolute = path.resolve(p);
  let existing = absolute;
  while (!existsSync(existing)) existing = path.dirname(existing);
  return path.join(realpathSync(existing), path.relative(existing, absolute));
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
