import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetEditMonthIndexes,
  budgetPeriodMonthKeys,
  budgetPeriodTotalLabel,
  shouldPromptForBudgetEdit,
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
