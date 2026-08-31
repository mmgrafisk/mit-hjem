"use client";

import {
  Bell,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Globe2,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  calendarItems,
  initialActions,
  initialShopping,
  initialTasks,
  meals,
  type ChecklistItem,
} from "./demo-data";
import {
  createDocumentUrl,
  documentKindLabel,
  documentMeta,
  loadDocuments,
  uploadDocument,
  type DocumentKind,
  type DocumentVisibility,
  type HouseholdDocument,
} from "./documents-data";
import {
  addFinanceCategory,
  addFinanceTransaction,
  budgetEditMonthIndexes,
  budgetCategorySummaryTotals,
  budgetPeriodMonthKeys,
  budgetPeriodTotalLabel,
  deleteFinanceTransaction,
  financeMonthLabel,
  financePeriodLabel,
  isValidFinanceAmount,
  loadFinance,
  loadFinancePeriod,
  shouldPromptForBudgetEdit,
  transactionDateLabel,
  updateFinanceTransaction,
  updatePeriodIncomeTargets,
  updatePeriodPlannedAmounts,
  updatePlannedAmount,
  type BudgetPeriodMode,
  type FinancePeriodSnapshot,
  type FinanceSnapshot,
  type FinanceTransaction,
  type FinanceCategoryType,
  type NewTransaction,
} from "./finance-data";
import {
  productConfig,
  supportedLanguages,
  type TemplateName,
} from "./product-config";
import { getSupabaseBrowserClient } from "./supabase-client";

type View =
  | "overview"
  | "finance"
  | "documents"
  | "tasks"
  | "calendar"
  | "shopping"
  | "meals"
  | "household"
  | "settings";

type Appearance = "light" | "dark" | "system";
type ResolvedAppearance = Exclude<Appearance, "system">;
type SyncState = "loading" | "synced" | "saving" | "error";
type FinanceSection = "overview" | "budget";

type HouseholdAppProps = {
  householdId?: string;
  householdName?: string;
  user?: { id: string; email: string; displayName: string };
  onSignOut?: () => void | Promise<void>;
};

const preferencesStorageKey = "mit-hjem:preferences:v1";

const navItems = [
  ["overview", "Overblik", LayoutDashboard],
  ["finance", "Økonomi", WalletCards],
  ["documents", "Dokumenter", FileText],
  ["tasks", "Opgaver", CheckSquare],
  ["calendar", "Kalender", CalendarDays],
  ["shopping", "Indkøb", ShoppingCart],
  ["meals", "Madplan", UtensilsCrossed],
] as const;

const currency = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const demoFinance: FinanceSnapshot = {
  budgetId: "demo-budget",
  month: "2025-05-01",
  incomeTarget: 32000,
  spendingTarget: 23000,
  spent: 14562,
  income: 32000,
  categories: [
    { id: "demo-home", budgetItemId: "demo-home-item", name: "Bolig", color: "#2158E8", categoryType: "fixed_expense", editable: true, planned: 9000, spent: 7850 },
    { id: "demo-food", budgetItemId: "demo-food-item", name: "Mad & husholdning", color: "#20A874", categoryType: "variable_expense", editable: true, planned: 7000, spent: 5240 },
    { id: "demo-transport", budgetItemId: "demo-transport-item", name: "Transport", color: "#8267DF", categoryType: "fixed_expense", editable: true, planned: 3500, spent: 900 },
    { id: "demo-insurance", budgetItemId: "demo-insurance-item", name: "Forsikring", color: "#FF9A5C", categoryType: "fixed_expense", editable: true, planned: 1500, spent: 572 },
    { id: "demo-leisure", budgetItemId: "demo-leisure-item", name: "Fritid", color: "#D85B8C", categoryType: "variable_expense", editable: true, planned: 2000, spent: 0 },
  ],
  transactions: [
    { id: "demo-1", merchant: "Norlys", amount: 499, direction: "expense", occurredOn: "2025-05-23", categoryId: "demo-home", categoryName: "Bolig" },
    { id: "demo-2", merchant: "Rema 1000", amount: 236.75, direction: "expense", occurredOn: "2025-05-19", categoryId: "demo-food", categoryName: "Mad & husholdning" },
    { id: "demo-3", merchant: "Løn", amount: 32000, direction: "income", occurredOn: "2025-05-01", categoryId: null, categoryName: "Indtægt" },
  ],
};

const demoDocuments: HouseholdDocument[] = [
  { id: "demo-doc-1", title: "Faktura · Norlys", kind: "invoice", visibility: "household", mimeType: "application/pdf", sizeBytes: 182000, storagePath: "", processingStatus: "ready", createdAt: "2025-05-23T10:00:00Z" },
  { id: "demo-doc-2", title: "Kvittering · Rema 1000", kind: "receipt", visibility: "household", mimeType: "image/jpeg", sizeBytes: 640000, storagePath: "", processingStatus: "ready", createdAt: "2025-05-19T12:00:00Z" },
  { id: "demo-doc-3", title: "Forsikring · Police", kind: "insurance", visibility: "household", mimeType: "application/pdf", sizeBytes: 1240000, storagePath: "", processingStatus: "ready", createdAt: "2025-05-11T09:00:00Z" },
  { id: "demo-doc-4", title: "Lønseddel · Anders", kind: "payslip", visibility: "private", mimeType: "application/pdf", sizeBytes: 242000, storagePath: "", processingStatus: "ready", createdAt: "2025-05-01T08:00:00Z" },
];

function createDemoPeriodFinance(mode: BudgetPeriodMode, selectedYear: number): FinancePeriodSnapshot {
  const plannedByCategory: Record<string, number> = {
    Bolig: 9000,
    "Mad & husholdning": 7000,
    Transport: 3500,
    Forsikring: 1500,
    Fritid: 2000,
  };
  const now = new Date();
  const months = budgetPeriodMonthKeys(mode, selectedYear, now).map((key) => {
    const year = Number(key.slice(0, 4));
    const monthIndex = Number(key.slice(5, 7)) - 1;
    const monthName = new Intl.DateTimeFormat("da-DK", { month: "short" }).format(new Date(year, monthIndex, 1)).replace(".", "");
    return { key, year, monthIndex, label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${String(year).slice(-2)}` };
  });
  const hasActual = (year: number, monthIndex: number) => year < now.getFullYear() || (year === now.getFullYear() && monthIndex <= now.getMonth());
  return {
    mode,
    selectedYear,
    months,
    budgetIds: months.map((month) => `demo-budget-${month.year}-${month.monthIndex}`),
    incomePlanned: months.map(() => 32000),
    incomeActual: months.map((month) => hasActual(month.year, month.monthIndex) ? 32000 : 0),
    expenseActual: months.map((month) => hasActual(month.year, month.monthIndex) ? 14562 : 0),
    categories: demoFinance.categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      categoryType: category.categoryType,
      editable: category.editable,
      budgetItemIds: months.map((month) => `${category.budgetItemId}-${month.year}-${month.monthIndex}`),
      planned: months.map(() => plannedByCategory[category.name] ?? category.planned),
      actual: months.map((month) => hasActual(month.year, month.monthIndex) ? category.spent : 0),
    })),
  };
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action ? (
        <button className="text-button" onClick={onAction} type="button">
          {action} <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

function CheckRow({
  item,
  onToggle,
}: {
  item: ChecklistItem;
  onToggle: (id: ChecklistItem["id"]) => void;
}) {
  return (
    <button
      aria-pressed={item.done}
      className={`check-row ${item.done ? "is-done" : ""}`}
      onClick={() => onToggle(item.id)}
      type="button"
    >
      <span className="checkbox">{item.done ? <Check size={13} /> : null}</span>
      <span>
        <strong>{item.title}</strong>
        {item.meta ? <small>{item.meta}</small> : null}
      </span>
    </button>
  );
}

function BudgetHero({ finance, onOpen }: { finance: FinanceSnapshot; onOpen: () => void }) {
  const remaining = finance.spendingTarget - finance.spent;
  const percent = finance.spendingTarget > 0 ? Math.min(100, Math.round((finance.spent / finance.spendingTarget) * 100)) : 0;
  return (
    <section className="budget-hero">
      <div className="budget-heading">
        <span>Økonomi</span>
        <i />
        <button type="button" onClick={onOpen}>{financeMonthLabel(finance.month)} <ChevronDown size={14} /></button>
      </div>
      <div className="budget-overview">
        <div>
          <small>Forbrug</small>
          <strong>{currency.format(finance.spent)}</strong>
          <span>af {currency.format(finance.spendingTarget)}</span>
        </div>
        <div>
          <small>Tilbage at bruge</small>
          <strong>{currency.format(remaining)}</strong>
          <span>{Math.max(0, 100 - percent)}% tilbage</span>
        </div>
        <div className="progress-ring" aria-label={`${percent} procent af budgettet er brugt`} style={{ background: `radial-gradient(circle, var(--primary) 55%, transparent 57%), conic-gradient(var(--mint) 0 ${percent}%, rgba(255,255,255,.35) ${percent}% 100%)` }}>
          <span>{percent}%</span>
        </div>
      </div>
      <div className="budget-bar"><span style={{ width: `${percent}%` }} /></div>
      <div className="account-row">
        <button type="button" onClick={onOpen}>
          <small>Indtægter</small><strong>{currency.format(finance.income)}</strong><span>Månedens registrerede</span>
        </button>
        <button type="button" onClick={onOpen}>
          <small>Budget</small><strong>{currency.format(finance.spendingTarget)}</strong><span>Fordelt på kategorier</span>
        </button>
        <button type="button" onClick={onOpen}>
          <small>Posteringer</small><strong>{finance.transactions.length}</strong><span>Denne måned</span>
        </button>
      </div>
    </section>
  );
}

function Overview({
  finance,
  actions,
  approve,
  tasks,
  shopping,
  documents,
  toggleTask,
  toggleShopping,
  navigate,
  openAdd,
  openUpload,
  openDocument,
}: {
  finance: FinanceSnapshot;
  actions: typeof initialActions;
  approve: (id: number) => void;
  tasks: ChecklistItem[];
  shopping: ChecklistItem[];
  documents: HouseholdDocument[];
  toggleTask: (id: ChecklistItem["id"]) => void;
  toggleShopping: (id: ChecklistItem["id"]) => void;
  navigate: (view: View) => void;
  openAdd: (kind: "task" | "shopping") => void;
  openUpload: () => void;
  openDocument: (document: HouseholdDocument) => void | Promise<void>;
}) {
  return (
    <div className="dashboard-grid">
      <BudgetHero finance={finance} onOpen={() => navigate("finance")} />

      <Panel className="payments-panel">
        <SectionTitle title="Seneste bevægelser" action="Se alle" onAction={() => navigate("finance")} />
        <div className="payment-list">
          {finance.transactions.slice(0, 4).map((transaction) => (
            <button key={transaction.id} type="button" onClick={() => navigate("finance")}>
              <time>{transactionDateLabel(transaction.occurredOn)}</time>
              <span><strong>{transaction.merchant}</strong><small>{transaction.categoryName}</small></span>
              <b className={transaction.direction === "income" ? "amount-income" : ""}>{transaction.direction === "income" ? "+" : "−"}{currency.format(transaction.amount)}</b>
            </button>
          ))}
          {finance.transactions.length === 0 ? <button className="finance-empty" type="button" onClick={() => navigate("finance")}><Plus size={16} /><span><strong>Tilføj første postering</strong><small>Indtægt eller udgift</small></span></button> : null}
        </div>
        <div className="panel-total"><span>Udgifter denne måned</span><strong>{currency.format(finance.spent)}</strong></div>
      </Panel>

      <Panel className="approval-panel">
        <SectionTitle title="Kræver handling" />
        <p className="panel-intro">Forslag bliver først en del af økonomien, når du godkender dem.</p>
        <div className="approval-list">
          {actions.map((action) => (
            <div className={`approval-row tone-${action.tone}`} key={action.id}>
              <span className="approval-icon"><Sparkles size={15} /></span>
              <span><strong>{action.title}</strong><small>{action.detail}</small></span>
              {typeof action.amount === "number" ? <b>{currency.format(action.amount)}</b> : null}
              <button onClick={() => approve(action.id)} type="button">Godkend</button>
            </div>
          ))}
          {actions.length === 0 ? (
            <div className="empty-state"><Check size={18} /> Alt er behandlet</div>
          ) : null}
        </div>
      </Panel>

      <Panel className="documents-panel">
        <SectionTitle title="Dokumenter" action="Se alle" onAction={() => navigate("documents")} />
        <div className="document-list">
          {documents.slice(0, 4).map((document, index) => (
            <button key={document.id} onClick={() => void openDocument(document)} type="button">
              <span className={`file-icon file-${index + 1}`}><FileText size={16} /></span>
              <span><strong>{document.title}</strong><small>{documentMeta(document)}</small></span>
              <b>{document.visibility === "private" ? "Privat" : ""}</b>
            </button>
          ))}
          {documents.length === 0 ? <div className="empty-state"><FileText size={18} /> Ingen dokumenter endnu</div> : null}
        </div>
        <button className="panel-link" onClick={openUpload} type="button"><Upload size={14} /> Upload dokument</button>
      </Panel>

      <Panel className="tasks-panel">
        <SectionTitle title="Opgaver" action="Se alle" onAction={() => navigate("tasks")} />
        <div className="check-list">
          {tasks.map((task) => <CheckRow item={task} key={task.id} onToggle={toggleTask} />)}
        </div>
        <button className="panel-link" onClick={() => openAdd("task")} type="button"><Plus size={15} /> Opret opgave</button>
      </Panel>

      <Panel className="calendar-panel">
        <SectionTitle title="Kalender" action="Se kalender" onAction={() => navigate("calendar")} />
        <div className="calendar-list">
          {calendarItems.map(([day, time, title, tone], index) => (
            <button key={`${day}-${time}`} onClick={() => navigate("calendar")} type="button">
              <span className={`timeline-dot dot-${tone}`} />
              <time>{index === 0 || calendarItems[index - 1][0] !== day ? day : ""}</time>
              <b>{time}</b><span>{title}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="shopping-panel">
        <SectionTitle title="Indkøb" action="Se liste" onAction={() => navigate("shopping")} />
        <div className="check-list compact">
          {shopping.map((item) => <CheckRow item={item} key={item.id} onToggle={toggleShopping} />)}
        </div>
        <button className="add-field" onClick={() => openAdd("shopping")} type="button"><Plus size={15} /> Tilføj vare</button>
      </Panel>

      <Panel className="meal-panel">
        <SectionTitle title="Madplan" action="Se madplan" onAction={() => navigate("meals")} />
        <div className="meal-strip">
          {meals.map(([day, meal, duration], index) => (
            <button key={day} onClick={() => navigate("meals")} type="button">
              <small>{day}</small>
              <span className={`meal-visual meal-${index + 1}`} aria-hidden="true" />
              <strong>{meal}</strong>
              <em>{duration}</em>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

type BudgetMode = "budget" | "actual" | "difference";

const budgetNumber = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function sumValues(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function FinanceOverviewView({
  finance,
  onOpenBudget,
  onAddTransaction,
  onEditTransaction,
  onPlannedChange,
}: {
  finance: FinanceSnapshot;
  onOpenBudget: () => void;
  onAddTransaction: () => void;
  onEditTransaction: (transaction: FinanceTransaction) => void;
  onPlannedChange: (categoryId: string, planned: number) => void | Promise<void>;
}) {
  return (
    <div className="module-layout finance-overview">
      <BudgetHero finance={finance} onOpen={onOpenBudget} />
      <Panel>
        <SectionTitle title="Budget pr. kategori" action="Åbn budget" onAction={onOpenBudget} />
        <div className="category-table">
          {finance.categories.map((category) => {
            const percent = category.planned > 0 ? Math.min(100, Math.round((category.spent / category.planned) * 100)) : 0;
            return (
              <div key={category.id}>
                <strong><i className="category-color" style={{ background: category.color }} />{category.name}</strong>
                <span className="category-progress"><i style={{ width: `${percent}%`, background: category.color }} /></span>
                <span>{currency.format(category.spent)}</span>
                {category.editable ? <label className="budget-amount-field">
                  <span className="sr-only">Budget for {category.name}</span>
                  <input
                    aria-label={`Budget for ${category.name}`}
                    defaultValue={category.planned}
                    key={`${category.id}-${category.planned}`}
                    min="0"
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (isValidFinanceAmount(next) && next !== category.planned) void onPlannedChange(category.id, next);
                    }}
                    step="0.01"
                    type="number"
                  />
                  kr.
                </label> : <span className="budget-amount-field">Kræver kategori</span>}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Seneste bevægelser" action="Ny postering" onAction={onAddTransaction} />
        <div className="payment-list roomy">
          {finance.transactions.slice(0, 6).map((transaction) => (
            <button key={transaction.id} type="button" onClick={() => onEditTransaction(transaction)}>
              <time>{transactionDateLabel(transaction.occurredOn)}</time>
              <span><strong>{transaction.merchant}</strong><small>{transaction.categoryName}</small></span>
              <b className={transaction.direction === "income" ? "amount-income" : ""}>{transaction.direction === "income" ? "+" : "−"}{currency.format(transaction.amount)}</b>
            </button>
          ))}
          {finance.transactions.length === 0 ? <button className="finance-empty" type="button" onClick={onAddTransaction}><Plus size={16} /><span><strong>Tilføj første postering</strong><small>Indtægt eller udgift</small></span></button> : null}
        </div>
        <div className="panel-total"><span>Udgifter denne måned</span><strong>{currency.format(finance.spent)}</strong></div>
      </Panel>
    </div>
  );
}

type PendingBudgetEdit = {
  kind: "income" | "category";
  categoryId?: string;
  monthIndex: number;
  monthLabel: string;
  value: number;
};

function BudgetView({
  financePeriod,
  periodMode,
  selectedYear,
  onPeriodModeChange,
  onYearChange,
  onAddTransaction,
  onAddCategory,
  onPlannedChange,
  onIncomeChange,
  onExport,
}: {
  financePeriod: FinancePeriodSnapshot;
  periodMode: BudgetPeriodMode;
  selectedYear: number;
  onPeriodModeChange: (mode: BudgetPeriodMode) => void;
  onYearChange: (year: number) => void;
  onAddTransaction: () => void;
  onAddCategory: (name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) => Promise<boolean>;
  onPlannedChange: (categoryId: string, monthIndexes: number[], planned: number) => void | Promise<void>;
  onIncomeChange: (monthIndexes: number[], planned: number) => void | Promise<void>;
  onExport: () => void;
}) {
  const [mode, setMode] = useState<BudgetMode>("budget");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PendingBudgetEdit | null>(null);
  const [editRevision, setEditRevision] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const monthCount = Math.max(1, financePeriod.months.length);
  const plannedExpenses = financePeriod.months.map((_, monthIndex) => financePeriod.categories.reduce((sum, category) => sum + category.planned[monthIndex], 0));
  const categoryValues = (planned: number[], actual: number[]) => mode === "budget" ? planned : mode === "actual" ? actual : planned.map((value, monthIndex) => value - actual[monthIndex]);
  const incomeValues = mode === "budget" ? financePeriod.incomePlanned : mode === "actual" ? financePeriod.incomeActual : financePeriod.incomeActual.map((value, monthIndex) => value - financePeriod.incomePlanned[monthIndex]);
  const expenseValues = mode === "budget" ? plannedExpenses : mode === "actual" ? financePeriod.expenseActual : plannedExpenses.map((value, monthIndex) => value - financePeriod.expenseActual[monthIndex]);
  const availableValues = mode === "difference"
    ? financePeriod.incomeActual.map((income, monthIndex) => (income - financePeriod.expenseActual[monthIndex]) - (financePeriod.incomePlanned[monthIndex] - plannedExpenses[monthIndex]))
    : incomeValues.map((income, monthIndex) => income - expenseValues[monthIndex]);
  const categorySummary = budgetCategorySummaryTotals(financePeriod.categories.map((category) => ({ categoryType: category.categoryType, values: categoryValues(category.planned, category.actual) })));
  const fixedTotal = categorySummary.fixed;
  const variableTotal = categorySummary.variable;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

  const cancelEdit = () => { setPendingEdit(null); setEditRevision((revision) => revision + 1); };
  const saveEdit = async (edit: PendingBudgetEdit, forward: boolean) => {
    const monthIndexes = budgetEditMonthIndexes(financePeriod.months.length, edit.monthIndex, forward);
    setSavingEdit(true);
    try {
      if (edit.kind === "income") await onIncomeChange(monthIndexes, edit.value);
      else if (edit.categoryId) await onPlannedChange(edit.categoryId, monthIndexes, edit.value);
      setPendingEdit(null);
    } finally {
      setSavingEdit(false);
      setEditRevision((revision) => revision + 1);
    }
  };
  const askHowToApply = (edit: PendingBudgetEdit) => {
    if (shouldPromptForBudgetEdit(edit.monthIndex, financePeriod.months.length)) setPendingEdit(edit);
    else void saveEdit(edit, false);
  };
  const applyEdit = async (forward: boolean) => {
    if (pendingEdit) await saveEdit(pendingEdit, forward);
  };

  const renderValue = (value: number, label: string, edit?: Omit<PendingBudgetEdit, "value">) => mode === "budget" && edit ? (
    <input
      aria-label={label}
      defaultValue={value}
      key={`${editRevision}-${financePeriod.months[edit.monthIndex]?.key}-${label}-${value}`}
      min="0"
      onBlur={(event) => {
        const next = Number(event.target.value);
        if (isValidFinanceAmount(next) && next !== value) askHowToApply({ ...edit, value: next });
      }}
      step="0.01"
      type="number"
    />
  ) : <span className={mode === "difference" ? value < 0 ? "negative" : value > 0 ? "positive" : "" : ""}>{budgetNumber.format(Math.round(value))}</span>;

  return (
    <div className="finance-page">
      <header className="finance-workspace-header">
        <div><h1>Budget</h1><p>Planlæg fra den periode, der passer jer, og sammenlign med de faktiske posteringer.</p></div>
        <div className="budget-period-controls">
          <label><CalendarDays size={18} /><span className="sr-only">Vælg periode</span><select aria-label="Vælg budgetperiode" onChange={(event) => onPeriodModeChange(event.target.value as BudgetPeriodMode)} value={periodMode}><option value="calendar">Kalenderår</option><option value="rest-of-year">Resten af året</option><option value="rolling-12">12 måneder frem</option></select></label>
          {periodMode === "calendar" ? <label className="budget-year-select"><span className="sr-only">Vælg år</span><select aria-label="Vælg budgetår" onChange={(event) => onYearChange(Number(event.target.value))} value={selectedYear}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label> : null}
        </div>
        <div className="budget-mode-switch" role="group" aria-label="Budgetvisning">
          {(["budget", "actual", "difference"] as const).map((value) => <button className={mode === value ? "active" : ""} key={value} onClick={() => setMode(value)} type="button">{{ budget: "Budget", actual: "Faktisk", difference: "Forskel" }[value]}</button>)}
        </div>
        <div className="finance-header-actions">
          <button className="secondary-button" onClick={onAddTransaction} type="button"><CircleDollarSign size={17} />Ny postering</button>
          <button className="primary-button" onClick={() => setCategoryOpen(true)} type="button"><Plus size={17} />Tilføj kategori</button>
          <button className="secondary-button" onClick={onExport} type="button"><Download size={17} />Eksportér PDF</button>
        </div>
      </header>

      <section className="budget-summary" aria-label="Budgetoversigt for valgt periode">
        <div><small>Indtægter</small><strong className="positive">{currency.format(sumValues(incomeValues))}</strong><span>{currency.format(sumValues(incomeValues) / monthCount)} pr. md.</span></div>
        <div><small>Faste poster</small><strong>{currency.format(fixedTotal)}</strong><span>{currency.format(fixedTotal / monthCount)} pr. md.</span></div>
        <div><small>Variable udgifter</small><strong>{currency.format(variableTotal)}</strong><span>{currency.format(variableTotal / monthCount)} pr. md.</span></div>
        <div><small>Til rådighed</small><strong className={sumValues(availableValues) < 0 ? "negative" : "positive"}>{currency.format(sumValues(availableValues))}</strong><span>{currency.format(sumValues(availableValues) / monthCount)} pr. md.</span></div>
      </section>

      <section className="budget-table-panel">
        <div className="budget-table-scroll">
          <table className="budget-sheet" style={{ minWidth: Math.max(860, 210 + (financePeriod.months.length + 1) * 96) }}>
            <thead><tr><th>Kategori / post</th>{financePeriod.months.map((month) => <th key={month.key}>{month.label}</th>)}<th>{budgetPeriodTotalLabel(financePeriod.mode)}</th></tr></thead>
            <tbody>
              <tr className="budget-group-row"><th>Indtægter</th>{incomeValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(Math.round(value))}</td>)}<td>{budgetNumber.format(Math.round(sumValues(incomeValues)))}</td></tr>
              <tr className="budget-entry-row"><th><span className="budget-row-marker income" />Forventet indtægt</th>{financePeriod.incomePlanned.map((planned, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{renderValue(mode === "budget" ? planned : incomeValues[monthIndex], `Indtægt ${financePeriod.months[monthIndex].label}`, { kind: "income", monthIndex, monthLabel: financePeriod.months[monthIndex].label })}</td>)}<td>{budgetNumber.format(Math.round(sumValues(incomeValues)))}</td></tr>
              <tr className="budget-group-row expense"><th>Udgifter</th>{expenseValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(Math.round(value))}</td>)}<td>{budgetNumber.format(Math.round(sumValues(expenseValues)))}</td></tr>
              {financePeriod.categories.map((category) => {
                const values = categoryValues(category.planned, category.actual);
                return <tr className="budget-entry-row" key={category.id}><th><span className="budget-row-marker" style={{ background: category.color }} />{category.name}</th>{values.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{renderValue(value, `${category.name} ${financePeriod.months[monthIndex].label}`, category.editable ? { kind: "category", categoryId: category.id, monthIndex, monthLabel: financePeriod.months[monthIndex].label } : undefined)}</td>)}<td className={mode === "difference" ? sumValues(values) < 0 ? "negative" : "positive" : ""}>{budgetNumber.format(Math.round(sumValues(values)))}</td></tr>;
              })}
              <tr className="budget-total-row"><th>Udgifter i alt</th>{expenseValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(Math.round(value))}</td>)}<td>{budgetNumber.format(Math.round(sumValues(expenseValues)))}</td></tr>
              <tr className="budget-available-row"><th>Til rådighed</th>{availableValues.map((value, monthIndex) => <td className={value < 0 ? "negative" : "positive"} key={financePeriod.months[monthIndex].key}>{budgetNumber.format(Math.round(value))}</td>)}<td className={sumValues(availableValues) < 0 ? "negative" : "positive"}>{budgetNumber.format(Math.round(sumValues(availableValues)))}</td></tr>
            </tbody>
          </table>
        </div>
        <footer><span>{financePeriodLabel(financePeriod)} · Beløb er i DKK.</span><span>Budget gemmes automatisk, når du har valgt, hvordan ændringen skal gælde.</span></footer>
      </section>

      {categoryOpen ? <BudgetCategoryModal onClose={() => setCategoryOpen(false)} onAdd={async (name, categoryType) => { const saved = await onAddCategory(name, categoryType); if (saved) setCategoryOpen(false); return saved; }} /> : null}
      {pendingEdit ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={savingEdit ? undefined : cancelEdit}>
          <section aria-labelledby="repeat-budget-title" aria-modal="true" className="quick-modal repeat-budget-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label="Luk" className="modal-close" disabled={savingEdit} onClick={cancelEdit} type="button"><X size={18} /></button>
            <div><small className="eyebrow">Gentag ændring</small><h2 id="repeat-budget-title">Hvordan skal beløbet gælde?</h2><p className="modal-intro">Skal {currency.format(pendingEdit.value)} kun gælde {pendingEdit.monthLabel}, eller også alle følgende måneder i den viste periode?</p></div>
            <div className="repeat-budget-actions">
              <button className="secondary-button" disabled={savingEdit} onClick={() => void applyEdit(false)} type="button">Kun {pendingEdit.monthLabel}</button>
              <button className="primary-button" disabled={savingEdit} onClick={() => void applyEdit(true)} type="button">Fra {pendingEdit.monthLabel} og frem</button>
            </div>
            <p className="repeat-budget-warning">Valget “og frem” erstatter beløbene i de efterfølgende synlige måneder.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CollectionView({
  view,
  tasks,
  shopping,
  documents,
  toggleTask,
  toggleShopping,
  openUpload,
  openDocument,
  member,
}: {
  view: Exclude<View, "overview" | "finance" | "settings">;
  tasks: ChecklistItem[];
  shopping: ChecklistItem[];
  documents: HouseholdDocument[];
  toggleTask: (id: ChecklistItem["id"]) => void;
  toggleShopping: (id: ChecklistItem["id"]) => void;
  openUpload: () => void;
  openDocument: (document: HouseholdDocument) => void | Promise<void>;
  member?: { name: string; email: string };
}) {
  const [documentQuery, setDocumentQuery] = useState("");
  const labels: Record<typeof view, [string, string]> = {
    documents: ["Dokumenter", "Søg, organiser og forbind husholdningens vigtige papirer."],
    tasks: ["Opgaver", "Fordel arbejdet og få de gentagne ting til at ske til tiden."],
    calendar: ["Kalender", "Et fælles årshjul for aftaler, frister og vedligehold."],
    shopping: ["Indkøb", "En levende liste, som også kan bygges direkte fra madplanen."],
    meals: ["Madplan", "Planlæg ugen, justér portioner og gør indkøbet enkelt."],
    household: ["Husstanden", "Medlemmer, roller og adgang til fælles eller private områder."],
  };
  const [title, intro] = labels[view];
  const visibleDocuments = documents.filter((document) => `${document.title} ${documentKindLabel(document.kind)}`.toLocaleLowerCase("da-DK").includes(documentQuery.trim().toLocaleLowerCase("da-DK")));

  return (
    <div className="collection-page">
      <div className="module-intro"><h1>{title}</h1><p>{intro}</p></div>
      {view === "documents" ? (
        <Panel className="wide-panel">
          <div className="toolbar"><label><Search size={16} /><input aria-label="Søg i dokumenter" onChange={(event) => setDocumentQuery(event.target.value)} placeholder="Søg i dokumenter" value={documentQuery} /></label><button onClick={openUpload} type="button"><Upload size={15} /> Upload</button></div>
          <div className="document-list large">
            {visibleDocuments.map((document, index) => <button key={document.id} onClick={() => void openDocument(document)} type="button"><span className={`file-icon file-${(index % 4) + 1}`}><FileText size={18} /></span><span><strong>{document.title}</strong><small>{documentMeta(document)}</small></span><b>{document.visibility === "private" ? "Privat" : "Husstanden"}</b><ChevronRight size={16} /></button>)}
            {visibleDocuments.length === 0 ? <div className="empty-state"><FileText size={18} /> {documentQuery ? "Ingen dokumenter matcher søgningen" : "Upload jeres første dokument"}</div> : null}
          </div>
        </Panel>
      ) : null}
      {view === "tasks" ? <Panel className="wide-panel"><div className="check-list large">{tasks.map((item) => <CheckRow item={item} key={item.id} onToggle={toggleTask} />)}{tasks.length === 0 ? <div className="empty-state"><CheckSquare size={18} />Ingen opgaver endnu</div> : null}</div></Panel> : null}
      {view === "shopping" ? <Panel className="wide-panel"><div className="check-list large">{shopping.map((item) => <CheckRow item={item} key={item.id} onToggle={toggleShopping} />)}{shopping.length === 0 ? <div className="empty-state"><ShoppingCart size={18} />Indkøbslisten er tom</div> : null}</div></Panel> : null}
      {view === "calendar" ? <Panel className="wide-panel"><div className="calendar-list large">{calendarItems.map(([day, time, item, tone]) => <button type="button" key={`${day}-${time}`}><span className={`timeline-dot dot-${tone}`} /><time>{day}</time><b>{time}</b><span>{item}</span></button>)}</div></Panel> : null}
      {view === "meals" ? <Panel className="wide-panel"><div className="meal-strip large">{meals.map(([day, meal, duration], index) => <button type="button" key={day}><small>{day}</small><span className={`meal-visual meal-${index + 1}`} /><strong>{meal}</strong><em>{duration}</em></button>)}</div></Panel> : null}
      {view === "household" ? (
        <div className="member-grid">
          {member ? <Panel><span className="member-avatar">{member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><h2>{member.name}</h2><p>{member.email} · Ejer</p></Panel> : <div className="empty-state"><Users size={18} />Ingen medlemmer at vise</div>}
        </div>
      ) : null}
    </div>
  );
}

function SettingsView({
  template,
  setTemplate,
  language,
  setLanguage,
  appearance,
  setAppearance,
}: {
  template: TemplateName;
  setTemplate: (template: TemplateName) => void;
  language: string;
  setLanguage: (language: string) => void;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}) {
  return (
    <div className="settings-page">
      <div className="module-intro"><h1>Indstillinger</h1><p>Tilpas oplevelsen uden at ændre appens funktioner.</p></div>
      <Panel>
        <div className="settings-heading"><Palette size={20} /><span><h2>Design-template</h2><p>Farver, overflader og typografi styres centralt.</p></span></div>
        <div className="template-grid">
          {(Object.entries(productConfig.templates) as [TemplateName, { name: string; description: string }][]).map(([key, item]) => (
            <button className={template === key ? "selected" : ""} key={key} onClick={() => setTemplate(key)} type="button">
              <span className={`template-preview preview-${key}`}><i /><i /><i /></span>
              <strong>{item.name}</strong><small>{item.description}</small>
              {template === key ? <span className="selected-mark"><Check size={13} /></span> : null}
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="settings-heading"><Globe2 size={20} /><span><h2>Sprog</h2><p>Platformen er gjort klar til 18 sprog.</p></span></div>
        <label className="select-field">Visningssprog<select value={language} onChange={(event) => setLanguage(event.target.value)}>{supportedLanguages.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
      </Panel>
      <Panel>
        <div className="settings-heading"><Moon size={20} /><span><h2>Udseende</h2><p>Vælg et lyst eller mørkt design, eller følg enhedens indstilling.</p></span></div>
        <div className="appearance-grid" role="group" aria-label="Vælg udseende">
          {([
            ["light", "Lys", Sun],
            ["dark", "Mørk", Moon],
            ["system", "System", Monitor],
          ] as const).map(([key, label, Icon]) => (
            <button
              aria-pressed={appearance === key}
              className={appearance === key ? "selected" : ""}
              key={key}
              onClick={() => setAppearance(key)}
              type="button"
            >
              <Icon size={19} />
              <span><strong>{label}</strong><small>{key === "system" ? "Følger din enhed" : `Brug altid ${label.toLowerCase()} visning`}</small></span>
              {appearance === key ? <span className="selected-mark"><Check size={13} /></span> : null}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: (target: "budget" | "meal") => void }) {
  return (
    <div className="export-menu">
      <button onClick={() => onExport("budget")} type="button"><CircleDollarSign size={16} /><span><strong>Budget som PDF</strong><small>Valgt periode og kategorier</small></span></button>
      <button onClick={() => onExport("meal")} type="button"><UtensilsCrossed size={16} /><span><strong>Madplan som PDF</strong><small>Ugeplan og indkøbsliste</small></span></button>
    </div>
  );
}

function QuickAdd({
  kind,
  onClose,
  onAdd,
}: {
  kind: "task" | "shopping";
  onClose: () => void;
  onAdd: (title: string) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form aria-labelledby="quick-add-title" aria-modal="true" className="quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); if (!title.trim() || busy) return; setBusy(true); await onAdd(title.trim()); setBusy(false); }} role="dialog">
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon">{kind === "task" ? <CheckSquare size={20} /> : <ShoppingCart size={20} />}</span>
        <h2 id="quick-add-title">{kind === "task" ? "Ny opgave" : "Tilføj til indkøb"}</h2>
        <label>{kind === "task" ? "Hvad skal gøres?" : "Hvad mangler I?"}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "task" ? "Fx bestil tid til service" : "Fx havregryn"} /></label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : "Tilføj"}</button>
      </form>
    </div>
  );
}

function BudgetCategoryModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [categoryType, setCategoryType] = useState<Exclude<FinanceCategoryType, "uncategorized">>("variable_expense");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form aria-labelledby="budget-category-title" aria-modal="true" className="quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        const saved = await onAdd(name.trim(), categoryType);
        if (!saved) setError("Kategorien kunne ikke gemmes. Navnet findes måske allerede.");
        setBusy(false);
      }} role="dialog">
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><Plus size={20} /></span>
        <div><h2 id="budget-category-title">Ny budgetkategori</h2><p className="modal-intro">Kategorien bliver oprettet i alle måneder i den valgte periode.</p></div>
        <label>Kategorinavn<input autoFocus maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Fx Børnepasning" required value={name} /></label>
        <label>Type<select onChange={(event) => setCategoryType(event.target.value as Exclude<FinanceCategoryType, "uncategorized">)} value={categoryType}><option value="fixed_expense">Fast udgift</option><option value="variable_expense">Variabel udgift</option><option value="saving">Opsparing</option><option value="debt">Gæld og afdrag</option></select></label>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : "Tilføj kategori"}</button>
      </form>
    </div>
  );
}

function TransactionModal({
  categories,
  initial,
  onClose,
  onDelete,
  onSave,
}: {
  categories: FinanceSnapshot["categories"];
  initial?: FinanceTransaction | null;
  onClose: () => void;
  onDelete: (transactionId: string) => Promise<boolean>;
  onSave: (transaction: NewTransaction) => Promise<boolean>;
}) {
  const selectableCategories = categories.filter((category) => category.editable);
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [direction, setDirection] = useState<"expense" | "income">(initial?.direction ?? "expense");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? selectableCategories[0]?.id ?? "");
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form aria-labelledby="transaction-modal-title" aria-modal="true" className="quick-modal transaction-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
        event.preventDefault();
        const numericAmount = Number(amount.replace(",", "."));
        if (!merchant.trim() || !isValidFinanceAmount(numericAmount, false)) {
          setError("Udfyld navn og et gyldigt beløb.");
          return;
        }
        setBusy(true);
        setError(null);
        const saved = await onSave({ merchant: merchant.trim(), amount: numericAmount, direction, occurredOn, categoryId: direction === "expense" ? categoryId || null : null });
        if (!saved) setError("Posteringen kunne ikke gemmes. Prøv igen.");
        setBusy(false);
      }} role="dialog">
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><CircleDollarSign size={20} /></span>
        <div><h2 id="transaction-modal-title">{initial ? "Redigér postering" : "Ny postering"}</h2><p className="modal-intro">{initial ? "Ret beløb, dato eller kategori, så det faktiske budget stemmer." : `Registrér en udgift eller indtægt i ${financeMonthLabel(new Date().toISOString().slice(0, 7) + "-01").toLowerCase()}.`}</p></div>
        <div className="direction-switch">
          <button className={direction === "expense" ? "active" : ""} onClick={() => setDirection("expense")} type="button">Udgift</button>
          <button className={direction === "income" ? "active" : ""} onClick={() => setDirection("income")} type="button">Indtægt</button>
        </div>
        <div className="transaction-grid">
          <label className="wide">Navn<input autoFocus maxLength={160} onChange={(event) => setMerchant(event.target.value)} placeholder="Fx Rema 1000 eller løn" required value={merchant} /></label>
          <label>Beløb<input inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required step="0.01" type="number" value={amount} /></label>
          <label>Dato<input onChange={(event) => setOccurredOn(event.target.value)} required type="date" value={occurredOn} /></label>
          {direction === "expense" ? <label className="wide">Kategori<select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}><option value="">Ikke kategoriseret</option>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        </div>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <div className="transaction-modal-actions">
          {initial ? <button className="danger-button" disabled={busy} onClick={async () => { if (!window.confirm(`Slet posteringen “${initial.merchant}”?`)) return; setBusy(true); const deleted = await onDelete(initial.id); if (!deleted) setError("Posteringen kunne ikke slettes. Prøv igen."); setBusy(false); }} type="button"><Trash2 size={16} />Slet</button> : null}
          <button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : initial ? "Gem ændringer" : "Gem postering"}</button>
        </div>
      </form>
    </div>
  );
}

function DocumentUploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (file: File, title: string, kind: DocumentKind, visibility: DocumentVisibility) => Promise<string | null>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("other");
  const [visibility, setVisibility] = useState<DocumentVisibility>("household");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kinds: DocumentKind[] = ["invoice", "receipt", "insurance", "payslip", "contract", "warranty", "other"];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="quick-modal transaction-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
        event.preventDefault();
        if (!file || !title.trim()) { setError("Vælg en fil og giv dokumentet et navn."); return; }
        setBusy(true);
        setError(null);
        const uploadError = await onUpload(file, title.trim(), kind, visibility);
        if (uploadError) setError(uploadError);
        setBusy(false);
      }}>
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><Upload size={20} /></span>
        <div><h2>Upload dokument</h2><p className="modal-intro">PDF, billeder, Word eller Excel · højst 20 MB.</p></div>
        <label className="file-drop">
          <Upload size={22} />
          <strong>{file ? file.name : "Vælg dokument"}</strong>
          <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "Klik for at vælge en fil"}</small>
          <input accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; setFile(nextFile); if (nextFile && !title) setTitle(nextFile.name.replace(/\.[^.]+$/, "")); }} required type="file" />
        </label>
        <div className="transaction-grid">
          <label className="wide">Titel<input maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Fx Elregning august" required value={title} /></label>
          <label>Type<select onChange={(event) => setKind(event.target.value as DocumentKind)} value={kind}>{kinds.map((value) => <option key={value} value={value}>{documentKindLabel(value)}</option>)}</select></label>
          <label>Adgang<select onChange={(event) => setVisibility(event.target.value as DocumentVisibility)} value={visibility}><option value="household">Hele husstanden</option><option value="private">Kun mig</option></select></label>
        </div>
        <p className="privacy-note">{visibility === "private" ? "Privat: kun du kan åbne dokumentet." : "Delt: alle medlemmer af husstanden kan åbne dokumentet."}</p>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Uploader…" : "Gem dokument"}</button>
      </form>
    </div>
  );
}

function PrintSheets({ tasks, shopping, financePeriod, householdName }: { tasks: ChecklistItem[]; shopping: ChecklistItem[]; financePeriod: FinancePeriodSnapshot; householdName: string }) {
  const expenses = financePeriod.months.map((_, monthIndex) => financePeriod.categories.reduce((sum, category) => sum + category.planned[monthIndex], 0));
  const available = financePeriod.incomePlanned.map((income, monthIndex) => income - expenses[monthIndex]);
  return (
    <div className="print-sheets" aria-hidden="true">
      <article className="print-sheet budget-print">
        <header><span>Mit hjem</span><h1>Budget · {financePeriodLabel(financePeriod)}</h1><p>{householdName}</p></header>
        <div className="print-summary"><div><small>Indtægter</small><strong>{currency.format(sumValues(financePeriod.incomePlanned))}</strong></div><div><small>Udgifter</small><strong>{currency.format(sumValues(expenses))}</strong></div><div><small>Til rådighed</small><strong>{currency.format(sumValues(available))}</strong></div></div>
        <h2>Budget pr. måned</h2>
        <table className="print-budget-table"><thead><tr><th>Kategori</th>{financePeriod.months.map((month) => <th key={month.key}>{month.label}</th>)}<th>{budgetPeriodTotalLabel(financePeriod.mode)}</th></tr></thead><tbody>
          <tr><td>Indtægter</td>{financePeriod.incomePlanned.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.incomePlanned))}</td></tr>
          {financePeriod.categories.map((category) => <tr key={category.id}><td>{category.name}</td>{category.planned.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(category.planned))}</td></tr>)}
          <tr><td>Udgifter i alt</td>{expenses.map((value, monthIndex) => <td key={monthIndex}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(expenses))}</td></tr>
          <tr><td>Til rådighed</td>{available.map((value, monthIndex) => <td key={monthIndex}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(available))}</td></tr>
        </tbody></table>
      </article>
      <article className="print-sheet meal-print">
        <header><span>Mit hjem</span><h1>Madplan · Uge 21</h1><p>7 dage · 4 personer</p></header>
        <div className="print-meals">{meals.map(([day, meal]) => <div key={day}><strong>{day}</strong><span>{meal}</span></div>)}</div>
        <h2>Indkøbsliste</h2>
        <div className="print-shopping">{shopping.map((item) => <span key={item.id}>□ {item.title}</span>)}</div>
        <h2>Huskeliste</h2>
        <div className="print-shopping">{tasks.slice(0, 3).map((item) => <span key={item.id}>□ {item.title}</span>)}</div>
      </article>
    </div>
  );
}

export function HouseholdApp({ householdId, householdName = "Mit hjem", user, onSignOut }: HouseholdAppProps = {}) {
  const [view, setView] = useState<View>("overview");
  const [financeSection, setFinanceSection] = useState<FinanceSection>("overview");
  const [template, setTemplate] = useState<TemplateName>(productConfig.defaultTemplate);
  const [language, setLanguage] = useState("da");
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [resolvedAppearance, setResolvedAppearance] = useState<ResolvedAppearance>("light");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [actions, setActions] = useState(householdId ? [] : initialActions);
  const [tasks, setTasks] = useState<ChecklistItem[]>(householdId ? [] : initialTasks);
  const [shopping, setShopping] = useState<ChecklistItem[]>(householdId ? [] : initialShopping);
  const [householdDocuments, setHouseholdDocuments] = useState<HouseholdDocument[]>(householdId ? [] : demoDocuments);
  const [finance, setFinance] = useState<FinanceSnapshot>(() => householdId ? {
    ...demoFinance,
    budgetId: "",
    month: new Date().toISOString().slice(0, 7) + "-01",
    incomeTarget: 0,
    spendingTarget: 0,
    spent: 0,
    income: 0,
    categories: [],
    transactions: [],
  } : demoFinance);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [budgetPeriodMode, setBudgetPeriodMode] = useState<BudgetPeriodMode>("rolling-12");
  const [financePeriod, setFinancePeriod] = useState<FinancePeriodSnapshot>(() => createDemoPeriodFinance("rolling-12", new Date().getFullYear()));
  const [syncState, setSyncState] = useState<SyncState>(householdId ? "loading" : "synced");
  const [exportOpen, setExportOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [quickAdd, setQuickAdd] = useState<"task" | "shopping" | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<"budget" | "meal" | null>(null);
  const userId = user?.id;
  const visibleNavItems = useMemo(() => householdId ? navItems.filter(([key]) => key !== "calendar" && key !== "meals") : [...navItems], [householdId]);

  useEffect(() => {
    const restorePreferences = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(preferencesStorageKey);
        if (stored) {
          const preferences = JSON.parse(stored) as { appearance?: Appearance; budgetPeriodMode?: BudgetPeriodMode; language?: string; template?: TemplateName };
          if (["light", "dark", "system"].includes(preferences.appearance ?? "")) setAppearance(preferences.appearance as Appearance);
          if (["calendar", "rest-of-year", "rolling-12"].includes(preferences.budgetPeriodMode ?? "")) setBudgetPeriodMode(preferences.budgetPeriodMode as BudgetPeriodMode);
          if (supportedLanguages.some(([code]) => code === preferences.language)) setLanguage(preferences.language as string);
          if (Object.hasOwn(productConfig.templates, preferences.template ?? "")) setTemplate(preferences.template as TemplateName);
        }
      } catch {
        window.localStorage.removeItem(preferencesStorageKey);
      } finally {
        setPreferencesReady(true);
      }
    }, 0);

    return () => window.clearTimeout(restorePreferences);
  }, []);

  useEffect(() => {
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const resolveAppearance = () => setResolvedAppearance(appearance === "system" ? (systemPreference.matches ? "dark" : "light") : appearance);
    resolveAppearance();
    systemPreference.addEventListener("change", resolveAppearance);
    return () => systemPreference.removeEventListener("change", resolveAppearance);
  }, [appearance]);

  useEffect(() => {
    if (!preferencesReady) return;
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify({ appearance, budgetPeriodMode, language, template }));
  }, [appearance, budgetPeriodMode, language, preferencesReady, template]);

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();
    Promise.all([
      supabase.from("tasks").select("id, title, due_at, completed_at").eq("household_id", householdId).order("created_at"),
      supabase.from("shopping_items").select("id, title, quantity, completed_at").eq("household_id", householdId).order("created_at"),
      userId ? loadFinance(householdId, userId) : Promise.resolve(demoFinance),
      userId ? loadFinancePeriod(householdId, userId, budgetPeriodMode, budgetYear) : Promise.resolve(createDemoPeriodFinance(budgetPeriodMode, budgetYear)),
      loadDocuments(householdId),
    ]).then(([taskResult, shoppingResult, financeResult, financePeriodResult, documentsResult]) => {
      if (!active) return;
      if (taskResult.error || shoppingResult.error) {
        setSyncState("error");
        return;
      }
      setTasks((taskResult.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.due_at ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(new Date(item.due_at)) : "Ikke tildelt",
        done: Boolean(item.completed_at),
      })));
      setShopping((shoppingResult.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.quantity ?? undefined,
        done: Boolean(item.completed_at),
      })));
      setFinance(financeResult);
      setFinancePeriod(financePeriodResult);
      setHouseholdDocuments(documentsResult);
      setSyncState("synced");
    }).catch(() => { if (active) setSyncState("error"); });
    return () => { active = false; };
  }, [budgetPeriodMode, budgetYear, householdId, userId]);

  const title = useMemo(() => visibleNavItems.find(([key]) => key === view)?.[1] ?? (view === "household" ? "Husstanden" : "Indstillinger"), [view, visibleNavItems]);
  const displayName = user?.displayName || "Anders";
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MH";
  const setLocalToggle = (setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>) => (id: ChecklistItem["id"]) => setter((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const toggleTask = async (id: ChecklistItem["id"]) => {
    const current = tasks.find((item) => item.id === id);
    setTasks((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
    if (!householdId || typeof id !== "string" || !current) return;
    setSyncState("saving");
    const { error } = await getSupabaseBrowserClient().from("tasks").update({ completed_at: current.done ? null : new Date().toISOString() }).eq("id", id).eq("household_id", householdId);
    if (error) {
      setTasks((items) => items.map((item) => item.id === id ? current : item));
      setSyncState("error");
    } else setSyncState("synced");
  };
  const toggleShopping = async (id: ChecklistItem["id"]) => {
    const current = shopping.find((item) => item.id === id);
    setShopping((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
    if (!householdId || typeof id !== "string" || !current) return;
    setSyncState("saving");
    const { error } = await getSupabaseBrowserClient().from("shopping_items").update({ completed_at: current.done ? null : new Date().toISOString() }).eq("id", id).eq("household_id", householdId);
    if (error) {
      setShopping((items) => items.map((item) => item.id === id ? current : item));
      setSyncState("error");
    } else setSyncState("synced");
  };
  const navigate = (next: View) => {
    setView(next);
    if (next === "finance") setFinanceSection("overview");
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addItem = async (itemTitle: string) => {
    if (!householdId || !user) {
      if (quickAdd === "task") setTasks((items) => [...items, { id: Date.now(), title: itemTitle, meta: "Ny · Ikke tildelt", done: false }]);
      if (quickAdd === "shopping") setShopping((items) => [...items, { id: Date.now(), title: itemTitle, done: false }]);
      setQuickAdd(null);
      return;
    }
    setSyncState("saving");
    if (quickAdd === "task") {
      const { data, error } = await getSupabaseBrowserClient().from("tasks").insert({ household_id: householdId, created_by: user.id, title: itemTitle }).select("id, title, completed_at").single();
      if (error) { setSyncState("error"); return; }
      setTasks((items) => [...items, { id: data.id, title: data.title, meta: "Ikke tildelt", done: Boolean(data.completed_at) }]);
    }
    if (quickAdd === "shopping") {
      const { data, error } = await getSupabaseBrowserClient().from("shopping_items").insert({ household_id: householdId, created_by: user.id, title: itemTitle }).select("id, title, quantity, completed_at").single();
      if (error) { setSyncState("error"); return; }
      setShopping((items) => [...items, { id: data.id, title: data.title, meta: data.quantity ?? undefined, done: Boolean(data.completed_at) }]);
    }
    setSyncState("synced");
    setQuickAdd(null);
  };
  const openNewTransaction = () => { setEditingTransaction(null); setTransactionOpen(true); };
  const openTransaction = (transaction: FinanceTransaction) => { setEditingTransaction(transaction); setTransactionOpen(true); };
  const refreshFinance = async () => {
    if (!householdId || !user) return;
    const [nextFinance, nextFinancePeriod] = await Promise.all([
      loadFinance(householdId, user.id),
      loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear),
    ]);
    setFinance(nextFinance);
    setFinancePeriod(nextFinancePeriod);
  };
  const saveTransaction = async (transaction: NewTransaction) => {
    if (!householdId || !user) return false;
    setSyncState("saving");
    try {
      if (editingTransaction) await updateFinanceTransaction(householdId, editingTransaction.id, transaction);
      else await addFinanceTransaction(householdId, user.id, transaction);
      await refreshFinance();
      setTransactionOpen(false);
      setEditingTransaction(null);
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const removeTransaction = async (transactionId: string) => {
    if (!householdId || !user) return false;
    setSyncState("saving");
    try {
      await deleteFinanceTransaction(householdId, transactionId);
      await refreshFinance();
      setTransactionOpen(false);
      setEditingTransaction(null);
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const savePlannedAmount = async (categoryId: string, planned: number) => {
    if (!isValidFinanceAmount(planned)) return;
    if (!householdId || !user) {
      setFinance((snapshot) => ({
        ...snapshot,
        spendingTarget: snapshot.categories.reduce((sum, category) => sum + (category.id === categoryId ? planned : category.planned), 0),
        categories: snapshot.categories.map((category) => category.id === categoryId ? { ...category, planned } : category),
      }));
      return;
    }
    setSyncState("saving");
    try {
      await updatePlannedAmount(householdId, finance, categoryId, planned);
      const [nextFinance, nextFinancePeriod] = await Promise.all([loadFinance(householdId, user.id), loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear)]);
      setFinance(nextFinance);
      setFinancePeriod(nextFinancePeriod);
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  };
  const savePeriodPlannedAmounts = async (categoryId: string, monthIndexes: number[], planned: number) => {
    if (!isValidFinanceAmount(planned)) return;
    if (!householdId || !user) {
      const changedIndexes = new Set(monthIndexes);
      setFinancePeriod((snapshot) => ({ ...snapshot, categories: snapshot.categories.map((category) => category.id === categoryId ? { ...category, planned: category.planned.map((value, index) => changedIndexes.has(index) ? planned : value) } : category) }));
      return;
    }
    setSyncState("saving");
    try {
      await updatePeriodPlannedAmounts(householdId, financePeriod, categoryId, monthIndexes, planned);
      const [nextFinance, nextFinancePeriod] = await Promise.all([loadFinance(householdId, user.id), loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear)]);
      setFinance(nextFinance);
      setFinancePeriod(nextFinancePeriod);
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  };
  const savePeriodIncome = async (monthIndexes: number[], planned: number) => {
    if (!isValidFinanceAmount(planned)) return;
    if (!householdId || !user) {
      const changedIndexes = new Set(monthIndexes);
      setFinancePeriod((snapshot) => ({ ...snapshot, incomePlanned: snapshot.incomePlanned.map((value, index) => changedIndexes.has(index) ? planned : value) }));
      return;
    }
    setSyncState("saving");
    try {
      await updatePeriodIncomeTargets(householdId, financePeriod, monthIndexes, planned);
      const [nextFinance, nextFinancePeriod] = await Promise.all([loadFinance(householdId, user.id), loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear)]);
      setFinance(nextFinance);
      setFinancePeriod(nextFinancePeriod);
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  };
  const saveFinanceCategory = async (name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) => {
    if (!householdId || !user) {
      setFinancePeriod((snapshot) => ({ ...snapshot, categories: [...snapshot.categories, { id: `demo-${Date.now()}`, name, color: "#4A7A91", categoryType, editable: true, budgetItemIds: Array(snapshot.months.length).fill(null), planned: Array(snapshot.months.length).fill(0), actual: Array(snapshot.months.length).fill(0) }] }));
      return true;
    }
    setSyncState("saving");
    try {
      await addFinanceCategory(householdId, financePeriod, name, categoryType);
      const [nextFinance, nextFinancePeriod] = await Promise.all([loadFinance(householdId, user.id), loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear)]);
      setFinance(nextFinance);
      setFinancePeriod(nextFinancePeriod);
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const saveDocument = async (file: File, documentTitle: string, kind: DocumentKind, visibility: DocumentVisibility) => {
    if (!householdId || !user) return "Du skal være logget ind for at uploade.";
    setSyncState("saving");
    try {
      await uploadDocument({ householdId, userId: user.id, file, title: documentTitle, kind, visibility });
      setHouseholdDocuments(await loadDocuments(householdId));
      setDocumentUploadOpen(false);
      setSyncState("synced");
      return null;
    } catch (reason) {
      setSyncState("error");
      return reason instanceof Error ? reason.message : "Dokumentet kunne ikke uploades.";
    }
  };
  const openDocument = async (document: HouseholdDocument) => {
    if (!document.storagePath) return;
    setSyncState("saving");
    try {
      const url = await createDocumentUrl(document.storagePath);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  };
  const exportPdf = (target: "budget" | "meal") => {
    setExportOpen(false);
    setPrintTarget(target);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintTarget(null), 250);
    }, 80);
  };

  return (
    <div className="app-root" data-color-mode={resolvedAppearance} data-template={template} data-print-target={printTarget ?? "none"}>
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand"><span><House size={19} /></span><strong>{productConfig.name}</strong><ChevronDown size={14} /></div>
        <nav aria-label="Primær navigation">
          {visibleNavItems.map(([key, label, Icon]) => <button aria-current={view === key ? "page" : undefined} className={view === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button"><Icon size={18} /><span>{label}</span>{key === "documents" && householdDocuments.length ? <b>{householdDocuments.length}</b> : null}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button aria-current={view === "household" ? "page" : undefined} className={view === "household" ? "active" : ""} onClick={() => navigate("household")} type="button"><Users size={18} /><span>{householdName}</span><small>{user ? "Husstand" : "4 medlemmer"}</small></button>
          <button className={view === "settings" ? "active" : ""} onClick={() => navigate("settings")} type="button"><Settings size={18} /><span>Indstillinger</span></button>
          {onSignOut ? <button onClick={() => void onSignOut()} type="button"><LogOut size={18} /><span>Log ud</span></button> : null}
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <button aria-label="Åbn menu" className="menu-button" onClick={() => setMobileMenu((open) => !open)} type="button"><Menu size={21} /></button>
          <div><small>{view === "overview" ? `Godmorgen, ${firstName} 👋` : householdName}</small><strong>{view === "overview" ? "Her er overblikket over jeres hjem." : title}</strong></div>
          <div className="top-actions">
            <div className="export-wrap">
              <button className="export-button" onClick={() => setExportOpen((open) => !open)} type="button"><Download size={16} /><span>Eksportér</span><ChevronDown size={13} /></button>
              {exportOpen ? <ExportMenu onExport={exportPdf} /> : null}
            </div>
            <button
              aria-label={resolvedAppearance === "dark" ? "Skift til lyst tema" : "Skift til mørkt tema"}
              className="mode-button"
              onClick={() => setAppearance(resolvedAppearance === "dark" ? "light" : "dark")}
              title={resolvedAppearance === "dark" ? "Lyst tema" : "Mørkt tema"}
              type="button"
            >
              {resolvedAppearance === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {actions.length ? <button aria-label={`${actions.length} notifikationer`} className="notification-button" type="button"><Bell size={19} /><b>{actions.length}</b></button> : null}
            {householdId ? <span className={`sync-status ${syncState}`}>{syncState === "loading" ? "Henter…" : syncState === "saving" ? "Gemmer…" : syncState === "error" ? "Synkronisering fejlede" : "Synkroniseret"}</span> : null}
            <button className="profile-button" type="button"><span>{initials}</span><strong>{firstName}</strong><ChevronDown size={14} /></button>
          </div>
        </header>

        <main>
          {view === "overview" ? <Overview finance={finance} actions={actions} approve={(id) => setActions((items) => items.filter((item) => item.id !== id))} tasks={tasks} shopping={shopping} documents={householdDocuments} toggleTask={householdId ? toggleTask : setLocalToggle(setTasks)} toggleShopping={householdId ? toggleShopping : setLocalToggle(setShopping)} navigate={navigate} openAdd={setQuickAdd} openUpload={() => setDocumentUploadOpen(true)} openDocument={openDocument} /> : null}
          {view === "finance" ? (
            <div className="finance-area">
              <div className="finance-tabs" role="tablist" aria-label="Økonomi">
                <button aria-selected={financeSection === "overview"} className={financeSection === "overview" ? "active" : ""} onClick={() => setFinanceSection("overview")} role="tab" type="button">Overblik</button>
                <button aria-selected={financeSection === "budget"} className={financeSection === "budget" ? "active" : ""} onClick={() => setFinanceSection("budget")} role="tab" type="button">Budget</button>
              </div>
              {financeSection === "overview" ? <FinanceOverviewView finance={finance} onAddTransaction={openNewTransaction} onEditTransaction={openTransaction} onOpenBudget={() => setFinanceSection("budget")} onPlannedChange={savePlannedAmount} /> : null}
              {financeSection === "budget" ? <BudgetView financePeriod={financePeriod} onAddCategory={saveFinanceCategory} onAddTransaction={openNewTransaction} onExport={() => exportPdf("budget")} onIncomeChange={savePeriodIncome} onPeriodModeChange={setBudgetPeriodMode} onPlannedChange={savePeriodPlannedAmounts} onYearChange={setBudgetYear} periodMode={budgetPeriodMode} selectedYear={budgetYear} /> : null}
            </div>
          ) : null}
          {!["overview", "finance", "settings"].includes(view) ? <CollectionView view={view as Exclude<View, "overview" | "finance" | "settings">} tasks={tasks} shopping={shopping} documents={householdDocuments} toggleTask={householdId ? toggleTask : setLocalToggle(setTasks)} toggleShopping={householdId ? toggleShopping : setLocalToggle(setShopping)} openUpload={() => setDocumentUploadOpen(true)} openDocument={openDocument} member={user ? { name: user.displayName, email: user.email } : undefined} /> : null}
          {view === "settings" ? <SettingsView template={template} setTemplate={setTemplate} language={language} setLanguage={setLanguage} appearance={appearance} setAppearance={setAppearance} /> : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobil navigation">
        {visibleNavItems.slice(0, 4).map(([key, label, Icon]) => <button aria-current={view === key ? "page" : undefined} className={view === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button"><Icon size={19} /><span>{label}</span></button>)}
        <button className={mobileMenu ? "active" : ""} onClick={() => setMobileMenu((open) => !open)} type="button"><Menu size={19} /><span>Mere</span></button>
      </nav>

      {quickAdd ? <QuickAdd kind={quickAdd} onClose={() => setQuickAdd(null)} onAdd={addItem} /> : null}
      {transactionOpen ? <TransactionModal categories={finance.categories} initial={editingTransaction} onClose={() => { setTransactionOpen(false); setEditingTransaction(null); }} onDelete={removeTransaction} onSave={saveTransaction} /> : null}
      {documentUploadOpen ? <DocumentUploadModal onClose={() => setDocumentUploadOpen(false)} onUpload={saveDocument} /> : null}
      <PrintSheets tasks={tasks} shopping={shopping} financePeriod={financePeriod} householdName={householdName} />
    </div>
  );
}
