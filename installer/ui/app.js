// Agent Engineering Kit installer UI. Plain DOM; every piece of data is inserted with textContent, never as HTML.

const STEPS = [
  ["welcome", "Welcome"],
  ["target", "Target"],
  ["scan", "Scan"],
  ["tools", "AI tools"],
  ["components", "Components"],
  ["project", "About your project"],
  ["preview", "Preview"],
  ["done", "Done"],
];
const DIFF_KINDS = new Set(["MERGE", "APPEND", "CONFLICT", "UPDATE", "REMOVE"]);
const CAPABILITY_KINDS = [
  ["rules", "Rules"],
  ["skills", "Skills"],
  ["agents", "Agents"],
  ["format", "Format"],
  ["secretGuard", "Secrets"],
];
const CAPABILITY_MARKS = { yes: "✓", reference: "ref", note: "note", none: "—" };
const PROJECT_FIELDS = [
  ["overview", "What does this project do?", "One or two lines, in plain words.", false],
  ["stack", "Tech stack", "Pre-filled from your project files. Fix anything that's wrong.", false],
  ["commands", "Commands", "How to install, run, test, lint and build. Pre-filled from package.json / Makefile.", true],
  ["keyDirs", "Key folders", "Where the important code lives, e.g. src/api: HTTP handlers.", true],
  ["conventions", "Conventions", "Naming, error handling, state, styling, testing: whatever the agent should copy.", true],
  ["doDont", "Do / Don't", "Hard rules and lessons learned, e.g. \"Never edit generated files in gen/\".", true],
  ["workflow", "Workflow preferences", "Optional. How the feature, quick-fix and ship skills should work here, e.g. \"Plans in planning/\", \"No tests for scripts/: run them instead\". Blank keeps the kit's defaults.", true],
  ["notes", "Anything else the agent should know", "Domain terms, gotchas, people to ask, links. Free-form Markdown.", true],
];

const token = new URLSearchParams(location.search).get("token") ?? sessionStorage.getItem("kit-token");
sessionStorage.setItem("kit-token", token ?? "");
history.replaceState(null, "", "/");

const state = {
  step: "welcome",
  manifest: null,
  homeDir: "",
  os: "",
  kitRoot: "",
  recent: [],
  target: { mode: "project", path: "" },
  browser: null,
  scan: null,
  suggestion: null,
  hasProjectSection: false,
  suggested: [],
  presets: {},
  categories: [],
  toolsInfo: [],
  tools: [],
  suggestedChecks: "",
  checks: null,
  flow: "install",
  resolved: { selected: [], reasons: {}, blockers: {} },
  projectInfo: null,
  useProjectInfo: false,
  plan: null,
  resolutions: {},
  result: null,
  error: null,
  busy: false,
  isClosed: false,
};

// ---------- helpers ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && typeof value !== "string") node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { "x-kit-token": token, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.error || `Request failed (${res.status}).`);
    error.status = res.status;
    throw error;
  }
  return json;
}

/** Runs an async action with the UI locked and errors shown at the top of the page. */
async function run(task) {
  state.busy = true;
  state.error = null;
  render();
  try {
    await task();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

function go(step) {
  state.step = step;
  state.error = null;
  render();
  window.scrollTo(0, 0);
}

function componentName(id) {
  return state.manifest.components.find((c) => c.id === id)?.name ?? id;
}

function targetLabel() {
  return state.target.mode === "global" ? `${state.homeDir}/.claude (global)` : state.target.path;
}

function wantsProjectStep() {
  const { selected } = state.resolved;
  return state.flow === "install" && state.target.mode === "project" && (selected.includes("instructions") || selected.includes("checks"));
}

function toolName(id) {
  return state.toolsInfo.find((t) => t.id === id)?.name ?? id;
}

/** "§03 · Scan" label above each page's headline. */
function kicker() {
  const visible = visibleSteps();
  const index = visible.findIndex(([id]) => id === state.step);
  return el("p", { class: "kicker", text: `§${String(index + 1).padStart(2, "0")} · ${visible[index][1]}` });
}

function button(label, onClick, variant = "", extra = {}) {
  return el("button", { class: `btn ${variant}`.trim(), type: "button", onClick, disabled: state.busy, ...extra }, label);
}

// ---------- rendering ----------

function render() {
  renderSteps();
  const app = document.getElementById("app");
  const views = { welcome, target, scan: scanView, tools, components, project, preview, done };
  app.replaceChildren(...[state.error && el("div", { class: "notice error", role: "alert" }, state.error), views[state.step]()].filter(Boolean));
}

function visibleSteps() {
  return STEPS.filter(([id]) => {
    if (id === "components") return state.flow === "install";
    if (id === "tools") return state.flow === "install" && state.target.mode === "project";
    if (id === "project") return wantsProjectStep() || state.step === "project";
    return true;
  });
}

function renderSteps() {
  const current = STEPS.findIndex(([id]) => id === state.step);
  const visible = visibleSteps();
  document.getElementById("steps").replaceChildren(
    ...visible.map(([id, label]) => {
      const index = STEPS.findIndex(([s]) => s === id);
      return el("li", { class: index < current ? "done" : "", "aria-current": index === current ? "step" : null }, label);
    }),
  );
}

const KIT_CONTENTS = [
  ["Rulebook", "Plan first, keep it simple, make surgical changes, verify before saying \"done\"."],
  ["Agents", "Explore, design, verify, simplify, and review for tests, silent failures, security and UI."],
  ["Workflows", "Feature, fix, verify, ship and learn skills, plus a stack detector."],
  ["Safety", "Formats every edit, keeps agents out of your .env files, and can check every commit."],
];

function welcome() {
  return el(
    "section",
    {},
    kicker(),
    el("h1", {}, "Make your AI agents write code you'd ", el("em", { text: "actually" }), " want to maintain."),
    el(
      "div",
      { class: "lede" },
      el("p", { text: "Coding agents are fast, but left alone they guess APIs, sprawl across files and call untested work \"done\". This kit gives Claude Code, Codex, Cursor, Copilot and the rest the same habits of a careful senior engineer." }),
    ),
    el("ul", { class: "contents" }, KIT_CONTENTS.map(([title, text]) => el("li", {}, el("strong", { text: title }), el("span", { text })))),
    el(
      "div",
      { class: "promise" },
      el("span", { class: "stamp", "aria-hidden": "true", text: "NO SLOP" }),
      el("p", { text: "You choose exactly what to install and see every change before anything is written. Nothing of yours is overwritten without asking, changed files are backed up, and uninstall is clean." }),
    ),
    el("p", { class: "muted small source" }, "Reading kit files live from ", el("span", { class: "path", text: state.kitRoot })),
    el("div", { class: "actions" }, button("Get started", () => go("target"), "primary")),
  );
}

function target() {
  const isProject = state.target.mode === "project";
  const choice = (mode, title, detail) =>
    el(
      "label",
      { class: "choice" },
      el("input", {
        type: "radio",
        name: "mode",
        checked: state.target.mode === mode,
        onChange: () => {
          state.target.mode = mode;
          render();
        },
      }),
      el("span", {}, el("strong", { text: title }), el("span", { class: "muted small", text: detail })),
    );

  const pathInput = el("input", {
    type: "text",
    id: "target-path",
    value: state.target.path,
    placeholder: state.os === "win32" ? "C:\\Users\\you\\projects\\my-app" : `${state.homeDir}/projects/my-app`,
    spellcheck: false,
    onInput: (e) => (state.target.path = e.target.value),
    onKeydown: (e) => e.key === "Enter" && scanTarget(),
  });

  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: "Where should the kit go?" }),
    el(
      "div",
      { class: "choices", role: "radiogroup" },
      choice("project", "An existing project", "Installs into the project's folder. Commit it so your team shares it."),
      choice("global", "Global: ~/.claude", "Claude Code only: applies to all your projects on this computer. Project files win on name clashes. For other tools, install per project."),
    ),
    isProject &&
      el(
        "div",
        {},
        el("label", { class: "field", for: "target-path" }, "Project folder"),
        el("div", { class: "row" }, pathInput, button("Browse…", () => openBrowser(state.target.path || state.homeDir))),
        state.browser && folderBrowser(),
        state.recent.length > 0 &&
          el(
            "div",
            { class: "recent" },
            el("h2", { text: "Recent" }),
            el("ul", { class: "plain" }, state.recent.map((p) => el("li", {}, el("button", { class: "link path", type: "button", onClick: () => { state.target.path = p; scanTarget(); } }, p)))),
          ),
      ),
    el("div", { class: "actions" }, button("Back", () => go("welcome")), button("Scan folder", scanTarget, "primary")),
  );
}

function folderBrowser() {
  const { path, parent, dirs, separator } = state.browser;
  return el(
    "div",
    { class: "browser card" },
    el("div", { class: "row" }, el("span", { class: "path", text: path })),
    el(
      "div",
      { class: "actions inline" },
      parent && button("Up one level", () => openBrowser(parent), "small"),
      button("Use this folder", () => { state.target.path = path; state.browser = null; render(); }, "primary small"),
      button("Close", () => { state.browser = null; render(); }, "small"),
    ),
    dirs.length === 0
      ? el("p", { class: "muted small empty", text: "No sub-folders." })
      : el("ul", {}, dirs.map((name) => el("li", {}, el("button", { type: "button", onClick: () => openBrowser(path.endsWith(separator) ? path + name : path + separator + name) }, `${name}${separator}`)))),
  );
}

function openBrowser(path) {
  run(async () => {
    state.browser = await api("GET", `/api/browse?path=${encodeURIComponent(path)}`);
  });
}

function scanTarget() {
  if (state.target.mode === "project" && !state.target.path.trim()) {
    state.error = "Enter or browse to the project folder first.";
    render();
    return;
  }
  run(async () => {
    state.target.path = state.target.path.trim();
    const result = await api("POST", "/api/scan", { target: state.target });
    state.scan = result.scan;
    state.suggestion = result.projectInfo;
    state.hasProjectSection = result.hasProjectSection;
    state.suggested = result.suggested;
    state.presets = result.presets;
    state.tools = result.defaultTools;
    state.suggestedChecks = result.suggestedChecks;
    state.checks = null;
    state.projectInfo = null;
    state.plan = null;
    state.browser = null;
    go("scan");
  });
}

function scanView() {
  const s = state.scan;
  const has = (value) => [value ? "yes" : "no", value ? "found" : "not found"];
  const list = (items) => [items.length ? "yes" : "no", items.length ? items.join(", ") : "none"];
  const rows = [
    [".claude/", has(s.found.claudeDir)],
    [".claude/settings.json", s.settingsProblem ? ["bad", "found, but it isn't valid JSON"] : has(s.found.settingsJson)],
    ["Claude skills", list(s.found.skills)],
    ["Claude agents", list(s.found.agents)],
    ["CLAUDE.md", has(s.found.claudeMd)],
  ];
  if (s.target.mode === "project") {
    rows.push(["AGENTS.md", has(s.found.agentsMd)], ["Glossary", [s.found.glossary ? "yes" : "no", s.found.glossary ?? "not found (GLOSSARY.md)"]], ["docs/", has(s.found.docsDir)]);
    const git = !s.git ? ["no", "git not available"] : !s.git.isRepo ? ["no", "not a git repository"] : s.git.uncommittedChanges ? ["bad", `${s.git.uncommittedChanges} uncommitted change(s)`] : ["yes", "clean working tree"];
    rows.push(["Git", git], ["Stack", list(s.stack)]);
    rows.push(["AI tools", list(s.tools.inProject.map(toolName))]);
  }
  rows.push(["Matt's skills", s.mattSkills.isDetected ? ["yes", `found (${s.mattSkills.evidence.join("; ")})`] : ["no", "not found; you'll get the install command at the end"]]);
  rows.push(["This kit", s.record ? ["yes", `installed (v${s.record.kitVersion}, ${new Date(s.record.updatedAt).toLocaleString()})`] : ["no", "not installed yet"]]);

  const warnings = [];
  if (s.recordProblem) warnings.push(el("div", { class: "notice error", role: "alert", text: s.recordProblem }));
  if (s.settingsProblem) warnings.push(el("div", { class: "notice error" }, el("p", { text: s.settingsProblem }), el("p", { text: "The install stops at the preview until it's fixed, or until you deselect the parts that change it (for Claude Code: the auto-format hook and secret guard)." })));
  if (s.git?.uncommittedChanges) warnings.push(el("div", { class: "notice warn", text: "This repo has uncommitted changes. Committing or stashing first makes the install easy to review with git diff and easy to undo." }));

  const startInstall = (components) =>
    run(async () => {
      state.flow = "install";
      await resolve(components);
      go(state.target.mode === "project" ? "tools" : "components");
    });

  const manage = s.record
    ? el(
        "div",
        {},
        el("h2", { text: "The kit is already installed here" }),
        el("p", { class: "muted", text: `Installed components: ${s.record.components.map(componentName).join(", ")}.` }),
        el(
          "div",
          { class: "actions inline" },
          button("Update to the current kit", () => run(async () => { state.flow = "install"; await resolve(s.record.components); await makePlan(); go("preview"); }), "primary"),
          button("Add or remove components or tools", () => startInstall(s.record.components)),
          button("Uninstall…", () => run(async () => { state.flow = "uninstall"; await makePlan(); go("preview"); }), "danger"),
        ),
      )
    : null;

  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: "Here's what's already there" }),
    el("p", { class: "path path-line", text: targetLabel() }),
    el("dl", { class: "findings card" }, rows.flatMap(([k, [status, v]]) => [el("dt", { text: k }), el("dd", { class: status, text: v })])),
    warnings,
    manage,
    el("div", { class: "actions" }, button("Back", () => go("target")), !s.record && button(s.target.mode === "project" ? "Choose AI tools" : "Choose components", () => startInstall(presetIds("recommended")), "primary")),
  );
}

function tools() {
  const { inProject, onMachine } = state.scan.tools;
  const toggle = (id, isChecked) => {
    state.tools = isChecked ? [...state.tools, id] : state.tools.filter((t) => t !== id);
    render();
  };
  const card = (tool) => {
    const id = `tool-${tool.id}`;
    const stamp = inProject.includes(tool.id) ? "used here" : onMachine.includes(tool.id) ? "installed" : null;
    return el(
      "div",
      { class: "tool-card" },
      el(
        "label",
        { class: "tool-head", for: id },
        el("input", { type: "checkbox", id, checked: state.tools.includes(tool.id), disabled: state.busy, onChange: (e) => toggle(tool.id, e.target.checked) }),
        el("strong", { text: tool.name }),
        stamp && el("span", { class: "tool-stamp", text: stamp }),
      ),
      el(
        "ul",
        { class: "caps", "aria-label": `What ${tool.name} gets` },
        CAPABILITY_KINDS.map(([kind, label]) =>
          el("li", { class: `cap ${tool.capabilities[kind].state}`, title: tool.capabilities[kind].detail }, el("span", { class: "cap-mark", text: CAPABILITY_MARKS[tool.capabilities[kind].state] }), ` ${label}`),
        ),
      ),
      el(
        "details",
        {},
        el("summary", { text: "What it gets" }),
        el("dl", { class: "explain" }, CAPABILITY_KINDS.flatMap(([kind, label]) => [el("dt", { text: label }), el("dd", { text: tool.capabilities[kind].detail })])),
      ),
    );
  };
  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: "Which AI tools does your team use?" }),
    el("p", { class: "lede", text: "The kit is written once and installed in each tool's own format. Tools this project already uses are selected; pick any others your team uses." }),
    el("p", { class: "muted small", text: "✓ installed · ref: the tool has no sub-agents, so skills point it to instruction files · note: can't be set from the repo, you'll get steps · — not supported by the tool" }),
    el("div", { class: "tool-grid" }, state.toolsInfo.map(card)),
    el(
      "div",
      { class: "actions" },
      button("Back", () => go("scan")),
      button("Choose components", () => go("components"), "primary", { disabled: state.busy || state.tools.length === 0 }),
    ),
  );
}

/** Which selected tools get a component, and how, in one line per tool group. */
function deliveryLines(component) {
  const selected = state.toolsInfo.filter((t) => state.tools.includes(t.id));
  if (state.target.mode === "global") return ["Claude Code (global ~/.claude)."];
  const byState = (kind) => {
    const groups = {};
    for (const tool of selected) (groups[tool.capabilities[kind].state] ??= []).push(tool.name);
    return groups;
  };
  const describe = (kind, words) => {
    const groups = byState(kind);
    return Object.entries(words).filter(([state]) => groups[state]).map(([state, text]) => `${text}: ${groups[state].join(", ")}`);
  };
  return component.artifacts.flatMap((artifact) => {
    switch (artifact.kind) {
      case "skill":
        return describe("skills", { yes: "Skill for", none: "Not supported by" });
      case "agent":
        return describe("agents", { yes: "Agent for", reference: "Instructions file for", none: "Not supported by" });
      case "format-hook":
        return describe("format", { yes: "Hook for", note: "Not available for (see notes)", none: "No hook in" });
      case "secret-guard":
        return describe("secretGuard", { yes: "Set up for", note: "Steps shown for", none: "Not supported by" });
      case "checks":
        return ["Every tool: runs on git commit, whichever agent made the change."];
      default:
        return ["Every tool you picked."];
    }
  }).filter((line, i, all) => all.indexOf(line) === i);
}

/** A preset's components for this project, as resolved by the server. */
function presetIds(name) {
  return state.presets[name];
}

async function resolve(components) {
  state.resolved = await api("POST", "/api/resolve", { components });
}

function components() {
  const { selected, reasons, blockers } = state.resolved;
  const toggle = (id, isChecked) =>
    run(async () => {
      const next = isChecked ? [...selected, id] : selected.filter((c) => c !== id);
      await resolve(next);
    });
  const presetButton = (name, label) => button(label, () => run(() => resolve(presetIds(name))), "small");

  const groups = state.categories.map((category) => {
    const items = state.manifest.components.filter((c) => c.category === category);
    if (items.length === 0) return null;
    const chosen = items.filter((c) => selected.includes(c.id)).length;
    return el("div", { class: "group" }, el("h2", {}, category, el("span", { class: "count", text: `${chosen}/${items.length}` })), items.map((c) => componentRow(c, selected, reasons, blockers, toggle)));
  });

  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: "Choose what to install" }),
    el("p", { class: "muted", text: "Open \"What is this?\" on anything you're unsure about. Things other parts need are selected for you." }),
    el("div", { class: "presets" }, el("span", { class: "label", text: "Presets" }), presetButton("recommended", "Recommended"), presetButton("minimal", "Minimal"), presetButton("everything", "Everything")),
    groups,
    el(
      "div",
      { class: "actions" },
      button("Back", () => go(state.target.mode === "project" ? "tools" : "scan")),
      button(wantsProjectStep() ? "Next: about your project" : "Preview changes", () => (wantsProjectStep() ? go("project") : run(async () => { await makePlan(); go("preview"); })), "primary", { disabled: state.busy || selected.length === 0 }),
    ),
  );
}

function componentRow(c, selected, reasons, blockers, toggle) {
  const isSelected = selected.includes(c.id);
  const blockedBy = isSelected ? blockers[c.id] ?? [] : [];
  const blockedText = blockedBy.includes("required") ? "Always installed: everything else relies on it." : blockedBy.length ? `Can't be removed while ${blockedBy.map(componentName).join(", ")} ${blockedBy.length === 1 ? "is" : "are"} selected.` : null;
  const why = reasons[c.id]?.filter((r) => r !== "required");
  const id = `component-${c.id}`;
  return el(
    "div",
    { class: "component" },
    el(
      "div",
      { class: "component-head" },
      el("input", { type: "checkbox", id, checked: isSelected, disabled: state.busy || blockedBy.length > 0, title: blockedText, onChange: (e) => toggle(c.id, e.target.checked) }),
      el("label", { for: id }, el("strong", { text: c.name }), " ", el("span", { class: "muted", text: `· ${c.summary}` })),
    ),
    why?.length > 0 && el("p", { class: "why", text: `Selected because ${why.map(componentName).join(", ")} ${why.length === 1 ? "needs" : "need"} it.` }),
    !why?.length && isSelected && state.suggested.includes(c.id) && el("p", { class: "why", text: "Suggested because this project has a frontend." }),
    blockedText && !why?.length && el("p", { class: "why", text: blockedText }),
    el(
      "details",
      {},
      el("summary", { text: "What is this?" }),
      el(
        "dl",
        { class: "explain" },
        el("dt", { text: "What it is" }), el("dd", { text: c.explanation.what }),
        el("dt", { text: "When it's used" }), el("dd", { text: c.explanation.when }),
        el("dt", { text: "Example" }), el("dd", {}, el("code", { text: c.explanation.example })),
        c.dependsOn.length > 0 && [el("dt", { text: "Also installs" }), el("dd", { text: c.dependsOn.map(componentName).join(", ") })],
        c.external.length > 0 && [el("dt", { text: "Needs (not installed by this tool)" }), el("dd", { text: c.external.join(" · ") })],
        el("dt", { text: "For your tools" }), el("dd", {}, deliveryLines(c).map((line) => el("div", { text: line }))),
      ),
    ),
  );
}

function project() {
  if (!state.projectInfo) state.projectInfo = { ...state.suggestion };
  if (state.checks === null) state.checks = state.suggestedChecks;
  const { selected } = state.resolved;
  const continueTo = (useInfo) =>
    run(async () => {
      state.useProjectInfo = useInfo;
      await makePlan();
      go("preview");
    });

  const checksFields = selected.includes("checks")
    ? el(
        "fieldset",
        { class: "question" },
        el("legend", { text: "Checks before each commit" }),
        el("label", { class: "field", for: "checks" }, "Commands", el("span", { class: "hint", text: 'One per line as "name: command". Every one must pass for a commit to go through. Pre-filled from your project\'s scripts.' })),
        (() => {
          const input = el("textarea", { id: "checks", rows: 4, spellcheck: false, onInput: (e) => (state.checks = e.target.value) });
          input.value = state.checks;
          return input;
        })(),
      )
    : null;

  if (!selected.includes("instructions") || state.hasProjectSection) {
    return el(
      "section",
      {},
      kicker(),
      el("h1", { text: "About your project" }),
      state.hasProjectSection && el("div", { class: "notice info", text: "Your AGENTS.md (or CLAUDE.md) already has a \"## Project Overview\" section, so the installer won't add a second one. Edit that section directly whenever you like." }),
      checksFields,
      el("div", { class: "actions" }, button("Back", () => go("components")), button("Preview changes", () => continueTo(false), "primary")),
    );
  }

  const fields = PROJECT_FIELDS.map(([key, label, hint, isLong]) => {
    const id = `info-${key}`;
    const input = isLong
      ? el("textarea", { id, rows: key === "notes" ? 6 : 3, spellcheck: true, onInput: (e) => (state.projectInfo[key] = e.target.value) })
      : el("input", { id, type: "text", onInput: (e) => (state.projectInfo[key] = e.target.value) });
    input.value = state.projectInfo[key] ?? "";
    return [el("label", { class: "field", for: id }, label, el("span", { class: "hint", text: hint })), input];
  });

  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: "Tell the agent about your project" }),
    el("p", { class: "lede", text: "Optional. Tell the agent what it can't work out from the code. This becomes the project section of AGENTS.md, above the kit's block, so every tool reads it. Fill in as much or as little as you like." }),
    el("p", { class: "muted small", text: "It's yours: re-running the installer never changes it, and uninstalling never removes it. You'll see it in the preview before anything is written." }),
    fields,
    checksFields,
    el("div", { class: "actions" }, button("Back", () => go("components")), button("Skip project info", () => continueTo(false)), button("Add to AGENTS.md and preview", () => continueTo(true), "primary")),
  );
}

async function makePlan() {
  state.plan = await api("POST", "/api/plan", planRequest());
  state.resolutions = Object.fromEntries(state.plan.actions.filter((a) => a.kind === "CONFLICT").map((a) => [a.path, state.resolutions[a.path] ?? "keep"]));
}

function planRequest() {
  return {
    target: state.target,
    components: state.resolved.selected,
    tools: state.target.mode === "project" && state.flow !== "uninstall" ? state.tools : undefined,
    projectInfo: state.useProjectInfo && wantsProjectStep() ? state.projectInfo : undefined,
    checks: state.resolved.selected.includes("checks") ? state.checks ?? state.suggestedChecks : undefined,
    uninstall: state.flow === "uninstall",
  };
}

function preview() {
  const { actions, blockers, notes, hasWork } = state.plan;
  const isUninstall = state.flow === "uninstall";
  const counts = {};
  for (const a of actions) counts[a.kind] = (counts[a.kind] ?? 0) + 1;

  const install = () =>
    run(async () => {
      try {
        state.result = await api("POST", "/api/apply", { ...planRequest(), resolutions: state.resolutions, fingerprint: state.plan.fingerprint });
        go("done");
      } catch (error) {
        if (error.status !== 409) throw error;
        await makePlan();
        throw error;
      }
    });

  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: isUninstall ? "Review the uninstall" : "Review every change. Nothing is written yet." }),
    el("p", { class: "path path-line", text: targetLabel() }),
    el("div", { class: "tally" }, Object.entries(counts).map(([kind, n]) => el("span", {}, el("span", { class: `badge ${kind}`, text: kind }), ` × ${n}`))),
    blockers.length > 0 && el("div", { class: "notice error", role: "alert" }, el("p", { text: "Can't continue until this is fixed:" }), blockers.map((b) => el("p", { text: b }))),
    notes.map((n) => el("div", { class: "notice info", text: n })),
    !hasWork && blockers.length === 0 && el("div", { class: "notice info", text: "Everything is already in place. There is nothing to change." }),
    el("div", {}, actions.map(actionRow)),
    el(
      "div",
      { class: "actions" },
      button("Back", () => go(isUninstall ? "scan" : wantsProjectStep() ? "project" : "components")),
      hasWork && blockers.length === 0
        ? button(isUninstall ? "Uninstall" : "Install", install, isUninstall ? "danger" : "primary")
        : button("Finish", finish, "primary"),
    ),
  );
}

function actionRow(a) {
  const choice = (value, label) =>
    el("label", {}, el("input", { type: "radio", name: `res-${a.path}`, checked: state.resolutions[a.path] === value, onChange: () => (state.resolutions[a.path] = value) }), ` ${label}`);
  return el(
    "div",
    { class: "action" },
    el("div", { class: "action-head" }, el("span", { class: `badge ${a.kind}`, text: a.kind }), el("span", { class: "path", text: a.path })),
    el("p", { class: "summary", text: a.summary }),
    a.toolIds?.length > 0 && state.tools.length > 1 && el("p", { class: "read-by", text: `Read by ${a.toolIds.map(toolName).join(", ")}` }),
    a.kind === "CONFLICT" &&
      el("div", { class: "resolution", role: "radiogroup", "aria-label": `What to do with ${a.path}` }, choice("keep", "Keep mine"), choice("kit", "Use kit version (yours is backed up)"), choice("kit-new", `Save kit version as ${a.path.split("/").pop()}.kit-new`)),
    DIFF_KINDS.has(a.kind) && a.diff && el("details", { open: a.kind === "CONFLICT" }, el("summary", { text: "Show changes" }), diffView(a.diff)),
  );
}

function diffView(diff) {
  return el(
    "pre",
    { class: "diff" },
    diff.split("\n").map((line) => el("span", { class: line.startsWith("@@") ? "hunk" : line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "", text: line || " " })),
  );
}

function done() {
  const r = state.result;
  if (state.isClosed) {
    return el("section", {}, kicker(), el("h1", { text: "All set." }), el("p", { class: "lede", text: "The installer has stopped. You can close this tab." }));
  }
  const isUninstall = state.flow === "uninstall";
  return el(
    "section",
    {},
    kicker(),
    el("h1", { text: isUninstall ? "Uninstalled." : "Installed." }),
    el("p", { class: "lede", text: `${r.changedFiles.length} file(s) changed in ${targetLabel()}.` }),
    el("ul", { class: "files" }, r.changedFiles.map((f) => el("li", { class: "path", text: f }))),
    r.backupDir && el("p", { class: "small" }, "Backup of every file that changed: ", el("span", { class: "path", text: r.backupDir })),
    r.keptConflicts.length > 0 && el("p", { class: "small", text: `Kept your version of: ${r.keptConflicts.join(", ")}.` }),
    r.nextSteps.length > 0 &&
      el(
        "div",
        {},
        el("h2", { text: "Next steps (the installer doesn't do these for you)" }),
        el("ul", { class: "plain next-steps" }, r.nextSteps.map(nextStepRow)),
      ),
    el("div", { class: "actions" }, button("Done", finish, "primary")),
  );
}

function nextStepRow(step) {
  return el(
    "li",
    {},
    el("span", { class: step.isDone ? "done-step" : "" }, step.text, step.isDone ? " (already installed)" : ""),
    step.command && !step.isDone && el("span", { class: "command" }, el("code", { text: step.command }), copyButton(step.command)),
  );
}

function copyButton(text) {
  const btn = el("button", { class: "btn small", type: "button" }, "Copy");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Select and copy manually";
    }
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
  return btn;
}

function finish() {
  run(async () => {
    await api("POST", "/api/done");
    state.isClosed = true;
    state.result ??= { changedFiles: [], keptConflicts: [], nextSteps: [] };
    clearInterval(heartbeat);
    go("done");
  });
}

// ---------- lifecycle ----------

const heartbeat = setInterval(() => api("POST", "/api/heartbeat").catch(() => {}), 5000);
window.addEventListener("pagehide", () => {
  if (!state.isClosed) navigator.sendBeacon("/api/goodbye", JSON.stringify({ token }));
});

run(async () => {
  const [info, recent] = await Promise.all([api("GET", "/api/manifest"), api("GET", "/api/recent"), api("POST", "/api/heartbeat")]);
  Object.assign(state, { manifest: info.manifest, homeDir: info.homeDir, os: info.os, kitRoot: info.kitRoot, toolsInfo: info.tools, categories: info.categories, recent });
});
