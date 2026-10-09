import { TOOL_PROFILES } from "../src/tools/profiles.js";

// A checklist for maintainers: re-read each tool's docs, update its profile if anything changed, then bump `checked`.

const oldestFirst = [...TOOL_PROFILES].sort((a, b) => a.checked.localeCompare(b.checked));
for (const tool of oldestFirst) {
  console.log(`\n${tool.name} (${tool.id}): last checked ${tool.checked}`);
  for (const url of tool.docs) console.log(`  ${url}`);
}
console.log("\nFor each tool: confirm the instruction file, skill and agent folders, agent fields, hook payload and ignore file still match its profile in src/tools/profiles.ts. Then run `npm run docs && npm test`.");
