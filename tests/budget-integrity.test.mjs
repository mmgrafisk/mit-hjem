import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260831180118_improve_budget_integrity_and_categories.sql", import.meta.url);
const financePath = new URL("../app/finance-data.ts", import.meta.url);
const appPath = new URL("../app/household-app.tsx", import.meta.url);
const recurringMigrationPath = new URL("../supabase/migrations/20260901133016_add_recurring_finance_transactions.sql", import.meta.url);

test("budget mutations use restricted transactional database functions", async () => {
  const [migration, finance] = await Promise.all([readFile(migrationPath, "utf8"), readFile(financePath, "utf8")]);
  assert.match(migration, /security invoker/g);
  assert.match(migration, /revoke execute on function public\.update_budget_plans[\s\S]*from public, anon/);
  assert.match(migration, /grant execute on function public\.update_budget_plans[\s\S]*to authenticated, service_role/);
  assert.match(finance, /\.rpc\("update_budget_plans"/);
  assert.match(finance, /\.rpc\("ensure_budget_months"/);
  assert.match(finance, /\.rpc\("add_budget_category"/);
});

test("transactions expose correction and deletion instead of insert-only behavior", async () => {
  const [finance, app] = await Promise.all([readFile(financePath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(finance, /export async function updateFinanceTransaction/);
  assert.match(finance, /export async function deleteFinanceTransaction/);
  assert.match(app, /Redigér postering/);
  assert.match(app, /onEditTransaction\(transaction\)/);
  assert.match(app, /Slet posteringen/);
});

test("authenticated navigation does not present demo household data as real", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /useState\(householdId \? \[\] : initialActions\)/);
  assert.match(app, /key !== "calendar" && key !== "meals"/);
  assert.match(app, /householdDocuments\.length/);
  assert.match(app, /member\.email/);
  assert.doesNotMatch(app, /Anders Sørensen/);
});

test("recurring transactions remain household-scoped and distinguish scheduled occurrences", async () => {
  const [migration, finance, app] = await Promise.all([readFile(recurringMigrationPath, "utf8"), readFile(financePath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(migration, /recurrence_interval_months smallint/);
  assert.match(migration, /status in \('suggested', 'approved', 'scheduled', 'rejected'\)/);
  assert.match(finance, /recurringTransactionDates/);
  assert.match(finance, /recurrence_group_id/);
  assert.match(finance, /\.eq\("household_id", householdId\)/);
  assert.match(app, /Hver anden måned/);
  assert.match(app, /Hvert kvartal/);
  assert.match(app, /Hvert halve år/);
});

test("finance categories and transaction history have stable routes", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /\/oekonomi\/kategorier\//);
  assert.match(app, /\/oekonomi\/posteringer/);
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /Posteringer<\/button>/);
});
