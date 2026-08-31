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
  Upload,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  calendarItems,
  documents,
  initialActions,
  initialShopping,
  initialTasks,
  meals,
  type ChecklistItem,
} from "./demo-data";
import {
  addFinanceTransaction,
  financeMonthLabel,
  loadFinance,
  transactionDateLabel,
  updatePlannedAmount,
  type FinanceSnapshot,
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
    { id: "demo-home", budgetItemId: "demo-home-item", name: "Bolig", color: "#2158E8", planned: 9000, spent: 7850 },
    { id: "demo-food", budgetItemId: "demo-food-item", name: "Mad & husholdning", color: "#20A874", planned: 7000, spent: 5240 },
    { id: "demo-transport", budgetItemId: "demo-transport-item", name: "Transport", color: "#8267DF", planned: 3500, spent: 900 },
    { id: "demo-insurance", budgetItemId: "demo-insurance-item", name: "Forsikring", color: "#FF9A5C", planned: 1500, spent: 572 },
    { id: "demo-leisure", budgetItemId: "demo-leisure-item", name: "Fritid", color: "#D85B8C", planned: 2000, spent: 0 },
  ],
  transactions: [
    { id: "demo-1", merchant: "Norlys", amount: 499, direction: "expense", occurredOn: "2025-05-23", categoryId: "demo-home", categoryName: "Bolig" },
    { id: "demo-2", merchant: "Rema 1000", amount: 236.75, direction: "expense", occurredOn: "2025-05-19", categoryId: "demo-food", categoryName: "Mad & husholdning" },
    { id: "demo-3", merchant: "Løn", amount: 32000, direction: "income", occurredOn: "2025-05-01", categoryId: null, categoryName: "Indtægt" },
  ],
};

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
  toggleTask,
  toggleShopping,
  navigate,
  openAdd,
}: {
  finance: FinanceSnapshot;
  actions: typeof initialActions;
  approve: (id: number) => void;
  tasks: ChecklistItem[];
  shopping: ChecklistItem[];
  toggleTask: (id: ChecklistItem["id"]) => void;
  toggleShopping: (id: ChecklistItem["id"]) => void;
  navigate: (view: View) => void;
  openAdd: (kind: "task" | "shopping") => void;
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
          {documents.map(([title, meta, amount], index) => (
            <button key={title} onClick={() => navigate("documents")} type="button">
              <span className={`file-icon file-${index + 1}`}><FileText size={16} /></span>
              <span><strong>{title}</strong><small>{meta}</small></span>
              <b>{amount}</b>
            </button>
          ))}
        </div>
        <button className="panel-link" onClick={() => navigate("documents")} type="button"><Upload size={14} /> Upload dokument</button>
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

function FinanceView({
  finance,
  onAdd,
  onPlannedChange,
}: {
  finance: FinanceSnapshot;
  onAdd: () => void;
  onPlannedChange: (categoryId: string, planned: number) => void | Promise<void>;
}) {
  return (
    <div className="module-layout">
      <BudgetHero finance={finance} onOpen={onAdd} />
      <Panel>
        <SectionTitle title="Budget pr. kategori" />
        <div className="category-table">
          {finance.categories.map((category) => (
            <div key={category.id}>
              <strong><i className="category-color" style={{ background: category.color }} />{category.name}</strong>
              <span className="category-progress"><i style={{ width: `${category.planned > 0 ? Math.min(100, (category.spent / category.planned) * 100) : 0}%`, background: category.color }} /></span>
              <span>{currency.format(category.spent)}</span>
              <label className="budget-amount-field">af <input aria-label={`Budget for ${category.name}`} defaultValue={category.planned} min="0" onBlur={(event) => void onPlannedChange(category.id, Number(event.target.value))} step="100" type="number" /> kr.</label>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Seneste bevægelser" action="Tilføj postering" onAction={onAdd} />
        <div className="payment-list roomy">
          {finance.transactions.map((transaction) => (
            <button key={transaction.id} type="button">
              <time>{transactionDateLabel(transaction.occurredOn)}</time>
              <span><strong>{transaction.merchant}</strong><small>{transaction.categoryName}</small></span>
              <b className={transaction.direction === "income" ? "amount-income" : ""}>{transaction.direction === "income" ? "+" : "−"}{currency.format(transaction.amount)}</b>
            </button>
          ))}
          {finance.transactions.length === 0 ? <div className="empty-state"><CircleDollarSign size={18} /> Ingen posteringer endnu</div> : null}
        </div>
      </Panel>
    </div>
  );
}

function CollectionView({
  view,
  tasks,
  shopping,
  toggleTask,
  toggleShopping,
}: {
  view: Exclude<View, "overview" | "finance" | "settings">;
  tasks: ChecklistItem[];
  shopping: ChecklistItem[];
  toggleTask: (id: ChecklistItem["id"]) => void;
  toggleShopping: (id: ChecklistItem["id"]) => void;
}) {
  const labels: Record<typeof view, [string, string]> = {
    documents: ["Dokumenter", "Søg, organiser og forbind husholdningens vigtige papirer."],
    tasks: ["Opgaver", "Fordel arbejdet og få de gentagne ting til at ske til tiden."],
    calendar: ["Kalender", "Et fælles årshjul for aftaler, frister og vedligehold."],
    shopping: ["Indkøb", "En levende liste, som også kan bygges direkte fra madplanen."],
    meals: ["Madplan", "Planlæg ugen, justér portioner og gør indkøbet enkelt."],
    household: ["Husstanden", "Medlemmer, roller og adgang til fælles eller private områder."],
  };
  const [title, intro] = labels[view];

  return (
    <div className="collection-page">
      <div className="module-intro"><h1>{title}</h1><p>{intro}</p></div>
      {view === "documents" ? (
        <Panel className="wide-panel">
          <div className="toolbar"><label><Search size={16} /><input aria-label="Søg i dokumenter" placeholder="Søg i dokumenter" /></label><button type="button"><Upload size={15} /> Upload</button></div>
          <div className="document-list large">
            {documents.map(([name, meta, amount], index) => <button key={name} type="button"><span className={`file-icon file-${index + 1}`}><FileText size={18} /></span><span><strong>{name}</strong><small>{meta}</small></span><b>{amount || "Arkiveret"}</b><ChevronRight size={16} /></button>)}
          </div>
        </Panel>
      ) : null}
      {view === "tasks" ? <Panel className="wide-panel"><div className="check-list large">{tasks.map((item) => <CheckRow item={item} key={item.id} onToggle={toggleTask} />)}</div></Panel> : null}
      {view === "shopping" ? <Panel className="wide-panel"><div className="check-list large">{shopping.map((item) => <CheckRow item={item} key={item.id} onToggle={toggleShopping} />)}</div></Panel> : null}
      {view === "calendar" ? <Panel className="wide-panel"><div className="calendar-list large">{calendarItems.map(([day, time, item, tone]) => <button type="button" key={`${day}-${time}`}><span className={`timeline-dot dot-${tone}`} /><time>{day}</time><b>{time}</b><span>{item}</span></button>)}</div></Panel> : null}
      {view === "meals" ? <Panel className="wide-panel"><div className="meal-strip large">{meals.map(([day, meal, duration], index) => <button type="button" key={day}><small>{day}</small><span className={`meal-visual meal-${index + 1}`} /><strong>{meal}</strong><em>{duration}</em></button>)}</div></Panel> : null}
      {view === "household" ? (
        <div className="member-grid">
          {[["AS", "Anders Sørensen", "Ejer"], ["SS", "Sofie Sørensen", "Voksen"], ["ES", "Emil Sørensen", "Barn"]].map(([initials, name, role]) => <Panel key={name}><span className="member-avatar">{initials}</span><h2>{name}</h2><p>{role}</p><button className="secondary-button" type="button">Administrer adgang</button></Panel>)}
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
      <button onClick={() => onExport("budget")} type="button"><CircleDollarSign size={16} /><span><strong>Budget som PDF</strong><small>Månedsoversigt og kategorier</small></span></button>
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
      <form className="quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); if (!title.trim() || busy) return; setBusy(true); await onAdd(title.trim()); setBusy(false); }}>
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon">{kind === "task" ? <CheckSquare size={20} /> : <ShoppingCart size={20} />}</span>
        <h2>{kind === "task" ? "Ny opgave" : "Tilføj til indkøb"}</h2>
        <label>{kind === "task" ? "Hvad skal gøres?" : "Hvad mangler I?"}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "task" ? "Fx bestil tid til service" : "Fx havregryn"} /></label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : "Tilføj"}</button>
      </form>
    </div>
  );
}

function TransactionModal({
  categories,
  onClose,
  onAdd,
}: {
  categories: FinanceSnapshot["categories"];
  onClose: () => void;
  onAdd: (transaction: NewTransaction) => Promise<boolean>;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="quick-modal transaction-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
        event.preventDefault();
        const numericAmount = Number(amount.replace(",", "."));
        if (!merchant.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
          setError("Udfyld navn og et gyldigt beløb.");
          return;
        }
        setBusy(true);
        setError(null);
        const saved = await onAdd({ merchant: merchant.trim(), amount: numericAmount, direction, occurredOn, categoryId: direction === "expense" ? categoryId || null : null });
        if (!saved) setError("Posteringen kunne ikke gemmes. Prøv igen.");
        setBusy(false);
      }}>
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><CircleDollarSign size={20} /></span>
        <div><h2>Ny postering</h2><p className="modal-intro">Registrér en udgift eller indtægt i {financeMonthLabel(new Date().toISOString().slice(0, 7) + "-01").toLowerCase()}.</p></div>
        <div className="direction-switch">
          <button className={direction === "expense" ? "active" : ""} onClick={() => setDirection("expense")} type="button">Udgift</button>
          <button className={direction === "income" ? "active" : ""} onClick={() => setDirection("income")} type="button">Indtægt</button>
        </div>
        <div className="transaction-grid">
          <label className="wide">Navn<input autoFocus maxLength={160} onChange={(event) => setMerchant(event.target.value)} placeholder="Fx Rema 1000 eller løn" required value={merchant} /></label>
          <label>Beløb<input inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required step="0.01" type="number" value={amount} /></label>
          <label>Dato<input onChange={(event) => setOccurredOn(event.target.value)} required type="date" value={occurredOn} /></label>
          {direction === "expense" ? <label className="wide">Kategori<select onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        </div>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Gemmer…" : "Gem postering"}</button>
      </form>
    </div>
  );
}

function PrintSheets({ tasks, shopping, finance, householdName }: { tasks: ChecklistItem[]; shopping: ChecklistItem[]; finance: FinanceSnapshot; householdName: string }) {
  return (
    <div className="print-sheets" aria-hidden="true">
      <article className="print-sheet budget-print">
        <header><span>Mit hjem</span><h1>Budget · {financeMonthLabel(finance.month)}</h1><p>{householdName}</p></header>
        <div className="print-summary"><div><small>Budget</small><strong>{currency.format(finance.spendingTarget)}</strong></div><div><small>Forbrug</small><strong>{currency.format(finance.spent)}</strong></div><div><small>Tilbage</small><strong>{currency.format(finance.spendingTarget - finance.spent)}</strong></div></div>
        <h2>Budget pr. kategori</h2>
        <table><thead><tr><th>Kategori</th><th>Forbrug</th><th>Budget</th></tr></thead><tbody>{finance.categories.map((category) => <tr key={category.id}><td>{category.name}</td><td>{currency.format(category.spent)}</td><td>{currency.format(category.planned)}</td></tr>)}</tbody></table>
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
  const [template, setTemplate] = useState<TemplateName>(productConfig.defaultTemplate);
  const [language, setLanguage] = useState("da");
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [resolvedAppearance, setResolvedAppearance] = useState<ResolvedAppearance>("light");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [actions, setActions] = useState(initialActions);
  const [tasks, setTasks] = useState<ChecklistItem[]>(householdId ? [] : initialTasks);
  const [shopping, setShopping] = useState<ChecklistItem[]>(householdId ? [] : initialShopping);
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
  const [syncState, setSyncState] = useState<SyncState>(householdId ? "loading" : "synced");
  const [exportOpen, setExportOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [quickAdd, setQuickAdd] = useState<"task" | "shopping" | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<"budget" | "meal" | null>(null);
  const userId = user?.id;

  useEffect(() => {
    const restorePreferences = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(preferencesStorageKey);
        if (stored) {
          const preferences = JSON.parse(stored) as { appearance?: Appearance; language?: string; template?: TemplateName };
          if (["light", "dark", "system"].includes(preferences.appearance ?? "")) setAppearance(preferences.appearance as Appearance);
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
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify({ appearance, language, template }));
  }, [appearance, language, preferencesReady, template]);

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();
    Promise.all([
      supabase.from("tasks").select("id, title, due_at, completed_at").eq("household_id", householdId).order("created_at"),
      supabase.from("shopping_items").select("id, title, quantity, completed_at").eq("household_id", householdId).order("created_at"),
      userId ? loadFinance(householdId, userId) : Promise.resolve(demoFinance),
    ]).then(([taskResult, shoppingResult, financeResult]) => {
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
      setSyncState("synced");
    }).catch(() => { if (active) setSyncState("error"); });
    return () => { active = false; };
  }, [householdId, userId]);

  const title = useMemo(() => navItems.find(([key]) => key === view)?.[1] ?? (view === "household" ? "Husstanden" : "Indstillinger"), [view]);
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
  const navigate = (next: View) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
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
  const saveTransaction = async (transaction: NewTransaction) => {
    if (!householdId || !user) return false;
    setSyncState("saving");
    try {
      await addFinanceTransaction(householdId, user.id, transaction);
      setFinance(await loadFinance(householdId, user.id));
      setTransactionOpen(false);
      setSyncState("synced");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  };
  const savePlannedAmount = async (categoryId: string, planned: number) => {
    if (!householdId || !user || !Number.isFinite(planned) || planned < 0) return;
    setSyncState("saving");
    try {
      await updatePlannedAmount(householdId, finance, categoryId, planned);
      setFinance(await loadFinance(householdId, user.id));
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
          {navItems.map(([key, label, Icon]) => <button className={view === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button"><Icon size={18} /><span>{label}</span>{key === "documents" ? <b>3</b> : null}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className={view === "household" ? "active" : ""} onClick={() => navigate("household")} type="button"><Users size={18} /><span>{householdName}</span><small>{user ? "1 medlem" : "4 medlemmer"}</small></button>
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
            <button aria-label={`${actions.length} notifikationer`} className="notification-button" type="button"><Bell size={19} />{actions.length ? <b>{actions.length}</b> : null}</button>
            {householdId ? <span className={`sync-status ${syncState}`}>{syncState === "loading" ? "Henter…" : syncState === "saving" ? "Gemmer…" : syncState === "error" ? "Synkronisering fejlede" : "Synkroniseret"}</span> : null}
            <button className="profile-button" type="button"><span>{initials}</span><strong>{firstName}</strong><ChevronDown size={14} /></button>
          </div>
        </header>

        <main>
          {view === "overview" ? <Overview finance={finance} actions={actions} approve={(id) => setActions((items) => items.filter((item) => item.id !== id))} tasks={tasks} shopping={shopping} toggleTask={householdId ? toggleTask : setLocalToggle(setTasks)} toggleShopping={householdId ? toggleShopping : setLocalToggle(setShopping)} navigate={navigate} openAdd={setQuickAdd} /> : null}
          {view === "finance" ? <FinanceView finance={finance} onAdd={() => setTransactionOpen(true)} onPlannedChange={savePlannedAmount} /> : null}
          {!["overview", "finance", "settings"].includes(view) ? <CollectionView view={view as Exclude<View, "overview" | "finance" | "settings">} tasks={tasks} shopping={shopping} toggleTask={householdId ? toggleTask : setLocalToggle(setTasks)} toggleShopping={householdId ? toggleShopping : setLocalToggle(setShopping)} /> : null}
          {view === "settings" ? <SettingsView template={template} setTemplate={setTemplate} language={language} setLanguage={setLanguage} appearance={appearance} setAppearance={setAppearance} /> : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobil navigation">
        {navItems.slice(0, 4).map(([key, label, Icon]) => <button className={view === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button"><Icon size={19} /><span>{label}</span></button>)}
        <button className={mobileMenu ? "active" : ""} onClick={() => setMobileMenu((open) => !open)} type="button"><Menu size={19} /><span>Mere</span></button>
      </nav>

      {quickAdd ? <QuickAdd kind={quickAdd} onClose={() => setQuickAdd(null)} onAdd={addItem} /> : null}
      {transactionOpen ? <TransactionModal categories={finance.categories} onClose={() => setTransactionOpen(false)} onAdd={saveTransaction} /> : null}
      <PrintSheets tasks={tasks} shopping={shopping} finance={finance} householdName={householdName} />
    </div>
  );
}
