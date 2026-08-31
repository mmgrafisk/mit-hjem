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
  payments,
  type ChecklistItem,
} from "./demo-data";
import {
  productConfig,
  supportedLanguages,
  type TemplateName,
} from "./product-config";

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
  onToggle: (id: number) => void;
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

function BudgetHero({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="budget-hero">
      <div className="budget-heading">
        <span>Økonomi</span>
        <i />
        <button type="button">Denne måned <ChevronDown size={14} /></button>
      </div>
      <div className="budget-overview">
        <div>
          <small>Forbrug</small>
          <strong>14.562 kr.</strong>
          <span>af 23.000 kr.</span>
        </div>
        <div>
          <small>Tilbage at bruge</small>
          <strong>8.438 kr.</strong>
          <span>36% tilbage</span>
        </div>
        <div className="progress-ring" aria-label="63 procent af budgettet er brugt">
          <span>63%</span>
        </div>
      </div>
      <div className="budget-bar"><span /></div>
      <div className="account-row">
        <button type="button" onClick={onOpen}>
          <small>Lønkonto</small><strong>23.842 kr.</strong><span>Danske Bank</span>
        </button>
        <button type="button" onClick={onOpen}>
          <small>Budgetkonto</small><strong>8.438 kr.</strong><span>Nordea</span>
        </button>
        <button type="button" onClick={onOpen}>
          <small>Opsparing</small><strong>72.100 kr.</strong><span>Spar Nord</span>
        </button>
      </div>
    </section>
  );
}

function Overview({
  actions,
  approve,
  tasks,
  shopping,
  toggleTask,
  toggleShopping,
  navigate,
  openAdd,
}: {
  actions: typeof initialActions;
  approve: (id: number) => void;
  tasks: ChecklistItem[];
  shopping: ChecklistItem[];
  toggleTask: (id: number) => void;
  toggleShopping: (id: number) => void;
  navigate: (view: View) => void;
  openAdd: (kind: "task" | "shopping") => void;
}) {
  return (
    <div className="dashboard-grid">
      <BudgetHero onOpen={() => navigate("finance")} />

      <Panel className="payments-panel">
        <SectionTitle title="Kommende betalinger" action="Se alle" onAction={() => navigate("finance")} />
        <div className="payment-list">
          {payments.map((payment) => (
            <button key={payment.id} type="button" onClick={() => navigate("finance")}>
              <time>{payment.date}</time>
              <span><strong>{payment.vendor}</strong><small>{payment.category}</small></span>
              <b>{currency.format(payment.amount)}</b>
            </button>
          ))}
        </div>
        <div className="panel-total"><span>I alt kommende</span><strong>2.748 kr.</strong></div>
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

function FinanceView() {
  return (
    <div className="module-layout">
      <BudgetHero onOpen={() => undefined} />
      <Panel>
        <SectionTitle title="Budget pr. kategori" />
        <div className="category-table">
          {[
            ["Bolig", 7850, 9000],
            ["Mad & husholdning", 5240, 7000],
            ["Transport", 2350, 3500],
            ["Forsikring", 1250, 1500],
            ["Fritid", 1050, 2000],
          ].map(([name, used, total]) => (
            <div key={name}>
              <strong>{name}</strong>
              <span className="category-progress"><i style={{ width: `${(Number(used) / Number(total)) * 100}%` }} /></span>
              <span>{currency.format(Number(used))}</span>
              <small>af {currency.format(Number(total))}</small>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Seneste bevægelser" />
        <div className="payment-list roomy">
          {payments.map((payment) => (
            <button key={payment.id} type="button">
              <time>{payment.date}</time>
              <span><strong>{payment.vendor}</strong><small>{payment.category}</small></span>
              <b>-{currency.format(payment.amount)}</b>
            </button>
          ))}
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
  toggleTask: (id: number) => void;
  toggleShopping: (id: number) => void;
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
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (title.trim()) onAdd(title.trim()); }}>
        <button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon">{kind === "task" ? <CheckSquare size={20} /> : <ShoppingCart size={20} />}</span>
        <h2>{kind === "task" ? "Ny opgave" : "Tilføj til indkøb"}</h2>
        <label>{kind === "task" ? "Hvad skal gøres?" : "Hvad mangler I?"}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "task" ? "Fx bestil tid til service" : "Fx havregryn"} /></label>
        <button className="primary-button" type="submit">Tilføj</button>
      </form>
    </div>
  );
}

function PrintSheets({ tasks, shopping }: { tasks: ChecklistItem[]; shopping: ChecklistItem[] }) {
  return (
    <div className="print-sheets" aria-hidden="true">
      <article className="print-sheet budget-print">
        <header><span>Mit hjem</span><h1>Budget · Maj 2025</h1><p>Husstanden Sørensen</p></header>
        <div className="print-summary"><div><small>Budget</small><strong>23.000 kr.</strong></div><div><small>Forbrug</small><strong>14.562 kr.</strong></div><div><small>Tilbage</small><strong>8.438 kr.</strong></div></div>
        <h2>Budget pr. kategori</h2>
        <table><thead><tr><th>Kategori</th><th>Forbrug</th><th>Budget</th></tr></thead><tbody><tr><td>Bolig</td><td>7.850 kr.</td><td>9.000 kr.</td></tr><tr><td>Mad & husholdning</td><td>5.240 kr.</td><td>7.000 kr.</td></tr><tr><td>Transport</td><td>2.350 kr.</td><td>3.500 kr.</td></tr></tbody></table>
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

export function HouseholdApp() {
  const [view, setView] = useState<View>("overview");
  const [template, setTemplate] = useState<TemplateName>(productConfig.defaultTemplate);
  const [language, setLanguage] = useState("da");
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [resolvedAppearance, setResolvedAppearance] = useState<ResolvedAppearance>("light");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [actions, setActions] = useState(initialActions);
  const [tasks, setTasks] = useState(initialTasks);
  const [shopping, setShopping] = useState(initialShopping);
  const [exportOpen, setExportOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [quickAdd, setQuickAdd] = useState<"task" | "shopping" | null>(null);
  const [printTarget, setPrintTarget] = useState<"budget" | "meal" | null>(null);

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

  const title = useMemo(() => navItems.find(([key]) => key === view)?.[1] ?? (view === "household" ? "Husstanden" : "Indstillinger"), [view]);
  const toggle = (setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>) => (id: number) => setter((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const navigate = (next: View) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const addItem = (title: string) => {
    if (quickAdd === "task") setTasks((items) => [...items, { id: Date.now(), title, meta: "Ny · Ikke tildelt", done: false }]);
    if (quickAdd === "shopping") setShopping((items) => [...items, { id: Date.now(), title, done: false }]);
    setQuickAdd(null);
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
          <button className={view === "household" ? "active" : ""} onClick={() => navigate("household")} type="button"><Users size={18} /><span>Husstanden</span><small>4 medlemmer</small></button>
          <button className={view === "settings" ? "active" : ""} onClick={() => navigate("settings")} type="button"><Settings size={18} /><span>Indstillinger</span></button>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <button aria-label="Åbn menu" className="menu-button" onClick={() => setMobileMenu((open) => !open)} type="button"><Menu size={21} /></button>
          <div><small>{view === "overview" ? "Godmorgen, Anders 👋" : "Mit hjem"}</small><strong>{view === "overview" ? "Her er overblikket over jeres hjem." : title}</strong></div>
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
            <button className="profile-button" type="button"><span>AS</span><strong>Anders</strong><ChevronDown size={14} /></button>
          </div>
        </header>

        <main>
          {view === "overview" ? <Overview actions={actions} approve={(id) => setActions((items) => items.filter((item) => item.id !== id))} tasks={tasks} shopping={shopping} toggleTask={toggle(setTasks)} toggleShopping={toggle(setShopping)} navigate={navigate} openAdd={setQuickAdd} /> : null}
          {view === "finance" ? <FinanceView /> : null}
          {!["overview", "finance", "settings"].includes(view) ? <CollectionView view={view as Exclude<View, "overview" | "finance" | "settings">} tasks={tasks} shopping={shopping} toggleTask={toggle(setTasks)} toggleShopping={toggle(setShopping)} /> : null}
          {view === "settings" ? <SettingsView template={template} setTemplate={setTemplate} language={language} setLanguage={setLanguage} appearance={appearance} setAppearance={setAppearance} /> : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobil navigation">
        {navItems.slice(0, 4).map(([key, label, Icon]) => <button className={view === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button"><Icon size={19} /><span>{label}</span></button>)}
        <button className={mobileMenu ? "active" : ""} onClick={() => setMobileMenu((open) => !open)} type="button"><Menu size={19} /><span>Mere</span></button>
      </nav>

      {quickAdd ? <QuickAdd kind={quickAdd} onClose={() => setQuickAdd(null)} onAdd={addItem} /> : null}
      <PrintSheets tasks={tasks} shopping={shopping} />
    </div>
  );
}
