import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260831180118_improve_budget_integrity_and_categories.sql", import.meta.url);
const financePath = new URL("../app/finance-data.ts", import.meta.url);
const appPath = new URL("../app/household-app.tsx", import.meta.url);
const recurringMigrationPath = new URL("../supabase/migrations/20260901133016_add_recurring_finance_transactions.sql", import.meta.url);
const recurringSeriesMigrationPath = new URL("../supabase/migrations/20260902052000_store_recurring_transactions_as_series.sql", import.meta.url);
const occurrenceOverridesMigrationPath = new URL("../supabase/migrations/20260910033000_add_transaction_occurrence_overrides.sql", import.meta.url);
const occurrenceOverrideIndexesMigrationPath = new URL("../supabase/migrations/20260910042500_index_transaction_occurrence_override_foreign_keys.sql", import.meta.url);

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

test("authenticated navigation exposes real modules without presenting demo household data as real", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /useState\(householdId \? \[\] : initialActions\)/);
  assert.match(app, /sampleMode=\{!householdId\}/);
  assert.match(app, /sampleMode \? calendarItems : \[\]/);
  assert.match(app, /sampleMode \? meals : \[\]/);
  assert.doesNotMatch(app, /key !== "calendar" && key !== "meals"/);
  assert.match(app, /useState<HouseholdDocument\[\]>\(householdId \? \[\] : demoDocuments\)/);
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

test("recurring transactions are stored once, have an optional end date and are expanded for budget calculations", async () => {
  const [migration, finance, app] = await Promise.all([readFile(recurringSeriesMigrationPath, "utf8"), readFile(financePath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(migration, /recurrence_end_on date/);
  assert.match(migration, /delete from public\.transactions/);
  assert.match(finance, /\.insert\(\{/);
  assert.doesNotMatch(finance, /\.insert\(dates\.map/);
  assert.match(finance, /collapseRecurringTransactions/);
  assert.match(finance, /recurringTransactionDates\(transaction\.occurredOn/);
  assert.match(finance, /\.in\("status", \["approved", "scheduled"\]\)/);
  assert.match(app, /Sidste betaling/);
  assert.match(app, /Betalingsplan/);
  assert.match(app, /Slet .* fra oversigten/);
});

test("transaction occurrence overrides are household-scoped and recurring splits stay atomic", async () => {
  const [migration, indexMigration, finance, app] = await Promise.all([readFile(occurrenceOverridesMigrationPath, "utf8"), readFile(occurrenceOverrideIndexesMigrationPath, "utf8"), readFile(financePath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(migration, /create table public\.transaction_occurrence_overrides/);
  assert.match(migration, /unique \(transaction_id, occurred_on\)/);
  assert.match(migration, /transaction_occurrence_overrides_period_idx[\s\S]*household_id, occurred_on, transaction_id/);
  assert.match(migration, /alter table public\.transaction_occurrence_overrides enable row level security/);
  assert.match(migration, /private\.is_household_member\(household_id\)/);
  assert.match(migration, /create or replace function public\.split_recurring_transaction/);
  assert.match(migration, /recurrence_group_id = effective_group_id[\s\S]*effective_group_id,/);
  assert.match(indexMigration, /transaction_id, household_id/);
  assert.match(indexMigration, /created_by/);
  assert.match(migration, /security invoker/g);
  assert.match(migration, /revoke execute on function public\.split_recurring_transaction[\s\S]*from public, anon/);
  assert.match(finance, /buildTransactionPeriodRows/);
  assert.match(finance, /updateFinanceTransactionOccurrence/);
  assert.match(finance, /\.rpc\("set_transaction_occurrence_override"/);
  assert.match(finance, /\.rpc\("split_recurring_transaction"/);
  assert.doesNotMatch(app, /Budgetvisning/);
  assert.doesNotMatch(app, />Faktisk<|>Forskel</);
  assert.match(app, /Alle tal kommer fra dine posteringer/);
  assert.match(app, /Tilføj indtægt/);
  assert.match(app, /Tilføj postering/);
});

test("finance categories and transaction history have stable routes", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /\/oekonomi\/kategorier\//);
  assert.match(app, /\/oekonomi\/posteringer/);
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /handleHistory\(\);\s*window\.addEventListener\("popstate", handleHistory\)/);
  assert.match(app, /Posteringer<\/button>/);
});

test("a new posting can create and immediately select a missing category", async () => {
  const [finance, app] = await Promise.all([readFile(financePath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(finance, /return result\.data/);
  assert.match(app, /Opret kategori i posteringen/);
  assert.match(app, /onAddCategory/);
});
