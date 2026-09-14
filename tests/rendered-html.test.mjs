import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const defaultRuntimeEnv = {
  NEXT_PUBLIC_APP_URL: "https://mit-hjem-samlet.exposprint.chatgpt.site",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

async function render(runtimeEnv = defaultRuntimeEnv) {
  const previousEnv = Object.fromEntries(Object.keys(runtimeEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, runtimeEnv);
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  try {
    const { default: worker } = await import(workerUrl.href);
    return await worker.fetch(
      new Request("http://localhost/", { headers: { accept: "text/html" } }),
      { ...runtimeEnv, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("server-renders the authenticated Hjemblik entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="da">/i);
  assert.match(html, /<title>Hjemblik — økonomi og hverdag samlet<\/title>/i);
  assert.match(html, /auth-shell auth-loading/);
  assert.match(html, /Hjemblik/);
  assert.match(html, /AuthGate/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
test("connects account login and household data without privileged keys", async () => {
  const [page, auth, app, checklist, client, exampleEnv] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/checklist-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/supabase-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /signUp/);
  assert.match(auth, /resetPasswordForEmail/);
  assert.match(auth, /updateUser\(\{\s*password,?\s*\}\)/);
  assert.match(auth, /Glemt adgangskode/);
  assert.match(auth, /authRedirectUrl/);
  assert.match(page, /process\.env/);
  assert.match(page, /NEXT_PUBLIC_APP_URL/);
  assert.match(auth, /error_code/);
  assert.match(auth, /supabase\.auth\.resend/);
  assert.match(auth, /Send nyt bekræftelseslink/);
  assert.match(auth, /ensureHousehold/);
  assert.match(auth, /ensure_current_user_household/);
  assert.match(checklist, /from\("tasks"\)/);
  assert.match(checklist, /from\("shopping_items"\)/);
  assert.match(app, /TasksView/);
  assert.match(app, /ShoppingView/);
  assert.match(app, /loadNotificationPreferences/);
  assert.match(client, /PublicSupabaseConfig/);
  assert.doesNotMatch(client, /process\.env\.NEXT_PUBLIC_/);
  assert.match(exampleEnv, /sb_publishable_your_key/);
  assert.match(exampleEnv, /NEXT_PUBLIC_APP_URL/);
  assert.doesNotMatch(`${auth}\n${app}\n${checklist}\n${client}\n${exampleEnv}`, /service[_-]?role|secret[_-]?key/i);
});

test("renders a visible configuration error instead of crashing", async () => {
  const response = await render({
    NEXT_PUBLIC_APP_URL: defaultRuntimeEnv.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  });

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /FORBINDELSESFEJL/);
  assert.match(html, /Konfigurationen til login mangler/);
});

test("persists selectable periods and renders one transaction-based budget table", async () => {
  const [app, finance] = await Promise.all([
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/finance-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(finance, /ensureCurrentBudget/);
  assert.match(finance, /budget_categories/);
  assert.match(finance, /budget_items/);
  assert.match(finance, /addFinanceTransaction/);
  assert.match(finance, /loadFinanceYear/);
  assert.match(finance, /budgetPeriodMonthKeys/);
  assert.match(finance, /loadFinancePeriod/);
  assert.match(finance, /buildTransactionPeriodRows/);
  assert.match(finance, /updateFinanceTransactionOccurrence/);
  assert.match(finance, /"calendar" \| "rest-of-year" \| "rolling-12"/);
  assert.match(app, /TransactionModal/);
  assert.match(app, /FinanceOverviewView/);
  assert.match(app, /Overblik/);
  assert.match(app, /12 måneder frem/);
  assert.match(app, /Fra \$\{pendingEdit\.monthLabel\} og frem/);
  assert.match(app, /Alle tal kommer fra dine posteringer/);
  assert.doesNotMatch(app, /Budgetvisning/);
  assert.match(app, /Budget · \{financePeriodLabel\(financePeriod\)\}/);
  assert.doesNotMatch(finance, /service[_-]?role|secret[_-]?key/i);
});

test("keeps household documents private and downloadable through signed links", async () => {
  const [app, archiveView, documentData, storageMigration, archiveMigration] = await Promise.all([
    readFile(new URL("../app/household-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/document-library-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/documents-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260831064746_protect_private_document_storage.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260913101706_extend_document_archive.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /DocumentLibraryView/);
  assert.match(archiveView, /Søg i titel, tags eller noter/);
  assert.match(archiveView, /Forbind dokumentet/);
  assert.match(archiveView, /Udløbne og snart udløbne/);
  assert.match(documentData, /household-documents/);
  assert.match(documentData, /createSignedUrl/);
  assert.match(documentData, /20 \* 1024 \* 1024/);
  assert.match(storageMigration, /exists \(/);
  assert.match(storageMigration, /public\.documents/);
  assert.match(archiveMigration, /enable row level security/g);
  assert.match(archiveMigration, /security invoker/i);
  assert.match(archiveMigration, /revoke all on function public\.update_document_archive_metadata[\s\S]*?from public, anon/i);
  assert.match(archiveMigration, /document\.visibility = 'household' or document\.owner_user_id/);
  assert.doesNotMatch(`${documentData}\n${archiveView}`, /getPublicUrl|service[_-]?role|secret[_-]?key/i);
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
  assert.match(app, /loadMealPlan\(householdId, mondayFor\(\)\)/);
  assert.match(app, /sampleMode \? shopping\.map/);
  assert.match(app, /Ingen planlagte måltider i denne uge/);
  assert.doesNotMatch(app, /mealItems\.length \? mealItems\.map[\s\S]*?: meals\.map/);
  assert.match(app, /prefers-color-scheme: dark/);
  assert.match(app, /mit-hjem:preferences:v2/);
  assert.match(app, /sampleMode \? calendarItems/);
  assert.match(app, /sampleMode \? meals/);
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

test("keeps modal focus handling and task assignment household-safe", async () => {
  const [modalAccessibility, calendar, mealPlan, household, migration] = await Promise.all([
    readFile(new URL("../app/modal-accessibility.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/calendar-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/meal-plan-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/household-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260913090000_harden_task_assignment_and_notification_defaults.sql", import.meta.url), "utf8"),
  ]);

  assert.match(modalAccessibility, /event\.key === "Escape"/);
  assert.match(modalAccessibility, /event\.key !== "Tab"/);
  assert.match(modalAccessibility, /previousFocus\?\.focus/);
  assert.match(calendar, /useModalAccessibility\(onClose, saving\)/);
  assert.match(mealPlan, /useModalAccessibility\(onClose, saving\)/);
  assert.match(household, /useModalAccessibility\(onClose, saving\)/);
  assert.match(migration, /validate_task_assignee_household/i);
  assert.match(migration, /membership\.household_id = new\.household_id/i);
  assert.match(migration, /revoke all on function private\.validate_task_assignee_household\(\) from public, anon, authenticated/i);
  assert.match(migration, /email_enabled set default false/i);
});
