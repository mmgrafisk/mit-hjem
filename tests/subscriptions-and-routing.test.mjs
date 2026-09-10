import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appPath = new URL("../app/household-app.tsx", import.meta.url);
const financePath = new URL("../app/finance-data.ts", import.meta.url);
const subscriptionsPath = new URL("../app/subscriptions-data.ts", import.meta.url);
const migrationPath = new URL("../supabase/migrations/20260902053500_add_subscription_and_document_links.sql", import.meta.url);

test("transactions and subscriptions can share household-scoped document links", async () => {
  const [migration, finance, subscriptions, app] = await Promise.all([readFile(migrationPath, "utf8"), readFile(financePath, "utf8"), readFile(subscriptionsPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(migration, /create table public\.transaction_documents/);
  assert.match(migration, /create table public\.subscription_documents/);
  assert.match(migration, /foreign key \(document_id, household_id\)/g);
  assert.match(migration, /enable row level security/g);
  assert.match(finance, /syncTransactionDocuments/);
  assert.match(subscriptions, /syncSubscriptionDocuments/);
  assert.match(app, /Tilknyttede dokumenter/);
});

test("subscriptions avoid plaintext passwords and track payment and cancellation details", async () => {
  const [migration, app] = await Promise.all([readFile(migrationPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(migration, /account_identifier text/);
  assert.match(migration, /password_manager_url text/);
  assert.doesNotMatch(migration, /password text/);
  assert.match(migration, /cancellation_deadline_on date/);
  assert.match(app, /Sidste opsigelsesdag/);
  assert.match(app, /Link til password manager/);
  assert.match(app, /Tilknyttet postering/);
});

test("every primary app area has a stable URL", async () => {
  const app = await readFile(appPath, "utf8");
  for (const route of ["/overblik", "/dokumenter", "/opgaver", "/kalender", "/indkoeb", "/madplan", "/husstand", "/indstillinger", "/oekonomi/abonnementer"]) {
    assert.match(app, new RegExp(route.replaceAll("/", "\\/")));
  }
});
