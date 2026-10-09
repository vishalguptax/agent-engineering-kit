import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { applyPlan } from "../core/apply.js";
import { CATEGORIES, INSTALLER_ROOT, KIT_ROOT } from "../core/manifest.js";
import { nextSteps } from "../core/next-steps.js";
import { CONFLICT_CHOICES, hasChanges, planInstall } from "../core/plan.js";
import { hasProjectSection, suggestProjectInfo } from "../core/project-info.js";
import { hashText } from "../core/record.js";
import { blockersFor, presetSelection, resolveSelection, suggestedComponents } from "../core/resolve.js";
import { scan } from "../core/scan.js";
import { globalTarget, projectTarget } from "../core/target.js";
import { suggestChecks } from "../core/checks.js";
import { readRecord } from "../core/record.js";
import { planUninstall } from "../core/uninstall.js";
import { capabilitiesOf } from "../tools/capabilities.js";
import { defaultTools } from "../tools/detect.js";
import { isToolId, TOOL_PROFILES } from "../tools/profiles.js";
import { openBrowser } from "./open-browser.js";
import { readRecent, rememberRecent } from "./recent.js";
const UI_DIR = path.join(INSTALLER_ROOT, "ui");
const STATIC_FILES = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/app.js": ["app.js", "text/javascript; charset=utf-8"],
    "/style.css": ["style.css", "text/css; charset=utf-8"],
};
const MAX_BODY_BYTES = 1024 * 1024;
/** The page sends a heartbeat every few seconds; without one for this long, the tab is gone. */
const HEARTBEAT_TIMEOUT_MS = 30_000;
/** After the tab says goodbye, wait this long for a reload before shutting down. */
const GOODBYE_GRACE_MS = 5_000;
class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
/** Starts the local GUI server on 127.0.0.1 with a random port and a random per-session token. */
export async function createGuiServer(manifest, { homeDir = os.homedir(), recentFile } = {}) {
    const token = randomBytes(32).toString("hex");
    let lastHeartbeat = null;
    let goodbyeTimer;
    let resolveClosed;
    const closed = new Promise((resolve) => (resolveClosed = resolve));
    const toTarget = (request) => {
        if (request.mode === "global")
            return globalTarget(homeDir);
        if (!request.path || !path.isAbsolute(request.path))
            throw new HttpError(400, "Enter the full path of the project folder.");
        return projectTarget(request.path);
    };
    const buildPlan = (request) => {
        const target = toTarget(request.target);
        if (request.uninstall)
            return planUninstall(manifest, target);
        const { selected } = resolveSelection(manifest, request.components);
        const tools = request.tools ?? defaultTools(target.mode, target.root, readRecord(target, manifest)?.tools);
        return planInstall({ manifest, target, selected, tools, projectInfo: request.projectInfo, checks: request.checks, homeDir });
    };
    const api = {
        "GET /api/manifest": () => ({
            manifest,
            categories: CATEGORIES,
            kitRoot: KIT_ROOT,
            homeDir,
            os: process.platform,
            tools: TOOL_PROFILES.map((tool) => ({ id: tool.id, name: tool.name, capabilities: capabilitiesOf(tool) })),
        }),
        "GET /api/recent": () => readRecent(recentFile),
        "GET /api/browse": (_body, url) => browse(url.searchParams.get("path") || homeDir),
        "POST /api/resolve": (body) => {
            const { selected, reasons } = resolveSelection(manifest, stringList(field(body, "components"), "components"));
            const blockers = Object.fromEntries(manifest.components.map((c) => [c.id, blockersFor(manifest, selected, c.id)]));
            return { selected, reasons, blockers };
        },
        "POST /api/scan": (body) => {
            const target = toTarget(targetRequest(field(body, "target")));
            const result = scan(manifest, target, homeDir);
            if (result.folderProblem)
                throw new HttpError(400, result.folderProblem);
            const suggested = suggestedComponents(manifest, result);
            return {
                scan: result,
                projectInfo: target.mode === "project" ? suggestProjectInfo(target, result.stack) : null,
                hasProjectSection: hasProjectSection(target),
                suggested,
                presets: Object.fromEntries(Object.keys(manifest.presets).map((preset) => [preset, presetSelection(manifest, preset, suggested)])),
                defaultTools: defaultTools(target.mode, target.root, result.record?.tools),
                suggestedChecks: target.mode === "project" ? suggestChecks(target) : "",
            };
        },
        "POST /api/plan": (body) => {
            const plan = buildPlan(planRequest(body));
            return { ...publicPlan(plan), fingerprint: fingerprint(plan) };
        },
        "POST /api/apply": (body) => {
            const request = planRequest(body);
            const plan = buildPlan(request);
            if (fingerprint(plan) !== field(body, "fingerprint")) {
                throw new HttpError(409, "Files changed since the preview was made. Review the updated preview before installing.");
            }
            const result = applyPlan({ manifest, plan, resolutions: resolutions(field(body, "resolutions")) });
            if (plan.target.mode === "project")
                rememberRecent(plan.target.root, recentFile);
            return { ...result, nextSteps: request.uninstall ? [] : nextSteps(scan(manifest, plan.target, homeDir), plan.selected, plan.tools) };
        },
        "POST /api/heartbeat": () => {
            lastHeartbeat = Date.now();
            clearTimeout(goodbyeTimer);
            return {};
        },
        "POST /api/done": () => {
            setImmediate(close);
            return {};
        },
    };
    const server = createServer((req, res) => {
        handle(req, res).catch((error) => {
            const status = error instanceof HttpError ? error.status : 400;
            sendJson(res, status, { error: error.message });
        });
    });
    const handle = async (req, res) => {
        const port = server.address().port;
        // Reject other Host headers so a malicious site can't reach us through DNS rebinding.
        if (req.headers.host !== `127.0.0.1:${port}`)
            throw new HttpError(403, "Forbidden host.");
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
        if (req.method === "GET" && STATIC_FILES[url.pathname]) {
            const [file, type] = STATIC_FILES[url.pathname];
            res.writeHead(200, { "Content-Type": type, ...SECURITY_HEADERS });
            res.end(readFileSync(path.join(UI_DIR, file)));
            return;
        }
        const body = req.method === "POST" ? await readJson(req) : undefined;
        if (url.pathname === "/api/goodbye") {
            // navigator.sendBeacon can't set headers, so this one route takes the token from the body.
            if (!isValidToken(token, field(body, "token")))
                throw new HttpError(403, "Missing or wrong session token.");
            goodbyeTimer = setTimeout(close, GOODBYE_GRACE_MS);
            return sendJson(res, 200, {});
        }
        const route = api[`${req.method} ${url.pathname}`];
        if (!route)
            throw new HttpError(404, "Not found.");
        if (!isValidToken(token, req.headers["x-kit-token"]))
            throw new HttpError(403, "Missing or wrong session token.");
        sendJson(res, 200, route(body, url));
    };
    const watchdog = setInterval(() => {
        if (lastHeartbeat !== null && Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT_MS)
            close();
    }, 5_000);
    watchdog.unref();
    function close() {
        clearInterval(watchdog);
        clearTimeout(goodbyeTimer);
        server.close(() => resolveClosed());
        server.closeAllConnections?.();
    }
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    return { server, url: `http://127.0.0.1:${port}/?token=${token}`, token, closed, close };
}
/** Runs the GUI until the user clicks Done or closes the tab. */
export async function startGui(manifest, { shouldOpenBrowser }) {
    const gui = await createGuiServer(manifest);
    console.log(`Agent Engineering Kit installer is running at:\n  ${gui.url}\n`);
    if (shouldOpenBrowser) {
        openBrowser(gui.url, () => console.log("Couldn't open a browser automatically; open the address above yourself."));
    }
    console.log("Click Done in the browser (or press Ctrl+C) to stop. No browser here? Stop and run with --terminal.");
    process.once("SIGINT", gui.close);
    await gui.closed;
    console.log("Installer closed.");
}
const SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
};
function sendJson(res, status, value) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify(value));
}
function isValidToken(expected, received) {
    if (typeof received !== "string" || received.length !== expected.length)
        return false;
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES)
            throw new HttpError(413, "Request too large.");
        chunks.push(chunk);
    }
    if (size === 0)
        return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    catch {
        throw new HttpError(400, "Request body is not valid JSON.");
    }
}
// Request validation: the API only accepts the shapes below; anything else is a 400.
function field(body, name) {
    return typeof body === "object" && body !== null ? body[name] : undefined;
}
function stringList(value, name) {
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
        throw new HttpError(400, `"${name}" must be a list of strings.`);
    return value;
}
function targetRequest(value) {
    const mode = field(value, "mode");
    const folder = field(value, "path");
    if (mode !== "project" && mode !== "global")
        throw new HttpError(400, 'target.mode must be "project" or "global".');
    if (folder !== undefined && typeof folder !== "string")
        throw new HttpError(400, "target.path must be a string.");
    return { mode, path: folder };
}
const PROJECT_INFO_FIELDS = ["overview", "stack", "commands", "keyDirs", "conventions", "doDont", "workflow", "notes"];
function planRequest(body) {
    const info = field(body, "projectInfo");
    let projectInfo;
    if (info !== undefined && info !== null) {
        projectInfo = {};
        for (const name of PROJECT_INFO_FIELDS) {
            const value = field(info, name);
            if (value !== undefined && typeof value !== "string")
                throw new HttpError(400, `projectInfo.${name} must be text.`);
            projectInfo[name] = value;
        }
    }
    return {
        target: targetRequest(field(body, "target")),
        components: stringList(field(body, "components") ?? [], "components"),
        tools: toolList(field(body, "tools")),
        projectInfo,
        checks: optionalText(field(body, "checks"), "checks"),
        uninstall: field(body, "uninstall") === true,
    };
}
function optionalText(value, name) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== "string")
        throw new HttpError(400, `${name} must be text.`);
    return value;
}
/** An optional list of tool ids; unknown ids are a 400. */
function toolList(value) {
    if (value === undefined)
        return undefined;
    const ids = stringList(value, "tools");
    const unknown = ids.filter((id) => !isToolId(id));
    if (unknown.length > 0)
        throw new HttpError(400, `Unknown tool(s): ${unknown.join(", ")}.`);
    return ids;
}
function resolutions(value) {
    if (value === undefined)
        return {};
    if (typeof value !== "object" || value === null)
        throw new HttpError(400, "resolutions must be an object.");
    for (const choice of Object.values(value)) {
        if (!CONFLICT_CHOICES.includes(choice))
            throw new HttpError(400, `Unknown conflict choice "${String(choice)}".`);
    }
    return value;
}
/** Sub-folders of `folder`, for the folder picker. Names only; file contents are never sent. */
function browse(folder) {
    const resolved = path.resolve(folder);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory())
        throw new HttpError(400, `${resolved} is not a folder.`);
    let dirs;
    try {
        dirs = readdirSync(resolved, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b));
    }
    catch {
        throw new HttpError(400, `Can't read ${resolved} (permission denied?).`);
    }
    const parent = path.dirname(resolved);
    return { path: resolved, parent: parent === resolved ? null : parent, dirs, separator: path.sep };
}
/** What the preview needs. Full file contents stay on the server; diffs are enough to review. */
function publicPlan(plan) {
    return {
        selected: plan.selected,
        blockers: plan.blockers,
        notes: plan.notes,
        tools: plan.tools,
        /** Conflicts count: the user picks per file on the preview. */
        hasWork: hasChanges(plan, () => false),
        actions: plan.actions.map(({ path: file, kind, componentIds, toolIds, summary, diff }) => ({ path: file, kind, componentIds, toolIds, summary, diff })),
    };
}
/** Identifies a plan's exact effect, so apply can refuse if files changed after the preview. */
function fingerprint(plan) {
    return hashText(JSON.stringify(plan.actions.map((a) => [a.path, a.kind, a.before, a.after])));
}
