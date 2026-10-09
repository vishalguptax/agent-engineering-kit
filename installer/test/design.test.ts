import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { INSTALLER_ROOT } from "../src/core/manifest.js";

// DESIGN.md (repo root) is the design system; installer/ui/style.css implements it. Keep them in sync.

const DESIGN_TO_CSS: Record<string, string> = {
  primary: "pen",
  "on-primary": "pen-ink",
  "primary-soft": "pen-soft",
  surface: "paper",
  "surface-card": "card",
  "on-surface": "ink",
  "on-surface-soft": "ink-soft",
  muted: "muted",
  rule: "rule",
  grid: "grid",
  "code-surface": "code",
  success: "ok",
  "success-soft": "ok-soft",
  warning: "warn",
  "warning-soft": "warn-soft",
  error: "del",
  "error-soft": "del-bg",
  "diff-add": "add",
  "diff-add-bg": "add-bg",
};

function designColors(): Record<string, string> {
  const text = readFileSync(path.join(INSTALLER_ROOT, "..", "DESIGN.md"), "utf8");
  const frontMatter = /^---\n([\s\S]*?)\n---\n/.exec(text)![1];
  const block = /^colors:\n((?: {2}.+\n)+)/m.exec(`${frontMatter}\n`)![1];
  return Object.fromEntries([...block.matchAll(/^ {2}([\w-]+): "([^"]+)"$/gm)].map((m) => [m[1], m[2]]));
}

function cssVars(selector: string): Record<string, string> {
  const css = readFileSync(path.join(INSTALLER_ROOT, "ui", "style.css"), "utf8");
  const body = css.slice(css.indexOf(selector)).split("}")[0];
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

test("DESIGN.md has a primary color, as the spec requires", () => {
  assert.ok(designColors().primary);
});

test("DESIGN.md light and dark colors match style.css", () => {
  const colors = designColors();
  const light = cssVars(":root {");
  const dark = cssVars(':root[data-theme="dark"] {');
  for (const [token, cssVar] of Object.entries(DESIGN_TO_CSS)) {
    assert.equal(colors[token]?.toLowerCase(), light[cssVar]?.toLowerCase(), `${token} ↔ --${cssVar} (light)`);
    assert.equal(colors[`${token}-dark`]?.toLowerCase(), dark[cssVar]?.toLowerCase(), `${token}-dark ↔ --${cssVar} (dark)`);
  }
});
