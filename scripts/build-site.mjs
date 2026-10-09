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
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

export const PAGES = [
  {
    path: "/",
    file: "site/index.html",
    og: "home",
    title: "Agent Engineering Kit: make AI coding agents ship clean code",
    description: "Rules, sub-agents and skills that give AI coding agents a senior engineer's habits: plan first, verify with evidence, simplify, review. One safe installer.",
    ogTitle: "Make your AI coding agents ship clean, maintainable code.",
    llms: "What the kit is, the six-step workflow, the parts, supported tools, the installer's safety, and an FAQ.",
  },
  {
    path: "/rules/",
    file: "site/rules/index.html",
    og: "rules",
    nav: "Rules",
    title: "AGENTS.md rules for AI coding agents | Agent Engineering Kit",
    description: "The always-on rules the kit adds to AGENTS.md (about 600 tokens) and the rulebook that skills and agents open one section at a time.",
    ogTitle: "The rules your agent reads every session.",
    llms: "The always-on rules block in AGENTS.md, word for word, and the ten sections of the rulebook.",
  },
  {
    path: "/agents/",
    file: "site/agents/index.html",
    og: "agents",
    nav: "Agents",
    title: "Sub-agents for code review and verification | Agent Eng. Kit",
    description: "Eight focused sub-agents: explorer, architect, verifier, simplifier, test-analyzer, silent-failure-hunter, security-reviewer and frontend-reviewer.",
    ogTitle: "Sub-agents with one job each.",
    llms: "Each sub-agent: what it does, when it's used, an example, and whether it can edit code.",
  },
  {
    path: "/skills/",
    file: "site/skills/index.html",
    og: "skills",
    nav: "Skills",
    title: "Skills for Claude Code, Codex and Cursor | Agent Eng. Kit",
    description: "feature, quick-fix, verify-change, ship, learn and project-conventions: the skills that run the plan, build, verify, review and ship workflow.",
    ogTitle: "Skills that run the whole workflow.",
    llms: "Each skill (feature, quick-fix, verify-change, ship, learn, project-conventions): what it does, when to use it, and what it needs.",
  },
  {
    path: "/safety/",
    file: "site/safety/index.html",
    og: "safety",
    nav: "Safety",
    title: "Guardrails for AI coding agents | Agent Engineering Kit",
    description: "A format-on-edit hook, a secret guard that keeps agents out of .env files, and optional pre-commit checks that run your project's own lint and tests.",
    ogTitle: "Guardrails that don't depend on the agent remembering.",
    llms: "The format-on-edit hook, the secret guard and the pre-commit checks, with what each AI tool supports.",
  },
  {
    path: "/tools/",
    file: "site/tools/index.html",
    og: "tools",
    nav: "Tools",
    title: "Supported tools: Cursor, Copilot, Gemini CLI, Codex and more",
    description: "What each AI coding tool gets from the kit in its own format: AGENTS.md rules, skills, sub-agents, format on edit and secret guard, with links to its docs.",
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
    title: "How the installer works: preview, merge, backups, uninstall",
    description: "How the installer previews every change, merges AGENTS.md and settings without overwriting, backs up files, records what it did and uninstalls cleanly.",
    ogTitle: "What the installer does to your files.",
    llms: "Where files go, how existing files are merged, backups, the install record, update, uninstall and the safety checks.",
  },
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
const plain = (md) => md.replace(/`([^`]+)`/g, "$1");

// ---------- head, header, footer ----------

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
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
        {
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: plain(faqAnswer(item, data)) } })),
        },
      ],
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: page.nav, item: SITE_URL + page.path },
    ],
  };
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
    .map((p) => `<li><a href="${p.path}"${p === page ? ' aria-current="page"' : ""}>${p.nav}</a></li>`)
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
      <a class="wordmark" href="/">The Agent Engineering Kit</a>
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
    <p><a href="${GITHUB}">Source on GitHub</a> <span aria-hidden="true">/</span> <a href="${NPM}">Package on npm</a> <span aria-hidden="true">/</span> <a href="/llms.txt">llms.txt</a></p>
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
  const rows = tools.map((t) => `<tr><th scope="row">${escapeHtml(t.name)}</th>${kinds.map((k) => capCell(t.caps[k])).join("")}</tr>`).join("\n        ");
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
      return `<li><span class="name">${escapeHtml(t.name)}</span><span class="leader" aria-hidden="true"></span><span class="what">${native.length ? native.join(", ") : "notes only"}</span></li>`;
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

function rulebook(md) {
  const sections = [...md.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => `<li><span class="num">§${m[1]}</span> ${escapeHtml(m[2])}</li>`);
  if (!sections.length) throw new Error('kit/rules/RULES.md: no "## N. Title" sections found');
  return `
      <ol class="rulebook">
        ${sections.join("\n        ")}
      </ol>
      `;
}

function faqBlock(data) {
  return (
    FAQ.map(
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
  changelog: (d) => `\n${renderChangelog(d.changelog)}\n      `,
};

const LAYOUT_BLOCKS = ["head", "header", "footer"];

export function renderPage(html, page, data) {
  const unknown = [...html.matchAll(/<!-- bake:([\w-]+) -->/g)].map((m) => m[1]).filter((name) => !LAYOUT_BLOCKS.includes(name) && !(name in BLOCKS));
  if (unknown.length) throw new Error(`${page.file}: unknown bake block(s): ${unknown.join(", ")}`);
  let out = replaceBlock(html, "head", renderHead(page, data));
  out = replaceBlock(out, "header", renderHeader(page));
  out = replaceBlock(out, "footer", renderFooter());
  for (const [name, render] of Object.entries(BLOCKS)) {
    if (out.includes(`<!-- bake:${name} -->`)) out = replaceBlock(out, name, render(data));
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
    ...pages.filter((p) => p.og).map((p) => `- [${p.nav ?? "Home"}](${SITE_URL}${p.path}): ${p.llms}`),
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
  const label = page.nav ?? "Front page";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;padding:56px 72px;background:#fff;color:#141414;display:flex;flex-direction:column;
background-image:linear-gradient(90deg,transparent 40px,rgba(209,64,31,.45) 40px,rgba(209,64,31,.45) 41px,transparent 41px)}
.bar{display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #141414;font:600 20px/1 "JetBrains Mono";letter-spacing:.08em;text-transform:uppercase}
.bar span:last-child{color:#b5341a}
h1{margin-top:auto;max-width:980px;font:600 ${page.ogTitle.length > 44 ? 76 : 92}px/1 "Newsreader";letter-spacing:-.025em}
svg{display:block;margin:14px 0 0 -6px}
.foot{display:flex;justify-content:space-between;align-items:center;margin-top:38px;padding-top:18px;border-top:1px solid #141414;font:500 24px/1 "JetBrains Mono"}
.stamp{padding:8px 16px 6px;border:3px solid #d1401f;color:#b5341a;font:700 24px/1 "JetBrains Mono";letter-spacing:.18em;text-transform:uppercase;transform:rotate(-6deg)}
</style></head><body>
<div class="bar"><span>The Agent Engineering Kit</span><span>${escapeHtml(label)}</span></div>
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
