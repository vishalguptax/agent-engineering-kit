---
version: alpha
name: Agent Engineering Kit — Spec Sheet
description: Visual system for the kit's installer UI. An engineering spec sheet after code review, with drafting-paper grid, book-serif headlines, mono labels, one red-pen accent, hard ink borders and rubber-stamp status labels. Tokens mirror installer/ui/style.css; colors with a -dark suffix are the dark-mode values.
colors:
  primary: "#d1401f"
  on-primary: "#fffdf7"
  primary-soft: "#fbe6dd"
  surface: "#f4f1e8"
  surface-card: "#fffdf7"
  on-surface: "#1b2330"
  on-surface-soft: "#4a5260"
  muted: "#6f7480"
  rule: "#d9d3c4"
  grid: "rgba(28, 45, 70, 0.07)"
  code-surface: "#ece7da"
  success: "#2f6b4f"
  success-soft: "#e1eee4"
  warning: "#8c5a00"
  warning-soft: "#f8ecd2"
  error: "#b2321a"
  error-soft: "#f9e3dc"
  diff-add: "#2f6b4f"
  diff-add-bg: "#e2efe5"
  primary-dark: "#f2a33a"
  on-primary-dark: "#111a26"
  primary-soft-dark: "#33291a"
  surface-dark: "#111a26"
  surface-card-dark: "#172232"
  on-surface-dark: "#e6ecf3"
  on-surface-soft-dark: "#b8c2cf"
  muted-dark: "#8b97a6"
  rule-dark: "#2a3a4f"
  grid-dark: "rgba(120, 190, 230, 0.07)"
  code-surface-dark: "#0f1823"
  success-dark: "#79c9a0"
  success-soft-dark: "#173229"
  warning-dark: "#f2c16b"
  warning-soft-dark: "#302815"
  error-dark: "#ff9f88"
  error-soft-dark: "#3a1f1d"
  diff-add-dark: "#8fd8ac"
  diff-add-bg-dark: "#15302a"
typography:
  headline-display:
    fontFamily: Charter, "Iowan Old Style", Palatino, Georgia, serif
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Charter, "Iowan Old Style", Palatino, Georgia, serif
    fontSize: 21px
    fontWeight: 600
    lineHeight: 1.25
  body-lg:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.08em
  code-sm:
    fontFamily: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.55
rounded:
  none: 0px
  sm: 2px
  md: 3px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 18px
  xl: 28px
  xxl: 36px
  gutter-mobile: 16px
  rail: 232px
  content: 720px
  sheet: 1080px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 10px
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 10px
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.none}"
    padding: 18px
  badge:
    textColor: "{colors.muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
  kicker:
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
  diff:
    backgroundColor: "{colors.code-surface}"
    typography: "{typography.code-sm}"
---

# Agent Engineering Kit — Spec Sheet

This file follows the [DESIGN.md format](https://github.com/google-labs-code/design.md). Keep every UI change consistent with it, and update it in the same change when something new is needed. Tokens are implemented as CSS custom properties in [`installer/ui/style.css`](installer/ui/style.css); a test (`installer/test/design.test.ts`) fails if the two drift apart.

## Overview

**An engineering spec sheet after code review.** The kit is about careful, reviewed work, so the UI looks like a technical manual marked up with a red pen: a drafting-paper grid, book-serif headlines, mono labels, hard ink borders and rubber-stamp status labels. It's calm, precise and a little tactile.

It must never look like a generic AI app: no gradients, glassmorphism, soft blurry shadows, purple/blue palettes, emoji, or rounded pill buttons.

Light mode is warm drafting paper. Dark mode is a navy drafting board with cyan grid lines and an amber pen. Both follow the system setting; `data-theme="light|dark"` on `<html>` forces one.

## Colors

- `primary` (vermilion red pen; amber in dark mode) is the **only accent**. Use it for the current step, the primary button, kickers, conflicts and the focus ring. If everything is accented, nothing is.
- `surface` is the page background, with a 24px grid drawn in `grid`. `surface-card` is for cards, inputs and index cards.
- `on-surface` is text, borders and the offset shadow. `on-surface-soft` and `muted` are secondary text and labels. `rule` is hairlines, dashed separators and inactive borders.
- `success`, `warning` and `error` (each with a `-soft` background) mark status: created/added, warnings, and removals/errors. `diff-add`/`diff-add-bg` and `error`/`error-soft` color diff lines.
- Each token with a `-dark` suffix is the same role in dark mode. In CSS, both modes use the same variable names (`--pen`, `--paper`, …), and dark mode redefines them.

## Typography

- **Serif** (`headline-display`, `headline-md`: Charter → Iowan → Palatino → Georgia) is for `h1`, `h2`, choice titles and question legends. One italic word per headline at most, colored `primary`.
- **Sans** (`body-md`, `body-lg`: system UI) is for body text, leads and buttons.
- **Mono** (`label-md`, `code-sm`) is for paths, labels, kickers, badges, diffs and step numbers. Labels are uppercase with letter-spacing, **except file names, which always keep their real case** (`CLAUDE.md`, never `CLAUDE.MD`).
- No web fonts. The installer makes no network calls, and these stacks exist on macOS, Windows and Linux. `h1` scales with `clamp(30px, 4.4vw, 44px)`.

## Layout

- On desktop, a 232px left rail (a numbered table of contents, `§01`…) sits next to content at most 720px wide, with a 56px gap, inside a sheet at most 1080px wide.
- Below 860px: one column, the rail becomes a wrapped row, and the side gutter is 16px. There must never be horizontal page scroll; long paths wrap.
- Spacing comes from the scale above. Separate sections with `rule` lines rather than nested boxes, and end every screen with an actions row: Back on the left, the primary action last.

## Elevation & Depth

There is exactly one kind of depth: a **solid offset shadow**, `4px 4px 0` in `on-surface` (`#050a10` in dark mode), like an index card on a desk. Never blur it. It marks things the user should treat as one object (scan findings, the promise card, the folder browser, the selected choice). Buttons lift 1px with a 2px solid shadow on hover, and press down on click.

## Shapes

Corners are square or nearly so: `none` for cards, `sm` (2px) for buttons, inputs and badges, `md` (3px) for inline code. Borders are 1.5px solid `on-surface` for cards and buttons, 1px `rule` for hairlines, and dashed `rule` for table rows and path labels. The brand mark is the only circle, rotated −8°.

## Components

- **Rail:** numbered steps; the current one gets a `primary` bar, done ones a `success` check. The **kicker** above each `h1` reads `§NN · Step name` and is built from the visible steps, so it always matches the rail.
- **Card / index card:** `surface-card`, a 1.5px ink border and the offset shadow.
- **Choice:** a radio card with a hairline border at rest, and an ink border plus the offset shadow when selected.
- **Button:** primary is filled `primary`. Secondary is outlined ink on `surface-card`. Danger is outlined in `error`.
- **Badge (stamp):** mono uppercase, outlined in its status color with no fill. CONFLICT is tilted −2° like a hand stamp. A rotated **stamp** label (e.g. "NO SLOP") may sit on one card edge per screen.
- **Notice:** a left bar in the status color on its `-soft` background (`warning`, `error`), or ink on `surface-card` for info.
- **Diff (proof sheet):** `code-sm` on `code-surface`. Added lines get a `diff-add` gutter bar; removed lines get an `error` gutter bar and strikethrough; hunk headers are `muted`.
- **Tool card:** a checkbox card in a responsive grid; hairline border at rest, ink border plus the offset shadow when selected, like a Choice. A small `success` stamp ("used here" / "installed") sits at the right of the title. Below it, a mono capability row: `✓` in `success`, `ref` and `note` in `warning`, `—` in `muted`.
- **Findings table:** two columns with dashed rules and a status glyph per row: `●` found, `○` not found, `▲` problem.

## Do's and Don'ts

- **Do** use tokens (CSS variables) for every color, font and shadow. **Don't** hard-code values in a rule.
- **Do** build DOM with the `el()` helper and insert data only as text. **Don't** use `innerHTML` or inline `style` attributes; the page's CSP blocks them.
- **Do** design every state: loading (controls disabled while busy), empty ("No sub-folders."), error (a top `notice error`), success.
- **Do** write plain, specific copy that says what will happen to the user's files. **Don't** use marketing language.
- **Do** check new UI in light mode, dark mode and at phone width before shipping. **Don't** add a second accent color, a gradient or a blurred shadow.
- **Adding a screen:** add `[id, label]` to `STEPS` in `installer/ui/app.js` and a view that starts with `kicker()` and a serif `h1` and ends with an actions row. Reuse the components above before writing new CSS.
