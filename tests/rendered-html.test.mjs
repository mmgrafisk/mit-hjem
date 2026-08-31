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

test("server-renders the authenticated Mit hjem entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="da">/i);
  assert.match(html, /<title>Mit hjem — økonomi og hverdag samlet<\/title>/i);
  assert.match(html, /auth-shell auth-loading/);
  assert.match(html, /Mit hjem/);
  assert.match(html, /AuthGate/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
test("connects account login and household data without privileged keys", async () => {
  const [auth, app, client, exampleEnv] = await Promise.all([
    readFile(new URL("../app/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/supabase-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /signUp/);
  assert.match(auth, /authRedirectUrl/);
  assert.match(auth, /NEXT_PUBLIC_APP_URL/);
  assert.match(auth, /error_code/);
  assert.match(auth, /supabase\.auth\.resend/);
  assert.match(auth, /Send nyt bekræftelseslink/);
  assert.match(auth, /ensureHousehold/);
  assert.match(auth, /household_members/);
  assert.match(app, /from\("tasks"\)/);
  assert.match(app, /from\("shopping_items"\)/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(exampleEnv, /sb_publishable_your_key/);
  assert.match(exampleEnv, /NEXT_PUBLIC_APP_URL/);
  assert.doesNotMatch(`${auth}\n${app}\n${client}\n${exampleEnv}`, /service[_-]?role|secret[_-]?key/i);
});

test("persists monthly budgets, category plans and transactions", async () => {
  const [app, finance] = await Promise.all([
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/finance-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(finance, /ensureCurrentBudget/);
  assert.match(finance, /budget_categories/);
  assert.match(finance, /budget_items/);
  assert.match(finance, /addFinanceTransaction/);
  assert.match(finance, /updatePlannedAmount/);
  assert.match(app, /TransactionModal/);
  assert.match(app, /finance\.categories\.map/);
  assert.match(app, /Budget · \{financeMonthLabel\(finance\.month\)\}/);
  assert.doesNotMatch(finance, /service[_-]?role|secret[_-]?key/i);
});

test("keeps household documents private and downloadable through signed links", async () => {
  const [app, documentData, migration] = await Promise.all([
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/documents-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260831064746_protect_private_document_storage.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /DocumentUploadModal/);
  assert.match(app, /Søg i dokumenter/);
  assert.match(documentData, /household-documents/);
  assert.match(documentData, /createSignedUrl/);
  assert.match(documentData, /20 \* 1024 \* 1024/);
  assert.match(migration, /exists \(/);
  assert.match(migration, /public\.documents/);
  assert.doesNotMatch(documentData, /getPublicUrl|service[_-]?role|secret[_-]?key/i);
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
  assert.match(app, /prefers-color-scheme: dark/);
  assert.match(app, /mit-hjem:preferences:v1/);
  assert.match(app, /Vælg udseende/);
  assert.match(config, /defaultTemplate: "command"/);
  assert.match(config, /supportedLanguages/);
  assert.equal((config.match(/^\s*\["[a-z]{2}",/gm) ?? []).length, 18);
  assert.match(css, /data-template="calm"/);
  assert.match(css, /data-template="journal"/);
  assert.match(css, /data-color-mode="dark"/);
  assert.match(css, /appearance-grid/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
