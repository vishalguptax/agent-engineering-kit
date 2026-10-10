#!/usr/bin/env node
// Builds the static site in site/ in place. The committed HTML is always complete; this script rewrites the
// regions marked <!-- bake:NAME --> and the [data-bake] numbers from the repo's own files (tool profiles, kit
// manifest, CHANGELOG, rules) and from live numbers (GitHub stars, npm downloads and version). A failed fetch
// keeps the last value from scripts/live-numbers.json. It also writes sitemap.xml, robots.txt, llms.txt and,
// when Chrome is available, the Open Graph images and icon PNGs. No dependencies.
//
// node scripts/build-site.mjs            full build
// node scripts/build-site.mjs --offline  no network and no Chrome: last numbers, existing images

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { capabilitiesOf } from "../installer/dist/tools/capabilities.js";
import { TOOL_PROFILES } from "../installer/dist/tools/profiles.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const LIVE_FILE = path.join(ROOT, "scripts", "live-numbers.json");
const REPO = "vishalguptax/agent-engineering-kit";
const PACKAGE = "agent-engineering-kit";
const GITHUB = `https://github.com/${REPO}`;
const NPM = `https://www.npmjs.com/package/${PACKAGE}`;
export const SITE_URL = "https://agentengineeringkit.vishalg.in";
const AUTHOR = { "@type": "Person", name: "Vishal Gupta", url: "https://vishalg.in" };

// ---------- per-tool setup pages ----------

// Each tool's page is titled for what people search for that tool ("Cursor rules", "Copilot instructions", "GEMINI.md", …),
// and says only what the installer really does for it.
const SETUP_KEYWORDS = {
  "claude-code": { title: "Best Claude Code Setup: CLAUDE.md, Subagents, Skills, Hooks", rules: "CLAUDE.md and AGENTS.md rules" },
  codex: { title: "Best Codex Setup: AGENTS.md, Subagents and Skills", rules: "AGENTS.md rules" },
  cursor: { title: "Best Cursor Setup: Cursor Rules, Subagents, Skills, Hooks", rules: "AGENTS.md rules for Cursor" },
  copilot: { title: "Best GitHub Copilot Setup: Instructions, Agents, Skills", rules: "AGENTS.md instructions" },
  gemini: { title: "Best Gemini CLI Setup: GEMINI.md, AGENTS.md, Skills, Agents", rules: "GEMINI.md and AGENTS.md rules" },
  antigravity: { title: "Best Google Antigravity Setup: Rules, Skills and Agents", rules: "AGENTS.md rules" },
  grok: { title: "Best Grok Build Setup: AGENTS.md Rules and Skills", rules: "AGENTS.md rules" },
  windsurf: { title: "Best Windsurf Setup: Windsurf Rules, Skills and Hooks", rules: "AGENTS.md rules for Windsurf", name: "Windsurf" },
  kiro: { title: "Best Kiro Setup: Steering Rules, Skills and Agents", rules: "AGENTS.md steering rules" },
  opencode: { title: "Best opencode Setup: AGENTS.md, Agents and Skills", rules: "AGENTS.md rules" },
  kilo: { title: "Best Kilo Code Setup: AGENTS.md, Subagents and Skills", rules: "AGENTS.md rules" },
  junie: { title: "Best JetBrains Junie Setup: Guidelines, Skills, Agents", rules: "AGENTS.md guidelines" },
  augment: { title: "Best Augment Code Setup: Rules, Skills and Subagents", rules: "AGENTS.md rules" },
  cline: { title: "Best Cline Setup: Rules for Cline, Skills and Reviews", rules: "AGENTS.md rules for Cline" },
  zed: { title: "Best Zed AI Setup: Agent Rules and Skills", rules: "AGENTS.md rules" },
  amp: { title: "Best Amp Setup: AGENTS.md Rules and Skills", rules: "AGENTS.md rules" },
  warp: { title: "Best Warp AI Setup: Agent Rules and Skills", rules: "AGENTS.md rules" },
  aider: { title: "Best Aider Setup: Conventions, Rules and .aiderignore", rules: "AGENTS.md conventions" },
  generic: { title: "Best AGENTS.md Setup for Any AI Coding Agent", rules: "AGENTS.md rules", name: "your coding agent" },
};

const setupName = (tool) => SETUP_KEYWORDS[tool.id]?.name ?? tool.name;

// One heading per part, phrased the way people search for it ("Cursor subagents", "Codex skills", "Claude Code hooks").
const SETUP_HEADINGS = {
  rules: (name) => `${name} rules (AGENTS.md)`,
  skills: (name) => `${name} skills`,
  agents: (name) => `${name} subagents`,
  format: (name) => `${name} hooks: format on edit`,
  secretGuard: (name) => `Keep ${name} out of .env`,
};

function setupDescription(tool) {
  const caps = capabilitiesOf(tool);
  const name = setupName(tool);
  const parts = [];
  if (caps.rules.state === "yes") parts.push(SETUP_KEYWORDS[tool.id].rules);
  if (caps.agents.state === "yes") parts.push("review subagents");
  if (caps.skills.state === "yes") parts.push("workflow skills");
  if (caps.format.state === "yes") parts.push("a format-on-edit hook");
  if (caps.secretGuard.state === "yes") parts.push("a .env guard");
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  const long = `Set up ${name} to ship clean code: ${list}, in its own format, from one npx command. Preview every change first.`;
  const short = `Set up ${name} to ship clean code: ${list}, from one npx command.`;
  return long.length <= 155 ? long : short.length <= 155 ? short : `${name}: ${list}, set up from one npx command.`;
}

/** A direct answer first, then the installer's own explanation. */
function answer(cap, yes) {
  const lead = { yes, reference: "Not as separate agents:", note: "Not from the project files:", none: "No." }[cap.state];
  return `${lead} ${cap.detail}`;
}

function setupFaq(tool) {
  const caps = capabilitiesOf(tool);
  const name = setupName(tool);
  return [
    { q: `What is the best ${name} setup?`, a: `Rules it reads every session, focused subagents for review, skills for the plan-build-verify-ship workflow, and guardrails that don't depend on the agent remembering. The Agent Engineering Kit installs each part in ${name}'s own format where it can, and tells you the exact step where it can't.` },
    { q: `Does ${name} read AGENTS.md?`, a: answer(caps.rules, "Yes.") },
    { q: `Does ${name} support subagents?`, a: answer(caps.agents, "Yes.") },
    { q: `How do I stop ${name} reading .env files?`, a: answer(caps.secretGuard, "The kit sets this up for you:") },
    { q: `Can ${name} format files automatically after each edit?`, a: answer(caps.format, "Yes, the kit adds the hook:") },
  ];
}

const SETUP_PAGES = TOOL_PROFILES.map((tool) => ({
  path: `/setup/${tool.id}/`,
  file: `site/setup/${tool.id}/index.html`,
  og: `setup-${tool.id}`,
  parent: "/setup/",
  section: "/tools/",
  setup: tool.id,
  article: { published: "2026-10-11" },
  title: SETUP_KEYWORDS[tool.id].title,
  description: setupDescription(tool),
  ogTitle: `The ${setupName(tool)} setup that ships clean code.`,
  llms: `What the kit sets up for ${setupName(tool)}: rules, skills, subagents, format on edit and secret guard, the files it writes, and how to install it.`,
  faq: () => setupFaq(tool),
}));

export const PAGES = [
  {
    path: "/",
    file: "site/index.html",
    og: "home",
    title: "AGENTS.md Rules, Sub-agents & Skills for Any AI Coding Agent",
    description: "Stop AI slop in any AI coding agent: one npx installer adds AGENTS.md rules, sub-agents, skills and hooks to your project, in each tool's own format.",
    ogTitle: "Make AI coding agents ship clean code, not AI slop.",
    llms: "What the kit is, the six-step workflow, the parts, supported tools, the installer's safety, and an FAQ.",
    faq: () => FAQ,
  },
  {
    path: "/rules/",
    file: "site/rules/index.html",
    og: "rules",
    nav: "Rules",
    title: "AGENTS.md Template: Rules That Stop AI Coding Agent Slop",
    description: "A short, always-on AGENTS.md rules block that stops AI coding agents guessing APIs, over-engineering and weakening tests. Works with CLAUDE.md too.",
    ogTitle: "An AGENTS.md rules block your agent reads every session.",
    llms: "The always-on rules block in AGENTS.md, word for word, and the ten sections of the rulebook.",
  },
  {
    path: "/agents/",
    file: "site/agents/index.html",
    og: "agents",
    nav: "Agents",
    title: "Code Review Sub-agents for Every AI Coding Agent",
    description: "Code review and verification sub-agents for any coding agent: verifier, code-simplifier, test-analyzer, silent-failure-hunter, security-reviewer and more.",
    ogTitle: "Sub-agents with one job each.",
    llms: "Each sub-agent: what it does, when it's used, an example, and whether it can edit code.",
  },
  {
    path: "/skills/",
    file: "site/skills/index.html",
    og: "skills",
    nav: "Skills",
    title: "Agent Skills (SKILL.md) for Every AI Coding Agent",
    description: "SKILL.md workflows for any coding agent: feature, quick-fix, verify-change, ship, learn and project-conventions. Plan, build test-first, verify, then ship.",
    ogTitle: "Skills that run the whole workflow.",
    llms: "Each skill (feature, quick-fix, verify-change, ship, learn, project-conventions): what it does, when to use it, and what it needs.",
  },
  {
    path: "/safety/",
    file: "site/safety/index.html",
    og: "safety",
    nav: "Safety",
    title: "Stop AI Coding Agents Reading .env: Guardrails & Hooks",
    description: "Keep AI coding agents out of .env files, format every edit with your own formatter, and run your lint and tests before each commit, whichever agent edits.",
    ogTitle: "Guardrails your agent can't forget.",
    llms: "The format-on-edit hook, the secret guard and the pre-commit checks, with what each AI tool supports.",
  },
  {
    path: "/tools/",
    file: "site/tools/index.html",
    og: "tools",
    nav: "Tools",
    title: "Supported AI Coding Tools: AGENTS.md, Cursor Rules and More",
    description: "What every supported AI coding tool gets, in its own format: AGENTS.md or CLAUDE.md rules, skills, sub-agents, format on edit and secret guard.",
    ogTitle: "One kit, each tool in its own format.",
    llms: "A per-tool table of rules, skills, agents, format on edit and secret guard, with the reason and docs for each.",
  },
  {
    path: "/install/",
    file: "site/install/index.html",
    og: "install",
    nav: "Install",
    title: "Install the Agent Engineering Kit with npx or your agent",
    description: "Run npx agent-engineering-kit, or paste one prompt into your coding agent. Terminal and CI modes, global install, update and uninstall.",
    ogTitle: "Install it in a couple of minutes.",
    llms: "The npx command, the install-with-your-agent prompt, terminal and CI usage, global installs, flags, update and uninstall.",
  },
  {
    path: "/how-it-works/",
    file: "site/how-it-works/index.html",
    og: "how-it-works",
    nav: "How it works",
    title: "How the Installer Works: Preview, Merge, Back Up, Undo",
    description: "How the installer previews every change, merges AGENTS.md and settings without overwriting, backs up files, records what it did and uninstalls cleanly.",
    ogTitle: "What the installer does to your files.",
    llms: "Where files go, how existing files are merged, backups, the install record, update, uninstall and the safety checks.",
  },
  {
    path: "/guides/",
    file: "site/guides/index.html",
    og: "guides",
    nav: "Guides",
    title: "Guides: AGENTS.md, .env Safety and Hooks for AI Coding",
    description: "Practical guides for AI coding agents: which rules file each tool reads, keeping agents out of .env, and formatting every edit automatically.",
    ogTitle: "Guides for working with AI coding agents.",
    llms: "Index of the guides.",
  },
  {
    path: "/guides/agents-md-vs-claude-md/",
    file: "site/guides/agents-md-vs-claude-md/index.html",
    og: "guide-agents-md",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "AGENTS.md vs CLAUDE.md: Which File Each AI Tool Reads",
    description: "AGENTS.md, CLAUDE.md, GEMINI.md, copilot-instructions.md or Cursor rules? Which file each AI coding tool reads, and how to keep one source of truth.",
    ogTitle: "AGENTS.md vs CLAUDE.md: which file each AI tool reads.",
    llms: "Which rules file each AI coding tool reads (AGENTS.md, CLAUDE.md, GEMINI.md, copilot-instructions.md, Cursor rules), the tool-specific catches, and how to keep one source of truth.",
    faq: [
      {
        q: "Should I keep both AGENTS.md and CLAUDE.md?",
        a: "Keep your rules in `AGENTS.md`, which most tools read, and keep `CLAUDE.md` for anything specific to Claude Code plus a one-line `@AGENTS.md` import. Then every tool reads the same rules and you edit them in one place.",
      },
      {
        q: "How do I make Claude Code use AGENTS.md?",
        a: "Add a line containing `@AGENTS.md` to `CLAUDE.md`. Claude Code imports the file it names, so it reads the same rules as every other tool.",
      },
      {
        q: "Does Gemini CLI read AGENTS.md?",
        a: "It reads `GEMINI.md` by default. Add `AGENTS.md` to `context.fileName` in `.gemini/settings.json` and it reads both.",
      },
      {
        q: "Which tools need extra setup to read AGENTS.md?",
        a: "Claude Code (an `@AGENTS.md` import in `CLAUDE.md`), Gemini CLI (a `context.fileName` setting) and Aider (`read: AGENTS.md` in `.aider.conf.yml`). Zed and JetBrains Junie read it unless another rules file takes precedence.",
      },
    ],
  },
  {
    path: "/guides/stop-ai-agents-reading-env/",
    file: "site/guides/stop-ai-agents-reading-env/index.html",
    og: "guide-env",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "How to Stop AI Coding Agents Reading .env Files",
    description: "Block Claude Code, Cursor, Gemini CLI and every other AI coding agent from reading .env files and secrets: the setting for each tool and what it misses.",
    ogTitle: "Stop AI coding agents reading your .env.",
    llms: "How to keep each AI coding tool out of .env files and secrets: Claude Code deny rules and what they don't cover, ignore files for Cursor, Gemini CLI and others.",
  },
  {
    path: "/guides/format-on-edit-hooks/",
    file: "site/guides/format-on-edit-hooks/index.html",
    og: "guide-format",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "Auto-format Every AI Agent Edit with Hooks (Prettier, ruff)",
    description: "Claude Code PostToolUse, Cursor and Windsurf hooks that run your own formatter after every AI edit (Prettier, Biome, ruff, gofmt), plus a fallback.",
    ogTitle: "Format every file your AI agent edits.",
    llms: "A format-on-edit hook for Claude Code, Cursor and Windsurf that runs the project's own formatter (Prettier, Biome, ruff, gofmt, rustfmt, …) after every edit.",
  },
  {
    path: "/guides/stop-ai-slop/",
    file: "site/guides/stop-ai-slop/index.html",
    og: "guide-slop",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "How to Stop AI Coding Agents Writing Slop",
    description: "Vague names, dead code, TODO stubs, swallowed errors, weakened tests: why AI coding agents write slop, and the rules, reviews and checks that stop it.",
    ogTitle: "How to stop AI coding agents writing slop.",
    llms: "What AI slop looks like in code, and the habits and checks that prevent it: plan first, surgical changes, verification with evidence, a simplify pass and focused reviews.",
  },
  {
    path: "/guides/stop-ai-weakening-tests/",
    file: "site/guides/stop-ai-weakening-tests/index.html",
    og: "guide-tests",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "Stop AI Coding Agents Deleting or Weakening Your Tests",
    description: "AI agents loosen assertions, skip tests and delete failing ones to make checks pass. A rule, a test reviewer and a pre-commit guard that stop it.",
    ogTitle: "Stop AI agents weakening your tests.",
    llms: "How to stop AI coding agents deleting, skipping or loosening tests: an always-on rule, the test-analyzer reviewer, and a pre-commit check that refuses changes to protected test files.",
  },
  {
    path: "/guides/verify-ai-generated-code/",
    file: "site/guides/verify-ai-generated-code/index.html",
    og: "guide-verify",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "Make AI Coding Agents Prove Their Code Works",
    description: "Stop AI agents calling untested work done: run the project's real checks, exercise the change, retry from the root cause, and list what wasn't verified.",
    ogTitle: "Make AI agents prove their code works.",
    llms: "A verification loop for AI coding agents: real format, lint, type-check, test and build commands, exercising the change, fixing from the root cause, and reporting what wasn't verified.",
  },
  {
    path: "/guides/ai-code-review-agents/",
    file: "site/guides/ai-code-review-agents/index.html",
    og: "guide-review",
    parent: "/guides/",
    guide: { published: "2026-10-11" },
    title: "AI Code Review Agents: Tests, Silent Failures, Security, UI",
    description: "Review AI-written code with focused sub-agents: one for tests, one for swallowed errors, one for security, one for UI. When each runs and what it checks.",
    ogTitle: "Review AI-written code with focused agents.",
    llms: "Code review with focused sub-agents for AI-written changes: test-analyzer, silent-failure-hunter, security-reviewer and frontend-reviewer, when each runs and how tools without sub-agents use them.",
  },
  {
    path: "/setup/",
    file: "site/setup/index.html",
    og: "setup",
    section: "/tools/",
    title: "Best AI Coding Agent Setup for Every Tool | Agent Eng. Kit",
    description: "The best setup for Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, Windsurf, Kiro and every other supported AI coding tool, one page per tool.",
    ogTitle: "The best setup for each AI coding tool.",
    llms: "Index of the per-tool setup pages.",
  },
  ...SETUP_PAGES,
  {
    path: "/changelog/",
    file: "site/changelog/index.html",
    og: "changelog",
    nav: "Changelog",
    title: "Changelog | Agent Engineering Kit",
    description: "Every release of the Agent Engineering Kit and its installer, newest first: what changed and why.",
    ogTitle: "Changelog",
    llms: "Every release, newest first.",
  },
  {
    path: "/404.html",
    file: "site/404.html",
    title: "Page not found | Agent Engineering Kit",
    description: "This page isn't in this edition of the Agent Engineering Kit site.",
  },
];

export const FAQ = [
  {
    q: "Does the installer change my files without asking?",
    a: "No. It shows every change as a diff first, and nothing is written until you confirm. Files that change are backed up to `.agent-kit/backup/`, and `AGENTS.md`, `CLAUDE.md` and settings files are merged, never overwritten.",
  },
  {
    q: "Which AI coding tools does it work with?",
    a: (d) => `${d.toolCount} named tools, including Claude Code, OpenAI Codex, Cursor, GitHub Copilot and Gemini CLI, plus any other agent that reads \`AGENTS.md\`. Each one gets the kit in its own format.`,
  },
  {
    q: "How much context does it use?",
    a: "The always-on rules in `AGENTS.md` are about 600 tokens per session. The full rulebook is reference: skills and agents open only the section they need.",
  },
  {
    q: "Does it need dependencies or make network calls?",
    a: "`npx` downloads only the installer and the kit, about 100 kB with no dependencies. Once running, the installer makes no network calls.",
  },
  {
    q: "How do I update or uninstall it?",
    a: "Run the installer again. It offers Update, Add or remove components or tools, and Uninstall. Uninstall removes only what the kit added and keeps your own edits.",
  },
  {
    q: "Does it work on Windows?",
    a: "The installer and the format hook run on Node, so they work as is, though Windows hasn't been tested by hand yet. The optional pre-commit check is a POSIX `sh` script, which Git for Windows provides.",
  },
];

// ---------- markers and numbers ----------

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function replaceBlock(html, name, content) {
  const start = `<!-- bake:${name} -->`;
  const end = `<!-- /bake:${name} -->`;
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  if (from === -1 || to === -1) throw new Error(`missing <!-- bake:${name} --> block`);
  return html.slice(0, from + start.length) + content + html.slice(to);
}

/** Sets the text of every [data-bake=name] element; throws if one can't be filled (e.g. it wraps other markup). */
export function bakeValue(html, name, value) {
  const re = new RegExp(`(<([a-z]+)\\b[^>]*\\sdata-bake="${name}"[^>]*>)[^<]*(</\\2>)`, "g");
  let filled = 0;
  const out = html.replace(re, (_, open, _tag, close) => {
    filled++;
    return open + escapeHtml(value) + close;
  });
  const marked = html.split(`data-bake="${name}"`).length - 1;
  if (filled !== marked) throw new Error(`data-bake="${name}": filled ${filled} of ${marked} elements; each must hold plain text only`);
  return out;
}

function setCellVisible(html, name, visible) {
  const re = new RegExp(`<li data-bake-cell="${name}"( hidden)?>`, "g");
  return html.replace(re, visible ? `<li data-bake-cell="${name}">` : `<li data-bake-cell="${name}" hidden>`);
}

/** Bakes the live numbers. A null value (fetch failed, nothing stored) leaves the page as it is; a zero hides its cell. */
export function applyLive(html, live) {
  let out = html;
  for (const name of ["stars", "downloads"]) {
    const value = live[name];
    if (value === null || value === undefined) continue;
    if (value > 0) out = bakeValue(out, name, value.toLocaleString("en-US"));
    out = setCellVisible(out, name, value > 0);
  }
  if (live.version) out = bakeValue(out, "version", live.version);
  return out;
}

/** A warning line that GitHub Actions shows on the run summary, so a fallback in a green run is still seen. */
export function warningLine(message, env = process.env) {
  return env.GITHUB_ACTIONS ? `::warning title=build-site::${message}` : `warning: ${message}`;
}

const warn = (message) => console.warn(warningLine(message));

const newer = (a, b) => (a.split(".").map(Number).reduce((d, n, i) => d || n - Number(b.split(".")[i]), 0) > 0 ? a : b);

/**
 * The numbers to bake: fresh ones where fetched, else the last stored stars and downloads. The version is the newer of
 * npm's and package.json's, so a release commit (bumped here, not yet published) shows its own version.
 */
export function mergeLive(fetched, stored, packageVersion) {
  return {
    stars: fetched.stars ?? stored.stars ?? null,
    downloads: fetched.downloads ?? stored.downloads ?? null,
    version: fetched.version ? newer(fetched.version, packageVersion) : packageVersion,
  };
}

async function getJson(fetchImpl, url, headers = {}) {
  const res = await fetchImpl(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** Fetches each live number independently; a failure is a warning and a null, never a broken build. */
export async function fetchLive({ fetch: fetchImpl = fetch, token = process.env.GITHUB_TOKEN, warn: report = warn } = {}) {
  const sources = {
    stars: async () => {
      const auth = token ? { Authorization: `Bearer ${token}` } : {};
      const n = (await getJson(fetchImpl, `https://api.github.com/repos/${REPO}`, auth)).stargazers_count;
      if (!Number.isInteger(n)) throw new Error("GitHub: no stargazers_count");
      return n;
    },
    downloads: async () => {
      const n = (await getJson(fetchImpl, `https://api.npmjs.org/downloads/point/last-week/${PACKAGE}`)).downloads;
      if (!Number.isInteger(n)) throw new Error("npm downloads: no downloads field");
      return n;
    },
    version: async () => {
      const v = (await getJson(fetchImpl, `https://registry.npmjs.org/${PACKAGE}/latest`)).version;
      if (!/^\d+\.\d+\.\d+$/.test(v ?? "")) throw new Error("npm registry: no version");
      return v;
    },
  };
  const live = {};
  for (const [name, get] of Object.entries(sources)) {
    try {
      live[name] = await get();
    } catch (err) {
      report(`${name}: ${err.message}; keeping the last value`);
      live[name] = null;
    }
  }
  return live;
}

// ---------- Markdown (the subset CHANGELOG.md and the rules block use) ----------

function renderInline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${escapeHtml(resolveLink(href.replace(/&quot;/g, '"').replace(/&amp;/g, "&")))}">${label}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

function resolveLink(href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  return `${GITHUB}/blob/main/${href.replace(/^(\.\.\/)+/, "")}`;
}

export function renderMarkdown(md, { heading = (level, text) => `<h${level}>${renderInline(text)}</h${level}>` } = {}) {
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${renderInline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>\n${list.items.map((i) => `<li>${renderInline(i)}</li>`).join("\n")}\n</${list.tag}>`);
    list = null;
  };
  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,6}) (.*)$/);
    const ul = line.match(/^[-*] (.*)$/);
    const ol = line.match(/^\d+\. (.*)$/);
    if (h) {
      flushPara();
      flushList();
      out.push(heading(h[1].length, h[2]));
    } else if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (list?.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((ul ?? ol)[1]);
    } else if (/^\s+\S/.test(line) && list) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

export function renderChangelog(md) {
  return renderMarkdown(md, {
    heading: (level, text) => {
      if (level === 1) return "";
      const version = level === 2 && text.match(/^(\d+\.\d+\.\d+) — (.*)$/);
      if (level === 2 && !version && /^\d+\.\d+\.\d+/.test(text)) throw new Error(`CHANGELOG heading "${text}" should read "<version> — <date>"`);
      if (version) return `<h2 id="v${version[1].replace(/\./g, "-")}">${version[1]} <span class="date">${escapeHtml(version[2])}</span></h2>`;
      return `<h${level}>${renderInline(text)}</h${level}>`;
    },
  }).replace(/^\n+/, "");
}

// ---------- repo data ----------

function frontmatter(file) {
  const fm = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  return Object.fromEntries(fm.split("\n").map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .trim();
}

export function siteData(live = {}) {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "installer/kit.manifest.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const tools = TOOL_PROFILES.map((tool) => ({ id: tool.id, name: tool.name, docs: tool.docs, checked: tool.checked, detect: tool.detect?.project ?? [], caps: capabilitiesOf(tool) }));
  const byCategory = (category) => manifest.components.filter((c) => c.category === category);
  const recommended = new Set(manifest.presets.recommended);
  const nameOf = (id) => manifest.components.find((c) => c.id === id)?.name ?? id;
  const component = (c) => ({ ...c, preset: recommended.has(c.id) ? "Recommended" : "Everything", alsoInstalls: (c.dependsOn ?? []).map(nameOf) });
  const agents = byCategory("Agents").map((c) => {
    const access = frontmatter(path.join(ROOT, "kit/agents", `${c.id}.md`)).access;
    if (access !== "read-only" && access !== "edit") throw new Error(`kit/agents/${c.id}.md: access must be read-only or edit, not "${access}"`);
    return { ...component(c), access };
  });
  return {
    version: live.version ?? pkg.version,
    stars: live.stars ?? null,
    downloads: live.downloads ?? null,
    tools,
    toolCount: tools.filter((t) => t.id !== "generic").length,
    agents,
    skills: byCategory("Workflows/Skills").map(component),
    safety: byCategory("Hooks & Safety").map(component),
    rulesBlock: readFileSync(path.join(ROOT, "kit/instructions/agents-block.md"), "utf8"),
    rulebook: readFileSync(path.join(ROOT, "kit/rules/RULES.md"), "utf8"),
    changelog: readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8"),
    css: minifyCss(readFileSync(path.join(SITE, "style.css"), "utf8")),
  };
}

const faqAnswer = (item, data) => (typeof item.a === "function" ? item.a(data) : item.a);
const faqOf = (page) => (typeof page.faq === "function" ? page.faq() : page.faq) ?? [];
const crumbName = (page) => page.nav ?? page.ogTitle.replace(/\.$/, "");
const plain = (md) => md.replace(/`([^`]+)`/g, "$1");

// ---------- head, header, footer ----------

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
}

function faqPage(page, data) {
  return {
    "@type": "FAQPage",
    mainEntity: faqOf(page).map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: plain(faqAnswer(item, data)) } })),
  };
}

function breadcrumbs(page) {
  const trail = [{ name: "Home", path: "/" }];
  if (page.parent) trail.push({ name: crumbName(PAGES.find((p) => p.path === page.parent)), path: page.parent });
  trail.push({ name: crumbName(page), path: page.path });
  return { "@type": "BreadcrumbList", itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: SITE_URL + t.path })) };
}

function structuredData(page, data) {
  if (page.path === "/") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "Agent Engineering Kit", url: `${SITE_URL}/`, inLanguage: "en", publisher: AUTHOR },
        {
          "@type": "SoftwareApplication",
          name: "Agent Engineering Kit",
          description: page.description,
          url: `${SITE_URL}/`,
          applicationCategory: "DeveloperApplication",
          operatingSystem: "macOS, Windows, Linux",
          softwareVersion: data.version,
          license: "https://opensource.org/licenses/MIT",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          downloadUrl: NPM,
          sameAs: [GITHUB, NPM],
          author: AUTHOR,
        },
        faqPage(page, data),
      ],
    };
  }
  const graph = [breadcrumbs(page)];
  const article = page.guide ?? page.article;
  if (article) {
    graph.push({
      "@type": "TechArticle",
      headline: page.ogTitle.replace(/\.$/, ""),
      description: page.description,
      url: SITE_URL + page.path,
      image: `${SITE_URL}/og/${page.og}.png`,
      datePublished: article.published,
      dateModified: article.updated ?? article.published,
      author: AUTHOR,
      publisher: AUTHOR,
    });
  }
  if (faqOf(page).length) graph.push(faqPage(page, data));
  return graph.length === 1 ? { "@context": "https://schema.org", ...graph[0] } : { "@context": "https://schema.org", "@graph": graph };
}

export function renderHead(page, data) {
  const url = SITE_URL + page.path;
  const lines = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
  ];
  if (page.og) {
    const image = `${SITE_URL}/og/${page.og}.png`;
    lines.push(
      `<link rel="canonical" href="${url}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="Agent Engineering Kit">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:title" content="${escapeHtml(page.title)}">`,
      `<meta property="og:description" content="${escapeHtml(page.description)}">`,
      `<meta property="og:image" content="${image}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${escapeHtml(page.ogTitle)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escapeHtml(page.title)}">`,
      `<meta name="twitter:description" content="${escapeHtml(page.description)}">`,
      `<meta name="twitter:image" content="${image}">`,
    );
  }
  lines.push(
    `<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
    `<link rel="preload" href="/fonts/newsreader-display-600.woff2" as="font" type="font/woff2" crossorigin>`,
    `<style>${data.css}</style>`,
    `<script>document.documentElement.classList.add("js"); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("motion");</script>`,
    `<script type="module" src="/app.js"></script>`,
  );
  if (page.og) lines.push(jsonLd(structuredData(page, data)));
  return `\n  ${lines.join("\n  ")}\n  `;
}

function renderHeader(page) {
  const nav = PAGES.filter((p) => p.nav)
    .map((p) => `<li><a href="${p.path}"${p === page || p.path === (page.section ?? page.parent) ? ' aria-current="page"' : ""}>${p.nav}</a></li>`)
    .join("\n          ");
  return `
  <header class="sheet">
    <div class="edition">
      <ul aria-label="This edition">
        <li>Edition <span data-bake="version">0.0.0</span></li>
        <li>MIT licence</li>
        <li><span data-bake="tool-count">0</span> AI coding tools</li>
        <li>About 600 tokens always on</li>
        <li data-bake-cell="stars" hidden><span data-bake="stars">0</span> GitHub stars</li>
        <li data-bake-cell="downloads" hidden><span data-bake="downloads">0</span> npm downloads last week</li>
      </ul>
    </div>
    <div class="masthead">
      <a class="wordmark" href="/"><svg class="mark" aria-hidden="true" viewBox="0 0 64 64"><rect x="2.5" y="2.5" width="59" height="59" fill="var(--card)" stroke="currentColor" stroke-width="5"/><path d="M14 22h22M14 32h16M14 42h12" stroke="currentColor" stroke-width="4.5" stroke-linecap="square"/><path d="M33 40l8 8 15-21" fill="none" stroke="var(--pen)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>The Agent Engineering Kit</a>
      <nav class="contents" aria-label="Site">
        <ol>
          ${nav}
        </ol>
      </nav>
    </div>
  </header>
  `;
}

function renderFooter() {
  return `
  <footer class="sheet">
    <div class="colophon">
    <p>The Agent Engineering Kit is open source under the MIT licence, by <a href="https://vishalg.in">Vishal Gupta</a>. It builds on the workflows of Boris Cherny and Matt Pocock, the Karpathy guidelines, Superpowers and Addy Osmani’s agent-skills (<a href="${GITHUB}#credits">credits</a>).</p>
    <p><a href="${GITHUB}">Source on GitHub</a> <span aria-hidden="true">/</span> <a href="${NPM}">Package on npm</a> <span aria-hidden="true">/</span> <a href="/setup/">Setup by tool</a> <span aria-hidden="true">/</span> <a href="/llms.txt">llms.txt</a></p>
    </div>
  </footer>
  `;
}

// ---------- generated page blocks ----------

const MARK = { yes: ["✓", "yes"], reference: ["ref", "as reference"], note: ["note", "note"], none: ["—", "not supported"] };
const CAP_LABELS = { rules: "Rules", skills: "Skills", agents: "Agents", format: "Format on edit", secretGuard: "Secret guard" };
const CAP_KINDS = Object.keys(CAP_LABELS);

function capCell(cap) {
  const [glyph, words] = MARK[cap.state];
  return glyph === words ? `<td class="cap-${cap.state}">${glyph}</td>` : `<td class="cap-${cap.state}"><span aria-hidden="true">${glyph}</span><span class="sr-only">${words}</span></td>`;
}

function capTable(tools, kinds, caption) {
  const head = kinds.map((k) => `<th scope="col">${CAP_LABELS[k]}</th>`).join("");
  const rows = tools.map((t) => `<tr><th scope="row"><a href="/setup/${t.id}/">${escapeHtml(t.name)}</a></th>${kinds.map((k) => capCell(t.caps[k])).join("")}</tr>`).join("\n        ");
  return `
      <div class="table-wrap" role="region" aria-label="${escapeHtml(caption)}" tabindex="0">
      <table class="caps">
        <caption class="sr-only">${escapeHtml(caption)}</caption>
        <thead><tr><th scope="col">Tool</th>${head}</tr></thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
      </div>
      `;
}

function toolIndex(data) {
  const items = data.tools
    .map((t) => {
      const native = CAP_KINDS.filter((k) => t.caps[k].state === "yes").map((k) => CAP_LABELS[k].toLowerCase());
      return `<li><a class="name" href="/setup/${t.id}/">${escapeHtml(t.name)}</a><span class="leader" aria-hidden="true"></span><span class="what">${native.length ? native.join(", ") : "notes only"}</span></li>`;
    })
    .join("\n        ");
  return `
      <ol class="index">
        ${items}
      </ol>
      `;
}

// The manifest's one-line summaries for these two name Claude; the site covers every tool, and each
// component's own "what" text already says agents.
const SUMMARIES = {
  "format-hook": "Formats every file your agent edits, using your project’s own formatter.",
  "secret-guard": "Stops your agent from reading .env files and secrets/.",
};

/** A prompt to paste ("…") or a command (/feature, git …) is set as code; a description stays prose. */
function example(text) {
  return /^["/]|^git /.test(text) ? `<code>${escapeHtml(text.replace(/^"|"$/g, ""))}</code>` : escapeHtml(text);
}

function componentCard(c, extra = []) {
  const rows = [
    ["What it does", escapeHtml(c.explanation.what)],
    ["When it’s used", escapeHtml(c.explanation.when)],
    ["Example", example(c.explanation.example)],
    ...extra,
    ["Preset", c.preset === "Recommended" ? "Recommended and Everything" : "Everything (opt-in)"],
  ];
  if (c.alsoInstalls.length) rows.push(["Also installs", escapeHtml(c.alsoInstalls.join(", "))]);
  if (c.external?.length) rows.push(["Needs", escapeHtml(c.external.join("; "))]);
  return `
        <article class="card" id="${c.id}">
          <h3><code>${escapeHtml(c.id)}</code></h3>
          <p class="summary">${escapeHtml(SUMMARIES[c.id] ?? c.summary)}</p>
          <dl>
            ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("\n            ")}
          </dl>
        </article>`;
}

function cards(list, extra = () => []) {
  return `
      <div class="cards">${list.map((c) => componentCard(c, extra(c))).join("")}
      </div>
      `;
}

function toolsDetail(data) {
  return (
    data.tools
      .map(
        (t) => `
      <article class="tool" id="${t.id}">
        <h3>${escapeHtml(t.name)} <code>${t.id}</code></h3>
        <dl>
          ${CAP_KINDS.map((k) => `<div><dt>${CAP_LABELS[k]}</dt><dd>${escapeHtml(t.caps[k].detail)}</dd></div>`).join("\n          ")}
          ${t.detect.length ? `<div><dt>Detected by</dt><dd>${t.detect.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ")}</dd></div>` : ""}
        </dl>
        <p class="docs">Docs, checked ${t.checked}: ${t.docs.map((d) => `<a href="${escapeHtml(d)}">${escapeHtml(d.replace(/^https:\/\//, ""))}</a>`).join(" ")}</p>
      </article>`,
      )
      .join("") + "\n      "
  );
}

/** One row per tool with the installer's own explanation for one capability. */
function detailTable(tools, kind, caption) {
  const rows = tools.map((t) => `<tr><th scope="row"><a href="/setup/${t.id}/">${escapeHtml(t.name)}</a></th><td class="cap-${t.caps[kind].state}">${MARK[t.caps[kind].state][1]}</td><td>${escapeHtml(t.caps[kind].detail)}</td></tr>`).join("\n        ");
  return `
      <div class="table-wrap" role="region" aria-label="${escapeHtml(caption)}" tabindex="0">
      <table class="details">
        <caption class="sr-only">${escapeHtml(caption)}</caption>
        <thead><tr><th scope="col">Tool</th><th scope="col">${CAP_LABELS[kind]}</th><th scope="col">How</th></tr></thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
      </div>
      `;
}

/** The files the installer writes for a tool, from its profile. */
function setupFiles(tool) {
  const files = [];
  if (tool.instructions.kind === "claude-import") files.push(["AGENTS.md", "the rules block, shared with every other tool"], ["CLAUDE.md", "a marked one-line @AGENTS.md import"]);
  else if (tool.instructions.kind === "gemini-context") files.push(["AGENTS.md", "the rules block"], [".gemini/settings.json", "AGENTS.md added to context.fileName, keeping GEMINI.md"]);
  else if (tool.instructions.kind === "agents-md") files.push(["AGENTS.md", "the rules block"]);
  if (tool.skills) files.push([`${tool.skills.reads[0]}/<name>/SKILL.md`, "the six skills (or a shared folder it also reads)"]);
  if (tool.agents?.reads?.length) files.push([`${tool.agents.reads[0].dir}/`, "the sub-agents, in its own format"]);
  else files.push([".agent-kit/agents/*.md", "each agent's instructions, for the skills to follow in place"]);
  if (tool.formatHook && tool.formatHook.kind !== "note") files.push([tool.formatHook.file, "the after-edit format hook"]);
  if (tool.secretGuard && tool.secretGuard.kind !== "note") files.push([tool.secretGuard.file, "the .env and secrets/ guard"]);
  files.push([".agent-kit/", "the rulebook, format script, install record and backups"]);
  return files;
}

function setupBody(id, data, page) {
  const tool = TOOL_PROFILES.find((t) => t.id === id);
  const view = data.tools.find((t) => t.id === id);
  const name = setupName(tool);
  const files = setupFiles(tool).map(([f, what]) => `<li><code>${escapeHtml(f)}</code>: ${escapeHtml(what)}</li>`).join("\n          ");
  const notes = [...(tool.warnings ?? []).map((w) => w.message), ...(tool.nextSteps ?? [])];
  const command = id === "generic" ? "npx agent-engineering-kit" : `npx agent-engineering-kit --target . --tools ${id} --dry-run`;
  return `
    <div class="page-head">
      <p class="label"><a href="/setup/">Setup by tool</a></p>
      <h1>The best ${escapeHtml(name)} setup for clean, reviewed code</h1>
      <p class="lead">${escapeHtml(page.description)} Here is exactly what ${escapeHtml(name)} gets, the files that are written, and how to install it.</p>
    </div>

    <section class="section" aria-labelledby="gets">
      <div class="section-head">
        <p class="label">§01 · What ${escapeHtml(name)} gets</p>
        <div>
          <h2 id="gets">${escapeHtml(name)} rules, skills, subagents, hooks and .env guard.</h2>
          <p>From the installer’s profile for ${escapeHtml(name)}, which follows its official docs (checked ${escapeHtml(tool.checked)}). “Note” means it can’t be set safely from the project, so the installer tells you the exact step.</p>
        </div>
      </div>
      <div class="parts">${CAP_KINDS.map((k) => `
        <article>
          <h3>${escapeHtml(SETUP_HEADINGS[k](name))} <span class="state cap-${view.caps[k].state}">${MARK[view.caps[k].state][1]}</span></h3>
          <p>${escapeHtml(view.caps[k].detail)}</p>
        </article>`).join("")}
      </div>
    </section>

    <section class="section" aria-labelledby="files">
      <div class="section-head">
        <p class="label">§02 · Files</p>
        <div>
          <h2 id="files">What lands in your project.</h2>
          <p>Existing files are merged, never overwritten, and backed up first.</p>
        </div>
      </div>
      <ul class="file-list">
          ${files}
      </ul>
    </section>

    <section class="section" aria-labelledby="install">
      <div class="section-head">
        <p class="label">§03 · Install for ${escapeHtml(name)}</p>
        <div>
          <h2 id="install">Preview it, then install.</h2>
          <p>${id === "generic" ? "Run the installer and pick “Any other agent (AGENTS.md)”." : `This previews exactly what would change for ${escapeHtml(name)} and writes nothing. Run it again without <code>--dry-run</code> to install, or run <code>npx agent-engineering-kit</code> for the guided installer.`}</p>
        </div>
      </div>
      <div class="terminal">
        <pre><span class="prompt" aria-hidden="true">$ </span>${escapeHtml(command)}</pre>
        <button class="copy" type="button" data-copy="${escapeHtml(command)}">Copy</button>
      </div>
      ${notes.length ? `<ol class="rules-list notes">\n        ${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("\n        ")}\n      </ol>` : ""}
    </section>

    <section class="section" aria-labelledby="workflow">
      <div class="section-head">
        <p class="label">§04 · Day to day</p>
        <div>
          <h2 id="workflow">Plan, build test-first, verify, simplify, review, ship.</h2>
          <p>Use the <code>feature</code> skill for anything beyond a small fix (<code>/feature</code>, or “use the feature skill” where there are no slash commands). It plans first, builds test-first, runs your real checks, simplifies, and reviews before calling anything done. <a href="/skills/">The skills</a> and <a href="/agents/">the sub-agents</a> in full.</p>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="faq-title">
      <div class="section-head">
        <p class="label">§05 · Questions</p>
        <div>
          <h2 id="faq-title">${escapeHtml(name)} setup questions.</h2>
        </div>
      </div>
      <div class="faq">${faqBlock(data, page)}</div>
      <p class="more">Docs used: ${tool.docs.map((d) => `<a href="${escapeHtml(d)}">${escapeHtml(d.replace(/^https:\/\//, ""))}</a>`).join(" ")}</p>
    </section>
    `;
}

function setupList() {
  const items = PAGES.filter((p) => p.setup)
    .map((p) => `<li><a href="${p.path}"><span class="name">${escapeHtml(setupName(TOOL_PROFILES.find((t) => t.id === p.setup)))}</span></a><span class="leader" aria-hidden="true"></span><span class="what">${escapeHtml(p.title.replace(/^Best .*? Setup: /, ""))}</span></li>`)
    .join("\n        ");
  return `
      <ol class="index">
        ${items}
      </ol>
      `;
}

function guideList() {
  const items = PAGES.filter((p) => p.guide)
    .map((p) => `
        <article class="guide-card">
          <h2><a href="${p.path}">${escapeHtml(p.ogTitle.replace(/\.$/, ""))}</a></h2>
          <p>${escapeHtml(p.description)}</p>
        </article>`)
    .join("");
  return `
      <div class="guide-list">${items}
      </div>
      `;
}

function rulebook(md) {
  const sections = [...md.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => `<li><span class="num">§${m[1]}</span> ${escapeHtml(m[2])}</li>`);
  if (!sections.length) throw new Error('kit/rules/RULES.md: no "## N. Title" sections found');
  return `
      <ol class="rulebook">
        ${sections.join("\n        ")}
      </ol>
      `;
}

function faqBlock(data, page) {
  return (
    faqOf(page).map(
      (item) => `
        <div class="qa">
          <h3>${escapeHtml(item.q)}</h3>
          <p>${renderMarkdown(faqAnswer(item, data)).replace(/^<p>|<\/p>$/g, "")}</p>
        </div>`,
    ).join("") + "\n      "
  );
}

const BLOCKS = {
  "tool-index": toolIndex,
  faq: faqBlock,
  "always-on": (d) => `\n${renderMarkdown(d.rulesBlock.replace(/^## .*\n/, ""))}\n      `,
  rulebook: (d) => rulebook(d.rulebook),
  agents: (d) => cards(d.agents, (c) => [["Access", c.access === "read-only" ? "Read-only: it reports, it doesn’t edit" : "Edits code"]]),
  skills: (d) => cards(d.skills),
  safety: (d) => cards(d.safety),
  "safety-table": (d) => capTable(d.tools, ["format", "secretGuard"], "Format on edit and secret guard by tool"),
  "tools-table": (d) => capTable(d.tools, CAP_KINDS, "What each tool gets"),
  "tools-detail": toolsDetail,
  "rules-by-tool": (d) => detailTable(d.tools, "rules", "How each tool reads the rules"),
  "secret-by-tool": (d) => detailTable(d.tools, "secretGuard", "How each tool keeps agents out of secrets"),
  "format-by-tool": (d) => detailTable(d.tools, "format", "Format on edit by tool"),
  "guide-list": guideList,
  "setup-list": setupList,
  setup: (d, page) => setupBody(page.setup, d, page),
  changelog: (d) => `\n${renderChangelog(d.changelog)}\n      `,
};

const LAYOUT_BLOCKS = ["head", "header", "footer"];

// Per-tool setup pages are generated whole: this shell, filled by the blocks above.
const SETUP_STUB = `<!doctype html>
<html lang="en">
<head><!-- bake:head --><!-- /bake:head --></head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <!-- bake:header --><!-- /bake:header -->

  <main id="main" class="sheet"><!-- bake:setup --><!-- /bake:setup --></main>

  <!-- bake:footer --><!-- /bake:footer -->
</body>
</html>
`;

export function renderPage(html, page, data) {
  const unknown = [...html.matchAll(/<!-- bake:([\w-]+) -->/g)].map((m) => m[1]).filter((name) => !LAYOUT_BLOCKS.includes(name) && !(name in BLOCKS));
  if (unknown.length) throw new Error(`${page.file}: unknown bake block(s): ${unknown.join(", ")}`);
  let out = replaceBlock(html, "head", renderHead(page, data));
  out = replaceBlock(out, "header", renderHeader(page));
  out = replaceBlock(out, "footer", renderFooter());
  for (const [name, render] of Object.entries(BLOCKS)) {
    if (out.includes(`<!-- bake:${name} -->`)) out = replaceBlock(out, name, render(data, page));
  }
  out = bakeValue(out, "tool-count", String(data.toolCount));
  out = bakeValue(out, "agent-count", String(data.agents.length));
  out = bakeValue(out, "skill-count", String(data.skills.length));
  return applyLive(out, data);
}

// ---------- crawl files ----------

export function renderSitemap(pages, date) {
  const urls = pages
    .filter((p) => p.og)
    .map((p) => `  <url>\n    <loc>${SITE_URL}${p.path}</loc>\n    <lastmod>${date}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots() {
  const bots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "*"];
  return [
    "# Everything here is public and may be cited. The wildcard already allows every crawler;",
    "# the named AI crawlers are listed to make that explicit.",
    "",
    ...bots.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

export function renderLlms(pages, data) {
  const lines = [
    "# Agent Engineering Kit",
    "",
    `> An open-source (MIT) kit of rules, sub-agents, skills and hooks that gives AI coding agents the habits of a careful senior engineer: plan first, make surgical changes, verify with evidence, simplify and review. A safe installer (\`npx ${PACKAGE}\`) puts it into any project in the format of each of ${data.toolCount} AI coding tools (Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI and more), or any agent that reads AGENTS.md.`,
    "",
    "The installer previews every change as a diff before writing, merges AGENTS.md, CLAUDE.md and settings files instead of overwriting them, backs up files it changes, records what it did, and can update or uninstall cleanly. The always-on rules in AGENTS.md cost about 600 tokens per session; the full rulebook is reference that skills and agents open one section at a time.",
    "",
    "## Pages",
    "",
    ...pages.filter((p) => p.og).map((p) => `- [${p.nav ?? (p.path === "/" ? "Home" : p.ogTitle.replace(/\.$/, ""))}](${SITE_URL}${p.path}): ${p.llms}`),
    "",
    "## Links",
    "",
    `- [GitHub repository](${GITHUB}): source, issues, docs (MIT)`,
    `- [npm package](${NPM}): \`npx ${PACKAGE}\``,
    `- [Install with your AI agent](https://raw.githubusercontent.com/${REPO}/main/docs/install-with-an-agent.md): the instructions an agent follows to install the kit`,
    "",
  ];
  return lines.join("\n");
}

// ---------- images (headless Chrome; skipped without it) ----------

const runs = (bin) => spawnSync(bin, ["--version"], { stdio: "ignore", timeout: 10000 }).status === 0;

function findChrome() {
  if (process.env.CHROME_PATH) {
    if (runs(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    warn(`CHROME_PATH=${process.env.CHROME_PATH} doesn't run; looking for Chrome elsewhere`);
  }
  return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].find(runs);
}

function screenshot(chrome, html, out, width, height) {
  const dir = mkdtempSync(path.join(tmpdir(), "aek-site-"));
  try {
    const file = path.join(dir, "page.html");
    writeFileSync(file, html);
    const shot = path.join(dir, "shot.png");
    const result = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--user-data-dir=${dir}`, `--window-size=${width},${height}`, "--virtual-time-budget=3000", `--screenshot=${shot}`, pathToFileURL(file).href], { stdio: "pipe", timeout: 60000 });
    if (result.status !== 0) throw new Error(`Chrome failed (status ${result.status}, signal ${result.signal}${result.error ? `, ${result.error.message}` : ""}): ${String(result.stderr).slice(0, 300)}`);
    if (!existsSync(shot) || statSync(shot).size === 0) throw new Error("Chrome exited without writing a screenshot");
    copyFileSync(shot, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const fontFaces = () =>
  ["newsreader-display-600.woff2:Newsreader:600:normal", "newsreader-italic-500.woff2:Newsreader:500:italic", "jetbrains-mono.woff2:JetBrains Mono:400 700:normal"]
    .map((spec) => {
      const [file, family, weight, style] = spec.split(":");
      if (!existsSync(path.join(SITE, "fonts", file))) throw new Error(`site/fonts/${file} is missing`);
      return `@font-face{font-family:"${family}";src:url("${pathToFileURL(path.join(SITE, "fonts", file)).href}");font-weight:${weight};font-style:${style}}`;
    })
    .join("");

function ogHtml(page, data) {
  const label = page.nav ?? (page.guide ? "Guide" : page.setup || page.path === "/setup/" ? "Setup" : "Front page");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;padding:56px 72px;background:#fff;color:#141414;display:flex;flex-direction:column;
background-image:linear-gradient(90deg,transparent 40px,rgba(209,64,31,.45) 40px,rgba(209,64,31,.45) 41px,transparent 41px)}
.bar{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:3px solid #141414;font:600 20px/1 "JetBrains Mono";letter-spacing:.08em;text-transform:uppercase}
.bar span:last-child{color:#b5341a}
.brand{display:flex;align-items:center;gap:14px}.brand svg{width:34px;height:34px}
h1{margin-top:auto;max-width:980px;font:600 ${page.ogTitle.length > 44 ? 76 : 92}px/1 "Newsreader";letter-spacing:-.025em}
svg{display:block;margin:14px 0 0 -6px}
.foot{display:flex;justify-content:space-between;align-items:center;margin-top:38px;padding-top:18px;border-top:1px solid #141414;font:500 24px/1 "JetBrains Mono"}
.stamp{padding:8px 16px 6px;border:3px solid #d1401f;color:#b5341a;font:700 24px/1 "JetBrains Mono";letter-spacing:.18em;text-transform:uppercase;transform:rotate(-6deg)}
</style></head><body>
<div class="bar"><span class="brand">${readFileSync(path.join(SITE, "favicon.svg"), "utf8")}The Agent Engineering Kit</span><span>${escapeHtml(label)}</span></div>
<h1>${escapeHtml(page.ogTitle)}</h1>
<svg width="420" height="18" viewBox="0 0 420 18"><path d="M4 12C90 4 170 15 250 8s120-4 164 2" fill="none" stroke="#d1401f" stroke-width="5" stroke-linecap="round"/></svg>
<div class="foot"><span>$ npx ${PACKAGE}</span><span class="stamp">Verified</span></div>
</body></html>`;
}

/** Icons of 180px and up are home-screen icons, which platforms show on an opaque square. */
function iconHtml(size) {
  const svg = readFileSync(path.join(SITE, "favicon.svg"), "utf8");
  const square = size >= 180;
  const inner = square ? Math.round(size * 0.84) : size;
  return `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;overflow:hidden;display:grid;place-items:center;background:${square ? "#ffffff" : "transparent"}}svg{display:block;width:${inner}px;height:${inner}px}</style></head><body>${svg}</body></html>`;
}

/** Renders every OG image and icon PNG into outDir. A failed job warns and leaves that file as it was. */
export function renderImages(chrome, data, { outDir = SITE, report = warn } = {}) {
  const jobs = [
    ...PAGES.filter((p) => p.og).map((p) => [ogHtml(p, data), `og/${p.og}.png`, 1200, 630]),
    [iconHtml(32), "favicon-32.png", 32, 32],
    [iconHtml(180), "apple-touch-icon.png", 180, 180],
    [iconHtml(192), "icon-192.png", 192, 192],
    [iconHtml(512), "icon-512.png", 512, 512],
  ];
  for (const [html, out, w, h] of jobs) {
    try {
      screenshot(chrome, html, path.join(outDir, out), w, h);
    } catch (err) {
      report(`${out}: ${err.message}; keeping the existing image`);
    }
  }
}

// ---------- main ----------

async function main() {
  const offline = process.argv.includes("--offline");
  const stored = existsSync(LIVE_FILE) ? JSON.parse(readFileSync(LIVE_FILE, "utf8")) : {};
  const fetched = offline ? { stars: null, downloads: null, version: null } : await fetchLive();
  const live = mergeLive(fetched, stored, JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  if (fetched.stars !== null || fetched.downloads !== null) writeFileSync(LIVE_FILE, `${JSON.stringify({ stars: live.stars, downloads: live.downloads }, null, 2)}\n`);

  const data = siteData(live);
  for (const page of PAGES.filter((p) => p.setup)) {
    const file = path.join(ROOT, page.file);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, SETUP_STUB);
  }
  for (const page of PAGES) {
    const file = path.join(ROOT, page.file);
    writeFileSync(file, renderPage(readFileSync(file, "utf8"), page, data));
  }
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(path.join(SITE, "sitemap.xml"), renderSitemap(PAGES, today));
  writeFileSync(path.join(SITE, "robots.txt"), renderRobots());
  writeFileSync(path.join(SITE, "llms.txt"), renderLlms(PAGES, data));

  const chrome = offline ? null : findChrome();
  if (chrome) renderImages(chrome, data);
  else if (!offline) warn("Chrome not found (set CHROME_PATH); keeping the existing images");
  const missing = PAGES.filter((p) => p.og && !existsSync(path.join(SITE, "og", `${p.og}.png`)));
  if (missing.length) throw new Error(`no Open Graph image for ${missing.map((p) => p.path).join(", ")}; run the build where Chrome is available`);
  console.log(`built ${PAGES.length} pages: version ${data.version}, ${data.toolCount} tools, stars ${live.stars ?? "unknown"}, downloads ${live.downloads ?? "unknown"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
