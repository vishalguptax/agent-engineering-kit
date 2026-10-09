# Plan 001: Website at agentengineeringkit.vishalg.in

> Written by the feature skill to `.agent-kit/plans/NNN-<slug>.md`. One file per piece of work, so any session or tool can resume it.
> Status: Done (2026-10-09; gate 2 approved by the user; waiting for review and the OK to commit)

## Problem
The kit has no website: only the README and `docs/`. The user wants a marketing-and-docs site (`website-brief.md`) built as "The Review Copy": a printed engineering spec sheet that a senior engineer marks up in red pen. It is hosted on GitHub Pages at `agentengineeringkit.vishalg.in`, with live numbers baked in at build time and solid SEO and AI-search plumbing, without touching the npm package.

## Appetite
A few working sessions. Gate 2 (design proof) comes before any other page, so the look is settled before it is repeated ten times. If full motion can't meet Lighthouse ≥ 95 or AA, fall back to the brief's minimal version (static before/after hero, one stamp).

## Decisions (made from the brief, the repo and the user's answers; no grilling round, per the user)
- **Installs approved (2026-10-09):**
  - Lighthouse via `npx` from the scratchpad (not a project dependency).
  - Newsreader and JetBrains Mono woff2 files, committed with their OFL licenses.
  - frontend-design read from GitHub only (no install).
  - Superdesign skipped.
- **Fonts (3 files, ~80 KB):**
  - `newsreader-display-600.woff2` (opsz 72, wght 600, 23 KB) for every serif heading;
  - `newsreader-italic-500.woff2` (opsz 36, 25 KB) for red-pen margin notes only;
  - `jetbrains-mono.woff2` (wght 400–700, 31 KB) for labels and code.
  - Body text stays system sans, per `DESIGN.md`. Only the display font is preloaded.
- **Images:** no photos or stock. Visuals are typeset diffs, inline SVG and stamps. The only raster files are generated OG PNGs and icon PNGs, plus at most one installer screenshot on `/how-it-works/`, and only if that page needs it (user: "only if it's needed").
- **Build model (copied from claude-code-manager):** the HTML in `site/` is hand-written and committed, and always complete and valid. `scripts/build-site.mjs` rewrites marked regions in place:
  - `<!-- bake:NAME -->…<!-- /bake:NAME -->` for generated blocks;
  - `data-bake="NAME"` elements for single numbers.
  - On a fetch failure the old value stays. The Pages workflow runs the build and deploys `site/` without committing back. Locally, running it refreshes the committed files.
- **Single source of truth:**
  - The `PAGES` table in the build script holds path, title, description, h1, breadcrumb, JSON-LD types and OG title. It generates each page's `<head>` SEO block, the nav and footer, `sitemap.xml`, `llms.txt` and the OG images.
  - Tool data is imported from `installer/dist/tools/profiles.js` and `capabilities.js` (the same code that prints `--list-tools`). Tool count = profiles minus `generic` (18 today).
  - Agents, skills and safety cards come from `installer/kit.manifest.json`.
  - The always-on rules come from `kit/instructions/agents-block.md`, rulebook sections from `kit/rules/RULES.md`, and the changelog from `CHANGELOG.md`.
- **Live numbers:**
  - GitHub stars: `api.github.com/repos/vishalguptax/agent-engineering-kit`, using `GITHUB_TOKEN` when present.
  - npm weekly downloads: `api.npmjs.org/downloads/point/last-week/agent-engineering-kit`.
  - Latest version: `registry.npmjs.org/agent-engineering-kit/latest`.
- **OG images and icon PNGs:** rendered at build time from generated SVG/HTML using a locally installed Chrome (`CHROME_PATH`, or the standard macOS/Linux paths; `ubuntu-latest` ships google-chrome). With no Chrome, the committed PNGs stay. No npm dependency.
- **Tests:** the pure functions of the build script are exported and tested in `scripts/build-site.test.mjs` with `node:test`:
  - marker replacement, keep-last-on-failure, the Markdown renderer, sitemap, robots, llms, head generation, and the unique title/description lengths.
  - Root `npm test` becomes `npm --prefix installer test && node --test scripts/`, so CI runs them.
  - The script runs `main()` only when executed directly.
- **No version bump / CHANGELOG entry:** the site isn't part of the npm package, and the brief requires that a site-only push publishes nothing. (This departs from the "bump kitVersion for user-visible changes" preference, on purpose.)
- **Pages workflow paths:** besides the brief's `site/**`, `scripts/build-site.mjs` and `pages.yml`, it also triggers on `CHANGELOG.md`, `kit/**`, `installer/kit.manifest.json` and `installer/dist/**`, because the build reads them. The 12-hour schedule would catch them anyway; this makes it immediate.
- **No theme toggle:** the site follows the system setting (the brief asks for both themes, not a switch).

## Requirements
- R1 (Must): pages `/`, `/rules/`, `/agents/`, `/skills/`, `/safety/`, `/tools/`, `/install/`, `/how-it-works/`, `/changelog/`, `/404.html` in `site/`; one `h1` each, ordered heading levels, human and specific copy with no hype words.
- R2 (Must): every claim, number and tool name traces to a repo file or is baked by the build. No testimonials, user counts beyond the baked npm/GitHub numbers, or logos.
- R3 (Must): Review Copy design system in `site/DESIGN.md` (DESIGN.md format), extending the root tokens:
  - a clamp type scale up to display sizes, a 12-column grid with visible column rules, section rules, the edition bar, stamps and pen marks;
  - zero radius; one accent (red pen in light, amber in dark).
- R4 (Must): hero red-pen animation. The sloppy diff gets SVG strokes and margin notes, resolves to the clean diff, and a VERIFIED stamp lands. It runs once, with a keyboard-operable Replay button.
- R5 (Flexible): traveling change card through Plan → Build test-first → Verify → Simplify → Review → Ship, picking up each step's mark (CSS scroll-driven; static complete card where unsupported or on narrow screens).
- R6 (Flexible): install command types itself once; tool index set like a newspaper index; counters tick once.
- R7 (Must): `prefers-reduced-motion: reduce` → complete static design: marked-up "before" and clean "after" both visible, stamps placed, no traveling motion, no typing, final numbers.
- R8 (Must): `scripts/build-site.mjs`: bakes stars, weekly downloads and version, keeping the last value on failure; renders `/changelog/` and the tools/agents/skills/safety/rules blocks; writes `sitemap.xml` (build `lastmod`), `llms.txt`, per-page heads and OG PNGs; no npm dependencies.
- R9 (Must): `.github/workflows/pages.yml` matching the brief: push paths, `workflow_dispatch`, 12h cron, `pages: write` + `id-token: write`, concurrency `pages`.
- R10 (Must): SEO per page:
  - unique title ≤ 60 characters and description ≤ 155;
  - canonical, Open Graph and `twitter:card=summary_large_image` tags, with a 1200×630 OG image per page;
  - JSON-LD: SoftwareApplication + WebSite on home, BreadcrumbList on subpages, FAQPage only on pages with a visible FAQ.
- R11 (Must): `robots.txt` (allow all + named AI crawlers + sitemap), `llms.txt`, favicon SVG + PNG, `apple-touch-icon`, `site.webmanifest`, `CNAME`, `.nojekyll`.
- R12 (Must): performance:
  - critical CSS inlined, the rest deferred;
  - JS ≤ ~30 KB gzipped per page;
  - only the display font preloaded; CLS < 0.05;
  - no third-party scripts.
- R13 (Must): accessibility:
  - WCAG 2.2 AA contrast in both themes, visible focus;
  - pen strokes `aria-hidden`, real text everywhere;
  - animated content understandable from its static text.
- R14 (Must): npm package unchanged. `files` has no `site/`, `npm pack --dry-run` lists no `site/` files, release.yml passes, the version is not bumped.
- R15 (Must): README links to the site.

## No-Gos
- No framework, bundler or runtime dependency. Nothing added to `installer/package.json`.
- No analytics, trackers, third-party scripts or web-font CDNs at runtime.
- No glassmorphism, gradients, glows, blurred shadows, emoji, sparkle icons, purple/blue, or rounded cards. Nothing resembling claudecodemanager.vishalg.in's look.
- No scroll-jacking or smooth-scroll libraries. Only `transform`, `opacity`, `clip-path` and `stroke-dashoffset` are animated.
- No invented testimonials, user counts or logos. The tool count is never hard-coded.
- No changes to the installer, kit content or release workflow logic.
- No commit, push or `gh repo edit` without the user's OK.

## Rabbit Holes
- **Scroll-driven animation support** (Firefox lacks `animation-timeline` by default). **Patch:** wrap it in `@supports (animation-timeline: view())`. Without support, the card shows all marks statically, which is a complete design.
- **OG rendering without dependencies.** **Patch:** headless Chrome `--screenshot` of a generated HTML file per page. **Bound:** if Chrome screenshots misbehave in CI, commit the locally rendered PNGs and let the CI build keep them (keep-last).
- **Lighthouse ≥ 95 with three fonts and the hero animation.** **Bound:** if the hero costs more than a few points, ship the brief's minimal fallback for the hero.
- **Markdown rendering for CHANGELOG / agents-block.** **Patch:** a small renderer covering only what those files use (headings, paragraphs, lists, bold, inline code, links). Tests pin it.
- **Clean URLs locally.** **Patch:** serve `site/` with `python3 -m http.server` for checks and Lighthouse (directory `index.html` works the same as on Pages).

## Motion spec
**Layer stack (hero, back to front):**
1. Page: paper `surface` plus a 24px drafting grid.
2. Sheet: the diff card, with ink border and offset shadow.
3. Code text: the real sloppy diff (selectable, read by screen readers).
4. Clean sheet: the clean diff on `surface-card`, revealed by `clip-path`.
5. Pen SVG overlay (`aria-hidden`): strokes, circles and arrows in `--pen`.
6. Margin notes: real text in Newsreader italic, in the right margin (below the line on mobile).
7. Stamp: VERIFIED, rotated −6°.
8. Replay button: outside the card, in the toolbar.

**Hero choreography** (Web Animations API; t = ms after `DOMContentLoaded` + fonts ready, max 300 ms wait):

| t | Moment | Property | Duration / easing |
|---|---|---|---|
| 0 | Sloppy diff visible (static HTML) | none | none |
| 350 | Mark 1: circle round `doStuff` | stroke-dashoffset L→0 | 420 ms, cubic-bezier(.3,.7,.4,1) |
| 650 | Note 1 "name it for what it does" | opacity 0→1, translateX(6px→0) | 200 ms, ease-out |
| 900 | Mark 2: underline `catch (e) {}` | stroke-dashoffset | 380 ms |
| 1150 | Note 2 "swallowed error" | as note 1 | 200 ms |
| 1400 | Mark 3: strike `// TODO: implement` | stroke-dashoffset | 320 ms |
| 1650 | Note 3 "not done" | as note 1 | 200 ms |
| 1900 | Mark 4: box round `.skip` / weakened assert | stroke-dashoffset | 420 ms |
| 2150 | Note 4 "never weaken a test" | as note 1 | 200 ms |
| 2700 | Clean sheet wipes down over the sloppy one | clip-path inset(0 0 100% 0)→inset(0) | 520 ms, cubic-bezier(.6,0,.2,1) |
| 3300 | VERIFIED stamp thud | opacity 0→1, scale 1.5→0.96→1, rotate −6° | 220 ms, steps of ease-in then ease-out |
| 3300 | Card recoil | translate(0)→(1px,1px)→(0) | 120 ms |

The Replay button resets every animation to its start and plays it again; while playing it is `aria-disabled`. A visually hidden live summary describes the review.

**Reduced motion:** before (marked up, all strokes drawn, notes shown) and after (clean, stamp placed), stacked; no Replay button.

**Traveling change card (home §workflow, ≥ 860 px):**
- Layout: the steps sit in the left 7 columns; the card is `position: sticky; top: 96px` in the right 5 columns.
- Each step element declares `view-timeline-name: --step-N`. The workflow section declares `timeline-scope` for all six.
- Each mark on the card animates `opacity` + `translateY(4px→0)` (and the stamp's `scale`) against its step's timeline, with `animation-range: entry 60% cover 40%`, `fill: both`.
- The marks: Plan (☐→☑ plan checkbox), Build test-first (a red `✗ 1 failing` line then a green `✓ 1 passing` line), Verify (`checks passed: lint, test`), Simplify (a removed duplicate line struck through), Review (`REVIEWED` stamp), Ship (`SHIPPED` stamp + a commit hash line `a1b2c3d`, labelled as an example).
- Below 860 px, or without `animation-timeline` support, or with reduced motion: the card sits after the steps with every mark shown.

**Small moments:**
- Install command: `clip-path: inset(0 100% 0 0)` → `inset(0)` with `steps(N)` over N×45 ms, once, when in view; then a block cursor blinks (opacity) 3 times and stays solid.
- Counters: when in view, text ticks from 0 to the baked value over 700 ms (rAF, `tabular-nums`, fixed `min-width` in `ch` so no shift).
- Cross-document View Transitions: `@view-transition { navigation: auto }`, root cross-fade 160 ms; off under reduced motion.

## Page list and sources
| URL | h1 (draft) | Content source |
|---|---|---|
| `/` | Agents that ship like a careful senior engineer | README, CHANGELOG 1.2.0 (600 tokens), profiles (tool index), components.md, how-it-works (safety) |
| `/rules/` | The rules your agent reads every session | `kit/instructions/agents-block.md` (rendered), `kit/rules/RULES.md` § headings |
| `/agents/` | Eight sub-agents, one job each | manifest `category: Agents` |
| `/skills/` | Six skills for the whole workflow | manifest `category: Workflows/Skills`, README daily usage |
| `/safety/` | Guardrails for AI coding agents | manifest format-hook / secret-guard / checks + per-tool format and secret columns |
| `/tools/` | One kit, each tool in its own format | profiles + capabilities (table + per-tool notes and doc links) |
| `/install/` | Install it in a couple of minutes | README quick start, how-it-works flags, install-with-an-agent |
| `/how-it-works/` | What the installer does to your files | docs/how-it-works.md |
| `/changelog/` | Changelog | CHANGELOG.md (rendered) |
| `/404.html` | Not in this edition | none |

FAQ (home only, visible and in FAQPage): drawn from README Notes and how-it-works Safety (network calls, uninstall, Windows, existing AGENTS.md).

## Files
- `site/`:
  - `index.html` and `{rules,agents,skills,safety,tools,install,how-it-works,changelog}/index.html`, `404.html`;
  - `style.css` (non-critical), `app.js` (hero, counters, typing; ES module, deferred);
  - `fonts/*`, `og/*.png`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`;
  - `site.webmanifest`, `robots.txt`, `sitemap.xml`, `llms.txt`, `CNAME`, `.nojekyll`, `DESIGN.md`.
- `scripts/build-site.mjs`, `scripts/build-site.test.mjs`.
- `.github/workflows/pages.yml`.
- `package.json` (`test` script only), `README.md` (site link).

## Done When
1. Each of the 10 URLs in the page list → exists in `site/` and returns 200 from a local static server (404.html exists).
2. Each page at 320, 375, 1440, 1920 px → `document.documentElement.scrollWidth <= innerWidth`.
3. Screenshots at 375 and 1440 px, light and dark, and with reduced motion → reviewed; the reduced-motion hero shows the marked-up before, the clean after and the stamp.
4. Lighthouse mobile on every page → Performance, Accessibility, Best Practices and SEO each ≥ 95 (table in the report).
5. `sitemap.xml` → parses as XML and lists all 9 indexable URLs; each page's JSON-LD → passes validator.schema.org with 0 errors; titles and descriptions → unique, ≤ 60 / ≤ 155 characters (asserted by test).
6. `robots.txt`, `llms.txt`, `site.webmanifest`, the favicons, `apple-touch-icon.png`, `404.html`, `CNAME` (`agentengineeringkit.vishalg.in`) and `.nojekyll` → exist.
7. `grep` for digits in the visible copy → every number is either in a `data-bake`/`bake:` region or quoted from a repo file (list in the report).
8. `node scripts/build-site.mjs` → exits 0 online, and exits 0 offline (keeps the last values and prints a warning).
9. `npm test` → passes, with ≥ 186 installer tests plus the new site tests.
10. `npm pack --dry-run` → no path starts with `site/` or `scripts/`.
11. `pages.yml` → parses as YAML with the required triggers, permissions and concurrency (checked by test).
12. README → contains `https://agentengineeringkit.vishalg.in`.
13. JS per page → ≤ 30 KB gzipped (`gzip -c | wc -c`); no `<script src="http`.

## Slices
1. **Design proof (gate 2):** `site/DESIGN.md`, fonts, `style.css` tokens, the home hero with the full hero animation and Replay, the edition bar, plus one section (the workflow with the traveling card), light/dark/reduced motion. Check: screenshots + keyboard replay. **STOP for approval.**
2. **Build script core** (test first): marker replace, keep-last bake, live fetchers with fallback, head/nav/footer from `PAGES`, sitemap, robots, llms. (DW 5, 6, 8)
3. **Generated content** (test first): Markdown renderer, changelog page, tools table, agents/skills/safety/rules blocks. (DW 1, 7)
4. **Remaining pages:** home sections, the rest of the hand-written copy, 404. (DW 1, 2)
5. **OG images + icons + manifest** via headless Chrome. (DW 5, 6)
6. **Pages workflow, README link, root test script.** (DW 9–12)
7. **Verify:** browser matrix, Lighthouse, validators, size budget; simplify; review agents (test-analyzer, silent-failure-hunter, security-reviewer). (DW 2–4, 13)

## Detail check
| Detail from the request | Where it landed |
|---|---|
| Facts only from the listed repo files; leave out what isn't found | R2, DW 7 |
| Tool count from `--list-tools` at build time, never hard-coded | Decisions (profiles import), R2 |
| ~600 tokens (CHANGELOG 1.2.0); npm provenance from main | R2 (quoted on home/install with source) |
| No testimonials, user counts, logos | R2, No-Gos |
| Review Copy concept; DESIGN.md tokens; site/DESIGN.md | R3 |
| Newsprint structure, Swiss restraint, Terminal only for code | R3, site/DESIGN.md |
| Superdesign traveling object; Ascii hero optional | R5; Ascii hero cut (competes with the pen; its prompt has no motion spec) |
| Rejected styles (motionsites, glass, gradients, CCM look) | No-Gos |
| Self-hosted woff2, swap, ≤ 3 critical files, serif + mono | Decisions (fonts) |
| Zero radius, ink borders, grid rules, one accent per theme | R3 |
| § numbering; stamps used sparingly | R3, site/DESIGN.md |
| Hero red pen, replay | R4, Motion spec |
| Traveling change card | R5, Motion spec |
| Typing install command, newspaper tool index, counters | R6 |
| Native CSS/WAAPI first; library only if justified | Decisions (no library planned) |
| Animate only transform/opacity/clip-path/stroke-dashoffset; no scroll-jacking | No-Gos |
| Reduced motion complete static design, tested | R7, DW 3 |
| Minimal fallback | Appetite, Rabbit Holes |
| 10 URLs, one h1, no hype | R1 |
| Plumbing from claude-code-manager | Decisions (build model) |
| CNAME, .nojekyll | R11 |
| pages.yml triggers/permissions/concurrency | R9 (+ extra paths, explained) |
| Build script: stars, weekly downloads, version, changelog, keep last | R8 |
| Don't break npm package; no publish on site-only push | R14 |
| Per-page title/desc/canonical/OG/Twitter | R10 |
| OG images 1200×630 generated at build | R8, R10 |
| JSON-LD SoftwareApplication fields, WebSite, BreadcrumbList, FAQPage only with FAQ | R10 |
| sitemap, robots with named AI crawlers, llms.txt | R8, R11 |
| Favicon SVG+PNG, apple-touch-icon, manifest | R11 |
| Lighthouse ≥ 95 ×4 every page | DW 4 |
| Critical CSS inline, JS ≤ 30 KB gz, AVIF/WebP with dimensions, preload display font only | R12 (no content images; a screenshot, if used, is WebP with dimensions) |
| No third-party scripts | R12, No-Gos |
| AA both themes, focus, keyboard replay, aria-hidden strokes | R13 |
| Images (user, mid-task): only if needed | Decisions (images) |
| Skills/tools: list and wait for OK | Done 2026-10-09 (answers recorded above) |
| Gates: pause only at gate 2 and before commit/push (user) | Status line, Slices 1 |
| Done-When list from the brief §8 | DW 1–13 |
| One-time setup instructions at the end | Report (Phase 7) |
| `gh repo edit --homepage` only after asking | No-Gos |

## Open questions
- None blocking. The installer screenshot on `/how-it-works/` is decided while building slice 4, and only added if the page needs it.

## Build log
- 2026-10-09: Context read. Research done: claude-code-manager plumbing (regex bake in committed HTML, keep-last; no sitemap/OG generation) and the design references (Newsprint, Swiss, Terminal, Superdesign prompts). Fonts downloaded as static display instances (~80 KB total instead of ~310 KB variable).
- 2026-10-09 (slice 1, design proof): `site/DESIGN.md`, fonts, `style.css`, home hero + §01 workflow with the traveling card, and `app.js` (copy, replay, counters).
  - The hero choreography is CSS animations with `--at` delays instead of WAAPI, so it plays even without JS and never flashes. JS only pauses it until the card is in view (on phones it sits below the fold) and replays it with `getAnimations()`.
  - Added a "Resolved" checklist to the after-sheet. It fills the height gap, and it states in text what each pen mark meant.
  - AA: light `--pen` (4.17:1) and `--muted` (4.15:1) fail for small text on paper. The site uses `--pen-text #b5341a` and `--muted #5d616b`. The installer has the same issue (out of scope; reported).
  - Checked with headless Chrome via CDP at 1440 and 375 px, light and dark, motion and reduced motion: no horizontal scroll, the reduced-motion hero is complete, and the scroll-linked marks arrive per step. Waiting at gate 2.
- 2026-10-09 (slices 2–7): build script test-first, eight subpages, OG images and icons via headless Chrome, Pages workflow, README and AGENTS.md lines, root `npm test` runs the site tests. Simplify pass, then reviewers (test-analyzer, silent-failure-hunter, security-reviewer, frontend-reviewer) with fixes:
  - **Workflow:** split into a read-only build job and a deploy job.
  - **CI fallbacks are visible:** `::warning` annotations, the build fails on a missing OG image, and screenshots are verified before they replace old ones.
  - **Version:** the newer of npm's and package.json's.
  - **Stale data fails loudly:** an unknown bake marker, a bake value that can't be filled, a bad changelog heading or agent access value all throw, and a staleness test fails if `site/` isn't rebuilt.
  - **Frontend:** the tall workflow steps only appear where scroll-driven animation is supported, plus copy-failure handling, no-JS Copy, accessibility labels, a sticky table column on phones, and the type scale snapped to the documented sizes.
  - **The 404 page drops `noindex`.** Pages serves it with HTTP 404, and the tag cost a Lighthouse SEO score of 63.

## Done When — evidence (2026-10-09)
1. ✅ All 10 URLs exist and return 200 from the local server.
2. ✅ No horizontal scroll at 320/375/1440/1920 on all 10 pages (40 checks; layout viewport = requested width).
3. ✅ Screenshots reviewed at 375 and 1440, light and dark, motion and reduced motion. The reduced-motion hero shows the marked-up before, the clean after and the stamp. Replay works from the keyboard and shows a focus ring.
4. ✅ Lighthouse 13.5.0 mobile: every page is 99–100 in all four categories, with CLS 0.
5. ✅ The sitemap passes xmllint and lists 9 URLs. JSON-LD passes validator.schema.org with 0 errors and 0 warnings (home graph + BreadcrumbList). Titles ≤ 60 and descriptions ≤ 155 are unique (tested).
6. ✅ robots.txt, llms.txt, site.webmanifest, favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192/512.png, 404.html, CNAME and .nojekyll all exist.
7. ✅ Every hand-written number traces to a repo file (audit in the report). The counts and the version are baked.
8. ✅ `node scripts/build-site.mjs` exits 0 online (npm downloads 404 → warning, keeps the last value), and exits 0 with `--offline`.
9. ✅ `npm test`: 186 installer tests + 35 site tests pass. Typecheck is clean.
10. ✅ `npm pack --dry-run`: 0 `site/` or `scripts/` paths (63 files, 97.5 kB, unchanged).
11. ✅ pages.yml parses as YAML (Ruby), with triggers, permissions and concurrency as specified (tested).
12. ✅ README links https://agentengineeringkit.vishalg.in.
13. ✅ app.js is 967 B gzipped, the only script; no external scripts.
