import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGES,
  SITE_URL,
  applyLive,
  bakeValue,
  fetchLive,
  mergeLive,
  renderChangelog,
  renderHead,
  renderLlms,
  renderMarkdown,
  renderImages,
  renderPage,
  renderRobots,
  renderSitemap,
  replaceBlock,
  siteData,
  warningLine,
} from "./build-site.mjs";
import { TOOL_PROFILES } from "../installer/dist/tools/profiles.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");

test("replaceBlock swaps only the content between a block's markers", () => {
  const html = "<p>a</p><!-- bake:x -->old<!-- /bake:x --><p>b</p>";
  assert.equal(replaceBlock(html, "x", "new"), "<p>a</p><!-- bake:x -->new<!-- /bake:x --><p>b</p>");
});

test("replaceBlock is idempotent and leaves other blocks alone", () => {
  const html = "<!-- bake:x -->1<!-- /bake:x --><!-- bake:y -->2<!-- /bake:y -->";
  const once = replaceBlock(html, "x", "9");
  assert.equal(replaceBlock(once, "x", "9"), once);
  assert.match(once, /<!-- bake:y -->2<!-- \/bake:y -->/);
});

test("replaceBlock throws when a page lacks the block, so a missing marker can't silently skip content", () => {
  assert.throws(() => replaceBlock("<p>no markers</p>", "x", "new"), /bake:x/);
});

test("replaceBlock inserts content literally, even with $ sequences", () => {
  assert.equal(replaceBlock("<!-- bake:x --><!-- /bake:x -->", "x", "$1 $& $$"), "<!-- bake:x -->$1 $& $$<!-- /bake:x -->");
});

test("bakeValue sets every element with that data-bake name", () => {
  const html = '<li>Edition <span data-bake="version">1.0.0</span></li><b data-bake="version">1.0.0</b><i data-bake="other">x</i>';
  assert.equal(bakeValue(html, "version", "1.2.3"), '<li>Edition <span data-bake="version">1.2.3</span></li><b data-bake="version">1.2.3</b><i data-bake="other">x</i>');
});

test("bakeValue throws when an element carries the name but can't be filled, instead of leaving a stale number", () => {
  assert.throws(() => bakeValue('<span data-bake="agent-count"><b>8</b></span>', "agent-count", "9"), /agent-count/);
});

test("bakeValue escapes HTML in the value", () => {
  assert.equal(bakeValue('<b data-bake="v">1</b>', "v", "<x>"), '<b data-bake="v">&lt;x&gt;</b>');
});

test("applyLive bakes fetched numbers and shows their cells", () => {
  const html = '<li data-bake-cell="stars" hidden><span data-bake="stars">0</span> stars</li><span data-bake="version">1.0.0</span>';
  const out = applyLive(html, { stars: 1234, downloads: null, version: "1.2.3" });
  assert.match(out, /<li data-bake-cell="stars"><span data-bake="stars">1,234<\/span>/);
  assert.match(out, /data-bake="version">1\.2\.3</);
});

test("applyLive keeps the last value when a fetch failed (null)", () => {
  const html = '<li data-bake-cell="stars"><span data-bake="stars">42</span></li><span data-bake="version">1.2.2</span>';
  assert.equal(applyLive(html, { stars: null, downloads: null, version: null }), html);
});

test("applyLive hides a count of zero instead of printing it", () => {
  const html = '<li data-bake-cell="downloads"><span data-bake="downloads">5</span></li>';
  assert.equal(applyLive(html, { stars: null, downloads: 0, version: null }), '<li data-bake-cell="downloads" hidden><span data-bake="downloads">5</span></li>');
});

test("mergeLive keeps the last stored stars and downloads, but falls back to package.json for the version", () => {
  assert.deepEqual(mergeLive({ stars: null, downloads: null, version: null }, { stars: 12, downloads: 30, version: "1.0.0" }, "1.2.3"), { stars: 12, downloads: 30, version: "1.2.3" });
  assert.deepEqual(mergeLive({ stars: 13, downloads: 0, version: "1.2.4" }, { stars: 12, downloads: 30 }, "1.2.3"), { stars: 13, downloads: 0, version: "1.2.4" });
  assert.deepEqual(mergeLive({ stars: null, downloads: null, version: null }, {}, "1.2.3"), { stars: null, downloads: null, version: "1.2.3" });
  assert.equal(mergeLive({ stars: 0, downloads: null, version: null }, { stars: 5 }, "1.2.3").stars, 0, "a fetched zero is a real value, not a failure");
  assert.equal(mergeLive({ stars: null, downloads: null, version: "1.2.3" }, {}, "1.10.0").version, "1.10.0", "a release commit shows its own, newer version");
  assert.equal(mergeLive({ stars: null, downloads: null, version: "1.10.0" }, {}, "1.9.9").version, "1.10.0");
});

test("fetchLive sends the GitHub token to the GitHub API only", async () => {
  const seen = {};
  const fakeFetch = async (url, init) => {
    seen[new URL(url).host] = init.headers.Authorization;
    return { ok: true, json: async () => ({ stargazers_count: 1, downloads: 1, version: "1.0.0" }) };
  };
  await fetchLive({ fetch: fakeFetch, token: "t", warn: () => {} });
  assert.deepEqual(seen, { "api.github.com": "Bearer t", "api.npmjs.org": undefined, "registry.npmjs.org": undefined });
});

test("warnings become GitHub Actions annotations in CI, so a fallback shows on the run summary", () => {
  assert.equal(warningLine("stars: offline", { GITHUB_ACTIONS: "true" }), "::warning title=build-site::stars: offline");
  assert.equal(warningLine("stars: offline", {}), "warning: stars: offline");
});

test("fetchLive returns null for each source that fails, and never throws", async () => {
  const warnings = [];
  const fakeFetch = async (url) => {
    if (url.includes("api.github.com")) return { ok: true, json: async () => ({ stargazers_count: 7 }) };
    if (url.includes("api.npmjs.org")) return { ok: false, status: 404, json: async () => ({}) };
    throw new Error("offline");
  };
  const live = await fetchLive({ fetch: fakeFetch, warn: (m) => warnings.push(m) });
  assert.deepEqual(live, { stars: 7, downloads: null, version: null });
  assert.equal(warnings.length, 2);
});

test("fetchLive rejects a response without the expected field", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ error: "not found" }) });
  const live = await fetchLive({ fetch: fakeFetch, warn: () => {} });
  assert.deepEqual(live, { stars: null, downloads: null, version: null });
});

test("renderMarkdown renders the subset the changelog and rules use, escaping HTML", () => {
  const md = "Intro with `code`, **bold** and a [link](https://x.dev).\n\n- one <b>\n- two\n  continued\n\n1. first\n2. second";
  assert.equal(
    renderMarkdown(md),
    '<p>Intro with <code>code</code>, <strong>bold</strong> and a <a href="https://x.dev">link</a>.</p>\n' +
      "<ul>\n<li>one &lt;b&gt;</li>\n<li>two continued</li>\n</ul>\n" +
      "<ol>\n<li>first</li>\n<li>second</li>\n</ol>",
  );
});

test("renderMarkdown points repo-relative links at GitHub", () => {
  assert.match(renderMarkdown("See [docs](docs/working-habits.md)."), /href="https:\/\/github\.com\/vishalguptax\/agent-engineering-kit\/blob\/main\/docs\/working-habits\.md"/);
});

test("renderChangelog gives each version a heading with a stable anchor", () => {
  const html = renderChangelog("# Changelog\n\nIntro.\n\n## 1.2.3 — 2026-10-09\n\n### Fixes\n- A fix.\n");
  assert.match(html, /<h2 id="v1-2-3">1\.2\.3 <span class="date">2026-10-09<\/span><\/h2>/);
  assert.match(html, /<h3>Fixes<\/h3>/);
  assert.doesNotMatch(html, /Changelog/);
});

test("renderChangelog throws on a version heading it can't anchor, so #v links can't silently break", () => {
  assert.throws(() => renderChangelog("## 1.2.3 - 2026-10-09\n"), /1\.2\.3/);
});

test("renderChangelog renders every version in CHANGELOG.md", () => {
  const md = read("CHANGELOG.md");
  const versions = [...md.matchAll(/^## (\d+\.\d+\.\d+) /gm)].map((m) => m[1]);
  const html = renderChangelog(md);
  for (const v of versions) assert.match(html, new RegExp(`id="v${v.replace(/\./g, "-")}"`));
});

test("renderPage throws on a bake marker it doesn't know, so a misspelled block can't keep stale content", () => {
  const html = "<head><!-- bake:head --><!-- /bake:head --></head><!-- bake:header --><!-- /bake:header --><!-- bake:tool-table --><!-- /bake:tool-table --><!-- bake:footer --><!-- /bake:footer -->";
  assert.throws(() => renderPage(html, PAGES[5], siteData()), /tool-table/);
});

test("every page has a unique title of at most 60 characters and a unique description of at most 155", () => {
  const titles = PAGES.map((p) => p.title);
  const descriptions = PAGES.map((p) => p.description);
  for (const page of PAGES) {
    assert.ok(page.title.length <= 60, `${page.path} title is ${page.title.length} chars`);
    assert.ok(page.description.length <= 155, `${page.path} description is ${page.description.length} chars`);
  }
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test("renderHead has canonical, Open Graph, Twitter card and valid JSON-LD", () => {
  const data = siteData();
  for (const page of PAGES) {
    const head = renderHead(page, data);
    const url = SITE_URL + page.path;
    if (page.path === "/404.html") {
      // GitHub Pages serves it with HTTP 404, which keeps it out of search; it gets no canonical or share card.
      assert.doesNotMatch(head, /rel="canonical"|og:|twitter:|application\/ld\+json/);
      assert.match(head, /<title>Page not found/);
      continue;
    }
    assert.match(head, new RegExp(`<link rel="canonical" href="${url}">`));
    assert.match(head, new RegExp(`<meta property="og:url" content="${url}">`));
    assert.match(head, /<meta property="og:image" content="https:\/\/agentengineeringkit\.vishalg\.in\/og\/[a-z-]+\.png">/);
    assert.match(head, /<meta name="twitter:card" content="summary_large_image">/);
    const blocks = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const types = blocks.flatMap((b) => (b["@graph"] ?? [b]).map((n) => n["@type"]));
    if (page.path === "/") {
      assert.ok(types.includes("SoftwareApplication") && types.includes("WebSite") && types.includes("FAQPage"));
    } else {
      assert.deepEqual(types, ["BreadcrumbList"]);
    }
  }
});

test("the home page's SoftwareApplication carries the fields search engines need", () => {
  const head = renderHead(PAGES[0], siteData());
  const graph = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
  const app = graph.find((n) => n["@type"] === "SoftwareApplication");
  assert.equal(app.applicationCategory, "DeveloperApplication");
  assert.equal(app.operatingSystem, "macOS, Windows, Linux");
  assert.equal(app.offers.price, "0");
  assert.equal(app.license, "https://opensource.org/licenses/MIT");
  assert.equal(app.author.name, "Vishal Gupta");
  assert.equal(app.author.url, "https://vishalg.in");
  assert.match(app.softwareVersion, /^\d+\.\d+\.\d+$/);
});

test("the home page's FAQPage matches the FAQ visible on the page", () => {
  const html = read("site/index.html");
  const head = renderHead(PAGES[0], siteData());
  const faq = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"].find((n) => n["@type"] === "FAQPage");
  for (const q of faq.mainEntity) assert.ok(html.includes(`>${q.name}</`), `visible FAQ lacks: ${q.name}`);
});

test("sitemap lists every indexable page with the build date, and parses as a urlset", () => {
  const xml = renderSitemap(PAGES, "2026-10-09");
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const page of PAGES.filter((p) => p.path !== "/404.html")) {
    assert.ok(xml.includes(`<loc>${SITE_URL}${page.path}</loc>`), page.path);
  }
  assert.doesNotMatch(xml, /404/);
  assert.equal(xml.match(/<lastmod>2026-10-09<\/lastmod>/g).length, PAGES.length - 1);
});

test("robots.txt allows every crawler, names the AI crawlers and points at the sitemap", () => {
  const robots = renderRobots();
  for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "*"]) {
    assert.match(robots, new RegExp(`User-agent: ${bot.replace("*", "\\*")}\\nAllow: /`));
  }
  assert.match(robots, /Sitemap: https:\/\/agentengineeringkit\.vishalg\.in\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow/);
});

test("llms.txt has a summary and one line with a link per indexable page", () => {
  const llms = renderLlms(PAGES, siteData());
  assert.match(llms, /^# Agent Engineering Kit\n\n> /);
  for (const page of PAGES.filter((p) => p.path !== "/404.html")) assert.ok(llms.includes(`](${SITE_URL}${page.path})`), page.path);
});

test("the tool count comes from the installer's tool profiles, not a constant", () => {
  assert.equal(siteData().toolCount, TOOL_PROFILES.filter((t) => t.id !== "generic").length);
});

test("every committed page is exactly what the build produces (run `node scripts/build-site.mjs --offline` after changing a source)", () => {
  const stored = JSON.parse(read("scripts/live-numbers.json"));
  const data = siteData(mergeLive({ stars: null, downloads: null, version: null }, stored, JSON.parse(read("package.json")).version));
  for (const page of PAGES) {
    const html = read(page.file);
    assert.equal(renderPage(html, page, data), html, `${page.file} is stale`);
    assert.match(html, new RegExp(`data-bake="version">${data.version.replace(/\./g, "\\.")}<`), `${page.file} shows the version`);
    assert.match(html, new RegExp(`data-bake="tool-count">${data.toolCount}<`), `${page.file} shows the tool count`);
  }
});

test("a failed image render warns per image and leaves the existing file as it was", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aek-images-"));
  try {
    const fakes = { "exits 1": "exit 1", "exits 0 without writing": "exit 0" };
    for (const [label, body] of Object.entries(fakes)) {
      const chrome = path.join(dir, label.replace(/\W+/g, "-"));
      writeFileSync(chrome, `#!/bin/sh\n${body}\n`);
      chmodSync(chrome, 0o755);
      const out = path.join(dir, `out-${label.replace(/\W+/g, "-")}`);
      mkdirSync(path.join(out, "og"), { recursive: true });
      writeFileSync(path.join(out, "og", "home.png"), "old image");
      const warnings = [];
      renderImages(chrome, siteData(), { outDir: out, report: (m) => warnings.push(m) });
      assert.equal(warnings.length, PAGES.filter((p) => p.og).length + 4, `Chrome ${label}: one warning per image`);
      assert.equal(readFileSync(path.join(out, "og", "home.png"), "utf8"), "old image", `Chrome ${label}: existing image kept`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every page file exists and carries the head, header and footer blocks", () => {
  for (const page of PAGES) {
    const html = read(page.file);
    for (const block of ["head", "header", "footer"]) assert.match(html, new RegExp(`<!-- bake:${block} -->[\\s\\S]*<!-- /bake:${block} -->`), `${page.file}: ${block}`);
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1, `${page.file} has one h1`);
  }
});

test("the npm package doesn't ship the site or the build script", () => {
  const pkg = JSON.parse(read("package.json"));
  for (const entry of pkg.files) assert.ok(!/^(site|scripts)\b/.test(entry), entry);
});

test("the Pages workflow deploys site/ on the right triggers with the right permissions", () => {
  const yml = read(".github/workflows/pages.yml").replace(/^\s*#.*$/gm, "");
  const inputs = ["site/**", "scripts/build-site.mjs", ".github/workflows/pages.yml", "CHANGELOG.md", "kit/**", "installer/kit.manifest.json", "installer/dist/**", "package.json", "scripts/live-numbers.json"];
  for (const p of inputs) assert.match(yml, new RegExp(`^\\s+- "${p.replace(/[.*/]/g, "\\$&")}"$`, "m"), p);
  assert.match(yml, /workflow_dispatch:/);
  assert.match(yml, /cron: "0 \*\/12 \* \* \*"/);
  assert.match(yml, /pages: write/);
  assert.match(yml, /id-token: write/);
  assert.match(yml, /group: pages/);
  assert.match(yml, /node scripts\/build-site\.mjs/);
  assert.match(yml, /path: site/);
});

test("site/CNAME names the custom domain", () => {
  assert.equal(read("site/CNAME").trim(), "agentengineeringkit.vishalg.in");
  assert.ok(existsSync(path.join(ROOT, "site/.nojekyll")));
});
