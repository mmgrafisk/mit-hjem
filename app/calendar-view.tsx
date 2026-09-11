"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  deleteCalendarEvent,
  expandCalendarEvents,
  loadCalendar,
  saveCalendarEvent,
  saveCalendarOccurrenceException,
  type CalendarEvent,
  type CalendarAssignee,
  type CalendarEventException,
  type CalendarOccurrence,
  type CalendarRecurrence,
  type CalendarReminderOffset,
  type NewCalendarEvent,
} from "./calendar-data";

type CalendarViewProps = { householdId?: string; userId?: string; onSyncState?: (state: "saving" | "synced" | "error") => void };
type CalendarMode = "month" | "week";

const recurrenceLabels: Record<CalendarRecurrence, string> = { once: "Gentages ikke", daily: "Dagligt", weekly: "Ugentligt", monthly: "Månedligt", yearly: "Årligt" };
const reminderOptions: Array<[CalendarReminderOffset | null, string]> = [[null, "Ingen"], [0, "Ved start"], [15, "15 minutter før"], [60, "1 time før"], [1440, "1 dag før"]];
const dayFormatter = new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" });

function startOfWeek(date: Date) { const next = new Date(date); const day = next.getDay() || 7; next.setHours(0, 0, 0, 0); next.setDate(next.getDate() - day + 1); return next; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function dateInputValue(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16); }

function EventModal({ assignees, initial, onClose, onDelete, onSave }: { assignees: CalendarAssignee[]; initial: CalendarOccurrence | null; onClose: () => void; onDelete: (scope: "occurrence" | "series") => Promise<void>; onSave: (value: NewCalendarEvent, scope: "occurrence" | "series") => Promise<void> }) {
  const defaultStart = new Date(); defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 15) * 15, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startsAt, setStartsAt] = useState(dateInputValue(initial?.occurrenceStart ?? defaultStart.toISOString()));
  const [endsAt, setEndsAt] = useState(dateInputValue(initial?.occurrenceEnd ?? defaultEnd.toISOString()));
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [recurrence, setRecurrence] = useState<CalendarRecurrence>(initial?.recurrence ?? "once");
  const [recurrenceEndOn, setRecurrenceEndOn] = useState(initial?.recurrenceEndOn ?? "");
  const [reminderMinutes, setReminderMinutes] = useState<CalendarReminderOffset | null>(initial?.reminderMinutes ?? 60);
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [scope, setScope] = useState<"occurrence" | "series">("series");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!title.trim()) { setError("Skriv en titel til aftalen."); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { setError("Sluttid skal ligge efter starttid."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), allDay, location: location || null, description: description || null, timezone: "Europe/Copenhagen", assignedTo: assignedTo || null, recurrence, recurrenceInterval: 1, recurrenceEndOn: recurrence === "once" ? null : recurrenceEndOn || null, reminderMinutes }, scope);
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aftalen kunne ikke gemmes."); } finally { setSaving(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose} role="presentation"><section aria-modal="true" className="calendar-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Luk" className="modal-close" onClick={onClose} type="button"><X size={18} /></button><header><span className="modal-icon"><CalendarDays size={20} /></span><div><h2>{initial ? "Redigér aftale" : "Ny aftale"}</h2><p>Planlæg tid, sted, gentagelse og påmindelse.</p></div></header><div className="calendar-form-grid"><label className="field-span-2"><span>Titel</span><input autoFocus onChange={(e) => setTitle(e.target.value)} value={title} /></label><label><span>Start</span><input onChange={(e) => setStartsAt(e.target.value)} type="datetime-local" value={startsAt} /></label><label><span>Slut</span><input onChange={(e) => setEndsAt(e.target.value)} type="datetime-local" value={endsAt} /></label><label><span>Gentagelse</span><select disabled={scope === "occurrence"} onChange={(e) => setRecurrence(e.target.value as CalendarRecurrence)} value={recurrence}>{Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Slutdato</span><input disabled={recurrence === "once" || scope === "occurrence"} onChange={(e) => setRecurrenceEndOn(e.target.value)} type="date" value={recurrenceEndOn} /></label><label><span>Sted</span><input onChange={(e) => setLocation(e.target.value)} placeholder="Valgfrit" value={location} /></label><label><span>Ansvarlig</span><select disabled={scope === "occurrence"} onChange={(e) => setAssignedTo(e.target.value)} value={assignedTo}><option value="">Hele husstanden</option>{assignees.map((assignee) => <option key={assignee.userId} value={assignee.userId}>{assignee.name}</option>)}</select></label><label><span>Påmindelse</span><select disabled={scope === "occurrence"} onChange={(e) => setReminderMinutes(e.target.value === "none" ? null : Number(e.target.value) as CalendarReminderOffset)} value={reminderMinutes ?? "none"}>{reminderOptions.map(([value, label]) => <option key={value ?? "none"} value={value ?? "none"}>{label}</option>)}</select></label><label className="checkbox-field"><input checked={allDay} onChange={(e) => setAllDay(e.target.checked)} type="checkbox" /><span>Heldagsaftale</span></label><label className="field-span-2"><span>Noter</span><textarea onChange={(e) => setDescription(e.target.value)} rows={3} value={description} /></label>{initial?.recurrence !== "once" ? <fieldset className="field-span-2 scope-choice"><legend>Ændringen gælder</legend><label><input checked={scope === "occurrence"} onChange={() => setScope("occurrence")} type="radio" />Kun denne forekomst</label><label><input checked={scope === "series"} onChange={() => setScope("series")} type="radio" />Hele serien</label></fieldset> : null}</div>{error ? <p className="modal-error" role="alert">{error}</p> : null}<footer><div>{initial ? <button className="danger-button compact" disabled={saving} onClick={() => void onDelete(scope)} type="button"><Trash2 size={15} /> Slet</button> : null}</div><div><button className="secondary-button" onClick={onClose} type="button">Annuller</button><button className="primary-button" disabled={saving} onClick={() => void submit()} type="button">{saving ? "Gemmer…" : "Gem aftale"}</button></div></footer></section></div>;
}

export function CalendarView({ householdId, userId, onSyncState }: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [focusDate, setFocusDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [exceptions, setExceptions] = useState<CalendarEventException[]>([]);
  const [assignees, setAssignees] = useState<CalendarAssignee[]>([]);
  const [editing, setEditing] = useState<CalendarOccurrence | null | undefined>(undefined);
  const range = useMemo(() => mode === "month" ? { start: startOfWeek(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)), end: addDays(startOfWeek(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0)), 6) } : { start: startOfWeek(focusDate), end: addDays(startOfWeek(focusDate), 6) }, [focusDate, mode]);
  const days = useMemo(() => { const result: Date[] = []; for (let date = new Date(range.start); date <= range.end; date = addDays(date, 1)) result.push(date); return result; }, [range]);
  const occurrences = useMemo(() => expandCalendarEvents(events, exceptions, range.start, new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59)), [events, exceptions, range]);
  const refresh = async () => { if (!householdId) return; const next = await loadCalendar(householdId); setEvents(next.events); setExceptions(next.exceptions); setAssignees(next.assignees); };
  useEffect(() => { const task = window.setTimeout(() => void refresh().catch(() => onSyncState?.("error")), 0); return () => window.clearTimeout(task); }, [householdId]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (value: NewCalendarEvent, scope: "occurrence" | "series") => { if (!householdId || !userId) throw new Error("Log ind for at gemme aftalen."); onSyncState?.("saving"); if (editing && scope === "occurrence" && editing.recurrence !== "once") await saveCalendarOccurrenceException(householdId, userId, editing, { title: value.title, startsAt: value.startsAt, endsAt: value.endsAt, description: value.description, location: value.location }); else await saveCalendarEvent(householdId, userId, value, editing?.id); await refresh(); onSyncState?.("synced"); };
  const remove = async (scope: "occurrence" | "series") => { if (!editing || !householdId || !userId) return; onSyncState?.("saving"); if (scope === "occurrence" && editing.recurrence !== "once") await saveCalendarOccurrenceException(householdId, userId, editing, { cancelled: true }); else await deleteCalendarEvent(householdId, editing.id); await refresh(); setEditing(undefined); onSyncState?.("synced"); };
  const move = (direction: number) => { const next = new Date(focusDate); if (mode === "month") next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + 7 * direction); setFocusDate(next); };
  return <div className="calendar-page"><div className="module-toolbar"><div><h2>Fælles kalender</h2><p>Måneder, uger og gentagne aftaler samlet ét sted.</p></div><button className="primary-button" onClick={() => setEditing(null)} type="button"><Plus size={16} /> Ny aftale</button></div><div className="calendar-controls"><div className="segmented"><button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")} type="button">Måned</button><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")} type="button">Uge</button></div><div className="calendar-period"><button aria-label="Forrige" onClick={() => move(-1)} type="button"><ChevronLeft size={17} /></button><strong>{mode === "month" ? monthFormatter.format(focusDate) : `${dayFormatter.format(range.start)} – ${dayFormatter.format(range.end)}`}</strong><button aria-label="Næste" onClick={() => move(1)} type="button"><ChevronRight size={17} /></button></div><button className="secondary-button compact" onClick={() => setFocusDate(new Date())} type="button">I dag</button></div><section className={`calendar-grid ${mode}`}><header>{["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => <span key={day}>{day}</span>)}</header><div>{days.map((day) => { const dayOccurrences = occurrences.filter((item) => new Date(item.occurrenceStart).toDateString() === day.toDateString()); const isOutside = mode === "month" && day.getMonth() !== focusDate.getMonth(); return <article className={isOutside ? "outside" : ""} key={day.toISOString()}><b>{day.getDate()}</b><div>{dayOccurrences.map((item) => <button key={`${item.id}-${item.occurrenceKey}`} onClick={() => setEditing(item)} type="button"><strong>{item.title}</strong><span>{item.allDay ? "Hele dagen" : timeFormatter.format(new Date(item.occurrenceStart))}{item.location ? ` · ${item.location}` : ""}</span></button>)}</div></article>; })}</div></section><section className="calendar-agenda"><h3>Kommende i visningen</h3>{occurrences.length ? occurrences.map((item) => <button key={`agenda-${item.id}-${item.occurrenceKey}`} onClick={() => setEditing(item)} type="button"><time>{dayFormatter.format(new Date(item.occurrenceStart))}</time><span><strong>{item.title}</strong><small><Clock3 size={13} />{item.allDay ? "Hele dagen" : timeFormatter.format(new Date(item.occurrenceStart))}{item.location ? <><MapPin size={13} />{item.location}</> : null}</small></span><ChevronRight size={16} /></button>) : <div className="empty-state"><CalendarDays size={18} />Ingen aftaler i denne periode</div>}</section>{editing !== undefined ? <EventModal assignees={assignees} initial={editing} onClose={() => setEditing(undefined)} onDelete={remove} onSave={save} /> : null}</div>;
}
