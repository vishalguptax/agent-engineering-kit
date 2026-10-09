import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadManifest } from "../src/core/manifest.js";
import { createGuiServer, type GuiServer } from "../src/server/server.js";
import { makeFixture, read, tempDir } from "./fixtures.js";

let gui: GuiServer;
let port: number;

before(async () => {
  gui = await createGuiServer(loadManifest(), { homeDir: tempDir("kit-home-"), recentFile: path.join(tempDir("kit-state-"), "recent.json") });
  port = Number(new URL(gui.url).port);
});
after(() => gui.close());

function call(method: string, urlPath: string, options: { token?: string; host?: string; body?: unknown } = {}) {
  return new Promise<{ status: number; json: any; headers: Record<string, unknown> }>((resolve, reject) => {
    const headers: Record<string, string> = { host: options.host ?? `127.0.0.1:${port}` };
    if (options.token !== undefined) headers["x-kit-token"] = options.token;
    const req = request({ host: "127.0.0.1", port, method, path: urlPath, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const isJson = String(res.headers["content-type"]).startsWith("application/json");
        resolve({ status: res.statusCode!, json: isJson ? JSON.parse(data) : data, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(options.body === undefined ? undefined : JSON.stringify(options.body));
  });
}

test("listens on 127.0.0.1 with a random port and a 64-hex-char token", () => {
  assert.match(gui.url, /^http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]{64}$/);
});

test("API requests without the right token are refused", async () => {
  assert.equal((await call("GET", "/api/manifest")).status, 403);
  assert.equal((await call("GET", "/api/manifest", { token: "0".repeat(64) })).status, 403);
  assert.equal((await call("GET", "/api/manifest", { token: gui.token })).status, 200);
});

test("requests with a foreign Host header are refused (DNS rebinding)", async () => {
  assert.equal((await call("GET", "/api/manifest", { token: gui.token, host: "evil.example:80" })).status, 403);
  assert.equal((await call("GET", "/", { host: "localhost:1" })).status, 403);
});

test("the page is served with a strict Content-Security-Policy", async () => {
  const page = await call("GET", "/");
  assert.equal(page.status, 200);
  assert.match(String(page.headers["content-security-policy"]), /script-src 'self'/);
});

test("malformed requests get a 400 with a clear message", async () => {
  const bad = await call("POST", "/api/plan", { token: gui.token, body: { target: { mode: "nope" } } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /target.mode/);
  const relative = await call("POST", "/api/scan", { token: gui.token, body: { target: { mode: "project", path: "relative/dir" } } });
  assert.match(relative.json.error, /full path/);
});

test("scan → plan → apply works over the API, and apply refuses if files changed after the preview", async () => {
  const dir = makeFixture("existing-settings");
  const target = { mode: "project", path: dir };
  const scanned = await call("POST", "/api/scan", { token: gui.token, body: { target } });
  assert.equal(scanned.status, 200);
  assert.equal(scanned.json.hasProjectSection, false);
  assert.match(scanned.json.projectInfo.commands, /pnpm test/);

  const body = { target, components: ["instructions", "secret-guard"] };
  const plan = await call("POST", "/api/plan", { token: gui.token, body });
  assert.equal(plan.status, 200);
  assert.ok(plan.json.actions.some((a: { kind: string }) => a.kind === "MERGE"));
  assert.equal(plan.json.actions[0].after, undefined, "full contents stay on the server");

  writeFileSync(path.join(dir, "CLAUDE.md"), "# Changed after preview\n");
  const stale = await call("POST", "/api/apply", { token: gui.token, body: { ...body, fingerprint: plan.json.fingerprint } });
  assert.equal(stale.status, 409);
  assert.equal(read(dir, "CLAUDE.md"), "# Changed after preview\n");

  const fresh = await call("POST", "/api/plan", { token: gui.token, body });
  const applied = await call("POST", "/api/apply", { token: gui.token, body: { ...body, fingerprint: fresh.json.fingerprint } });
  assert.equal(applied.status, 200, JSON.stringify(applied.json));
  assert.ok(applied.json.changedFiles.includes("CLAUDE.md"));
  assert.ok(applied.json.nextSteps.length > 0);
  const recent = await call("GET", "/api/recent", { token: gui.token });
  assert.deepEqual(recent.json, [dir], "remembered in the test's own recent file");
});

test("the folder browser lists sub-folders only", async () => {
  const dir = makeFixture("existing-settings");
  const listing = await call("GET", `/api/browse?path=${encodeURIComponent(dir)}`, { token: gui.token });
  assert.deepEqual(listing.json.dirs, [], ".claude is hidden and files are not listed");
  assert.equal(listing.json.parent, path.dirname(dir));
});

test("Done shuts the server down", async () => {
  const separate = await createGuiServer(loadManifest(), { homeDir: tempDir("kit-home-"), recentFile: path.join(tempDir("kit-state-"), "recent.json") });
  const res = await fetch(`${separate.url.replace(/\?.*/, "")}api/done`, { method: "POST", headers: { "x-kit-token": separate.token } });
  assert.equal(res.status, 200);
  await separate.closed;
});
