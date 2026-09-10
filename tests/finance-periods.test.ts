import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionPeriodRows,
  budgetCategorySummaryTotals,
  budgetEditMonthIndexes,
  budgetPeriodMonthKeys,
  budgetPeriodTotalLabel,
  collapseRecurringTransactions,
  isValidFinanceAmount,
  maximumFinanceAmount,
  recurringTransactionDates,
  shouldPromptForBudgetEdit,
  transactionRecurrenceLabel,
  transactionPeriodTotals,
} from "../app/finance-data";
import { financeRoute, readFinanceRoute } from "../app/household-app";

test("builds a rolling 12-month period across a year boundary", () => {
  assert.deepEqual(
    budgetPeriodMonthKeys("rolling-12", 2026, new Date("2026-12-15T12:00:00Z")),
    [
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
      "2027-04-01",
      "2027-05-01",
      "2027-06-01",
      "2027-07-01",
      "2027-08-01",
      "2027-09-01",
      "2027-10-01",
      "2027-11-01",
    ],
  );
});

test("builds the visible remainder of the current year", () => {
  assert.deepEqual(
    budgetPeriodMonthKeys("rest-of-year", 2024, new Date("2026-08-15T12:00:00Z")),
    ["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"],
  );
});

test("limits repeat-forward edits to the visible period", () => {
  assert.deepEqual(budgetEditMonthIndexes(5, 2, false), [2]);
  assert.deepEqual(budgetEditMonthIndexes(5, 2, true), [2, 3, 4]);
  assert.deepEqual(budgetEditMonthIndexes(5, 4, true), [4]);
  assert.equal(shouldPromptForBudgetEdit(2, 5), true);
  assert.equal(shouldPromptForBudgetEdit(4, 5), false);
});

test("uses the calendar-specific total heading", () => {
  assert.equal(budgetPeriodTotalLabel("calendar"), "Året");
  assert.equal(budgetPeriodTotalLabel("rest-of-year"), "I alt");
  assert.equal(budgetPeriodTotalLabel("rolling-12"), "I alt");
});

test("groups typed categories without relying on Danish names", () => {
  assert.deepEqual(budgetCategorySummaryTotals([
    { categoryType: "fixed_expense", values: [1_000, 1_000] },
    { categoryType: "saving", values: [500, 500] },
    { categoryType: "debt", values: [250, 250] },
    { categoryType: "variable_expense", values: [300, 400] },
    { categoryType: "uncategorized", values: [50, 0] },
  ]), { fixed: 3_500, variable: 750 });
});

test("accepts ørebeløb but rejects negative and oversized finance values", () => {
  assert.equal(isValidFinanceAmount(236.75), true);
  assert.equal(isValidFinanceAmount(0), true);
  assert.equal(isValidFinanceAmount(0, false), false);
  assert.equal(isValidFinanceAmount(-0.01), false);
  assert.equal(isValidFinanceAmount(maximumFinanceAmount + 0.01), false);
});

test("builds recurring transaction dates for a bounded view", () => {
  assert.deepEqual(recurringTransactionDates("2026-01-31", "monthly", { throughDate: "2026-12-31" }), [
    "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
    "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31",
  ]);
  assert.deepEqual(recurringTransactionDates("2026-08-15", "quarterly", { throughDate: "2027-08-14" }), ["2026-08-15", "2026-11-15", "2027-02-15", "2027-05-15"]);
  assert.deepEqual(recurringTransactionDates("2026-08-15", "every_2_months", { throughDate: "2027-08-14" }), ["2026-08-15", "2026-10-15", "2026-12-15", "2027-02-15", "2027-04-15", "2027-06-15"]);
  assert.deepEqual(recurringTransactionDates("2026-08-15", "half_yearly", { throughDate: "2027-08-14" }), ["2026-08-15", "2027-02-15"]);
  assert.deepEqual(recurringTransactionDates("2026-08-15", "once"), ["2026-08-15"]);
  assert.equal(transactionRecurrenceLabel("every_2_months"), "Hver anden måned");
});

test("monthly recurrence stays ongoing unless a final payment date is set", () => {
  assert.deepEqual(
    recurringTransactionDates("2026-09-02", "monthly", { fromDate: "2027-01-01", throughDate: "2027-04-30" }),
    ["2027-01-02", "2027-02-02", "2027-03-02", "2027-04-02"],
  );
  assert.deepEqual(
    recurringTransactionDates("2026-09-02", "monthly", { endDate: "2027-02-02", throughDate: "2027-04-30" }),
    ["2026-09-02", "2026-10-02", "2026-11-02", "2026-12-02", "2027-01-02", "2027-02-02"],
  );
});

test("collapses legacy monthly rows to one series in the overview", () => {
  const base = {
    merchant: "Husleje",
    amount: 6_200,
    direction: "expense" as const,
    categoryId: "bolig",
    categoryName: "Bolig",
    status: "approved" as const,
    recurrence: "monthly" as const,
    recurrenceGroupId: "series-1",
    recurrenceEndOn: null,
    linkedDocumentIds: [],
  };
  const collapsed = collapseRecurringTransactions([
    { ...base, id: "feb", occurredOn: "2027-02-02", status: "scheduled" },
    { ...base, id: "jan", occurredOn: "2027-01-02", status: "scheduled" },
    { ...base, id: "sep", occurredOn: "2026-09-02" },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].id, "sep");
  assert.equal(collapsed[0].occurredOn, "2026-09-02");
});

test("builds one transaction row with future recurring amounts and occurrence overrides", () => {
  const months = ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"].map((key) => ({
    key,
    year: Number(key.slice(0, 4)),
    monthIndex: Number(key.slice(5, 7)) - 1,
    label: key,
  }));
  const base = {
    categoryId: null,
    categoryName: "Indtægt",
    direction: "income" as const,
    linkedDocumentIds: [],
    recurrenceEndOn: null,
    status: "approved" as const,
  };
  const rows = buildTransactionPeriodRows([
    { ...base, id: "salary", merchant: "Løn", amount: 15_000, occurredOn: "2026-09-15", recurrence: "every_2_months", recurrenceGroupId: "salary-series" },
  ], [
    { transactionId: "salary", occurredOn: "2026-11-15", amount: 16_000, isSkipped: false },
    { transactionId: "salary", occurredOn: "2027-01-15", amount: null, isSkipped: true },
  ], months);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].occurrenceDates, ["2026-09-15", null, "2026-11-15", null, "2027-01-15"]);
  assert.deepEqual(rows[0].values, [15_000, 0, 16_000, 0, 0]);
  assert.deepEqual(transactionPeriodTotals(rows, months.length), {
    incomeValues: [15_000, 0, 16_000, 0, 0],
    expenseValues: [0, 0, 0, 0, 0],
    availableValues: [15_000, 0, 16_000, 0, 0],
  });
});

test("includes scheduled one-time and recurring expenses in the selected budget period", () => {
  const months = ["2026-09-01", "2026-10-01", "2026-11-01"].map((key) => ({
    key,
    year: 2026,
    monthIndex: Number(key.slice(5, 7)) - 1,
    label: key,
  }));
  const common = { categoryId: "home", categoryName: "Bolig", direction: "expense" as const, linkedDocumentIds: [], recurrenceEndOn: null };
  const rows = buildTransactionPeriodRows([
    { ...common, id: "rent", merchant: "Husleje", amount: 6_200, occurredOn: "2026-09-01", recurrence: "monthly", recurrenceGroupId: "rent-series", status: "approved" },
    { ...common, id: "repair", merchant: "Reparation", amount: 900, occurredOn: "2026-11-20", recurrence: "once", recurrenceGroupId: null, status: "scheduled" },
  ], [], months);

  assert.deepEqual(rows.map((row) => row.values), [[6_200, 6_200, 6_200], [0, 0, 900]]);
  assert.deepEqual(transactionPeriodTotals(rows, 3).expenseValues, [6_200, 6_200, 7_100]);
});

test("keeps a split recurring series on one row while using the new amount from its effective month", () => {
  const months = ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"].map((key) => ({ key, year: 2026, monthIndex: Number(key.slice(5, 7)) - 1, label: key }));
  const common = { merchant: "Husleje", direction: "expense" as const, categoryId: "home", categoryName: "Bolig", status: "approved" as const, recurrence: "monthly" as const, recurrenceGroupId: "rent-series", linkedDocumentIds: [] };
  const rows = buildTransactionPeriodRows([
    { ...common, id: "rent-old", amount: 6_200, occurredOn: "2026-09-01", recurrenceEndOn: "2026-10-31" },
    { ...common, id: "rent-new", amount: 6_500, occurredOn: "2026-11-01", recurrenceEndOn: null },
  ], [], months);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].values, [6_200, 6_200, 6_500, 6_500]);
  assert.deepEqual(rows[0].occurrenceTransactions.map((transaction) => transaction?.id), ["rent-old", "rent-old", "rent-new", "rent-new"]);
});

test("round-trips every stable finance route", () => {
  assert.deepEqual(readFinanceRoute("/oekonomi"), { section: "overview", categoryId: null });
  assert.deepEqual(readFinanceRoute("/oekonomi/budget"), { section: "budget", categoryId: null });
  assert.deepEqual(readFinanceRoute("/oekonomi/posteringer"), { section: "transactions", categoryId: null });
  assert.deepEqual(readFinanceRoute("/oekonomi/abonnementer"), { section: "subscriptions", categoryId: null });
  assert.deepEqual(readFinanceRoute("/oekonomi/kategorier/mad%20og%20hus"), { section: "category", categoryId: "mad og hus" });
  assert.equal(readFinanceRoute("/oekonomi/ukendt"), null);

  for (const [section, categoryId] of [["overview", null], ["budget", null], ["transactions", null], ["subscriptions", null], ["category", "mad og hus"]] as const) {
    const url = financeRoute(section, categoryId);
    assert.deepEqual(readFinanceRoute(url), { section, categoryId });
  }
});
