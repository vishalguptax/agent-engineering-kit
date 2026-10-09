---
version: alpha
name: Agent Engineering Kit site — The Review Copy
description: Visual system for agentengineeringkit.vishalg.in. A broadsheet engineering spec sheet going through code review, marked up in red pen as you read. Extends the installer's Spec Sheet system (../DESIGN.md) with display type, a 12-column ruled grid, an edition bar, pen marks and stamps. Tokens are implemented in site/style.css; colors with a -dark suffix are the dark-mode values.
colors:
  primary: "#d1401f"
  primary-text: "#b5341a"
  on-primary: "#fffdf7"
  surface: "#f4f1e8"
  surface-card: "#fffdf7"
  on-surface: "#1b2330"
  on-surface-soft: "#4a5260"
  muted: "#5d616b"
  rule: "#d9d3c4"
  grid: "rgba(28, 45, 70, 0.07)"
  code-surface: "#ece7da"
  success: "#2f6b4f"
  diff-add-bg: "#e2efe5"
  error: "#b2321a"
  error-soft: "#f9e3dc"
  primary-dark: "#f2a33a"
  primary-text-dark: "#f2a33a"
  on-primary-dark: "#111a26"
  surface-dark: "#111a26"
  surface-card-dark: "#172232"
  on-surface-dark: "#e6ecf3"
  on-surface-soft-dark: "#b8c2cf"
  muted-dark: "#8b97a6"
  rule-dark: "#2a3a4f"
  grid-dark: "rgba(120, 190, 230, 0.07)"
  code-surface-dark: "#0f1823"
  success-dark: "#79c9a0"
  diff-add-bg-dark: "#15302a"
  error-dark: "#ff9f88"
  error-soft-dark: "#3a1f1d"
typography:
  display:
    fontFamily: Newsreader, Charter, "Iowan Old Style", Georgia, serif
    fontSize: clamp(2.75rem, 1.2rem + 4.6vw, 5.75rem)
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Newsreader, Charter, "Iowan Old Style", Georgia, serif
    fontSize: clamp(2rem, 1.45rem + 2.4vw, 3.5rem)
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Newsreader, Charter, "Iowan Old Style", Georgia, serif
    fontSize: clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem)
    fontWeight: 600
    lineHeight: 1.15
  pen-note:
    fontFamily: Newsreader, Georgia, serif
    fontSize: 15px
    fontStyle: italic
    fontWeight: 500
    lineHeight: 1.3
  lead:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem)
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: JetBrains Mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.08em
  code-sm:
    fontFamily: JetBrains Mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 18px
  xl: 28px
  xxl: 48px
  section: clamp(56px, 8vw, 112px)
  gutter-mobile: 16px
  column-gap: 32px
  sheet: 1240px
  measure: 68ch
components:
  edition-bar:
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
  kicker:
    textColor: "{colors.primary-text}"
    typography: "{typography.label-md}"
  review-sheet:
    backgroundColor: "{colors.surface-card}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.none}"
  stamp:
    textColor: "{colors.primary-text}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
  button-primary:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: 12px
---

# Agent Engineering Kit site — The Review Copy

This file follows the [DESIGN.md format](https://github.com/google-labs-code/design.md). It extends the installer's system in [`../DESIGN.md`](../DESIGN.md); anything not stated here works as it does there. Tokens are CSS custom properties in [`style.css`](style.css).

## Overview

**A broadsheet engineering spec sheet going through code review.** The page is a printed technical document, and a strict senior engineer marks it up in red pen as you read. That is what the kit does to an agent's work, so the design carries the message. The page is broadsheet in structure (ruled columns, an edition bar, dramatic serif headlines, dense information), Swiss in discipline (strict grid, one signal colour, generous air in narrative sections), and terminal only inside code and install blocks.

It must never look like a generic AI landing page: no gradients, glass, glows, blurred shadows, purple or blue palettes, emoji, sparkle icons, rounded cards or logo walls.

## Colors

- `primary` is the **red pen** (amber in dark mode), and the only accent. Use it for pen strokes, the focus ring, kickers, stamps and links on hover. Never use it as a fill behind body text, and never for decoration.
- `primary-text` is the pen colour for **text** on light paper: `primary` itself is 4.17:1 on `surface`, below AA for small text, so small red text uses `primary-text` (5.36:1). Strokes and borders, which need 3:1, use `primary`. In dark mode both are the amber.
- `muted` is darkened from the installer's `#6f7480` (4.15:1 on `surface`) to `#5d616b` (5.49:1), so labels pass AA.
- `on-surface` is ink: text, 1.5px borders, column rules and the offset shadow. `rule` is for hairlines inside a column.
- `success` and `diff-add-bg` mark added lines and passing checks; `error` and `error-soft` mark removed lines. They are status colours, not accents.

## Typography

- **Display serif:** Newsreader, self-hosted as one static cut (optical size 72, weight 600, `newsreader-display-600.woff2`, the only preloaded font). It is used for every heading, from `display` (the front-page banner) down to `headline-md`. Headlines are sentence case and tightly leaded; the banner is allowed to run across all 12 columns.
- **Pen note:** Newsreader italic (`newsreader-italic-500.woff2`), only for the reviewer's margin notes, in `primary-text`. It is the reviewer's hand; nothing else uses italic serif.
- **Body:** the system sans, as in the installer. `lead` is for the first paragraph under a headline, and `body-md` for everything else. Keep lines under `measure` (68ch).
- **Mono:** JetBrains Mono (`jetbrains-mono.woff2`, weights 400–700), for labels, the edition bar, file names, code, diffs and the install command. Labels are uppercase with letter-spacing, **except file names and commands, which keep their real case**.
- **Sizes in use:** labels 12px, code 13px, small text 15px, body 17px, the lead and the clamp-based headings above. Don't add sizes between them.
- At most three font files per page. All use `font-display: swap`, and only the display face is preloaded.

## Layout

- **Sheet:** at most 1240px wide, centred, with a 16px gutter on phones and 32px from 860px up. A 12-column grid with a 32px gap.
- **Visible structure:** columns that sit side by side are separated by a 1px ink rule in the gap. Major sections start with a 3px ink rule across the sheet (the broadsheet fold), followed by the section label `§NN · Name` in mono.
- **Asymmetric splits:** 7/5, 8/4 and 5/7. Never 6/6 for content.
- **Section numbering:** `§01`… numbers the sections of each page in reading order, like a manual. The nav carries page names only, so the numbers never clash. Inside a section, numbers appear only on content that really is a sequence (the workflow steps, the installer screens) or a checklist.
- Below 860px, everything is one column, vertical rules become horizontal rules, and nothing may scroll sideways: long paths and code wrap.

## Elevation & Depth

As in the installer: one solid offset shadow, `4px 4px 0` in ink, for objects you treat as one thing (the review sheet, the traveling change card). Nothing else casts a shadow, and no shadow is ever blurred.

## Shapes

Zero radius on everything, buttons included (the installer's 2px radius is dropped for the broadsheet). Borders are 1.5px ink on cards and buttons, 1px ink for column rules, 3px ink for section folds, and 1px `rule` for hairlines inside a column. The only curves are the pen's.

## Components

- **Edition bar:** a mono strip at the very top. It's a row of cells separated by 1px ink rules: edition (the npm version, baked), licence, tool count (baked), always-on rules cost, GitHub stars and weekly downloads (both baked; a cell with no value yet is hidden, never shown as a made-up number).
- **Masthead:** the wordmark in display serif on the left, and the contents (`§`-numbered nav) on the right; on phones it wraps under the wordmark.
- **Review sheet (hero):** a diff on `surface-card` with an ink border and offset shadow. Each line is a grid row: gutter, code, margin note. Pen marks are inline SVG wrapped around the exact token they mark (circle, underline, strike, box), drawn with `stroke-dashoffset`, `aria-hidden`. Margin notes are real text in pen italic, and sit under their line on phones. The clean version is a second sheet in the same grid cell, revealed with `clip-path`.
- **Stamp:** mono 700, uppercase, letter-spaced, 2px border in `primary`, text in `primary-text`, on `surface-card`, rotated −4° to −8°. Words: VERIFIED, REVIEWED, SHIPPED, NO SLOP, and NOT FOUND on the 404 page. At most one stamp in view at a time, except inside the traveling card, where they accumulate as the record of the change.
- **Terminal block:** for install commands and CLI output only. Mono on `code-surface`, a `$` prompt glyph in `muted`, and a block cursor. A Copy button sits on the right edge.
- **Traveling change card:** a small index card (ink border, offset shadow) holding one example change. It is sticky beside the workflow steps and gains each step's mark as that step scrolls through.
- **Index (works with):** tool names set as a newspaper index, in two to four columns of dotted leaders: `Claude Code ........ rules · skills · agents`. No logos.
- **Rule list:** numbered rows with a hairline between them, for rules and FAQ.

## Motion

Motion has to mean something; it shows review happening.
- Animate only `transform`, `opacity`, `clip-path` and `stroke-dashoffset`. Easing is mechanical: no bounce, except the stamp's one-time thud.
- One orchestrated moment per page at most (the hero). Scroll-linked marks on the traveling card are tied to scroll position and reverse when you scroll back. The typing install command and counters run once.
- `prefers-reduced-motion: reduce` gets the complete finished document: every stroke drawn, notes shown, before and after both visible, stamps placed, numbers final. Motion is only added under a `.motion` class set when reduced motion is off.

## Do's and Don'ts

- **Do** take every fact, number and tool name from a repo file or from the build script, which marks the regions it generates with `bake:` comments.
- **Do** keep each page to one `h1` and ordered headings.
- **Do** use tokens for every colour, font and shadow.
- **Don't** add photos, stock images, logos, testimonials or user counts.
- **Don't** add a second accent, a gradient or a blurred shadow, and don't round corners.
- **Don't** let pen marks carry information that isn't also in text.
