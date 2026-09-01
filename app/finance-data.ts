import { getSupabaseBrowserClient } from "./supabase-client";

export type FinanceCategory = {
  id: string;
  budgetItemId: string;
  name: string;
  color: string;
  categoryType: FinanceCategoryType;
  editable: boolean;
  planned: number;
  spent: number;
};

export type FinanceCategoryType = "fixed_expense" | "variable_expense" | "saving" | "debt" | "uncategorized";

export type FinanceTransaction = {
  id: string;
  merchant: string;
  amount: number;
  direction: "expense" | "income";
  occurredOn: string;
  categoryId: string | null;
  categoryName: string;
  status: "approved" | "scheduled";
  recurrence: TransactionRecurrence;
  recurrenceGroupId: string | null;
};

export type FinanceSnapshot = {
  budgetId: string;
  month: string;
  incomeTarget: number;
  spendingTarget: number;
  spent: number;
  income: number;
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
};

export type NewTransaction = {
  merchant: string;
  amount: number;
  direction: "expense" | "income";
  occurredOn: string;
  categoryId: string | null;
  recurrence: TransactionRecurrence;
  status?: "approved" | "scheduled";
};

export type TransactionRecurrence = "once" | "monthly" | "every_2_months" | "quarterly" | "half_yearly";

export type FinanceYearCategory = {
  id: string;
  name: string;
  color: string;
  categoryType: FinanceCategoryType;
  editable: boolean;
  budgetItemIds: Array<string | null>;
  planned: number[];
  actual: number[];
};

export type FinanceYearSnapshot = {
  year: number;
  budgetIds: string[];
  incomePlanned: number[];
  incomeActual: number[];
  expenseActual: number[];
  categories: FinanceYearCategory[];
};

export type BudgetPeriodMode = "calendar" | "rest-of-year" | "rolling-12";

export type FinancePeriodMonth = {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
};

export type FinancePeriodSnapshot = {
  mode: BudgetPeriodMode;
  selectedYear: number;
  months: FinancePeriodMonth[];
  budgetIds: string[];
  incomePlanned: number[];
  incomeActual: number[];
  expenseActual: number[];
  categories: FinanceYearCategory[];
};

export const financeMonthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"] as const;
export const maximumFinanceAmount = 9_999_999_999.99;

const recurrenceIntervals: Record<TransactionRecurrence, number | null> = {
  once: null,
  monthly: 1,
  every_2_months: 2,
  quarterly: 3,
  half_yearly: 6,
};

export function transactionRecurrenceLabel(recurrence: TransactionRecurrence) {
  return ({
    once: "Kun denne måned",
    monthly: "Hver måned",
    every_2_months: "Hver anden måned",
    quarterly: "Hvert kvartal",
    half_yearly: "Hvert halve år",
  } as const)[recurrence];
}

function dateKey(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0, 12).getDate();
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function recurringTransactionDates(startDate: string, recurrence: TransactionRecurrence) {
  const interval = recurrenceIntervals[recurrence];
  if (!interval) return [startDate];
  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  return Array.from({ length: Math.floor(11 / interval) + 1 }, (_, index) => {
    const monthOffset = index * interval;
    const year = start.getFullYear() + Math.floor((start.getMonth() + monthOffset) / 12);
    const monthIndex = (start.getMonth() + monthOffset) % 12;
    return dateKey(year, monthIndex, start.getDate());
  });
}

function recurrenceFromInterval(interval: number | null): TransactionRecurrence {
  return (Object.entries(recurrenceIntervals).find(([, value]) => value === interval)?.[0] as TransactionRecurrence | undefined) ?? "once";
}

export function isValidFinanceAmount(value: number, allowZero = true) {
  return Number.isFinite(value) && value <= maximumFinanceAmount && (allowZero ? value >= 0 : value > 0);
}

export function budgetCategorySummaryTotals(categories: Array<Pick<FinanceYearCategory, "categoryType"> & { values: number[] }>) {
  return categories.reduce((totals, category) => {
    const amount = category.values.reduce((sum, value) => sum + value, 0);
    if (category.categoryType === "variable_expense" || category.categoryType === "uncategorized") totals.variable += amount;
    else totals.fixed += amount;
    return totals;
  }, { fixed: 0, variable: 0 });
}

const defaultCategories = [
  { name: "Bolig", color: "#2158E8", categoryType: "fixed_expense", planned: 9000 },
  { name: "Mad & husholdning", color: "#20A874", categoryType: "variable_expense", planned: 7000 },
  { name: "Transport", color: "#8267DF", categoryType: "fixed_expense", planned: 3500 },
  { name: "Forsikring", color: "#FF9A5C", categoryType: "fixed_expense", planned: 1500 },
  { name: "Fritid", color: "#D85B8C", categoryType: "variable_expense", planned: 2000 },
] as const;

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function nextMonthKey(month: string) {
  const date = new Date(`${month}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  return monthKey(date);
}

async function ensureCurrentBudget(householdId: string, userId: string) {
  const supabase = getSupabaseBrowserClient();
  const currentMonth = monthKey();
  const existingBudget = await supabase
    .from("budgets")
    .select("id, month, income_target, spending_target")
    .eq("household_id", householdId)
    .eq("month", currentMonth)
    .maybeSingle();
  if (existingBudget.error) throw existingBudget.error;

  const categoriesResult = await supabase
    .from("budget_categories")
    .select("id, name, color, category_type, sort_order")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("sort_order");
  if (categoriesResult.error) throw categoriesResult.error;

  let categories = categoriesResult.data ?? [];
  if (categories.length === 0) {
    const seededCategories = await supabase
      .from("budget_categories")
      .insert(defaultCategories.map((category, index) => ({
        household_id: householdId,
        created_by: userId,
        name: category.name,
        color: category.color,
        category_type: category.categoryType,
        sort_order: index,
      })))
      .select("id, name, color, category_type, sort_order");
    if (seededCategories.error) throw seededCategories.error;
    categories = seededCategories.data ?? [];
  }

  const currentBudget = existingBudget.data;
  if (currentBudget) {
    const defaultAmounts = new Map<string, number>(defaultCategories.map((item) => [item.name, item.planned]));
    const missingItemsResult = await supabase.from("budget_items").upsert(
      categories.map((category) => ({
        household_id: householdId,
        budget_id: currentBudget.id,
        category_id: category.id,
        planned_amount: defaultAmounts.get(category.name) ?? 0,
      })),
      { onConflict: "budget_id,category_id", ignoreDuplicates: true },
    );
    if (missingItemsResult.error) throw missingItemsResult.error;
    return { budget: currentBudget, categories };
  }

  const previousBudgetResult = await supabase
    .from("budgets")
    .select("id, month, income_target, spending_target")
    .eq("household_id", householdId)
    .lt("month", currentMonth)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousBudgetResult.error) throw previousBudgetResult.error;

  const previousBudget = previousBudgetResult.data;
  const createdBudgetResult = await supabase
    .from("budgets")
    .upsert({
      household_id: householdId,
      created_by: userId,
      month: currentMonth,
      name: "Månedsbudget",
      income_target: previousBudget?.income_target ?? 0,
      spending_target: previousBudget?.spending_target ?? defaultCategories.reduce((sum, item) => sum + item.planned, 0),
    }, { onConflict: "household_id,month", ignoreDuplicates: true })
    .select("id, month, income_target, spending_target")
    .maybeSingle();
  if (createdBudgetResult.error) throw createdBudgetResult.error;

  let budget = createdBudgetResult.data;
  if (!budget) {
    const concurrentBudget = await supabase
      .from("budgets")
      .select("id, month, income_target, spending_target")
      .eq("household_id", householdId)
      .eq("month", currentMonth)
      .single();
    if (concurrentBudget.error) throw concurrentBudget.error;
    budget = concurrentBudget.data;
  }

  let previousAmounts = new Map<string, number>();
  if (previousBudget) {
    const previousItems = await supabase
      .from("budget_items")
      .select("category_id, planned_amount")
      .eq("household_id", householdId)
      .eq("budget_id", previousBudget.id);
    if (previousItems.error) throw previousItems.error;
    previousAmounts = new Map((previousItems.data ?? []).map((item) => [item.category_id, Number(item.planned_amount)]));
  }

  const defaultAmounts = new Map<string, number>(defaultCategories.map((item) => [item.name, item.planned]));
  const itemsResult = await supabase.from("budget_items").upsert(
    categories.map((category) => ({
      household_id: householdId,
      budget_id: budget.id,
      category_id: category.id,
      planned_amount: previousAmounts.get(category.id) ?? defaultAmounts.get(category.name) ?? 0,
    })),
    { onConflict: "budget_id,category_id", ignoreDuplicates: true },
  );
  if (itemsResult.error) throw itemsResult.error;

  return { budget, categories };
}

export async function loadFinance(householdId: string, userId: string): Promise<FinanceSnapshot> {
  const supabase = getSupabaseBrowserClient();
  const { budget, categories } = await ensureCurrentBudget(householdId, userId);
  const endMonth = nextMonthKey(budget.month);
  const [itemsResult, transactionsResult] = await Promise.all([
    supabase.from("budget_items").select("id, category_id, planned_amount").eq("household_id", householdId).eq("budget_id", budget.id),
    supabase.from("transactions").select("id, merchant, amount, direction, occurred_on, category_id, status, recurrence_interval_months, recurrence_group_id").eq("household_id", householdId).gte("occurred_on", budget.month).lt("occurred_on", endMonth).in("status", ["approved", "scheduled"]).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const itemsByCategory = new Map((itemsResult.data ?? []).map((item) => [item.category_id, item]));
  const transactions: FinanceTransaction[] = (transactionsResult.data ?? []).map((transaction) => ({
    id: transaction.id,
    merchant: transaction.merchant,
    amount: Number(transaction.amount),
    direction: transaction.direction as "expense" | "income",
    occurredOn: transaction.occurred_on,
    categoryId: transaction.category_id,
    categoryName: transaction.category_id ? categoryById.get(transaction.category_id)?.name ?? "Andet" : transaction.direction === "income" ? "Indtægt" : "Andet",
    status: transaction.status as "approved" | "scheduled",
    recurrence: recurrenceFromInterval(transaction.recurrence_interval_months),
    recurrenceGroupId: transaction.recurrence_group_id,
  }));

  const categorySpend = new Map<string, number>();
  let uncategorizedSpend = 0;
  for (const transaction of transactions) {
    if (transaction.status !== "approved") continue;
    if (transaction.direction !== "expense") continue;
    if (!transaction.categoryId) {
      uncategorizedSpend += transaction.amount;
      continue;
    }
    categorySpend.set(transaction.categoryId, (categorySpend.get(transaction.categoryId) ?? 0) + transaction.amount);
  }

  const financeCategories: FinanceCategory[] = categories.map((category) => {
    const item = itemsByCategory.get(category.id);
    return {
      id: category.id,
      budgetItemId: item?.id ?? "",
      name: category.name,
      color: category.color ?? "#2158E8",
      categoryType: category.category_type as FinanceCategoryType,
      editable: true,
      planned: Number(item?.planned_amount ?? 0),
      spent: categorySpend.get(category.id) ?? 0,
    };
  });
  if (uncategorizedSpend > 0) {
    financeCategories.push({
      id: "uncategorized",
      budgetItemId: "",
      name: "Ikke kategoriseret",
      color: "#6B7280",
      categoryType: "uncategorized",
      editable: false,
      planned: 0,
      spent: uncategorizedSpend,
    });
  }
  const spendingTarget = financeCategories.reduce((sum, category) => sum + category.planned, 0) || Number(budget.spending_target);

  return {
    budgetId: budget.id,
    month: budget.month,
    incomeTarget: Number(budget.income_target),
    spendingTarget,
    spent: transactions.filter((item) => item.status === "approved" && item.direction === "expense").reduce((sum, item) => sum + item.amount, 0),
    income: transactions.filter((item) => item.status === "approved" && item.direction === "income").reduce((sum, item) => sum + item.amount, 0),
    categories: financeCategories,
    transactions,
  };
}

export async function addFinanceTransaction(householdId: string, userId: string, transaction: NewTransaction) {
  const dates = recurringTransactionDates(transaction.occurredOn, transaction.recurrence);
  const recurrenceInterval = recurrenceIntervals[transaction.recurrence];
  const recurrenceGroupId = recurrenceInterval ? crypto.randomUUID() : null;
  const today = new Date().toISOString().slice(0, 10);
  const result = await getSupabaseBrowserClient().from("transactions").insert(dates.map((occurredOn, index) => ({
    household_id: householdId,
    created_by: userId,
    merchant: transaction.merchant,
    amount: transaction.amount,
    direction: transaction.direction,
    occurred_on: occurredOn,
    category_id: transaction.direction === "expense" ? transaction.categoryId : null,
    recurrence_interval_months: recurrenceInterval,
    recurrence_group_id: recurrenceGroupId,
    source: "manual",
    status: index === 0 && occurredOn <= today ? "approved" : "scheduled",
  })));
  if (result.error) throw result.error;
}

export async function updateFinanceTransaction(householdId: string, transactionId: string, transaction: NewTransaction) {
  const result = await getSupabaseBrowserClient().from("transactions").update({
    merchant: transaction.merchant,
    amount: transaction.amount,
    direction: transaction.direction,
    occurred_on: transaction.occurredOn,
    category_id: transaction.direction === "expense" ? transaction.categoryId : null,
    status: transaction.status ?? "approved",
  }).eq("id", transactionId).eq("household_id", householdId).select("id").single();
  if (result.error) throw result.error;
}

export async function deleteFinanceTransaction(householdId: string, transactionId: string) {
  const result = await getSupabaseBrowserClient().from("transactions").delete().eq("id", transactionId).eq("household_id", householdId).select("id").single();
  if (result.error) throw result.error;
}

export async function loadFinanceTransactions(householdId: string, limit = 200): Promise<FinanceTransaction[]> {
  const supabase = getSupabaseBrowserClient();
  const [transactionsResult, categoriesResult] = await Promise.all([
    supabase.from("transactions")
      .select("id, merchant, amount, direction, occurred_on, category_id, status, recurrence_interval_months, recurrence_group_id")
      .eq("household_id", householdId)
      .in("status", ["approved", "scheduled"])
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("budget_categories").select("id, name").eq("household_id", householdId),
  ]);
  if (transactionsResult.error) throw transactionsResult.error;
  if (categoriesResult.error) throw categoriesResult.error;
  const categoryById = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
  return (transactionsResult.data ?? []).map((transaction) => ({
    id: transaction.id,
    merchant: transaction.merchant,
    amount: Number(transaction.amount),
    direction: transaction.direction as "expense" | "income",
    occurredOn: transaction.occurred_on,
    categoryId: transaction.category_id,
    categoryName: transaction.category_id ? categoryById.get(transaction.category_id) ?? "Andet" : transaction.direction === "income" ? "Indtægt" : "Ikke kategoriseret",
    status: transaction.status as "approved" | "scheduled",
    recurrence: recurrenceFromInterval(transaction.recurrence_interval_months),
    recurrenceGroupId: transaction.recurrence_group_id,
  }));
}

export async function updatePlannedAmount(householdId: string, snapshot: FinanceSnapshot, categoryId: string, planned: number) {
  const category = snapshot.categories.find((item) => item.id === categoryId);
  if (!category?.budgetItemId) throw new Error("Budgetkategorien kunne ikke opdateres.");
  const result = await getSupabaseBrowserClient().rpc("update_budget_plans", {
    p_household_id: householdId,
    p_category_id: categoryId,
    p_budget_ids: [snapshot.budgetId],
    p_amount: planned,
  });
  if (result.error) throw result.error;
}

function yearMonthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

export function budgetPeriodMonthKeys(mode: BudgetPeriodMode, selectedYear: number, now = new Date()): string[] {
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  if (mode === "calendar") return Array.from({ length: 12 }, (_, monthIndex) => yearMonthKey(selectedYear, monthIndex));
  if (mode === "rest-of-year") return Array.from({ length: 12 - currentMonthIndex }, (_, offset) => yearMonthKey(currentYear, currentMonthIndex + offset));
  return Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(currentYear, currentMonthIndex + offset, 1, 12);
    return yearMonthKey(date.getFullYear(), date.getMonth());
  });
}

export function budgetEditMonthIndexes(monthCount: number, monthIndex: number, forward: boolean): number[] {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= monthCount) return [];
  return forward
    ? Array.from({ length: monthCount - monthIndex }, (_, offset) => monthIndex + offset)
    : [monthIndex];
}

export function shouldPromptForBudgetEdit(monthIndex: number, monthCount: number) {
  return monthIndex >= 0 && monthIndex < monthCount - 1;
}

export function budgetPeriodTotalLabel(mode: BudgetPeriodMode) {
  return mode === "calendar" ? "Året" : "I alt";
}

export function financePeriodLabel(snapshot: FinancePeriodSnapshot) {
  if (snapshot.mode === "calendar") return `Kalenderåret ${snapshot.selectedYear}`;
  if (snapshot.mode === "rest-of-year") return `Resten af ${snapshot.months[0]?.year ?? new Date().getFullYear()}`;
  const first = snapshot.months[0];
  const last = snapshot.months.at(-1);
  return first && last ? `${first.label} – ${last.label}` : "12 måneder frem";
}

async function ensureYearBudgets(householdId: string, userId: string, year: number, monthsToEnsure = Array.from({ length: 12 }, (_, monthIndex) => yearMonthKey(year, monthIndex))) {
  const supabase = getSupabaseBrowserClient();
  const { categories } = await ensureCurrentBudget(householdId, userId);
  const yearStart = yearMonthKey(year, 0);
  const nextYearStart = yearMonthKey(year + 1, 0);

  const ensureResult = await supabase.rpc("ensure_budget_months", {
    p_household_id: householdId,
    p_months: monthsToEnsure,
  });
  if (ensureResult.error) throw ensureResult.error;

  const budgetsResult = await supabase
    .from("budgets")
    .select("id, month, income_target, spending_target")
    .eq("household_id", householdId)
    .gte("month", yearStart)
    .lt("month", nextYearStart)
    .order("month");
  if (budgetsResult.error) throw budgetsResult.error;
  const budgets = budgetsResult.data ?? [];

  return { budgets, categories };
}

export async function loadFinanceYear(householdId: string, userId: string, year: number, monthsToEnsure?: string[]): Promise<FinanceYearSnapshot> {
  const supabase = getSupabaseBrowserClient();
  const { budgets, categories } = await ensureYearBudgets(householdId, userId, year, monthsToEnsure);
  const budgetByMonth = new Map(budgets.map((budget) => [Number(budget.month.slice(5, 7)) - 1, budget]));
  const budgetIds = Array.from({ length: 12 }, (_, monthIndex) => budgetByMonth.get(monthIndex)?.id ?? "");
  const yearStart = `${year}-01-01`;
  const nextYearStart = `${year + 1}-01-01`;

  const [itemsResult, transactionsResult] = await Promise.all([
    supabase.from("budget_items").select("id, budget_id, category_id, planned_amount").eq("household_id", householdId).in("budget_id", budgetIds.filter(Boolean)),
    supabase.from("transactions").select("amount, direction, occurred_on, category_id").eq("household_id", householdId).gte("occurred_on", yearStart).lt("occurred_on", nextYearStart).eq("status", "approved"),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const budgetMonthById = new Map(budgets.map((budget) => [budget.id, Number(budget.month.slice(5, 7)) - 1]));
  const itemByPair = new Map((itemsResult.data ?? []).map((item) => [`${item.category_id}:${budgetMonthById.get(item.budget_id)}`, item]));
  const incomeActual = Array(12).fill(0) as number[];
  const expenseActual = Array(12).fill(0) as number[];
  const uncategorizedActual = Array(12).fill(0) as number[];
  const actualByCategory = new Map<string, number[]>();
  for (const transaction of transactionsResult.data ?? []) {
    const monthIndex = Number(transaction.occurred_on.slice(5, 7)) - 1;
    const amount = Number(transaction.amount);
    if (transaction.direction === "income") incomeActual[monthIndex] += amount;
    else {
      expenseActual[monthIndex] += amount;
      if (transaction.category_id) {
        const values = actualByCategory.get(transaction.category_id) ?? Array(12).fill(0) as number[];
        values[monthIndex] += amount;
        actualByCategory.set(transaction.category_id, values);
      } else uncategorizedActual[monthIndex] += amount;
    }
  }

  return {
    year,
    budgetIds,
    incomePlanned: Array.from({ length: 12 }, (_, monthIndex) => Number(budgetByMonth.get(monthIndex)?.income_target ?? 0)),
    incomeActual,
    expenseActual,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color ?? "#2158E8",
      categoryType: category.category_type as FinanceCategoryType,
      editable: true,
      budgetItemIds: Array.from({ length: 12 }, (_, monthIndex) => itemByPair.get(`${category.id}:${monthIndex}`)?.id ?? null),
      planned: Array.from({ length: 12 }, (_, monthIndex) => Number(itemByPair.get(`${category.id}:${monthIndex}`)?.planned_amount ?? 0)),
      actual: actualByCategory.get(category.id) ?? Array(12).fill(0) as number[],
    })).concat(uncategorizedActual.some((value) => value > 0) ? [{
      id: "uncategorized",
      name: "Ikke kategoriseret",
      color: "#6B7280",
      categoryType: "uncategorized" as const,
      editable: false,
      budgetItemIds: Array(12).fill(null) as Array<null>,
      planned: Array(12).fill(0) as number[],
      actual: uncategorizedActual,
    }] : []),
  };
}

export async function loadFinancePeriod(householdId: string, userId: string, mode: BudgetPeriodMode, selectedYear: number): Promise<FinancePeriodSnapshot> {
  const monthKeys = budgetPeriodMonthKeys(mode, selectedYear);
  const years = [...new Set(monthKeys.map((key) => Number(key.slice(0, 4))))];
  const snapshots = await Promise.all(years.map((year) => loadFinanceYear(householdId, userId, year, monthKeys.filter((key) => Number(key.slice(0, 4)) === year))));
  const snapshotByYear = new Map(snapshots.map((snapshot) => [snapshot.year, snapshot]));
  const months = monthKeys.map((key) => {
    const year = Number(key.slice(0, 4));
    const monthIndex = Number(key.slice(5, 7)) - 1;
    return { key, year, monthIndex, label: `${financeMonthNames[monthIndex]} ${String(year).slice(-2)}` };
  });
  const categoryOrder = snapshots.flatMap((snapshot) => snapshot.categories).filter((category, index, categories) => categories.findIndex((candidate) => candidate.id === category.id) === index);

  return {
    mode,
    selectedYear,
    months,
    budgetIds: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.budgetIds[monthIndex] ?? ""),
    incomePlanned: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.incomePlanned[monthIndex] ?? 0),
    incomeActual: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.incomeActual[monthIndex] ?? 0),
    expenseActual: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.expenseActual[monthIndex] ?? 0),
    categories: categoryOrder.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      categoryType: category.categoryType,
      editable: category.editable,
      budgetItemIds: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.categories.find((candidate) => candidate.id === category.id)?.budgetItemIds[monthIndex] ?? null),
      planned: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.categories.find((candidate) => candidate.id === category.id)?.planned[monthIndex] ?? 0),
      actual: months.map(({ year, monthIndex }) => snapshotByYear.get(year)?.categories.find((candidate) => candidate.id === category.id)?.actual[monthIndex] ?? 0),
    })),
  };
}

function validPeriodIndexes(snapshot: FinancePeriodSnapshot, monthIndexes: number[]) {
  return [...new Set(monthIndexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < snapshot.months.length);
}

export async function updatePeriodPlannedAmounts(householdId: string, snapshot: FinancePeriodSnapshot, categoryId: string, monthIndexes: number[], planned: number) {
  const indexes = validPeriodIndexes(snapshot, monthIndexes);
  const category = snapshot.categories.find((item) => item.id === categoryId);
  const budgetItemIds = indexes.map((index) => category?.budgetItemIds[index]).filter((id): id is string => Boolean(id));
  if (!category || budgetItemIds.length !== indexes.length) throw new Error("Budgetposterne kunne ikke opdateres.");
  const budgetIds = indexes.map((index) => snapshot.budgetIds[index]);
  const result = await getSupabaseBrowserClient().rpc("update_budget_plans", {
    p_household_id: householdId,
    p_category_id: categoryId,
    p_budget_ids: budgetIds,
    p_amount: planned,
  });
  if (result.error) throw result.error;
}

export async function updatePeriodIncomeTargets(householdId: string, snapshot: FinancePeriodSnapshot, monthIndexes: number[], planned: number) {
  const budgetIds = validPeriodIndexes(snapshot, monthIndexes).map((index) => snapshot.budgetIds[index]).filter(Boolean);
  if (!budgetIds.length) throw new Error("Månedsbudgetterne kunne ikke opdateres.");
  const result = await getSupabaseBrowserClient().from("budgets").update({ income_target: planned }).eq("household_id", householdId).in("id", budgetIds);
  if (result.error) throw result.error;
}

export async function updateYearPlannedAmount(householdId: string, snapshot: FinanceYearSnapshot, categoryId: string, monthIndex: number, planned: number) {
  const category = snapshot.categories.find((item) => item.id === categoryId);
  const budgetItemId = category?.budgetItemIds[monthIndex];
  const budgetId = snapshot.budgetIds[monthIndex];
  if (!budgetItemId || !budgetId) throw new Error("Budgetposten kunne ikke opdateres.");
  const result = await getSupabaseBrowserClient().rpc("update_budget_plans", {
    p_household_id: householdId,
    p_category_id: categoryId,
    p_budget_ids: [budgetId],
    p_amount: planned,
  });
  if (result.error) throw result.error;
}

export async function updateYearIncomeTarget(householdId: string, snapshot: FinanceYearSnapshot, monthIndex: number, planned: number) {
  const budgetId = snapshot.budgetIds[monthIndex];
  if (!budgetId) throw new Error("Månedsbudgettet kunne ikke opdateres.");
  const result = await getSupabaseBrowserClient().from("budgets").update({ income_target: planned }).eq("id", budgetId).eq("household_id", householdId);
  if (result.error) throw result.error;
}

export async function addFinanceCategory(householdId: string, snapshot: Pick<FinanceYearSnapshot, "categories" | "budgetIds">, name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) {
  const colorPalette = ["#2158E8", "#20A874", "#8267DF", "#FF9A5C", "#D85B8C", "#4A7A91"];
  const result = await getSupabaseBrowserClient().rpc("add_budget_category", {
    p_household_id: householdId,
    p_budget_ids: snapshot.budgetIds.filter(Boolean),
    p_name: name,
    p_color: colorPalette[snapshot.categories.length % colorPalette.length],
    p_category_type: categoryType,
  });
  if (result.error) throw result.error;
}

export function financeMonthLabel(month: string) {
  const label = new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" }).format(new Date(`${month}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function transactionDateLabel(date: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}
