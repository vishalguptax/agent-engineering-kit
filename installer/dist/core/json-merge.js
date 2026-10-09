import { appendToArray, findJsonErrorOffset, insertIntoObject, lineAndColumn, rawValueAt, removeFromArray, removeFromObject, replaceValue, valueAt, } from "./json-edit.js";
export class JsonParseError extends Error {
}
export function parseJsonObject(text, label) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch (error) {
        throw new JsonParseError(`${label} is not valid JSON (${describeJsonError(text, error)}). ` +
            "Fix it by hand (or move it aside) and run the installer again; it will not overwrite a file it can't read.");
    }
    if (!isObject(value))
        throw new JsonParseError(`${label} must be a JSON object at the top level.`);
    return value;
}
/**
 * Applies `requested` to the file's text. `seed` is the starting object when the file doesn't exist yet
 * (e.g. Cursor's hooks.json needs `"version": 1` next to the hooks).
 */
export function mergeJson(existingText, requested, label = "settings.json", seed = {}) {
    const doc = existingText === null ? structuredClone(seed) : parseJsonObject(existingText, label);
    const added = { additions: [], createdKeys: [], coerced: [] };
    let text = existingText;
    for (const addition of requested) {
        const target = locate(doc, addition, label);
        const present = new Set(target.items.flatMap((item) => identitiesOf(item, addition.identity)));
        const missing = addition.items.flatMap((item) => missingPart(item, addition.identity, present));
        if (missing.length === 0)
            continue;
        const written = target.kind === "missing" ? [...(addition.whenMissing ?? []), ...missing] : missing;
        if (text !== null)
            text = editText(text, addition.path, target, written);
        applyToModel(doc, addition.path, target, written);
        added.additions.push({
            path: addition.path,
            items: missing,
            ...(addition.identity ? { identity: addition.identity } : {}),
            ...(target.kind === "missing" && addition.whenMissing ? { whenMissing: addition.whenMissing } : {}),
        });
        if (target.kind === "missing") {
            for (let depth = target.firstMissing; depth < addition.path.length; depth++) {
                added.createdKeys.push(addition.path.slice(0, depth + 1).join("."));
            }
        }
        if (target.kind === "scalar")
            added.coerced.push({ path: addition.path, original: target.items[0] });
    }
    const changed = added.additions.length > 0;
    if (existingText === null)
        return { text: `${JSON.stringify(doc, null, 2)}\n`, changed: true, added };
    return { text: text, changed, added };
}
/** Undoes `added` as text edits, keeping anything the user added since. */
export function unmergeJson(text, added, label = "settings.json") {
    parseJsonObject(text, label);
    let result = text;
    for (const addition of added.additions)
        result = removeAddition(result, addition);
    for (const { path, original } of added.coerced) {
        const value = valueAt(result, path);
        if (Array.isArray(value) && value.length === 1 && JSON.stringify(value[0]) === JSON.stringify(original)) {
            result = replaceValue(result, path, JSON.stringify(original));
        }
    }
    const onlyDefault = (key, value) => added.additions.some((a) => a.whenMissing && a.path.join(".") === key && JSON.stringify(a.whenMissing) === JSON.stringify(value));
    for (const key of [...added.createdKeys].reverse()) {
        const path = key.split(".");
        const value = valueAt(result, path);
        if (isEmpty(value) || onlyDefault(key, value))
            result = removeFromObject(result, path.slice(0, -1), path[path.length - 1]);
    }
    return result;
}
/** Finds the array at `path`, checking every step is an object. */
function locate(doc, addition, label) {
    let current = doc;
    for (let depth = 0; depth < addition.path.length; depth++) {
        const isLast = depth === addition.path.length - 1;
        const next = current[addition.path[depth]];
        const where = `"${addition.path.slice(0, depth + 1).join(".")}"`;
        if (next === undefined)
            return { kind: "missing", items: [], firstMissing: depth };
        if (!isLast) {
            if (!isObject(next))
                throw new JsonParseError(`${label}: ${where} is not an object, so it can't be merged.`);
            current = next;
            continue;
        }
        if (Array.isArray(next))
            return { kind: "array", items: next };
        if (addition.coerceScalar && ["string", "number", "boolean"].includes(typeof next))
            return { kind: "scalar", items: [next] };
        throw new JsonParseError(`${label}: ${where} is not an array, so it can't be merged.`);
    }
    throw new Error("An array addition needs a non-empty path.");
}
function editText(text, path, target, missing) {
    if (target.kind === "missing") {
        const value = path.slice(target.firstMissing + 1).reduceRight((inner, key) => ({ [key]: inner }), missing);
        return insertIntoObject(text, path.slice(0, target.firstMissing), path[target.firstMissing], value);
    }
    let result = target.kind === "scalar" ? replaceValue(text, path, `[${rawValueAt(text, path)}]`) : text;
    for (const item of missing)
        result = appendToArray(result, path, item);
    return result;
}
function applyToModel(doc, path, target, missing) {
    let current = doc;
    for (const key of path.slice(0, -1)) {
        current[key] ??= {};
        current = current[key];
    }
    const last = path[path.length - 1];
    current[last] = [...target.items, ...missing];
}
/** The identity strings of an item (several for `list.*.field`). */
function identitiesOf(item, identity) {
    if (!identity)
        return [JSON.stringify(item)];
    const [head, tail] = splitWildcard(identity);
    if (tail === null) {
        const value = getPath(item, head);
        return value === undefined ? [] : [JSON.stringify(value)];
    }
    const list = getPath(item, head);
    return Array.isArray(list) ? list.flatMap((entry) => identitiesOf(entry, tail)) : [];
}
/** The part of `item` that isn't present yet: nothing, the whole item, or (for `list.*.field`) a copy with only the missing entries. */
function missingPart(item, identity, present) {
    const [head, tail] = identity ? splitWildcard(identity) : ["", null];
    if (tail === null)
        return identitiesOf(item, identity).some((id) => present.has(id)) ? [] : [item];
    const list = getPath(item, head);
    if (!Array.isArray(list))
        return [item];
    const missingEntries = list.filter((entry) => !identitiesOf(entry, tail).some((id) => present.has(id)));
    if (missingEntries.length === 0)
        return [];
    return [missingEntries.length === list.length ? item : setPath(item, head, missingEntries)];
}
function removeAddition(text, addition) {
    const current = valueAt(text, addition.path);
    if (!Array.isArray(current))
        return text;
    const ours = new Set(addition.items.flatMap((item) => identitiesOf(item, addition.identity)));
    const [head, tail] = addition.identity ? splitWildcard(addition.identity) : ["", null];
    let result = text;
    for (let index = current.length - 1; index >= 0; index--) {
        const item = current[index];
        if (tail === null) {
            if (identitiesOf(item, addition.identity).some((id) => ours.has(id)))
                result = removeFromArray(result, addition.path, index);
            continue;
        }
        const list = getPath(item, head);
        if (!Array.isArray(list))
            continue;
        const ourEntries = list.flatMap((entry, i) => (identitiesOf(entry, tail).some((id) => ours.has(id)) ? [i] : []));
        if (ourEntries.length === 0)
            continue;
        if (ourEntries.length === list.length) {
            result = removeFromArray(result, addition.path, index);
        }
        else {
            const listPath = [...addition.path, String(index), ...head.split(".")];
            for (const i of ourEntries.reverse())
                result = removeFromArray(result, listPath.map(toPathStep), i);
        }
    }
    return result;
}
function splitWildcard(identity) {
    const at = identity.indexOf(".*.");
    return at === -1 ? [identity, null] : [identity.slice(0, at), identity.slice(at + 3)];
}
function getPath(value, dotPath) {
    return dotPath.split(".").reduce((acc, key) => (isObject(acc) ? acc[key] : undefined), value);
}
function setPath(value, dotPath, replacement) {
    const [key, ...rest] = dotPath.split(".");
    const object = value;
    return { ...object, [key]: rest.length === 0 ? replacement : setPath(object[key], rest.join("."), replacement) };
}
/** json-edit paths use numbers for array indexes. */
function toPathStep(step) {
    return /^\d+$/.test(step) ? Number(step) : step;
}
function describeJsonError(text, error) {
    const offset = findJsonErrorOffset(text);
    if (offset === null)
        return error instanceof Error ? error.message : String(error);
    const { line, column } = lineAndColumn(text, offset);
    return `line ${line}, column ${column}`;
}
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isEmpty(value) {
    return Array.isArray(value) ? value.length === 0 : isObject(value) && Object.keys(value).length === 0;
}
/** Two merges into the same file, recorded as one. */
export function combineAdded(a, b) {
    if (!a)
        return b;
    const additions = [...a.additions];
    for (const addition of b.additions) {
        const same = additions.findIndex((x) => samePath(x.path, addition.path) && x.identity === addition.identity);
        if (same === -1)
            additions.push(addition);
        else
            additions[same] = { ...additions[same], items: [...additions[same].items, ...addition.items] };
    }
    return {
        additions,
        createdKeys: [...new Set([...a.createdKeys, ...b.createdKeys])],
        coerced: [...a.coerced, ...b.coerced.filter((c) => !a.coerced.some((x) => samePath(x.path, c.path)))],
    };
}
/** What remains recorded after `removed` was unmerged. */
export function subtractAdded(a, removed) {
    const additions = a.additions.flatMap((addition) => {
        const gone = new Set(removed.additions
            .filter((r) => samePath(r.path, addition.path))
            .flatMap((r) => r.items.flatMap((item) => identitiesOf(item, r.identity))));
        const kept = addition.items.filter((item) => !identitiesOf(item, addition.identity).some((id) => gone.has(id)));
        return kept.length > 0 ? [{ ...addition, items: kept }] : [];
    });
    return {
        additions,
        createdKeys: a.createdKeys.filter((key) => !removed.createdKeys.includes(key)),
        coerced: a.coerced.filter((c) => !removed.coerced.some((x) => samePath(x.path, c.path))),
    };
}
function samePath(a, b) {
    return a.length === b.length && a.every((step, i) => step === b[i]);
}
/**
 * The part of what was recorded as added that the kit no longer wants (e.g. a hook entry from an older kit
 * version, or deny rules after the secret guard was deselected). Unmerging it removes exactly that.
 */
export function staleAdded(recorded, desired) {
    const wantedAt = (path) => desired.filter((d) => samePath(d.path, path));
    const additions = recorded.additions.flatMap((addition) => {
        const wanted = new Set(wantedAt(addition.path).flatMap((d) => d.items.flatMap((item) => identitiesOf(item, d.identity))));
        const stale = addition.items.filter((item) => !identitiesOf(item, addition.identity).some((id) => wanted.has(id)));
        return stale.length > 0 ? [{ ...addition, items: stale }] : [];
    });
    const isStillNeeded = (key) => desired.some((d) => d.path.join(".") === key || d.path.join(".").startsWith(`${key}.`));
    return {
        additions,
        createdKeys: recorded.createdKeys.filter((key) => !isStillNeeded(key)),
        coerced: recorded.coerced.filter((c) => wantedAt(c.path).length === 0),
    };
}
/**
 * Whether a recorded `JsonAdded` (from the untrusted install record) only names entries the kit itself writes.
 * Without this check a forged record could make "remove the kit's entries" remove the user's own.
 */
export function isKnownAdded(value, known) {
    if (!isObject(value) || !Array.isArray(value.additions) || !isStringArray(value.createdKeys) || !Array.isArray(value.coerced))
        return false;
    const knownAt = (path, identity) => isStringArray(path) ? known.filter((k) => samePath(k.path, path) && k.identity === identity) : [];
    const additionsOk = value.additions.every((addition) => {
        if (!isObject(addition) || !Array.isArray(addition.items) || (addition.identity !== undefined && typeof addition.identity !== "string"))
            return false;
        const matches = knownAt(addition.path, addition.identity);
        const allowed = new Set(matches.flatMap((k) => k.items.flatMap((item) => identitiesOf(item, k.identity))));
        const isKnownDefault = addition.whenMissing === undefined || matches.some((k) => JSON.stringify(k.whenMissing) === JSON.stringify(addition.whenMissing));
        const identity = addition.identity;
        return matches.length > 0 && isKnownDefault && addition.items.every((item) => {
            const ids = identitiesOf(item, identity);
            return ids.length > 0 && ids.every((id) => allowed.has(id));
        });
    });
    const keysOk = value.createdKeys.every((key) => known.some((k) => k.path.join(".") === key || k.path.join(".").startsWith(`${key}.`)));
    const coercedOk = value.coerced.every((c) => isObject(c) && known.some((k) => k.coerceScalar && isStringArray(c.path) && samePath(k.path, c.path)));
    return additionsOk && keysOk && coercedOk;
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((v) => typeof v === "string");
}
export function isEmptyAdded(added) {
    return added.additions.length === 0 && added.createdKeys.length === 0 && added.coerced.length === 0;
}
