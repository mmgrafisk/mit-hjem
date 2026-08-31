import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Mit hjem dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="da">/i);
  assert.match(html, /<title>Mit hjem — økonomi og hverdag samlet<\/title>/i);
  assert.match(html, /data-template="command"/);
  assert.match(html, /Kræver handling/);
  assert.match(html, /Kommende betalinger/);
  assert.match(html, /Eksportér/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps templates, languages and printable exports configurable", async () => {
  const [app, config, css, packageJson] = await Promise.all([
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /PrintSheets/);
  assert.match(app, /Budget som PDF/);
  assert.match(app, /Madplan som PDF/);
  assert.match(config, /defaultTemplate: "command"/);
  assert.match(config, /supportedLanguages/);
  assert.equal((config.match(/^\s*\["[a-z]{2}",/gm) ?? []).length, 18);
  assert.match(css, /data-template="calm"/);
  assert.match(css, /data-template="journal"/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
