import { eolOf } from "./json-edit.js";
const MARKER_NAME = "agent-engineering-kit";
export function markersFor(style) {
    return style === "html"
        ? { start: `<!-- ${MARKER_NAME}:start -->`, end: `<!-- ${MARKER_NAME}:end -->` }
        : { start: `# ${MARKER_NAME}:start`, end: `# ${MARKER_NAME}:end` };
}
/**
 * Puts `content` between the kit's markers: replaces an existing block, or appends one after a blank line.
 * Keeps the file's line endings.
 */
export function upsertBlock(existing, content, style = "html") {
    const { start, end } = markersFor(style);
    const eol = eolOf(existing ?? "");
    const block = [start, ...content.replace(/\r\n/g, "\n").trimEnd().split("\n"), end, ""].join(eol);
    if (existing === null)
        return { text: block, changed: true };
    const found = findBlock(existing, style);
    if (found) {
        const text = existing.slice(0, found.start) + block + existing.slice(found.end);
        return { text, changed: text !== existing };
    }
    const separator = existing.endsWith(eol) ? eol : eol + eol;
    return { text: existing + separator + block, changed: true };
}
/** Removes the kit's block and the blank line that was added in front of it. */
export function removeBlock(text, style = "html") {
    const found = findBlock(text, style);
    if (!found)
        return { text, found: false };
    const eol = eolOf(text);
    let start = found.start;
    if (text.slice(0, start).endsWith(eol + eol))
        start -= eol.length;
    return { text: text.slice(0, start) + text.slice(found.end), found: true };
}
/** Adds `section` just before the kit's block, or at the end (after a blank line) if there is no block yet. */
export function insertBeforeBlock(text, section, style = "html") {
    const eol = eolOf(text);
    const normalized = section.replace(/\r?\n/g, eol);
    const found = findBlock(text, style);
    if (found)
        return text.slice(0, found.start) + normalized + eol + text.slice(found.start);
    return text + (text.endsWith(eol) ? eol : eol + eol) + normalized;
}
export function hasBlock(text, style = "html") {
    return findBlock(text, style) !== null;
}
/** Locates the block including the line break after the end marker. Throws if the markers are damaged. */
function findBlock(text, style) {
    const { start: startMarker, end: endMarker } = markersFor(style);
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker);
    if (start === -1 && end === -1)
        return null;
    if (start === -1 || end === -1 || end < start || text.indexOf(startMarker, start + 1) !== -1) {
        throw new Error(`The ${MARKER_NAME} markers in this file are incomplete or out of order. ` +
            `Make sure there is exactly one "${startMarker}" followed by one "${endMarker}", then run the installer again.`);
    }
    let blockEnd = end + endMarker.length;
    if (text.startsWith("\r\n", blockEnd))
        blockEnd += 2;
    else if (text.startsWith("\n", blockEnd))
        blockEnd += 1;
    return { start, end: blockEnd };
}
