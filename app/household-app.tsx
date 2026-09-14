"use client";

import {
  Bell,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  ExternalLink,
  Globe2,
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
  Repeat2,
  Link2,
  KeyRound,
  Upload,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react";
import Image from "next/image";
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
  clearCompletedShoppingItems,
  deleteShoppingItem,
  deleteTask,
  loadShoppingItems,
  loadTasks,
  saveShoppingItem,
  saveTask,
  setShoppingItemCompleted,
  setTaskCompleted,
  taskMeta,
  type ShoppingInput,
  type ShoppingListItem,
  type TaskInput,
  type TaskItem,
} from "./checklist-data";
import { ShoppingView, TasksView, type TaskMemberOption } from "./checklist-views";
import {
  createDocumentFolder,
  createDocumentUrl,
  documentKindLabel,
  documentMeta,
  loadDocumentFolders,
  loadDocuments,
  setDocumentArchived,
  updateDocumentArchive,
  uploadDocument,
  type DocumentArchiveInput,
  type DocumentFolder,
  type HouseholdDocument,
} from "./documents-data";
import { DocumentLibraryView, type DocumentRelationGroups } from "./document-library-view";
import {
  addFinanceCategory,
  addFinanceTransaction,
  buildTransactionPeriodRows,
  budgetPeriodMonthKeys,
  budgetPeriodTotalLabel,
  deleteFinanceTransaction,
  financeMonthLabel,
  financePeriodLabel,
  isValidFinanceAmount,
  loadFinance,
  loadFinancePeriod,
  loadFinanceTransactions,
  recurringTransactionDates,
  transactionDateLabel,
  transactionPeriodTotals,
  transactionRecurrenceLabel,
  updateFinanceTransaction,
  updateFinanceTransactionOccurrence,
  type BudgetPeriodMode,
  type FinancePeriodSnapshot,
  type FinanceSnapshot,
  type FinanceTransaction,
  type FinancePeriodTransactionRow,
  type FinanceCategoryType,
  type NewTransaction,
  type TransactionRecurrence,
  type TransactionOccurrenceEditScope,
} from "./finance-data";
import {
  addSubscription,
  deleteSubscription,
  loadSubscriptions,
  subscriptionIntervalLabel,
  updateSubscription,
  type NewSubscription,
  type Subscription,
  type SubscriptionStatus,
} from "./subscriptions-data";
import {
  productConfig,
  supportedLanguages,
  type TemplateName,
} from "./product-config";
import { getSupabaseBrowserClient } from "./supabase-client";
import { CalendarView } from "./calendar-view";
import { HouseholdView } from "./household-view";
import { loadHouseholdAccess } from "./household-data";
import { MealPlanView } from "./meal-plan-view";
import { aggregateIngredients, formatShoppingQuantity, loadMealPlan, mondayFor, type MealPlanItem } from "./meal-plan-data";
import { loadNotificationPreferences, loadNotifications, markNotificationRead, saveNotificationPreferences, type HouseholdNotification, type NotificationPreferences } from "./notifications-data";
import { useModalAccessibility } from "./modal-accessibility";

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
type FinanceSection = "overview" | "budget" | "transactions" | "subscriptions" | "category";

type HouseholdAppProps = {
  householdId?: string;
  householdName?: string;
  initialPath?: string;
  user?: { id: string; email: string; displayName: string };
  onSignOut?: () => void | Promise<void>;
};

function preferencesStorageKey(userId?: string) {
  return `mit-hjem:preferences:v2:${userId || "preview"}`;
}

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
    { id: "demo-1", merchant: "Norlys", amount: 499, direction: "expense", occurredOn: "2025-05-23", categoryId: "demo-home", categoryName: "Bolig", status: "approved", recurrence: "monthly", recurrenceGroupId: "demo-series-1", recurrenceEndOn: null, linkedDocumentIds: ["demo-doc-1"] },
    { id: "demo-2", merchant: "Rema 1000", amount: 236.75, direction: "expense", occurredOn: "2025-05-19", categoryId: "demo-food", categoryName: "Mad & husholdning", status: "approved", recurrence: "once", recurrenceGroupId: null, recurrenceEndOn: null, linkedDocumentIds: ["demo-doc-2"] },
    { id: "demo-3", merchant: "Løn", amount: 32000, direction: "income", occurredOn: "2025-05-01", categoryId: null, categoryName: "Indtægt", status: "approved", recurrence: "monthly", recurrenceGroupId: "demo-series-2", recurrenceEndOn: null, linkedDocumentIds: [] },
  ],
};

const demoDocuments: HouseholdDocument[] = [
  { id: "demo-doc-1", title: "Faktura · Norlys", kind: "invoice", visibility: "household", mimeType: "application/pdf", sizeBytes: 182000, storagePath: "", processingStatus: "ready", folderId: "demo-folder-home", folderName: "Bolig", folderColor: "#2864f0", documentDate: "2025-05-23", expiresOn: null, notes: "Elregning for maj.", archivedAt: null, createdBy: "demo-user", createdAt: "2025-05-23T10:00:00Z", tags: [{ id: "demo-tag-1", name: "Energi", color: "#7c6ee6" }], linkedTransactionIds: ["demo-1"], linkedSubscriptionIds: ["demo-sub-1"], linkedTaskIds: [] },
  { id: "demo-doc-2", title: "Kvittering · Rema 1000", kind: "receipt", visibility: "household", mimeType: "image/jpeg", sizeBytes: 640000, storagePath: "", processingStatus: "ready", folderId: "demo-folder-receipts", folderName: "Kvitteringer", folderColor: "#20a874", documentDate: "2025-05-19", expiresOn: null, notes: null, archivedAt: null, createdBy: "demo-user", createdAt: "2025-05-19T12:00:00Z", tags: [{ id: "demo-tag-2", name: "Dagligvarer", color: "#7c6ee6" }], linkedTransactionIds: ["demo-2"], linkedSubscriptionIds: [], linkedTaskIds: [] },
  { id: "demo-doc-3", title: "Husforsikring · Police", kind: "insurance", visibility: "household", mimeType: "application/pdf", sizeBytes: 1240000, storagePath: "", processingStatus: "ready", folderId: "demo-folder-home", folderName: "Bolig", folderColor: "#2864f0", documentDate: "2025-05-11", expiresOn: "2026-10-01", notes: "Årlig fornyelse.", archivedAt: null, createdBy: "demo-user", createdAt: "2025-05-11T09:00:00Z", tags: [{ id: "demo-tag-3", name: "Forsikring", color: "#7c6ee6" }], linkedTransactionIds: [], linkedSubscriptionIds: [], linkedTaskIds: [] },
  { id: "demo-doc-4", title: "Lønseddel · Anders", kind: "payslip", visibility: "private", mimeType: "application/pdf", sizeBytes: 242000, storagePath: "", processingStatus: "ready", folderId: "demo-folder-finance", folderName: "Privatøkonomi", folderColor: "#8267df", documentDate: "2025-05-01", expiresOn: null, notes: null, archivedAt: null, createdBy: "demo-user", createdAt: "2025-05-01T08:00:00Z", tags: [], linkedTransactionIds: [], linkedSubscriptionIds: [], linkedTaskIds: [] },
];

const demoDocumentFolders: DocumentFolder[] = [
  { id: "demo-folder-home", name: "Bolig", color: "#2864f0" },
  { id: "demo-folder-receipts", name: "Kvitteringer", color: "#20a874" },
  { id: "demo-folder-finance", name: "Privatøkonomi", color: "#8267df" },
];

const demoSubscriptions: Subscription[] = [
  { id: "demo-sub-1", name: "Norlys", websiteUrl: "https://norlys.dk", accountIdentifier: "anders@example.dk", passwordManagerUrl: null, amount: 499, billingIntervalMonths: 1, trialEndsOn: null, cancellationDeadlineOn: null, nextPaymentOn: "2025-06-23", status: "active", linkedTransactionId: "demo-1", linkedDocumentIds: ["demo-doc-1"] },
];

const demoTasks: TaskItem[] = initialTasks.map((item) => ({
  id: item.id,
  title: item.title,
  description: null,
  assignedTo: null,
  assignedName: item.meta?.split(" · ").at(-1) ?? null,
  dueAt: null,
  recurrence: null,
  createdBy: null,
  done: item.done,
}));

const demoShopping: ShoppingListItem[] = initialShopping.map((item) => ({ id: item.id, title: item.title, quantity: item.meta ?? null, createdBy: null, done: item.done }));

function createDemoPeriodFinance(mode: BudgetPeriodMode, selectedYear: number): FinancePeriodSnapshot {
  const now = new Date();
  const months = budgetPeriodMonthKeys(mode, selectedYear, now).map((key) => {
    const year = Number(key.slice(0, 4));
    const monthIndex = Number(key.slice(5, 7)) - 1;
    const monthName = new Intl.DateTimeFormat("da-DK", { month: "short" }).format(new Date(year, monthIndex, 1)).replace(".", "");
    return { key, year, monthIndex, label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${String(year).slice(-2)}` };
  });
  const transactionRows = buildTransactionPeriodRows(demoFinance.transactions, [], months);
  const totals = transactionPeriodTotals(transactionRows, months.length);
  return {
    mode,
    selectedYear,
    months,
    budgetIds: months.map((month) => `demo-budget-${month.year}-${month.monthIndex}`),
    incomePlanned: totals.incomeValues,
    incomeActual: totals.incomeValues,
    expenseActual: totals.expenseValues,
    categories: demoFinance.categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      categoryType: category.categoryType,
      editable: category.editable,
      budgetItemIds: months.map((month) => `${category.budgetItemId}-${month.year}-${month.monthIndex}`),
      planned: transactionPeriodTotals(transactionRows.filter((row) => row.transaction.categoryId === category.id), months.length).expenseValues,
      actual: transactionPeriodTotals(transactionRows.filter((row) => row.transaction.categoryId === category.id), months.length).expenseValues,
    })),
    transactionRows,
    ...totals,
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
  item: TaskItem | ShoppingListItem | ChecklistItem;
  onToggle: (id: string | number) => void;
}) {
  const meta = "dueAt" in item ? taskMeta(item) : "quantity" in item ? item.quantity : item.meta;
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
        {meta ? <small>{meta}</small> : null}
      </span>
    </button>
  );
}

function BudgetHero({ finance, onOpen }: { finance: FinanceSnapshot; onOpen: () => void }) {
  const remaining = finance.incomeTarget - finance.spendingTarget;
  const percent = finance.incomeTarget > 0 ? Math.min(100, Math.round((finance.spendingTarget / finance.incomeTarget) * 100)) : 0;
  return (
    <section className="budget-hero">
      <div className="budget-heading">
        <span>Økonomi</span>
        <i />
        <button type="button" onClick={onOpen}>{financeMonthLabel(finance.month)} <ChevronDown size={14} /></button>
      </div>
      <div className="budget-overview">
        <div>
          <small>Registrerede udgifter</small>
          <strong>{currency.format(finance.spendingTarget)}</strong>
          <span>{currency.format(finance.spent)} bogført</span>
        </div>
        <div>
          <small>Til rådighed</small>
          <strong>{currency.format(remaining)}</strong>
          <span>Indtægter minus udgifter</span>
        </div>
        <div className="progress-ring" aria-label={`${percent} procent af indtægterne er fordelt`} style={{ background: `radial-gradient(circle, var(--primary) 55%, transparent 57%), conic-gradient(var(--mint) 0 ${percent}%, rgba(255,255,255,.35) ${percent}% 100%)` }}>
          <span>{percent}%</span>
        </div>
      </div>
      <div className="budget-bar"><span style={{ width: `${percent}%` }} /></div>
      <div className="account-row">
        <button type="button" onClick={onOpen}>
          <small>Indtægter</small><strong>{currency.format(finance.incomeTarget)}</strong><span>{currency.format(finance.income)} bogført</span>
        </button>
        <button type="button" onClick={onOpen}>
          <small>Udgifter</small><strong>{currency.format(finance.spendingTarget)}</strong><span>Alle posteringer denne måned</span>
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
  openIncome,
  sampleMode,
  mealItems,
  dataReady,
}: {
  finance: FinanceSnapshot;
  actions: typeof initialActions;
  approve: (id: number) => void;
  tasks: TaskItem[];
  shopping: ShoppingListItem[];
  documents: HouseholdDocument[];
  toggleTask: (id: string | number) => void;
  toggleShopping: (id: string | number) => void;
  navigate: (view: View) => void;
  openAdd: (kind: "task" | "shopping") => void;
  openUpload: () => void;
  openDocument: (document: HouseholdDocument) => void | Promise<void>;
  openIncome: () => void;
  sampleMode: boolean;
  mealItems: MealPlanItem[];
  dataReady: boolean;
}) {
  const firstRun = dataReady && finance.transactions.length === 0 && tasks.length === 0 && shopping.length === 0 && documents.length === 0;
  return (
    <div className="dashboard-grid">
      {firstRun ? (
        <section className="activation-panel">
          <div><Sparkles size={20} /><span><strong>Gør Hjemblik klar på få minutter</strong><p>Start med de vigtigste oplysninger. Resten kan I tilføje løbende.</p></span></div>
          <div className="activation-actions">
            <button onClick={openIncome} type="button"><CircleDollarSign size={16} /><span><strong>Tilføj indtægt</strong><small>Få budgettet i gang</small></span></button>
            <button onClick={() => openAdd("task")} type="button"><CheckSquare size={16} /><span><strong>Opret opgave</strong><small>Fordel det første ansvar</small></span></button>
            <button onClick={openUpload} type="button"><Upload size={16} /><span><strong>Upload dokument</strong><small>Saml jeres vigtige papirer</small></span></button>
            <button onClick={() => navigate("meals")} type="button"><UtensilsCrossed size={16} /><span><strong>Planlæg et måltid</strong><small>Byg indkøbslisten automatisk</small></span></button>
          </div>
        </section>
      ) : null}
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
          {sampleMode ? calendarItems.map(([day, time, title, tone], index) => (
            <button key={`${day}-${time}`} onClick={() => navigate("calendar")} type="button">
              <span className={`timeline-dot dot-${tone}`} />
              <time>{index === 0 || calendarItems[index - 1][0] !== day ? day : ""}</time>
              <b>{time}</b><span>{title}</span>
            </button>
          )) : <div className="empty-state panel-empty-action"><CalendarDays size={17} /><span>Se aftaler og påmindelser i kalenderen.</span><button onClick={() => navigate("calendar")} type="button">Åbn kalender</button></div>}
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
          {sampleMode ? meals.map(([day, meal, duration], index) => (
            <button key={day} onClick={() => navigate("meals")} type="button">
              <small>{day}</small>
              <span className={`meal-visual meal-${index + 1}`} aria-hidden="true" />
              <strong>{meal}</strong>
              <em>{duration}</em>
            </button>
          )) : mealItems.length ? mealItems.slice(0, 7).map((item, index) => <button key={item.id} onClick={() => navigate("meals")} type="button"><small>{["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][item.dayOfWeek - 1]}</small><span className={`meal-visual meal-${(index % 7) + 1}`} aria-hidden="true" /><strong>{item.title}</strong><em>{item.durationMinutes ? `${item.durationMinutes} min` : ""}</em></button>) : <div className="empty-state panel-empty-action"><UtensilsCrossed size={17} /><span>Planlæg ugens første måltid.</span><button onClick={() => navigate("meals")} type="button">Åbn madplan</button></div>}
        </div>
      </Panel>
    </div>
  );
}

const budgetNumber = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

function parseBudgetNumber(value: string) {
  const normalized = value.trim().replaceAll(" ", "").replaceAll(".", "").replace(",", ".");
  return Number(normalized);
}

function sumValues(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function FinanceOverviewView({
  finance,
  onOpenBudget,
  onAddTransaction,
  onAddTransactionForCategory,
  onAddCategory,
  onOpenCategory,
  onOpenTransactions,
  onEditTransaction,
}: {
  finance: FinanceSnapshot;
  onOpenBudget: () => void;
  onAddTransaction: () => void;
  onAddTransactionForCategory: (categoryId: string) => void;
  onAddCategory: () => void;
  onOpenCategory: (categoryId: string) => void;
  onOpenTransactions: () => void;
  onEditTransaction: (transaction: FinanceTransaction) => void;
}) {
  return (
    <div className="module-layout finance-overview">
      <BudgetHero finance={finance} onOpen={onOpenBudget} />
      <Panel>
        <SectionTitle title="Posteringer pr. kategori denne måned" action="Ny kategori" onAction={onAddCategory} />
        <div className="category-table">
          {finance.categories.map((category) => {
            const percent = category.planned > 0 ? Math.min(100, Math.round((category.spent / category.planned) * 100)) : 0;
            return (
              <div key={category.id}>
                <button className="category-name-button" onClick={() => onOpenCategory(category.id)} type="button"><strong><i className="category-color" style={{ background: category.color }} />{category.name}</strong><ChevronRight size={15} /></button>
                <span className="category-progress"><i style={{ width: `${percent}%`, background: category.color }} /></span>
                <span>{currency.format(category.spent)}</span>
                <span className="budget-amount-field">{currency.format(category.planned)} registreret</span>
                {category.editable ? <button aria-label={`Ny postering i ${category.name}`} className="category-posting-button" onClick={() => onAddTransactionForCategory(category.id)} type="button"><Plus size={14} />Postering</button> : null}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Seneste bevægelser" action="Se alle" onAction={onOpenTransactions} />
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
        <button className="panel-primary-action" onClick={onAddTransaction} type="button"><Plus size={15} />Ny postering</button>
      </Panel>
    </div>
  );
}

function TransactionList({ transactions, onEdit, onDelete }: { transactions: FinanceTransaction[]; onEdit: (transaction: FinanceTransaction) => void; onDelete?: (transaction: FinanceTransaction) => Promise<boolean> }) {
  return (
    <div className="payment-list transaction-history">
      {transactions.map((transaction) => (
        <div className="transaction-history-row" key={transaction.id}>
          <button className="transaction-open-button" onClick={() => onEdit(transaction)} type="button">
            <time>{transactionDateLabel(transaction.occurredOn)}</time>
            <span><strong>{transaction.merchant}</strong><small>{transaction.categoryName} · {transactionRecurrenceLabel(transaction.recurrence)}{transaction.recurrenceEndOn ? ` · til ${transactionDateLabel(transaction.recurrenceEndOn)}` : transaction.recurrence !== "once" ? " · løbende" : ""}{transaction.status === "scheduled" ? " · Planlagt" : ""}{transaction.linkedDocumentIds.length ? ` · ${transaction.linkedDocumentIds.length} dokument${transaction.linkedDocumentIds.length === 1 ? "" : "er"}` : ""}</small></span>
            <b className={transaction.direction === "income" ? "amount-income" : ""}>{transaction.direction === "income" ? "+" : "−"}{currency.format(transaction.amount)}</b>
          </button>
          {onDelete ? <button aria-label={`Slet ${transaction.merchant} fra oversigten`} className="transaction-delete-button" onClick={async () => { if (window.confirm(`Slet posteringen “${transaction.merchant}”${transaction.recurrence !== "once" ? " og hele betalingsserien" : ""}?`)) await onDelete(transaction); }} title="Slet postering" type="button"><Trash2 size={16} /></button> : null}
        </div>
      ))}
      {transactions.length === 0 ? <div className="empty-state"><CircleDollarSign size={18} />Ingen posteringer matcher visningen</div> : null}
    </div>
  );
}

function TransactionsView({ transactions, categories, onAdd, onEdit, onDelete }: { transactions: FinanceTransaction[]; categories: FinanceSnapshot["categories"]; onAdd: () => void; onEdit: (transaction: FinanceTransaction) => void; onDelete: (transaction: FinanceTransaction) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState<"all" | "approved" | "scheduled">("all");
  const visible = transactions.filter((transaction) => {
    const matchesQuery = `${transaction.merchant} ${transaction.categoryName}`.toLocaleLowerCase("da-DK").includes(query.trim().toLocaleLowerCase("da-DK"));
    return matchesQuery && (categoryId === "all" || transaction.categoryId === categoryId) && (status === "all" || transaction.status === status);
  });
  return (
    <div className="finance-page transactions-page">
      <header className="compact-page-header"><div><p>Se, filtrér og ret registrerede og kommende betalinger.</p></div><button className="primary-button" onClick={onAdd} type="button"><Plus size={17} />Ny postering</button></header>
      <Panel className="wide-panel">
        <div className="transaction-filters">
          <label><Search size={16} /><input aria-label="Søg i posteringer" onChange={(event) => setQuery(event.target.value)} placeholder="Søg efter navn eller kategori" value={query} /></label>
          <select aria-label="Filtrér efter kategori" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}><option value="all">Alle kategorier</option>{categories.filter((category) => category.editable).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select aria-label="Filtrér efter status" onChange={(event) => setStatus(event.target.value as typeof status)} value={status}><option value="all">Alle statusser</option><option value="approved">Bogført</option><option value="scheduled">Planlagt</option></select>
        </div>
        <TransactionList onDelete={onDelete} onEdit={onEdit} transactions={visible} />
      </Panel>
    </div>
  );
}

function CategoryDetailView({ category, transactions, onBack, onAddTransaction, onEditTransaction }: { category: FinanceSnapshot["categories"][number]; transactions: FinanceTransaction[]; onBack: () => void; onAddTransaction: () => void; onEditTransaction: (transaction: FinanceTransaction) => void }) {
  const categoryTransactions = transactions.filter((transaction) => transaction.categoryId === category.id);
  const actual = category.spent;
  return (
    <div className="finance-page category-detail-page">
      <header className="compact-page-header"><div><button className="back-button" onClick={onBack} type="button"><ArrowLeft size={16} />Økonomi</button><p>Registrerede, bogførte og kommende posteringer for kategorien.</p></div><button className="primary-button" onClick={onAddTransaction} type="button"><Plus size={17} />Ny postering</button></header>
      <section className="category-detail-summary">
        <Panel><small>Registreret</small><strong>{currency.format(category.planned)}</strong><span>Denne måned</span></Panel>
        <Panel><small>Bogført</small><strong>{currency.format(actual)}</strong><span>Denne måned</span></Panel>
        <Panel><small>Kommende</small><strong>{currency.format(Math.max(0, category.planned - actual))}</strong><span>Planlagte betalinger</span></Panel>
      </section>
      <Panel className="wide-panel"><SectionTitle title="Posteringer i kategorien" action="Ny postering" onAction={onAddTransaction} /><TransactionList onEdit={onEditTransaction} transactions={categoryTransactions} /></Panel>
    </div>
  );
}

type PendingOccurrenceEdit = {
  row: FinancePeriodTransactionRow;
  occurredOn: string;
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
  onEditTransaction,
  onOpenCategory,
  onOccurrenceChange,
  onExport,
}: {
  financePeriod: FinancePeriodSnapshot;
  periodMode: BudgetPeriodMode;
  selectedYear: number;
  onPeriodModeChange: (mode: BudgetPeriodMode) => void;
  onYearChange: (year: number) => void;
  onAddTransaction: (direction: "expense" | "income", categoryId?: string | null) => void;
  onAddCategory: (name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) => Promise<boolean>;
  onEditTransaction: (transaction: FinanceTransaction) => void;
  onOpenCategory: (categoryId: string) => void;
  onOccurrenceChange: (transaction: FinanceTransaction, occurredOn: string, amount: number, scope: TransactionOccurrenceEditScope) => Promise<boolean>;
  onExport: () => void;
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PendingOccurrenceEdit | null>(null);
  const [editRevision, setEditRevision] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const monthCount = Math.max(1, financePeriod.months.length);
  const incomeRows = financePeriod.transactionRows.filter((row) => row.transaction.direction === "income");
  const expenseGroups = financePeriod.categories.map((category) => ({
    category,
    rows: financePeriod.transactionRows.filter((row) => row.transaction.direction === "expense" && (category.id === "uncategorized" ? !row.transaction.categoryId : row.transaction.categoryId === category.id)),
  }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  const valuesForRows = (rows: FinancePeriodTransactionRow[]) => financePeriod.months.map((_, monthIndex) => rows.reduce((sum, row) => sum + row.values[monthIndex], 0));

  const cancelEdit = () => { setPendingEdit(null); setEditError(null); setEditRevision((revision) => revision + 1); };
  const repeatDialogRef = useModalAccessibility(cancelEdit, savingEdit, Boolean(pendingEdit));
  const saveEdit = async (edit: PendingOccurrenceEdit, scope: TransactionOccurrenceEditScope) => {
    setSavingEdit(true);
    setEditError(null);
    try {
      const saved = await onOccurrenceChange(edit.row.transaction, edit.occurredOn, edit.value, scope);
      if (saved) setPendingEdit(null);
      else setEditError("Ændringen kunne ikke gemmes. Prøv igen.");
    } finally {
      setSavingEdit(false);
      setEditRevision((revision) => revision + 1);
    }
  };
  const askHowToApply = (edit: PendingOccurrenceEdit) => {
    if (edit.row.transaction.recurrence !== "once" || edit.value === 0) setPendingEdit(edit);
    else void saveEdit(edit, "only");
  };
  const applyEdit = async (scope: TransactionOccurrenceEditScope) => {
    if (pendingEdit) await saveEdit(pendingEdit, scope);
  };

  const renderValue = (row: FinancePeriodTransactionRow, monthIndex: number) => {
    const occurredOn = row.occurrenceDates[monthIndex];
    const occurrenceTransaction = row.occurrenceTransactions[monthIndex];
    const value = row.values[monthIndex];
    if (!occurredOn || !occurrenceTransaction) return <span className="budget-empty-cell">—</span>;
    return (
    <input
      aria-label={`${row.transaction.merchant} ${financePeriod.months[monthIndex].label}`}
      defaultValue={budgetNumber.format(value)}
      inputMode="decimal"
      key={`${editRevision}-${row.transaction.id}-${occurredOn}-${value}`}
      onBlur={(event) => {
        const next = parseBudgetNumber(event.target.value);
        event.currentTarget.value = budgetNumber.format(isValidFinanceAmount(next) ? next : value);
        if (isValidFinanceAmount(next) && next !== value) askHowToApply({ row: { ...row, transaction: occurrenceTransaction }, occurredOn, monthLabel: financePeriod.months[monthIndex].label, value: next });
        else if (!isValidFinanceAmount(next)) setEditRevision((revision) => revision + 1);
      }}
      onFocus={(event) => { event.currentTarget.value = String(value).replace(".", ","); event.currentTarget.select(); }}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = budgetNumber.format(value); event.currentTarget.blur(); } }}
      type="text"
    />
    );
  };

  const transactionRow = (row: FinancePeriodTransactionRow) => (
    <tr className="budget-entry-row budget-transaction-row" key={row.transaction.id}>
      <th><button className="budget-transaction-link" onClick={() => onEditTransaction(row.transaction)} type="button"><strong>{row.transaction.merchant}</strong></button></th>
      {financePeriod.months.map((month, monthIndex) => <td key={month.key}>{renderValue(row, monthIndex)}</td>)}
      <td>{budgetNumber.format(sumValues(row.values))}</td>
    </tr>
  );

  return (
    <div className="finance-page">
      <header className="finance-workspace-header">
        <div className="finance-workspace-copy"><p>Alle tal kommer fra dine posteringer. Ret et beløb direkte i den måned, hvor det forfalder.</p></div>
        <div className="finance-workspace-tools">
          <div className="budget-period-controls">
            <label><CalendarDays size={17} /><span className="sr-only">Vælg periode</span><select aria-label="Vælg budgetperiode" onChange={(event) => onPeriodModeChange(event.target.value as BudgetPeriodMode)} value={periodMode}><option value="calendar">Kalenderår</option><option value="rest-of-year">Resten af året</option><option value="rolling-12">12 måneder frem</option></select></label>
            {periodMode === "calendar" ? <label className="budget-year-select"><span className="sr-only">Vælg år</span><select aria-label="Vælg budgetår" onChange={(event) => onYearChange(Number(event.target.value))} value={selectedYear}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label> : null}
          </div>
          <div className="finance-header-actions">
            <button className="secondary-button" onClick={() => onAddTransaction("expense")} type="button"><CircleDollarSign size={16} />Ny postering</button>
            <button className="primary-button" onClick={() => setCategoryOpen(true)} type="button"><Plus size={16} />Kategori</button>
            <button aria-label="Eksportér budget som PDF" className="secondary-button compact-icon-button" onClick={onExport} title="Eksportér PDF" type="button"><Download size={17} /><span>PDF</span></button>
          </div>
        </div>
      </header>

      <section className="budget-summary budget-summary-three" aria-label="Budgetoversigt for valgt periode">
        <div><small>Indtægter</small><strong className="positive">{currency.format(sumValues(financePeriod.incomeValues))}</strong><span>{currency.format(sumValues(financePeriod.incomeValues) / monthCount)} pr. md.</span></div>
        <div><small>Udgifter</small><strong>{currency.format(sumValues(financePeriod.expenseValues))}</strong><span>{currency.format(sumValues(financePeriod.expenseValues) / monthCount)} pr. md.</span></div>
        <div><small>Til rådighed</small><strong className={sumValues(financePeriod.availableValues) < 0 ? "negative" : "positive"}>{currency.format(sumValues(financePeriod.availableValues))}</strong><span>{currency.format(sumValues(financePeriod.availableValues) / monthCount)} pr. md.</span></div>
      </section>

      <section className="budget-table-panel">
        <div className="budget-table-scroll">
          <table className="budget-sheet">
            <colgroup>
              <col className="budget-name-column" />
              {financePeriod.months.map((month) => <col className="budget-month-column" key={month.key} />)}
              <col className="budget-total-column" />
            </colgroup>
            <thead><tr><th>Kategori / post</th>{financePeriod.months.map((month) => <th key={month.key}>{month.label}</th>)}<th>{budgetPeriodTotalLabel(financePeriod.mode)}</th></tr></thead>
            <tbody>
              <tr className="budget-group-row"><th><span className="budget-group-label">Indtægter<button aria-label="Tilføj indtægt" className="budget-inline-add" onClick={() => onAddTransaction("income")} title="Tilføj indtægt" type="button"><Plus size={14} /></button></span></th>{financePeriod.incomeValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.incomeValues))}</td></tr>
              {incomeRows.map(transactionRow)}
              <tr className="budget-group-row expense"><th>Udgifter</th>{financePeriod.expenseValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.expenseValues))}</td></tr>
              {expenseGroups.flatMap(({ category, rows }) => {
                const values = valuesForRows(rows);
                return [
                  <tr className="budget-category-group-row" key={`${category.id}-group`}><th><span className="budget-category-cell">{category.editable ? <button className="budget-category-link" onClick={() => onOpenCategory(category.id)} type="button"><span className="budget-row-marker" style={{ background: category.color }} />{category.name}<ChevronRight size={14} /></button> : <span><span className="budget-row-marker" style={{ background: category.color }} />{category.name}</span>}{category.editable ? <button aria-label={`Tilføj postering i ${category.name}`} className="budget-inline-add" onClick={() => onAddTransaction("expense", category.id)} title={`Tilføj postering i ${category.name}`} type="button"><Plus size={14} /></button> : null}</span></th>{values.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(values))}</td></tr>,
                  ...rows.map(transactionRow),
                ].filter(Boolean);
              })}
              <tr className="budget-total-row"><th>Udgifter i alt</th>{financePeriod.expenseValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.expenseValues))}</td></tr>
              <tr className="budget-available-row"><th>Til rådighed</th>{financePeriod.availableValues.map((value, monthIndex) => <td className={value < 0 ? "negative" : "positive"} key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td className={sumValues(financePeriod.availableValues) < 0 ? "negative" : "positive"}>{budgetNumber.format(sumValues(financePeriod.availableValues))}</td></tr>
            </tbody>
          </table>
        </div>
        <footer><span>{financePeriodLabel(financePeriod)} · Beløb er i DKK.</span><span>Gentagne posteringer vises automatisk i de måneder, hvor de forfalder.</span></footer>
      </section>

      {categoryOpen ? <BudgetCategoryModal onClose={() => setCategoryOpen(false)} onAdd={async (name, categoryType) => { const saved = await onAddCategory(name, categoryType); if (saved) setCategoryOpen(false); return saved; }} /> : null}
      {pendingEdit ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={savingEdit ? undefined : cancelEdit}>
          <section aria-labelledby="repeat-budget-title" aria-modal="true" className="quick-modal repeat-budget-modal" onMouseDown={(event) => event.stopPropagation()} ref={repeatDialogRef} role="dialog">
            <button aria-label="Luk" className="modal-close" disabled={savingEdit} onClick={cancelEdit} type="button"><X size={18} /></button>
            <div><small className="eyebrow">{pendingEdit.value === 0 ? "Fjern betaling" : "Gentag ændring"}</small><h2 id="repeat-budget-title">{pendingEdit.value === 0 ? "Hvordan skal betalingen fjernes?" : "Hvordan skal beløbet gælde?"}</h2><p className="modal-intro">{pendingEdit.row.transaction.recurrence === "once" ? `Fjern “${pendingEdit.row.transaction.merchant}” fra ${pendingEdit.monthLabel}?` : pendingEdit.value === 0 ? `Skal betalingen springes over i ${pendingEdit.monthLabel}, eller skal serien stoppe fra denne måned?` : `Skal ${currency.format(pendingEdit.value)} kun gælde ${pendingEdit.monthLabel}, eller også alle følgende betalinger?`}</p></div>
            <div className="repeat-budget-actions">
              <button className="secondary-button" disabled={savingEdit} onClick={cancelEdit} type="button">Annuller</button>
              {pendingEdit.row.transaction.recurrence !== "once" ? <button className="secondary-button" disabled={savingEdit} onClick={() => void applyEdit("only")} type="button">Kun {pendingEdit.monthLabel}</button> : null}
              <button className={pendingEdit.value === 0 ? "danger-button" : "primary-button"} disabled={savingEdit} onClick={() => void applyEdit(pendingEdit.row.transaction.recurrence === "once" ? "only" : "forward")} type="button">{pendingEdit.row.transaction.recurrence === "once" ? "Fjern postering" : `Fra ${pendingEdit.monthLabel} og frem`}</button>
            </div>
            {editError ? <p className="modal-error" role="alert">{editError}</p> : null}
            <p className="repeat-budget-warning">“Fra denne måned og frem” ændrer serien fra den valgte betaling og påvirker ikke tidligere måneder.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}


function SettingsView({
  template,
  setTemplate,
  language,
  appearance,
  setAppearance,
  notificationPreferences,
  onNotificationPreferencesChange,
  accountEmail,
  onRequestPasswordReset,
  accountMessage,
}: {
  template: TemplateName;
  setTemplate: (template: TemplateName) => void;
  language: string;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  notificationPreferences: NotificationPreferences;
  onNotificationPreferencesChange: (preferences: NotificationPreferences) => void | Promise<void>;
  accountEmail?: string;
  onRequestPasswordReset: () => void | Promise<void>;
  accountMessage: string | null;
}) {
  return (
    <div className="settings-page">
      <div className="module-intro"><p>Tilpas oplevelsen uden at ændre appens funktioner.</p></div>
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
        <div className="settings-heading"><Globe2 size={20} /><span><h2>Sprog</h2><p>Dansk er aktivt. De øvrige sprog frigives, når alle tekster er kvalitetssikret.</p></span></div>
        <label className="select-field">Visningssprog<select disabled value={language}><option value={language}>{supportedLanguages.find(([code]) => code === language)?.[1] ?? "Dansk"}</option></select></label>
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
      <Panel>
        <div className="settings-heading"><Bell size={20} /><span><h2>Notifikationer</h2><p>Vælg hvordan Hjemblik må minde dig om aftaler og frister.</p></span></div>
        <div className="settings-switches">
          <label><span><strong>I appen</strong><small>Vis påmindelser i notifikationscenteret.</small></span><input checked={notificationPreferences.inAppEnabled} onChange={(event) => void onNotificationPreferencesChange({ ...notificationPreferences, inAppEnabled: event.target.checked })} type="checkbox" /></label>
          <label className="is-disabled"><span><strong>E-mail</strong><small>Bliver tilgængelig, når mailafsendelse aktiveres.</small></span><input checked={false} disabled type="checkbox" /></label>
        </div>
      </Panel>
      <Panel>
        <div className="settings-heading"><KeyRound size={20} /><span><h2>Konto og sikkerhed</h2><p>Skift adgangskoden via et sikkert engangslink.</p></span></div>
        <div className="account-settings"><span><small>Logget ind som</small><strong>{accountEmail || "Lokal forhåndsvisning"}</strong></span>{accountEmail ? <button className="secondary-button" onClick={() => void onRequestPasswordReset()} type="button">Send link til ny adgangskode</button> : null}</div>
        {accountMessage ? <p className="settings-message" role="status">{accountMessage}</p> : null}
      </Panel>
    </div>
  );
}

function ExportMenu({ onExport, target }: { onExport: (target: "budget" | "meal") => void; target: "budget" | "meal" }) {
  return (
    <div className="export-menu">
      {target === "budget" ? <button onClick={() => onExport("budget")} type="button"><CircleDollarSign size={16} /><span><strong>Budget som PDF</strong><small>Valgt periode og kategorier</small></span></button> : null}
      {target === "meal" ? <button onClick={() => onExport("meal")} type="button"><UtensilsCrossed size={16} /><span><strong>Madplan som PDF</strong><small>Ugeplan og indkøbsliste</small></span></button> : null}
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
  const dialogRef = useModalAccessibility(onClose, busy);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <form aria-labelledby="quick-add-title" aria-modal="true" className="quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); if (!title.trim() || busy) return; setBusy(true); await onAdd(title.trim()); setBusy(false); }} ref={dialogRef as React.RefObject<HTMLFormElement | null>} role="dialog">
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
  const dialogRef = useModalAccessibility(onClose, busy);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <form aria-labelledby="budget-category-title" aria-modal="true" className="quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        const saved = await onAdd(name.trim(), categoryType);
        if (!saved) setError("Kategorien kunne ikke gemmes. Navnet findes måske allerede.");
        setBusy(false);
      }} ref={dialogRef as React.RefObject<HTMLFormElement | null>} role="dialog">
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
  documents,
  initial,
  preferredCategoryId,
  preferredDirection,
  onClose,
  onAddCategory,
  onDelete,
  onOpenDocument,
  onSave,
}: {
  categories: FinanceSnapshot["categories"];
  documents: HouseholdDocument[];
  initial?: FinanceTransaction | null;
  preferredCategoryId?: string | null;
  preferredDirection?: "expense" | "income";
  onClose: () => void;
  onAddCategory: (name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) => Promise<string | null>;
  onDelete: (transactionId: string) => Promise<boolean>;
  onOpenDocument: (document: HouseholdDocument) => void | Promise<void>;
  onSave: (transaction: NewTransaction) => Promise<boolean>;
}) {
  const selectableCategories = categories.filter((category) => category.editable);
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [direction, setDirection] = useState<"expense" | "income">(initial?.direction ?? preferredDirection ?? "expense");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? preferredCategoryId ?? selectableCategories[0]?.id ?? "");
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<TransactionRecurrence>(initial?.recurrence ?? "once");
  const [recurrenceEndOn, setRecurrenceEndOn] = useState(initial?.recurrenceEndOn ?? "");
  const [transactionStatus, setTransactionStatus] = useState<"approved" | "scheduled">(initial?.status ?? "approved");
  const [categoryCreatorOpen, setCategoryCreatorOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<Exclude<FinanceCategoryType, "uncategorized">>("variable_expense");
  const [addingCategory, setAddingCategory] = useState(false);
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<string[]>(initial?.linkedDocumentIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalAccessibility(onClose, busy);
  const previewThrough = (() => {
    if (recurrenceEndOn) return recurrenceEndOn;
    const date = new Date(`${occurredOn}T12:00:00`);
    if (Number.isNaN(date.getTime())) return occurredOn;
    date.setMonth(date.getMonth() + 23);
    return date.toISOString().slice(0, 10);
  })();
  const occurrenceDates = recurrence === "once" ? [] : recurringTransactionDates(occurredOn, recurrence, { endDate: recurrenceEndOn || null, throughDate: previewThrough, limit: 24 });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <form aria-labelledby="transaction-modal-title" aria-modal="true" className="quick-modal transaction-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
        event.preventDefault();
        const numericAmount = Number(amount.replace(",", "."));
        if (!merchant.trim() || !isValidFinanceAmount(numericAmount, false)) {
          setError("Udfyld navn og et gyldigt beløb.");
          return;
        }
        if (recurrence !== "once" && recurrenceEndOn && recurrenceEndOn < occurredOn) {
          setError("Sidste betaling skal ligge på eller efter første betaling.");
          return;
        }
        setBusy(true);
        setError(null);
        const saved = await onSave({ merchant: merchant.trim(), amount: numericAmount, direction, occurredOn, categoryId: direction === "expense" ? categoryId || null : null, recurrence, recurrenceEndOn: recurrence === "once" ? null : recurrenceEndOn || null, recurrenceGroupId: initial?.recurrenceGroupId, status: initial ? transactionStatus : undefined, linkedDocumentIds });
        if (!saved) setError("Posteringen kunne ikke gemmes. Prøv igen.");
        setBusy(false);
      }} ref={dialogRef as React.RefObject<HTMLFormElement | null>} role="dialog">
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
          {direction === "expense" ? <div className="wide transaction-category-field">
            <span className="field-label-with-action"><label htmlFor="transaction-category">Kategori</label><button onClick={() => setCategoryCreatorOpen((open) => !open)} type="button"><Plus size={14} />Opret kategori i posteringen</button></span>
            <select id="transaction-category" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}><option value="">Ikke kategoriseret</option>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            {categoryCreatorOpen ? <div className="inline-category-creator">
              <label>Navn<input maxLength={80} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Fx Børnepasning" value={newCategoryName} /></label>
              <label>Type<select onChange={(event) => setNewCategoryType(event.target.value as typeof newCategoryType)} value={newCategoryType}><option value="fixed_expense">Fast udgift</option><option value="variable_expense">Variabel udgift</option><option value="saving">Opsparing</option><option value="debt">Gæld og afdrag</option></select></label>
              <button className="secondary-button" disabled={addingCategory || !newCategoryName.trim()} onClick={async () => {
                setAddingCategory(true);
                setError(null);
                const createdCategoryId = await onAddCategory(newCategoryName.trim(), newCategoryType);
                if (createdCategoryId) {
                  setCategoryId(createdCategoryId);
                  setNewCategoryName("");
                  setCategoryCreatorOpen(false);
                } else setError("Kategorien kunne ikke oprettes. Navnet findes måske allerede.");
                setAddingCategory(false);
              }} type="button">{addingCategory ? "Opretter…" : "Opret og vælg"}</button>
            </div> : null}
          </div> : null}
          <label><span className="field-label-with-icon"><Repeat2 size={15} />Gentagelse</span><select onChange={(event) => { const value = event.target.value as TransactionRecurrence; setRecurrence(value); if (value === "once") setRecurrenceEndOn(""); }} value={recurrence}><option value="once">Kun denne måned</option><option value="monthly">Hver måned</option><option value="every_2_months">Hver anden måned</option><option value="quarterly">Hvert kvartal</option><option value="half_yearly">Hvert halve år</option></select><small>{recurrence === "once" ? "Kun den valgte dato." : recurrenceEndOn ? "Stopper på den valgte dato." : "Fortsætter uden slutdato."}</small></label>
          {recurrence !== "once" ? <label>Sidste betaling <span className="optional-label">(valgfri)</span><input min={occurredOn} onChange={(event) => setRecurrenceEndOn(event.target.value)} type="date" value={recurrenceEndOn} /><small>Lad feltet stå tomt for løbende betaling.</small></label> : null}
          {initial ? <label>Status<select onChange={(event) => setTransactionStatus(event.target.value as typeof transactionStatus)} value={transactionStatus}><option value="approved">Bogført</option><option value="scheduled">Planlagt</option></select></label> : null}
        </div>
        {recurrence !== "once" ? <details className="transaction-disclosure"><summary><span>Betalingsplan</span><small>{occurrenceDates.length} viste betalinger</small></summary><section className="transaction-schedule" aria-label="Betalingsplan"><ol>{occurrenceDates.map((date) => <li key={date}><time dateTime={date}>{transactionDateLabel(date)}</time><span>{date <= new Date().toISOString().slice(0, 10) ? "Bogført" : "Planlagt"}</span><strong>{direction === "income" ? "+" : "−"}{amount ? currency.format(Number(amount.replace(",", ".")) || 0) : currency.format(0)}</strong></li>)}</ol>{!recurrenceEndOn ? <p>Serien fortsætter, indtil du tilføjer en sidste betalingsdato.</p> : null}</section></details> : null}
        <details className="transaction-disclosure"><summary><span><Link2 size={15} />Tilknyttede dokumenter</span><small>{linkedDocumentIds.length} valgt</small></summary><section className="document-link-section" aria-label="Tilknyttede dokumenter">{documents.length ? <div className="document-link-list">{documents.map((document) => <div className="document-link-row" key={document.id}><label><input checked={linkedDocumentIds.includes(document.id)} onChange={(event) => setLinkedDocumentIds((ids) => event.target.checked ? [...new Set([...ids, document.id])] : ids.filter((id) => id !== document.id))} type="checkbox" /><span><strong>{document.title}</strong><small>{documentKindLabel(document.kind)}</small></span></label>{initial && linkedDocumentIds.includes(document.id) ? <button aria-label={`Åbn ${document.title}`} onClick={() => void onOpenDocument(document)} type="button"><ExternalLink size={14} /></button> : null}</div>)}</div> : <p>Upload først et dokument under Dokumenter, og tilknyt det derefter her.</p>}</section></details>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <div className="transaction-modal-actions">
          {initial ? <button className="danger-button" disabled={busy} onClick={async () => { if (!window.confirm(`Slet posteringen “${initial.merchant}”?`)) return; setBusy(true); const deleted = await onDelete(initial.id); if (!deleted) setError("Posteringen kunne ikke slettes. Prøv igen."); setBusy(false); }} type="button"><Trash2 size={16} />Slet</button> : null}
          <button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : initial ? "Gem ændringer" : "Gem postering"}</button>
        </div>
      </form>
    </div>
  );
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(`${date}T12:00:00`).getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000);
}

function subscriptionStatusLabel(status: SubscriptionStatus) {
  return status === "trial" ? "Prøveperiode" : status === "cancelled" ? "Opsagt" : "Aktiv";
}

function SubscriptionsView({ subscriptions, transactions, documents, onAdd, onEdit, onDelete, onOpenDocument }: { subscriptions: Subscription[]; transactions: FinanceTransaction[]; documents: HouseholdDocument[]; onAdd: () => void; onEdit: (subscription: Subscription) => void; onDelete: (subscription: Subscription) => Promise<boolean>; onOpenDocument: (document: HouseholdDocument) => void | Promise<void> }) {
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status !== "cancelled");
  const monthlyCost = activeSubscriptions.reduce((sum, subscription) => sum + (subscription.amount ?? 0) / subscription.billingIntervalMonths, 0);
  const deadlines = activeSubscriptions.filter((subscription) => subscription.cancellationDeadlineOn).sort((a, b) => (a.cancellationDeadlineOn ?? "").localeCompare(b.cancellationDeadlineOn ?? ""));
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return (
    <div className="finance-page subscriptions-page">
      <header className="compact-page-header"><div><p>Saml betaling, opsigelsesfrist, konto og dokumentation ét sted.</p></div><button className="primary-button" onClick={onAdd} type="button"><Plus size={17} />Nyt abonnement</button></header>
      <div className="subscription-layout">
        <Panel className="wide-panel subscription-list-panel">
          <SectionTitle title="Dine abonnementer" />
          <div className="subscription-list">
            {subscriptions.map((subscription) => {
              const deadlineDays = daysUntil(subscription.cancellationDeadlineOn);
              const linkedTransaction = subscription.linkedTransactionId ? transactionById.get(subscription.linkedTransactionId) : null;
              return <article key={subscription.id} className="subscription-row">
                <button className="subscription-open" onClick={() => onEdit(subscription)} type="button"><span className="subscription-icon"><Repeat2 size={18} /></span><span><strong>{subscription.name}</strong><small>{subscriptionIntervalLabel(subscription.billingIntervalMonths)}{linkedTransaction ? ` · ${linkedTransaction.merchant}` : ""}</small></span><span className="subscription-price"><strong>{subscription.amount === null ? "–" : currency.format(subscription.amount)}</strong><small className={deadlineDays !== null && deadlineDays <= 14 ? "deadline-soon" : ""}>{deadlineDays === null ? subscriptionStatusLabel(subscription.status) : deadlineDays < 0 ? "Frist overskredet" : `${deadlineDays} dage til frist`}</small></span></button>
                <button aria-label={`Slet ${subscription.name}`} className="transaction-delete-button" onClick={async () => { if (window.confirm(`Slet abonnementet “${subscription.name}”?`)) await onDelete(subscription); }} type="button"><Trash2 size={16} /></button>
              </article>;
            })}
            {!subscriptions.length ? <div className="empty-state"><Repeat2 size={18} />Ingen abonnementer endnu</div> : null}
          </div>
        </Panel>
        <aside className="subscription-aside">
          <Panel><small>Månedlig værdi</small><strong className="aside-value">{currency.format(monthlyCost)}</strong><p>Omregnet ud fra {activeSubscriptions.length} aktive abonnement{activeSubscriptions.length === 1 ? "" : "er"}.</p></Panel>
          <Panel><SectionTitle title="Næste frister" />{deadlines.length ? <div className="deadline-list">{deadlines.slice(0, 4).map((subscription) => <button key={subscription.id} onClick={() => onEdit(subscription)} type="button"><span><strong>{subscription.name}</strong><small>{transactionDateLabel(subscription.cancellationDeadlineOn!)}</small></span><ChevronRight size={15} /></button>)}</div> : <p className="aside-empty">Ingen opsigelsesfrister registreret.</p>}</Panel>
          <Panel><SectionTitle title="Dokumenter" /><p className="aside-empty">{subscriptions.reduce((sum, subscription) => sum + subscription.linkedDocumentIds.length, 0)} dokumentlinks på abonnementer.</p>{subscriptions.flatMap((subscription) => subscription.linkedDocumentIds).slice(0, 3).map((id) => documentById.get(id)).filter((document): document is HouseholdDocument => Boolean(document)).map((document) => <button className="aside-link" key={document.id} onClick={() => void onOpenDocument(document)} type="button"><FileText size={15} />{document.title}</button>)}</Panel>
        </aside>
      </div>
    </div>
  );
}

function SubscriptionModal({ initial, transactions, documents, onClose, onDelete, onOpenDocument, onSave }: { initial?: Subscription | null; transactions: FinanceTransaction[]; documents: HouseholdDocument[]; onClose: () => void; onDelete: (subscriptionId: string) => Promise<boolean>; onOpenDocument: (document: HouseholdDocument) => void | Promise<void>; onSave: (subscription: NewSubscription) => Promise<boolean> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [accountIdentifier, setAccountIdentifier] = useState(initial?.accountIdentifier ?? "");
  const [passwordManagerUrl, setPasswordManagerUrl] = useState(initial?.passwordManagerUrl ?? "");
  const [amount, setAmount] = useState(initial?.amount === null || initial?.amount === undefined ? "" : String(initial.amount));
  const [billingIntervalMonths, setBillingIntervalMonths] = useState(initial?.billingIntervalMonths ?? 1);
  const [trialEndsOn, setTrialEndsOn] = useState(initial?.trialEndsOn ?? "");
  const [cancellationDeadlineOn, setCancellationDeadlineOn] = useState(initial?.cancellationDeadlineOn ?? "");
  const [nextPaymentOn, setNextPaymentOn] = useState(initial?.nextPaymentOn ?? "");
  const [status, setStatus] = useState<SubscriptionStatus>(initial?.status ?? "active");
  const [linkedTransactionId, setLinkedTransactionId] = useState(initial?.linkedTransactionId ?? "");
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<string[]>(initial?.linkedDocumentIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalAccessibility(onClose, busy);
  return <div className="modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}><form aria-labelledby="subscription-modal-title" aria-modal="true" className="quick-modal transaction-modal subscription-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
    event.preventDefault();
    if (!name.trim()) { setError("Giv abonnementet et navn."); return; }
    const numericAmount = amount ? Number(amount.replace(",", ".")) : null;
    if (numericAmount !== null && !isValidFinanceAmount(numericAmount)) { setError("Beløbet er ikke gyldigt."); return; }
    setBusy(true); setError(null);
    const saved = await onSave({ name: name.trim(), websiteUrl: websiteUrl.trim() || null, accountIdentifier: accountIdentifier.trim() || null, passwordManagerUrl: passwordManagerUrl.trim() || null, amount: numericAmount, billingIntervalMonths, trialEndsOn: trialEndsOn || null, cancellationDeadlineOn: cancellationDeadlineOn || null, nextPaymentOn: nextPaymentOn || null, status, linkedTransactionId: linkedTransactionId || null, linkedDocumentIds });
    if (!saved) setError("Abonnementet kunne ikke gemmes. Prøv igen.");
    setBusy(false);
  }} ref={dialogRef as React.RefObject<HTMLFormElement | null>} role="dialog">
    <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
    <span className="modal-icon"><Repeat2 size={20} /></span>
    <div><h2 id="subscription-modal-title">{initial ? "Redigér abonnement" : "Nyt abonnement"}</h2><p className="modal-intro">Gem frister og forbind dokumentation — men opbevar selve adgangskoden i din password manager.</p></div>
    <div className="transaction-grid">
      <label className="wide">Navn<input autoFocus maxLength={160} onChange={(event) => setName(event.target.value)} placeholder="Fx Netflix eller mobilabonnement" required value={name} /></label>
      <label>Beløb<input min="0" onChange={(event) => setAmount(event.target.value)} placeholder="0,00" step="0.01" type="number" value={amount} /></label>
      <label>Periode<select onChange={(event) => setBillingIntervalMonths(Number(event.target.value))} value={billingIntervalMonths}><option value={1}>Hver måned</option><option value={3}>Hvert kvartal</option><option value={6}>Hvert halve år</option><option value={12}>Hvert år</option></select></label>
      <label className="wide">Webadresse<input onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://…" type="url" value={websiteUrl} /></label>
      <label className="wide">Login-mail eller brugernavn<input onChange={(event) => setAccountIdentifier(event.target.value)} placeholder="Mail eller brugernavn — aldrig adgangskoden" value={accountIdentifier} /></label>
      <label className="wide"><span className="field-label-with-icon"><KeyRound size={15} />Link til password manager</span><input onChange={(event) => setPasswordManagerUrl(event.target.value)} placeholder="https://…" type="url" value={passwordManagerUrl} /></label>
      <label>Prøveperiode slutter<input onChange={(event) => setTrialEndsOn(event.target.value)} type="date" value={trialEndsOn} /></label>
      <label>Sidste opsigelsesdag<input onChange={(event) => setCancellationDeadlineOn(event.target.value)} type="date" value={cancellationDeadlineOn} /></label>
      <label>Næste betaling<input onChange={(event) => setNextPaymentOn(event.target.value)} type="date" value={nextPaymentOn} /></label>
      <label>Status<select onChange={(event) => setStatus(event.target.value as SubscriptionStatus)} value={status}><option value="trial">Prøveperiode</option><option value="active">Aktiv</option><option value="cancelled">Opsagt</option></select></label>
      <label className="wide">Tilknyttet postering<select onChange={(event) => setLinkedTransactionId(event.target.value)} value={linkedTransactionId}><option value="">Ingen postering</option>{transactions.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.merchant} · {currency.format(transaction.amount)}</option>)}</select></label>
    </div>
    <section className="document-link-section"><div><h3><Link2 size={16} />Dokumenter</h3><span>{linkedDocumentIds.length} valgt</span></div>{documents.length ? <div className="document-link-list">{documents.map((document) => <div className="document-link-row" key={document.id}><label><input checked={linkedDocumentIds.includes(document.id)} onChange={(event) => setLinkedDocumentIds((ids) => event.target.checked ? [...new Set([...ids, document.id])] : ids.filter((id) => id !== document.id))} type="checkbox" /><span><strong>{document.title}</strong><small>{documentKindLabel(document.kind)}</small></span></label>{initial && linkedDocumentIds.includes(document.id) ? <button aria-label={`Åbn ${document.title}`} onClick={() => void onOpenDocument(document)} type="button"><ExternalLink size={14} /></button> : null}</div>)}</div> : <p>Upload først et dokument under Dokumenter.</p>}</section>
    {error ? <p className="modal-error" role="alert">{error}</p> : null}
    <div className="transaction-modal-actions">{initial ? <button className="danger-button" disabled={busy} onClick={async () => { if (!window.confirm(`Slet abonnementet “${initial.name}”?`)) return; setBusy(true); const deleted = await onDelete(initial.id); if (!deleted) setError("Abonnementet kunne ikke slettes."); setBusy(false); }} type="button"><Trash2 size={16} />Slet</button> : <span />}<button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : "Gem abonnement"}</button></div>
  </form></div>;
}

function PrintSheets({ tasks, shopping, financePeriod, householdName, mealItems, mealWeekStart, sampleMode }: { tasks: ChecklistItem[]; shopping: ChecklistItem[]; financePeriod: FinancePeriodSnapshot; householdName: string; mealItems: MealPlanItem[]; mealWeekStart: string; sampleMode: boolean }) {
  const incomeRows = financePeriod.transactionRows.filter((row) => row.transaction.direction === "income");
  const expenseGroups = financePeriod.categories.map((category) => ({ category, rows: financePeriod.transactionRows.filter((row) => row.transaction.direction === "expense" && (category.id === "uncategorized" ? !row.transaction.categoryId : row.transaction.categoryId === category.id)) }));
  const mealIngredients = aggregateIngredients(mealItems);
  const mealWeekEnd = new Date(`${mealWeekStart}T12:00:00`);
  mealWeekEnd.setDate(mealWeekEnd.getDate() + 6);
  const mealWeekLabel = `${new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(new Date(`${mealWeekStart}T12:00:00`))} – ${new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(mealWeekEnd)}`;
  return (
    <div className="print-sheets" aria-hidden="true">
      <article className="print-sheet budget-print">
        <header><span>{productConfig.name}</span><h1>Budget · {financePeriodLabel(financePeriod)}</h1><p>{householdName}</p></header>
        <div className="print-summary"><div><small>Indtægter</small><strong>{currency.format(sumValues(financePeriod.incomeValues))}</strong></div><div><small>Udgifter</small><strong>{currency.format(sumValues(financePeriod.expenseValues))}</strong></div><div><small>Til rådighed</small><strong>{currency.format(sumValues(financePeriod.availableValues))}</strong></div></div>
        <h2>Posteringer pr. måned</h2>
        <table className="print-budget-table"><thead><tr><th>Kategori / postering</th>{financePeriod.months.map((month) => <th key={month.key}>{month.label}</th>)}<th>{budgetPeriodTotalLabel(financePeriod.mode)}</th></tr></thead><tbody>
          <tr><td><strong>Indtægter</strong></td>{financePeriod.incomeValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.incomeValues))}</td></tr>
          {incomeRows.map((row) => <tr key={row.transaction.id}><td>{row.transaction.merchant}</td>{row.values.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{value ? budgetNumber.format(value) : "—"}</td>)}<td>{budgetNumber.format(sumValues(row.values))}</td></tr>)}
          <tr><td><strong>Udgifter</strong></td>{financePeriod.expenseValues.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.expenseValues))}</td></tr>
          {expenseGroups.flatMap(({ category, rows }) => [
            <tr key={`${category.id}-print-group`}><td><strong>{category.name}</strong></td>{category.planned.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(category.planned))}</td></tr>,
            ...rows.map((row) => <tr key={`${row.transaction.id}-print`}><td>{row.transaction.merchant}</td>{row.values.map((value, monthIndex) => <td key={financePeriod.months[monthIndex].key}>{value ? budgetNumber.format(value) : "—"}</td>)}<td>{budgetNumber.format(sumValues(row.values))}</td></tr>),
          ])}
          <tr><td>Udgifter i alt</td>{financePeriod.expenseValues.map((value, monthIndex) => <td key={monthIndex}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.expenseValues))}</td></tr>
          <tr><td>Til rådighed</td>{financePeriod.availableValues.map((value, monthIndex) => <td key={monthIndex}>{budgetNumber.format(value)}</td>)}<td>{budgetNumber.format(sumValues(financePeriod.availableValues))}</td></tr>
        </tbody></table>
      </article>
      <article className="print-sheet meal-print">
        <header><span>{productConfig.name}</span><h1>Madplan</h1><p>{mealWeekLabel} · {mealItems.length} planlagte måltider</p></header>
        <div className="print-meals">{mealItems.length ? mealItems.map((item) => <div key={item.id}><strong>{["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"][item.dayOfWeek - 1]}</strong><span>{item.title} · {item.servings} portioner</span>{item.ingredients.length ? <small>{item.ingredients.map((ingredient) => `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.name}`.trim()).join(", ")}</small> : null}</div>) : sampleMode ? meals.map(([day, meal]) => <div key={day}><strong>{day}</strong><span>{meal}</span></div>) : <p className="print-empty">Ingen planlagte måltider i denne uge.</p>}</div>
        <h2>Indkøbsliste</h2>
        <div className="print-shopping">{sampleMode ? shopping.map((item) => <span key={item.id}>□ {item.title}</span>) : mealIngredients.length ? mealIngredients.map((ingredient) => <span key={`${ingredient.name}-${ingredient.unit ?? ""}`}>□ {[formatShoppingQuantity(ingredient), ingredient.name].filter(Boolean).join(" ")}</span>) : <span>Ingen ingredienser i ugeplanen.</span>}</div>
        <h2>Huskeliste</h2>
        <div className="print-shopping">{tasks.slice(0, 3).map((item) => <span key={item.id}>□ {item.title}</span>)}</div>
      </article>
    </div>
  );
}

export function readFinanceRoute(pathname: string): { section: FinanceSection; categoryId: string | null } | null {
  const categoryMatch = pathname.match(/^\/oekonomi\/kategorier\/([^/]+)\/?$/);
  if (categoryMatch) return { section: "category", categoryId: decodeURIComponent(categoryMatch[1]) };
  if (/^\/oekonomi\/budget\/?$/.test(pathname)) return { section: "budget", categoryId: null };
  if (/^\/oekonomi\/posteringer\/?$/.test(pathname)) return { section: "transactions", categoryId: null };
  if (/^\/oekonomi\/abonnementer\/?$/.test(pathname)) return { section: "subscriptions", categoryId: null };
  if (/^\/oekonomi\/?$/.test(pathname)) return { section: "overview", categoryId: null };
  return null;
}

export function financeRoute(section: FinanceSection, categoryId?: string | null) {
  if (section === "category" && categoryId) return `/oekonomi/kategorier/${encodeURIComponent(categoryId)}`;
  if (section === "budget") return "/oekonomi/budget";
  if (section === "transactions") return "/oekonomi/posteringer";
  if (section === "subscriptions") return "/oekonomi/abonnementer";
  return "/oekonomi";
}

const viewRoutes: Record<Exclude<View, "finance">, string> = {
  overview: "/overblik",
  documents: "/dokumenter",
  tasks: "/opgaver",
  calendar: "/kalender",
  shopping: "/indkoeb",
  meals: "/madplan",
  household: "/husstand",
  settings: "/indstillinger",
};

function readViewRoute(pathname: string): View {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const match = (Object.entries(viewRoutes) as [Exclude<View, "finance">, string][]).find(([, route]) => route === normalized);
  return match?.[0] ?? "overview";
}

export function HouseholdApp({ householdId, householdName = "Mit hjem", initialPath, user, onSignOut }: HouseholdAppProps = {}) {
  const initialPathname = initialPath ?? (typeof window === "undefined" ? "/" : window.location.pathname);
  const initialFinanceRoute = readFinanceRoute(initialPathname);
  const [view, setView] = useState<View>(initialFinanceRoute ? "finance" : readViewRoute(initialPathname));
  const [financeSection, setFinanceSection] = useState<FinanceSection>(initialFinanceRoute?.section ?? "overview");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialFinanceRoute?.categoryId ?? null);
  const [template, setTemplate] = useState<TemplateName>(productConfig.defaultTemplate);
  const [language, setLanguage] = useState("da");
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [resolvedAppearance, setResolvedAppearance] = useState<ResolvedAppearance>("light");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [actions, setActions] = useState(householdId ? [] : initialActions);
  const [tasks, setTasks] = useState<TaskItem[]>(householdId ? [] : demoTasks);
  const [shopping, setShopping] = useState<ShoppingListItem[]>(householdId ? [] : demoShopping);
  const [householdDocuments, setHouseholdDocuments] = useState<HouseholdDocument[]>(householdId ? [] : demoDocuments);
  const [documentFolders, setDocumentFolders] = useState<DocumentFolder[]>(householdId ? [] : demoDocumentFolders);
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
  const [transactionCategoryId, setTransactionCategoryId] = useState<string | null>(null);
  const [transactionDirection, setTransactionDirection] = useState<"expense" | "income">("expense");
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>(householdId ? [] : demoFinance.transactions);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(householdId ? [] : demoSubscriptions);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<"budget" | "meal" | null>(null);
  const [notifications, setNotifications] = useState<HouseholdNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({ inAppEnabled: true, emailEnabled: false });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [taskMembers, setTaskMembers] = useState<TaskMemberOption[]>(user ? [{ id: user.id, name: user.displayName }] : []);
  const [canManageChecklists, setCanManageChecklists] = useState(!householdId);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mealPrintItems, setMealPrintItems] = useState<MealPlanItem[]>([]);
  const [mealPrintWeekStart, setMealPrintWeekStart] = useState(mondayFor());
  const userId = user?.id;
  const visibleNavItems = navItems;

  useEffect(() => {
    let active = true;
    const storageKey = preferencesStorageKey(userId);
    const restorePreferences = window.setTimeout(() => void (async () => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const preferences = JSON.parse(stored) as { appearance?: Appearance; budgetPeriodMode?: BudgetPeriodMode; language?: string; template?: TemplateName };
          if (["light", "dark", "system"].includes(preferences.appearance ?? "")) setAppearance(preferences.appearance as Appearance);
          if (["calendar", "rest-of-year", "rolling-12"].includes(preferences.budgetPeriodMode ?? "")) setBudgetPeriodMode(preferences.budgetPeriodMode as BudgetPeriodMode);
          if (supportedLanguages.some(([code]) => code === preferences.language)) setLanguage(preferences.language as string);
          if (Object.hasOwn(productConfig.templates, preferences.template ?? "")) setTemplate(preferences.template as TemplateName);
        }
      } catch { window.localStorage.removeItem(storageKey); }
      if (userId) {
        const { data } = await getSupabaseBrowserClient().from("profiles").select("appearance, locale").eq("id", userId).maybeSingle();
        if (active && data) {
          if (["light", "dark", "system"].includes(data.appearance)) setAppearance(data.appearance as Appearance);
          const locale = data.locale.split("-")[0];
          if (supportedLanguages.some(([code]) => code === locale)) setLanguage(locale);
        }
      }
      if (active) setPreferencesReady(true);
    })(), 0);

    return () => { active = false; window.clearTimeout(restorePreferences); };
  }, [userId]);

  useEffect(() => {
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const resolveAppearance = () => setResolvedAppearance(appearance === "system" ? (systemPreference.matches ? "dark" : "light") : appearance);
    resolveAppearance();
    systemPreference.addEventListener("change", resolveAppearance);
    return () => systemPreference.removeEventListener("change", resolveAppearance);
  }, [appearance]);

  useEffect(() => {
    if (!preferencesReady) return;
    window.localStorage.setItem(preferencesStorageKey(userId), JSON.stringify({ appearance, budgetPeriodMode, language, template }));
    if (!userId) return;
    const saveRemote = window.setTimeout(() => void getSupabaseBrowserClient().from("profiles").update({ appearance, locale: language === "da" ? "da-DK" : language }).eq("id", userId), 250);
    return () => window.clearTimeout(saveRemote);
  }, [appearance, budgetPeriodMode, language, preferencesReady, template, userId]);

  useEffect(() => {
    const handleHistory = () => {
      const route = readFinanceRoute(window.location.pathname);
      if (route) {
        setView("finance");
        setFinanceSection(route.section);
        setSelectedCategoryId(route.categoryId);
      } else {
        setView(readViewRoute(window.location.pathname));
        setFinanceSection("overview");
        setSelectedCategoryId(null);
      }
    };
    handleHistory();
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    Promise.all([
      loadTasks(householdId),
      loadShoppingItems(householdId),
      userId ? loadFinance(householdId, userId) : Promise.resolve(demoFinance),
      userId ? loadFinancePeriod(householdId, userId, budgetPeriodMode, budgetYear) : Promise.resolve(createDemoPeriodFinance(budgetPeriodMode, budgetYear)),
      userId ? loadFinanceTransactions(householdId) : Promise.resolve(demoFinance.transactions),
      loadDocuments(householdId),
      loadDocumentFolders(householdId),
      loadSubscriptions(householdId),
      loadMealPlan(householdId, mondayFor()),
    ]).then(([taskItems, shoppingItems, financeResult, financePeriodResult, transactionsResult, documentsResult, foldersResult, subscriptionsResult, mealPlanResult]) => {
      if (!active) return;
      setTasks(taskItems);
      setShopping(shoppingItems);
      setFinance(financeResult);
      setFinancePeriod(financePeriodResult);
      setFinanceTransactions(transactionsResult);
      setHouseholdDocuments(documentsResult);
      setDocumentFolders(foldersResult);
      setSubscriptions(subscriptionsResult);
      setMealPrintItems(mealPlanResult.items);
      setMealPrintWeekStart(mondayFor());
      setSyncState("synced");
    }).catch(() => { if (active) setSyncState("error"); });
    return () => { active = false; };
  }, [budgetPeriodMode, budgetYear, householdId, userId]);

  useEffect(() => {
    if (householdId) return;
    const refreshDemoPeriod = window.setTimeout(() => {
      setFinancePeriod(createDemoPeriodFinance(budgetPeriodMode, budgetYear));
    }, 0);
    return () => window.clearTimeout(refreshDemoPeriod);
  }, [budgetPeriodMode, budgetYear, householdId]);

  useEffect(() => {
    if (!householdId || !userId || !user) return;
    let active = true;
    Promise.all([
      loadNotifications(householdId, userId),
      loadNotificationPreferences(userId),
      loadHouseholdAccess(householdId, user.id, user.email, user.displayName),
    ]).then(([items, preferences, access]) => {
      if (!active) return;
      setNotifications(items);
      setNotificationPreferences({ ...preferences, emailEnabled: false });
      setTaskMembers(access.members.map((member) => ({ id: member.userId, name: member.name })));
      setCanManageChecklists(access.isOwner);
    }).catch(() => { if (active) setSyncState("error"); });
    return () => { active = false; };
  }, [householdId, user, userId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedCategory = finance.categories.find((category) => category.id === selectedCategoryId) ?? null;
  const activeHouseholdDocuments = useMemo(() => householdDocuments.filter((document) => !document.archivedAt), [householdDocuments]);
  const documentRelations = useMemo<DocumentRelationGroups>(() => ({
    transactions: financeTransactions.map((transaction) => ({ id: transaction.id, label: transaction.merchant, meta: `${transactionDateLabel(transaction.occurredOn)} · ${currency.format(transaction.amount)}` })),
    subscriptions: subscriptions.map((subscription) => ({ id: subscription.id, label: subscription.name, meta: subscription.nextPaymentOn ? `Næste betaling ${transactionDateLabel(subscription.nextPaymentOn)}` : subscriptionIntervalLabel(subscription.billingIntervalMonths) })),
    tasks: tasks.map((task) => ({ id: String(task.id), label: task.title, meta: taskMeta(task) })),
  }), [financeTransactions, subscriptions, tasks]);
  const title = useMemo(() => visibleNavItems.find(([key]) => key === view)?.[1] ?? (view === "household" ? "Husstanden" : "Indstillinger"), [view, visibleNavItems]);
  const displayName = user?.displayName || "Anders";
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const topbarHeading = view === "finance" ? "Økonomi" : view === "overview" ? "Overblik" : title;
  const topbarSubheading = view === "finance"
    ? financeSection === "budget" ? "Budget" : financeSection === "transactions" ? "Posteringer" : financeSection === "subscriptions" ? "Abonnementer" : financeSection === "category" ? selectedCategory?.name ?? "Kategori" : "Overblik"
    : view === "overview" ? `Godmorgen, ${firstName} 👋` : householdName;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MH";
  const setLocalToggle = <T extends { id: string | number; done: boolean }>(setter: React.Dispatch<React.SetStateAction<T[]>>) => (id: string | number) => setter((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const toggleTask = async (id: string | number) => {
    const current = tasks.find((item) => item.id === id);
    setTasks((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
    if (!householdId || typeof id !== "string" || !current) return;
    setSyncState("saving");
    try {
      await setTaskCompleted(householdId, id, !current.done);
      setSyncState("synced");
      setToast(current.done ? "Opgaven er genåbnet." : "Opgaven er markeret som færdig.");
    } catch {
      setTasks((items) => items.map((item) => item.id === id ? current : item));
      setSyncState("error");
    }
  };
  const toggleShopping = async (id: string | number) => {
    const current = shopping.find((item) => item.id === id);
    setShopping((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
    if (!householdId || typeof id !== "string" || !current) return;
    setSyncState("saving");
    try {
      await setShoppingItemCompleted(householdId, id, !current.done);
      setSyncState("synced");
    } catch {
      setShopping((items) => items.map((item) => item.id === id ? current : item));
      setSyncState("error");
    }
  };
  const refreshShopping = async () => {
    if (!householdId) return;
    try { setShopping(await loadShoppingItems(householdId)); } catch { setSyncState("error"); }
  };
  const navigateFinance = (section: FinanceSection, categoryId: string | null = null) => {
    setView("finance");
    setFinanceSection(section);
    setSelectedCategoryId(categoryId);
    window.history.pushState(null, "", financeRoute(section, categoryId));
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navigate = (next: View) => {
    if (next === "finance") {
      navigateFinance("overview");
      return;
    }
    setView(next);
    setFinanceSection("overview");
    setSelectedCategoryId(null);
    window.history.pushState(null, "", viewRoutes[next as Exclude<View, "finance">]);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addItem = async (itemTitle: string) => {
    if (!householdId || !user) {
      if (quickAdd === "task") setTasks((items) => [...items, { id: Date.now(), title: itemTitle, description: null, assignedTo: null, assignedName: null, dueAt: null, recurrence: null, createdBy: user?.id ?? null, done: false }]);
      if (quickAdd === "shopping") setShopping((items) => [...items, { id: Date.now(), title: itemTitle, quantity: null, createdBy: user?.id ?? null, done: false }]);
      setQuickAdd(null);
      return;
    }
    setSyncState("saving");
    try {
      if (quickAdd === "task") { await saveTask(householdId, user.id, { title: itemTitle, description: null, assignedTo: null, dueAt: null }); setTasks(await loadTasks(householdId)); }
      if (quickAdd === "shopping") { await saveShoppingItem(householdId, user.id, { title: itemTitle, quantity: null }); setShopping(await loadShoppingItems(householdId)); }
      setSyncState("synced");
      setQuickAdd(null);
      setToast(quickAdd === "task" ? "Opgaven er oprettet." : "Varen er tilføjet.");
    } catch { setSyncState("error"); }
  };

  const saveTaskItem = async (input: TaskInput, item?: TaskItem) => {
    if (!householdId || !user) {
      if (item) setTasks((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, ...input, assignedName: input.assignedTo === user?.id ? user.displayName : null } : candidate));
      else setTasks((items) => [...items, { id: Date.now(), ...input, assignedName: input.assignedTo === user?.id ? user.displayName : null, recurrence: null, createdBy: user?.id ?? null, done: false }]);
      setToast(item ? "Opgaven er opdateret." : "Opgaven er oprettet.");
      return true;
    }
    setSyncState("saving");
    try {
      await saveTask(householdId, user.id, input, typeof item?.id === "string" ? item.id : undefined);
      setTasks(await loadTasks(householdId));
      setSyncState("synced");
      setToast(item ? "Opgaven er opdateret." : "Opgaven er oprettet.");
      return true;
    } catch { setSyncState("error"); return false; }
  };
  const removeTaskItem = async (item: TaskItem) => {
    if (!householdId || typeof item.id !== "string") { setTasks((items) => items.filter((candidate) => candidate.id !== item.id)); setToast("Opgaven er slettet."); return true; }
    setSyncState("saving");
    try { await deleteTask(householdId, item.id); setTasks(await loadTasks(householdId)); setSyncState("synced"); setToast("Opgaven er slettet."); return true; } catch { setSyncState("error"); return false; }
  };
  const saveShoppingListItem = async (input: ShoppingInput, item?: ShoppingListItem) => {
    if (!householdId || !user) {
      if (item) setShopping((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, ...input } : candidate));
      else setShopping((items) => [...items, { id: Date.now(), ...input, createdBy: user?.id ?? null, done: false }]);
      setToast(item ? "Varen er opdateret." : "Varen er tilføjet.");
      return true;
    }
    setSyncState("saving");
    try { await saveShoppingItem(householdId, user.id, input, typeof item?.id === "string" ? item.id : undefined); setShopping(await loadShoppingItems(householdId)); setSyncState("synced"); setToast(item ? "Varen er opdateret." : "Varen er tilføjet."); return true; } catch { setSyncState("error"); return false; }
  };
  const removeShoppingListItem = async (item: ShoppingListItem) => {
    if (!householdId || typeof item.id !== "string") { setShopping((items) => items.filter((candidate) => candidate.id !== item.id)); setToast("Varen er slettet."); return true; }
    setSyncState("saving");
    try { await deleteShoppingItem(householdId, item.id); setShopping(await loadShoppingItems(householdId)); setSyncState("synced"); setToast("Varen er slettet."); return true; } catch { setSyncState("error"); return false; }
  };
  const clearCompletedShopping = async () => {
    if (!householdId) { setShopping((items) => items.filter((item) => !item.done)); setToast("Købte varer er ryddet."); return true; }
    const deletableIds = shopping.filter((item) => item.done && typeof item.id === "string" && (canManageChecklists || item.createdBy === userId)).map((item) => item.id as string);
    if (!deletableIds.length) { setToast("Kun opretteren eller husstandens ejer kan rydde disse varer."); return false; }
    setSyncState("saving");
    try { await clearCompletedShoppingItems(householdId, deletableIds); setShopping(await loadShoppingItems(householdId)); setSyncState("synced"); setToast(deletableIds.length === 1 ? "Den købte vare er ryddet." : `${deletableIds.length} købte varer er ryddet.`); return true; } catch { setSyncState("error"); return false; }
  };
  const openNewTransaction = (categoryId: string | null = null, direction: "expense" | "income" = "expense") => { setEditingTransaction(null); setTransactionCategoryId(categoryId); setTransactionDirection(direction); setTransactionOpen(true); };
  const openTransaction = (transaction: FinanceTransaction) => { setEditingTransaction(transaction); setTransactionCategoryId(transaction.categoryId); setTransactionDirection(transaction.direction); setTransactionOpen(true); };
  const refreshFinance = async () => {
    if (!householdId || !user) return;
    const [nextFinance, nextFinancePeriod, nextTransactions] = await Promise.all([
      loadFinance(householdId, user.id),
      loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear),
      loadFinanceTransactions(householdId),
    ]);
    setFinance(nextFinance);
    setFinancePeriod(nextFinancePeriod);
    setFinanceTransactions(nextTransactions);
  };
  const saveTransaction = async (transaction: NewTransaction) => {
    if (!householdId || !user) return false;
    setSyncState("saving");
    try {
      if (editingTransaction) await updateFinanceTransaction(householdId, user.id, editingTransaction.id, transaction);
      else await addFinanceTransaction(householdId, user.id, transaction);
      await refreshFinance();
      await refreshDocumentArchive();
      setTransactionOpen(false);
      setEditingTransaction(null);
      setTransactionCategoryId(null);
      setTransactionDirection("expense");
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
      await refreshDocumentArchive();
      setTransactionOpen(false);
      setEditingTransaction(null);
      setTransactionCategoryId(null);
      setTransactionDirection("expense");
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const openNewSubscription = () => { setEditingSubscription(null); setSubscriptionOpen(true); };
  const openSubscription = (subscription: Subscription) => { setEditingSubscription(subscription); setSubscriptionOpen(true); };
  const refreshSubscriptions = async () => {
    if (!householdId) return;
    setSubscriptions(await loadSubscriptions(householdId));
  };
  const saveSubscription = async (subscription: NewSubscription) => {
    if (!householdId || !user) return false;
    setSyncState("saving");
    try {
      if (editingSubscription) await updateSubscription(householdId, user.id, editingSubscription.id, subscription);
      else await addSubscription(householdId, user.id, subscription);
      await refreshSubscriptions();
      await refreshDocumentArchive();
      setSubscriptionOpen(false);
      setEditingSubscription(null);
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const removeSubscription = async (subscriptionId: string) => {
    if (!householdId || !user) return false;
    setSyncState("saving");
    try {
      await deleteSubscription(householdId, subscriptionId);
      await refreshSubscriptions();
      await refreshDocumentArchive();
      setSubscriptionOpen(false);
      setEditingSubscription(null);
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const saveTransactionOccurrence = async (transaction: FinanceTransaction, occurredOn: string, amount: number, scope: TransactionOccurrenceEditScope) => {
    if (!isValidFinanceAmount(amount)) return false;
    if (!householdId || !user) {
      setFinancePeriod((snapshot) => {
        const transactionRows = snapshot.transactionRows.map((row) => row.occurrenceTransactions.some((candidate) => candidate?.id === transaction.id) ? {
          ...row,
          values: row.values.map((value, monthIndex) => row.occurrenceDates[monthIndex] === occurredOn ? amount : scope === "forward" && row.occurrenceDates[monthIndex] && row.occurrenceDates[monthIndex]! >= occurredOn ? amount : value),
        } : row);
        const totals = transactionPeriodTotals(transactionRows, snapshot.months.length);
        return { ...snapshot, transactionRows, incomePlanned: totals.incomeValues, incomeActual: totals.incomeValues, expenseActual: totals.expenseValues, ...totals };
      });
      return true;
    }
    setSyncState("saving");
    try {
      await updateFinanceTransactionOccurrence(householdId, user.id, transaction, occurredOn, amount, scope);
      await refreshFinance();
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const saveFinanceCategory = async (name: string, categoryType: Exclude<FinanceCategoryType, "uncategorized">) => {
    if (!householdId || !user) {
      const categoryId = `demo-${Date.now()}`;
      setFinance((snapshot) => ({ ...snapshot, categories: [...snapshot.categories, { id: categoryId, budgetItemId: `${categoryId}-item`, name, color: "#4A7A91", categoryType, editable: true, planned: 0, spent: 0 }] }));
      setFinancePeriod((snapshot) => ({ ...snapshot, categories: [...snapshot.categories, { id: categoryId, name, color: "#4A7A91", categoryType, editable: true, budgetItemIds: Array(snapshot.months.length).fill(null), planned: Array(snapshot.months.length).fill(0), actual: Array(snapshot.months.length).fill(0) }] }));
      return categoryId;
    }
    setSyncState("saving");
    try {
      const categoryId = await addFinanceCategory(householdId, financePeriod, name, categoryType);
      const [nextFinance, nextFinancePeriod] = await Promise.all([loadFinance(householdId, user.id), loadFinancePeriod(householdId, user.id, budgetPeriodMode, budgetYear)]);
      setFinance(nextFinance);
      setFinancePeriod(nextFinancePeriod);
      setSyncState("synced");
      return categoryId;
    } catch {
      setSyncState("error");
      return null;
    }
  };
  const refreshDocumentArchive = async () => {
    if (!householdId) return;
    const [documentsResult, foldersResult, transactionsResult, subscriptionsResult] = await Promise.all([loadDocuments(householdId), loadDocumentFolders(householdId), loadFinanceTransactions(householdId), loadSubscriptions(householdId)]);
    setHouseholdDocuments(documentsResult);
    setDocumentFolders(foldersResult);
    setFinanceTransactions(transactionsResult);
    setSubscriptions(subscriptionsResult);
  };
  const saveDocument = async (file: File, input: DocumentArchiveInput) => {
    if (!householdId || !user) {
      const folder = input.folderId ? documentFolders.find((candidate) => candidate.id === input.folderId) : null;
      const id = `demo-doc-${Date.now()}`;
      setHouseholdDocuments((documents) => [{
        id,
        title: input.title,
        kind: input.kind,
        visibility: input.visibility,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storagePath: "",
        processingStatus: "ready",
        folderId: folder?.id ?? null,
        folderName: folder?.name ?? null,
        folderColor: folder?.color ?? null,
        documentDate: input.documentDate,
        expiresOn: input.expiresOn,
        notes: input.notes,
        archivedAt: null,
        createdBy: user?.id ?? "demo-user",
        createdAt: new Date().toISOString(),
        tags: input.tagNames.map((name, index) => ({ id: `${id}-tag-${index}`, name, color: "#7c6ee6" })),
        linkedTransactionIds: input.transactionIds,
        linkedSubscriptionIds: input.subscriptionIds,
        linkedTaskIds: input.taskIds,
      }, ...documents]);
      setToast("Dokumentet er tilføjet i forhåndsvisningen.");
      return true;
    }
    setSyncState("saving");
    try {
      await uploadDocument({ householdId, userId: user.id, file, input });
      await refreshDocumentArchive();
      setSyncState("synced");
      setToast("Dokumentet er uploadet.");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const saveDocumentMetadata = async (document: HouseholdDocument, input: DocumentArchiveInput) => {
    if (!householdId) {
      const folder = input.folderId ? documentFolders.find((candidate) => candidate.id === input.folderId) : null;
      setHouseholdDocuments((documents) => documents.map((candidate) => candidate.id === document.id ? {
        ...candidate,
        ...input,
        folderName: folder?.name ?? null,
        folderColor: folder?.color ?? null,
        tags: input.tagNames.map((name, index) => ({ id: `${document.id}-tag-${index}`, name, color: "#7c6ee6" })),
        linkedTransactionIds: input.transactionIds,
        linkedSubscriptionIds: input.subscriptionIds,
        linkedTaskIds: input.taskIds,
      } : candidate));
      setToast("Dokumentet er opdateret.");
      return true;
    }
    setSyncState("saving");
    try {
      await updateDocumentArchive(householdId, document.id, input);
      await refreshDocumentArchive();
      setSyncState("synced");
      setToast("Dokumentet er opdateret.");
      return true;
    } catch { setSyncState("error"); return false; }
  };
  const addDocumentFolder = async (name: string) => {
    if (!householdId || !user) {
      const folder = { id: `demo-folder-${Date.now()}`, name, color: "#5b6ee1" };
      setDocumentFolders((folders) => [...folders, folder]);
      setToast("Mappen er oprettet.");
      return true;
    }
    setSyncState("saving");
    try {
      await createDocumentFolder(householdId, user.id, name);
      await refreshDocumentArchive();
      setSyncState("synced");
      setToast("Mappen er oprettet.");
      return true;
    } catch { setSyncState("error"); return false; }
  };
  const archiveDocument = async (document: HouseholdDocument, archived: boolean) => {
    if (!householdId) {
      setHouseholdDocuments((documents) => documents.map((candidate) => candidate.id === document.id ? { ...candidate, archivedAt: archived ? new Date().toISOString() : null } : candidate));
      setToast(archived ? "Dokumentet er arkiveret." : "Dokumentet er gendannet.");
      return true;
    }
    setSyncState("saving");
    try {
      await setDocumentArchived(householdId, document.id, archived);
      await refreshDocumentArchive();
      setSyncState("synced");
      setToast(archived ? "Dokumentet er arkiveret." : "Dokumentet er gendannet.");
      return true;
    } catch { setSyncState("error"); return false; }
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
  const updateNotificationPreferences = async (preferences: NotificationPreferences) => {
    const next = { ...preferences, emailEnabled: false };
    setNotificationPreferences(next);
    if (!userId) return;
    setSyncState("saving");
    try { await saveNotificationPreferences(userId, next); setSyncState("synced"); setToast("Notifikationsvalg er gemt."); } catch { setSyncState("error"); }
  };
  const requestPasswordReset = async () => {
    if (!user?.email) return;
    setAccountMessage(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(user.email, { redirectTo: new URL("/?auth=recovery", window.location.origin).toString() });
      if (error) throw error;
      setAccountMessage("Linket er sendt. Brug altid den nyeste mail i din indbakke.");
    } catch { setAccountMessage("Linket kunne ikke sendes lige nu. Prøv igen om lidt."); }
  };

  return (
    <div className="app-root" data-color-mode={resolvedAppearance} data-template={template} data-print-target={printTarget ?? "none"}>
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand" title={productConfig.name}>
          <Image alt="" height={44} priority src="/brand/hjemblik-mark-192.png?v=1" unoptimized width={44} />
          <span className="sr-only">{productConfig.name}</span>
        </div>
        <nav aria-label="Primær navigation">
          {visibleNavItems.map(([key, label, Icon]) => (
            <div className={key === "finance" ? "sidebar-nav-group" : ""} key={key}>
              <button aria-current={view === key ? "page" : undefined} className={view === key ? "active" : ""} onClick={() => navigate(key)} type="button"><Icon size={18} /><span>{label}</span></button>
              {key === "finance" && view === "finance" ? (
                <div aria-label="Økonomi" className="sidebar-subnav">
                  <button aria-current={financeSection === "overview" ? "page" : undefined} className={financeSection === "overview" ? "active" : ""} onClick={() => navigateFinance("overview")} type="button">Overblik</button>
                  <button aria-current={financeSection === "budget" ? "page" : undefined} className={financeSection === "budget" ? "active" : ""} onClick={() => navigateFinance("budget")} type="button">Budget</button>
                  <button aria-current={financeSection === "transactions" ? "page" : undefined} className={financeSection === "transactions" ? "active" : ""} onClick={() => navigateFinance("transactions")} type="button">Posteringer</button>
                  <button aria-current={financeSection === "subscriptions" ? "page" : undefined} className={financeSection === "subscriptions" ? "active" : ""} onClick={() => navigateFinance("subscriptions")} type="button">Abonnementer</button>
                </div>
              ) : null}
            </div>
          ))}
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
          <div><small>{topbarHeading}</small><strong>{topbarSubheading}</strong></div>
          <div className="top-actions">
            {view === "finance" || view === "meals" ? <div className="export-wrap">
              <button className="export-button" onClick={() => setExportOpen((open) => !open)} type="button"><Download size={16} /><span>Eksportér</span><ChevronDown size={13} /></button>
              {exportOpen ? <ExportMenu onExport={exportPdf} target={view === "meals" ? "meal" : "budget"} /> : null}
            </div> : null}
            <button
              aria-label={resolvedAppearance === "dark" ? "Skift til lyst tema" : "Skift til mørkt tema"}
              className="mode-button"
              onClick={() => setAppearance(resolvedAppearance === "dark" ? "light" : "dark")}
              title={resolvedAppearance === "dark" ? "Lyst tema" : "Mørkt tema"}
              type="button"
            >
              {resolvedAppearance === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {actions.length || notifications.length ? <div className="notification-wrap"><button aria-label={`${actions.length + notifications.filter((item) => !item.readAt).length} notifikationer`} className="notification-button" onClick={() => setNotificationOpen((open) => !open)} type="button"><Bell size={19} />{actions.length + notifications.filter((item) => !item.readAt).length ? <b>{actions.length + notifications.filter((item) => !item.readAt).length}</b> : null}</button>{notificationOpen ? <section className="notification-center"><header><strong>Notifikationer</strong><span>{notifications.filter((item) => !item.readAt).length} ulæste</span></header>{notifications.length ? notifications.map((item) => <button className={item.readAt ? "read" : ""} key={item.id} onClick={() => { if (userId && !item.readAt) void markNotificationRead(item.id, userId).then(() => setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry))); }} type="button"><strong>{item.title}</strong><span>{item.body || "Kalenderpåmindelse"}</span><time>{new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></button>) : <div className="empty-state"><Bell size={17} />Ingen notifikationer endnu</div>}</section> : null}</div> : null}
            {householdId ? <span aria-live="polite" className={`sync-status ${syncState}`} role="status">{syncState === "loading" ? "Henter…" : syncState === "saving" ? "Gemmer…" : syncState === "error" ? "Synkronisering fejlede" : "Synkroniseret"}</span> : null}
            <button className="profile-button" type="button"><span>{initials}</span><strong>{firstName}</strong><ChevronDown size={14} /></button>
          </div>
        </header>

        <main>
          {view === "overview" ? <Overview finance={finance} actions={actions} approve={(id) => setActions((items) => items.filter((item) => item.id !== id))} tasks={tasks} shopping={shopping} documents={activeHouseholdDocuments} toggleTask={householdId ? toggleTask : setLocalToggle(setTasks)} toggleShopping={householdId ? toggleShopping : setLocalToggle(setShopping)} navigate={navigate} openAdd={setQuickAdd} openUpload={() => { setDocumentUploadOpen(true); navigate("documents"); }} openDocument={openDocument} openIncome={() => openNewTransaction(null, "income")} sampleMode={!householdId} mealItems={mealPrintItems} dataReady={!householdId || syncState === "synced"} /> : null}
          {view === "finance" ? (
            <div className="finance-area">
              {financeSection === "overview" ? <FinanceOverviewView finance={finance} onAddCategory={() => setCategoryOpen(true)} onAddTransaction={() => openNewTransaction()} onAddTransactionForCategory={(categoryId) => openNewTransaction(categoryId)} onEditTransaction={openTransaction} onOpenBudget={() => navigateFinance("budget")} onOpenCategory={(categoryId) => navigateFinance("category", categoryId)} onOpenTransactions={() => navigateFinance("transactions")} /> : null}
              {financeSection === "budget" ? <BudgetView financePeriod={financePeriod} onAddCategory={async (name, categoryType) => Boolean(await saveFinanceCategory(name, categoryType))} onAddTransaction={(direction, categoryId) => openNewTransaction(categoryId ?? null, direction)} onEditTransaction={openTransaction} onExport={() => exportPdf("budget")} onOccurrenceChange={saveTransactionOccurrence} onOpenCategory={(categoryId) => navigateFinance("category", categoryId)} onPeriodModeChange={setBudgetPeriodMode} onYearChange={setBudgetYear} periodMode={budgetPeriodMode} selectedYear={budgetYear} /> : null}
              {financeSection === "transactions" ? <TransactionsView categories={finance.categories} onAdd={() => openNewTransaction()} onDelete={(transaction) => removeTransaction(transaction.id)} onEdit={openTransaction} transactions={financeTransactions} /> : null}
              {financeSection === "subscriptions" ? <SubscriptionsView documents={householdDocuments} onAdd={openNewSubscription} onDelete={(subscription) => removeSubscription(subscription.id)} onEdit={openSubscription} onOpenDocument={openDocument} subscriptions={subscriptions} transactions={financeTransactions} /> : null}
              {financeSection === "category" && selectedCategory ? <CategoryDetailView category={selectedCategory} onAddTransaction={() => openNewTransaction(selectedCategory.id)} onBack={() => navigateFinance("overview")} onEditTransaction={openTransaction} transactions={financeTransactions} /> : null}
              {financeSection === "category" && !selectedCategory ? <Panel><div className="empty-state">Kategorien findes ikke eller indlæses stadig.</div></Panel> : null}
            </div>
          ) : null}
          {view === "documents" ? <DocumentLibraryView createRequested={documentUploadOpen} currentUserId={userId} documents={householdDocuments} folders={documentFolders} isOwner={canManageChecklists} onArchive={archiveDocument} onCreateFolder={addDocumentFolder} onCreateRequestHandled={() => setDocumentUploadOpen(false)} onOpen={openDocument} onSave={saveDocumentMetadata} onUpload={saveDocument} relations={documentRelations} /> : null}
          {view === "tasks" ? <TasksView currentUserId={userId} isOwner={canManageChecklists} members={taskMembers} onDelete={removeTaskItem} onSave={saveTaskItem} onToggle={(item) => householdId ? toggleTask(item.id) : setLocalToggle(setTasks)(item.id)} tasks={tasks} /> : null}
          {view === "shopping" ? <ShoppingView currentUserId={userId} isOwner={canManageChecklists} items={shopping} onClearCompleted={clearCompletedShopping} onDelete={removeShoppingListItem} onSave={saveShoppingListItem} onToggle={(item) => householdId ? toggleShopping(item.id) : setLocalToggle(setShopping)(item.id)} /> : null}
          {view === "calendar" ? <CalendarView householdId={householdId} onSyncState={setSyncState} userId={user?.id} /> : null}
          {view === "meals" ? <MealPlanView householdId={householdId} onItemsChange={(items, weekStart) => { setMealPrintItems(items); setMealPrintWeekStart(weekStart); }} onShoppingChanged={() => void refreshShopping()} onSyncState={setSyncState} userId={user?.id} /> : null}
          {view === "household" ? <HouseholdView householdId={householdId} householdName={householdName} onSyncState={setSyncState} user={user} /> : null}
          {view === "settings" ? <SettingsView template={template} setTemplate={setTemplate} language={language} appearance={appearance} setAppearance={setAppearance} notificationPreferences={notificationPreferences} onNotificationPreferencesChange={updateNotificationPreferences} accountEmail={user?.email} onRequestPasswordReset={requestPasswordReset} accountMessage={accountMessage} /> : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobil navigation">
        {visibleNavItems.slice(0, 4).map(([key, label, Icon]) => <button aria-current={view === key ? "page" : undefined} className={view === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button"><Icon size={19} /><span>{label}</span></button>)}
        <button className={mobileMenu ? "active" : ""} onClick={() => setMobileMenu((open) => !open)} type="button"><Menu size={19} /><span>Mere</span></button>
      </nav>

      {quickAdd ? <QuickAdd kind={quickAdd} onClose={() => setQuickAdd(null)} onAdd={addItem} /> : null}
      {transactionOpen ? <TransactionModal categories={finance.categories} documents={householdDocuments} initial={editingTransaction} preferredCategoryId={transactionCategoryId} preferredDirection={transactionDirection} onAddCategory={saveFinanceCategory} onClose={() => { setTransactionOpen(false); setEditingTransaction(null); setTransactionCategoryId(null); setTransactionDirection("expense"); }} onDelete={removeTransaction} onOpenDocument={openDocument} onSave={saveTransaction} /> : null}
      {subscriptionOpen ? <SubscriptionModal documents={householdDocuments} initial={editingSubscription} onClose={() => { setSubscriptionOpen(false); setEditingSubscription(null); }} onDelete={removeSubscription} onOpenDocument={openDocument} onSave={saveSubscription} transactions={financeTransactions} /> : null}
      {categoryOpen ? <BudgetCategoryModal onClose={() => setCategoryOpen(false)} onAdd={async (name, categoryType) => { const saved = Boolean(await saveFinanceCategory(name, categoryType)); if (saved) setCategoryOpen(false); return saved; }} /> : null}
      {toast ? <div aria-live="polite" className="app-toast" role="status"><Check size={16} />{toast}</div> : null}
      <PrintSheets tasks={tasks} shopping={shopping} financePeriod={financePeriod} householdName={householdName} mealItems={mealPrintItems} mealWeekStart={mealPrintWeekStart} sampleMode={!householdId} />
    </div>
  );
}
