import assert from "node:assert/strict";
import test from "node:test";
import {
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
} from "../app/finance-data";

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
