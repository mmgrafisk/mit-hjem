"use client";

import { CalendarClock, Check, CheckSquare, Clock3, Plus, Search, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { taskMeta, type ShoppingInput, type ShoppingListItem, type TaskInput, type TaskItem } from "./checklist-data";
import { useModalAccessibility } from "./modal-accessibility";

export type TaskMemberOption = { id: string; name: string };

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function copenhagenDateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof value === "string" ? new Date(value) : value);
}

function TaskModal({ canDelete = false, item, members, onClose, onDelete, onSave }: {
  item: TaskItem | null;
  members: TaskMemberOption[];
  onClose: () => void;
  onDelete: (item: TaskItem) => Promise<boolean>;
  onSave: (input: TaskInput, item?: TaskItem) => Promise<boolean>;
  canDelete?: boolean;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(item?.assignedTo ?? "");
  const [dueAt, setDueAt] = useState(localDateTimeValue(item?.dueAt ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalAccessibility(onClose, busy);
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    const saved = await onSave({ title: title.trim(), description: description.trim() || null, assignedTo: assignedTo || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null }, item ?? undefined);
    if (!saved) setError("Opgaven kunne ikke gemmes. Prøv igen.");
    setBusy(false);
  };
  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose} role="presentation">
      <section aria-labelledby="task-modal-title" aria-modal="true" className="quick-modal checklist-modal" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <button aria-label="Luk" className="modal-close" disabled={busy} onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><CheckSquare size={20} /></span>
        <div><h2 id="task-modal-title">{item ? "Redigér opgave" : "Ny opgave"}</h2><p className="modal-intro">Saml ansvar, frist og noter i én opgave.</p></div>
        <label className="checklist-full">Opgave<input autoFocus maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Fx bestil tid til service" required value={title} /></label>
        <div className="checklist-form-grid">
          <label><span><CalendarClock size={14} />Frist</span><input onChange={(event) => setDueAt(event.target.value)} type="datetime-local" value={dueAt} /></label>
          <label><span><UserRound size={14} />Ansvarlig</span><select onChange={(event) => setAssignedTo(event.target.value)} value={assignedTo}><option value="">Ikke tildelt</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        </div>
        <label>Noter<textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Detaljer, links eller praktiske noter" rows={3} value={description} /></label>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <footer className="checklist-modal-actions">
          {item && canDelete ? <button className="danger-button" disabled={busy} onClick={async () => { if (!window.confirm(`Slet opgaven “${item.title}”?`)) return; setBusy(true); const deleted = await onDelete(item); if (!deleted) { setError("Opgaven kunne ikke slettes."); setBusy(false); } }} type="button"><Trash2 size={15} />Slet</button> : <span />}
          <div><button className="secondary-button" disabled={busy} onClick={onClose} type="button">Annuller</button><button className="primary-button" disabled={busy || !title.trim()} onClick={() => void submit()} type="button">{busy ? "Gemmer…" : "Gem opgave"}</button></div>
        </footer>
      </section>
    </div>
  );
}

function ShoppingModal({ canDelete = false, item, onClose, onDelete, onSave }: {
  item: ShoppingListItem | null;
  onClose: () => void;
  onDelete: (item: ShoppingListItem) => Promise<boolean>;
  onSave: (input: ShoppingInput, item?: ShoppingListItem) => Promise<boolean>;
  canDelete?: boolean;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalAccessibility(onClose, busy);
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    const saved = await onSave({ title: title.trim(), quantity: quantity.trim() || null }, item ?? undefined);
    if (!saved) setError("Varen kunne ikke gemmes. Prøv igen.");
    setBusy(false);
  };
  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose} role="presentation">
      <section aria-labelledby="shopping-modal-title" aria-modal="true" className="quick-modal checklist-modal compact" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <button aria-label="Luk" className="modal-close" disabled={busy} onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><ShoppingCart size={20} /></span>
        <div><h2 id="shopping-modal-title">{item ? "Redigér vare" : "Tilføj vare"}</h2><p className="modal-intro">Mængde og enhed kan skrives samlet, fx “2 liter”.</p></div>
        <div className="checklist-form-grid">
          <label>Vare<input autoFocus maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="Fx havregryn" required value={title} /></label>
          <label>Mængde<input maxLength={80} onChange={(event) => setQuantity(event.target.value)} placeholder="Fx 2 pakker" value={quantity} /></label>
        </div>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <footer className="checklist-modal-actions">
          {item && canDelete ? <button className="danger-button" disabled={busy} onClick={async () => { if (!window.confirm(`Slet “${item.title}” fra indkøbslisten?`)) return; setBusy(true); const deleted = await onDelete(item); if (!deleted) { setError("Varen kunne ikke slettes."); setBusy(false); } }} type="button"><Trash2 size={15} />Slet</button> : <span />}
          <div><button className="secondary-button" disabled={busy} onClick={onClose} type="button">Annuller</button><button className="primary-button" disabled={busy || !title.trim()} onClick={() => void submit()} type="button">{busy ? "Gemmer…" : "Gem vare"}</button></div>
        </footer>
      </section>
    </div>
  );
}

export function TasksView({ currentUserId, isOwner, members, onDelete, onSave, onToggle, tasks }: {
  currentUserId?: string;
  isOwner: boolean;
  members: TaskMemberOption[];
  onDelete: (item: TaskItem) => Promise<boolean>;
  onSave: (input: TaskInput, item?: TaskItem) => Promise<boolean>;
  onToggle: (item: TaskItem) => void | Promise<void>;
  tasks: TaskItem[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"open" | "today" | "upcoming" | "done">("open");
  const [editing, setEditing] = useState<TaskItem | null | undefined>(undefined);
  const todayKey = copenhagenDateKey(new Date());
  const visible = useMemo(() => tasks.filter((item) => {
    const matchesQuery = `${item.title} ${item.description ?? ""} ${item.assignedName ?? ""}`.toLocaleLowerCase("da-DK").includes(query.trim().toLocaleLowerCase("da-DK"));
    if (!matchesQuery) return false;
    if (filter === "done") return item.done;
    if (item.done) return false;
    if (filter === "today") return Boolean(item.dueAt && copenhagenDateKey(item.dueAt) === todayKey);
    if (filter === "upcoming") return Boolean(item.dueAt && copenhagenDateKey(item.dueAt) > todayKey);
    return true;
  }), [filter, query, tasks, todayKey]);
  return (
    <div className="daily-page">
      <div className="module-toolbar"><div><h2>Opgaver</h2><p>Fordel arbejdet, sæt en frist og behold praktiske noter samlet.</p></div><button className="primary-button" onClick={() => setEditing(null)} type="button"><Plus size={16} />Ny opgave</button></div>
      <section className="panel daily-panel">
        <div className="daily-toolbar"><label><Search size={16} /><input aria-label="Søg i opgaver" onChange={(event) => setQuery(event.target.value)} placeholder="Søg i opgaver" value={query} /></label><div className="filter-tabs" role="group" aria-label="Filtrér opgaver">{([['open','Åbne'],['today','I dag'],['upcoming','Kommende'],['done','Færdige']] as const).map(([key,label]) => <button aria-pressed={filter === key} className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)} type="button">{label}</button>)}</div></div>
        <div className="daily-list">
          {visible.map((item) => <article className={item.done ? "is-done" : ""} key={item.id}><button aria-label={item.done ? `Markér ${item.title} som åben` : `Markér ${item.title} som færdig`} aria-pressed={item.done} className="daily-check" onClick={() => void onToggle(item)} type="button">{item.done ? <Check size={14} /> : null}</button><button className="daily-content" onClick={() => setEditing(item)} type="button"><strong>{item.title}</strong><span><Clock3 size={13} />{taskMeta(item)}</span>{item.description ? <small>{item.description}</small> : null}</button><button aria-label={`Redigér ${item.title}`} className="row-edit" onClick={() => setEditing(item)} type="button">Redigér</button></article>)}
          {!visible.length ? <div className="empty-state action-empty"><CheckSquare size={20} /><div><strong>{query ? "Ingen opgaver matcher" : filter === "done" ? "Ingen færdige opgaver endnu" : "I har ingen opgaver her"}</strong><span>Opret en opgave med ansvarlig og frist.</span></div><button onClick={() => setEditing(null)} type="button"><Plus size={15} />Ny opgave</button></div> : null}
        </div>
      </section>
      {editing !== undefined ? <TaskModal canDelete={!editing || isOwner || editing.createdBy === currentUserId} item={editing} members={members} onClose={() => setEditing(undefined)} onDelete={async (item) => { const deleted = await onDelete(item); if (deleted) setEditing(undefined); return deleted; }} onSave={async (input, item) => { const saved = await onSave(input, item); if (saved) setEditing(undefined); return saved; }} /> : null}
    </div>
  );
}

export function ShoppingView({ currentUserId, isOwner, items, onClearCompleted, onDelete, onSave, onToggle }: {
  currentUserId?: string;
  isOwner: boolean;
  items: ShoppingListItem[];
  onClearCompleted: () => Promise<boolean>;
  onDelete: (item: ShoppingListItem) => Promise<boolean>;
  onSave: (input: ShoppingInput, item?: ShoppingListItem) => Promise<boolean>;
  onToggle: (item: ShoppingListItem) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<ShoppingListItem | null | undefined>(undefined);
  const visible = items.filter((item) => (showDone || !item.done) && `${item.title} ${item.quantity ?? ""}`.toLocaleLowerCase("da-DK").includes(query.trim().toLocaleLowerCase("da-DK")));
  const completedCount = items.filter((item) => item.done).length;
  return (
    <div className="daily-page">
      <div className="module-toolbar"><div><h2>Indkøb</h2><p>En enkel fælles liste, der også modtager ingredienser fra madplanen.</p></div><button className="primary-button" onClick={() => setEditing(null)} type="button"><Plus size={16} />Tilføj vare</button></div>
      <section className="panel daily-panel">
        <div className="daily-toolbar"><label><Search size={16} /><input aria-label="Søg i indkøbslisten" onChange={(event) => setQuery(event.target.value)} placeholder="Søg i indkøbslisten" value={query} /></label><div className="daily-actions"><button aria-pressed={showDone} className={showDone ? "active" : ""} onClick={() => setShowDone((value) => !value)} type="button">{showDone ? "Skjul købte" : `Vis købte (${completedCount})`}</button>{completedCount ? <button onClick={() => void onClearCompleted()} type="button"><Trash2 size={14} />Ryd købte</button> : null}</div></div>
        <div className="daily-list shopping-daily-list">
          {visible.map((item) => <article className={item.done ? "is-done" : ""} key={item.id}><button aria-label={item.done ? `Markér ${item.title} som manglende` : `Markér ${item.title} som købt`} aria-pressed={item.done} className="daily-check" onClick={() => void onToggle(item)} type="button">{item.done ? <Check size={14} /> : null}</button><button className="daily-content" onClick={() => setEditing(item)} type="button"><strong>{item.title}</strong>{item.quantity ? <span>{item.quantity}</span> : <small>Ingen mængde angivet</small>}</button><button aria-label={`Redigér ${item.title}`} className="row-edit" onClick={() => setEditing(item)} type="button">Redigér</button></article>)}
          {!visible.length ? <div className="empty-state action-empty"><ShoppingCart size={20} /><div><strong>{query ? "Ingen varer matcher" : "Indkøbslisten er klar"}</strong><span>Tilføj selv en vare eller send ingredienser fra madplanen.</span></div><button onClick={() => setEditing(null)} type="button"><Plus size={15} />Tilføj vare</button></div> : null}
        </div>
      </section>
      {editing !== undefined ? <ShoppingModal canDelete={!editing || isOwner || editing.createdBy === currentUserId} item={editing} onClose={() => setEditing(undefined)} onDelete={async (item) => { const deleted = await onDelete(item); if (deleted) setEditing(undefined); return deleted; }} onSave={async (input, item) => { const saved = await onSave(input, item); if (saved) setEditing(undefined); return saved; }} /> : null}
    </div>
  );
}
