import { getSupabaseBrowserClient } from "./supabase-client";

export type CalendarRecurrence = "once" | "daily" | "weekly" | "monthly" | "yearly";
export type CalendarReminderOffset = 0 | 15 | 60 | 1440;

export type CalendarEvent = {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  assignedTo: string | null;
  recurrence: CalendarRecurrence;
  recurrenceInterval: number;
  recurrenceEndOn: string | null;
  reminderMinutes: CalendarReminderOffset | null;
};

export type CalendarEventException = {
  id: string;
  eventId: string;
  occurrenceStart: string;
  cancelled: boolean;
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  description: string | null;
  location: string | null;
};

export type CalendarOccurrence = CalendarEvent & {
  occurrenceKey: string;
  occurrenceStart: string;
  occurrenceEnd: string;
  isException: boolean;
};

export type CalendarAssignee = {
  userId: string;
  name: string;
};

export type NewCalendarEvent = Omit<CalendarEvent, "id" | "householdId">;

function mapEvent(row: Record<string, unknown>, reminderMinutes: CalendarReminderOffset | null): CalendarEvent {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    allDay: Boolean(row.all_day),
    timezone: String(row.timezone ?? "Europe/Copenhagen"),
    assignedTo: typeof row.assigned_to === "string" ? row.assigned_to : null,
    recurrence: row.recurrence as CalendarRecurrence,
    recurrenceInterval: Number(row.recurrence_interval ?? 1),
    recurrenceEndOn: typeof row.recurrence_end_on === "string" ? row.recurrence_end_on : null,
    reminderMinutes,
  };
}

export async function loadCalendar(householdId: string) {
  const supabase = getSupabaseBrowserClient();
  const [eventsResult, exceptionsResult, remindersResult, membersResult] = await Promise.all([
    supabase.from("calendar_events").select("*").eq("household_id", householdId).order("starts_at"),
    supabase.from("calendar_event_exceptions").select("*").eq("household_id", householdId).order("occurrence_start"),
    supabase.from("calendar_event_reminders").select("event_id, minutes_before").eq("household_id", householdId),
    supabase.from("household_members").select("user_id").eq("household_id", householdId),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;
  if (remindersResult.error) throw remindersResult.error;
  if (membersResult.error) throw membersResult.error;
  const memberIds = (membersResult.data ?? []).map((row) => row.user_id);
  const profilesResult = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;
  const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
  const reminderByEvent = new Map((remindersResult.data ?? []).map((row) => [row.event_id, row.minutes_before as CalendarReminderOffset]));
  return {
    events: (eventsResult.data ?? []).map((row) => mapEvent(row, reminderByEvent.get(row.id) ?? null)),
    exceptions: (exceptionsResult.data ?? []).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      occurrenceStart: row.occurrence_start,
      cancelled: row.cancelled,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      description: row.description,
      location: row.location,
    })),
    assignees: memberIds.map((userId) => ({
      userId,
      name: profileNames.get(userId) || "Husstandsmedlem",
    } satisfies CalendarAssignee)),
  };
}

export async function saveCalendarEvent(householdId: string, userId: string, event: NewCalendarEvent, eventId?: string) {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    household_id: householdId,
    title: event.title.trim(),
    description: event.description?.trim() || null,
    location: event.location?.trim() || null,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    all_day: event.allDay,
    timezone: event.timezone,
    assigned_to: event.assignedTo,
    recurrence: event.recurrence,
    recurrence_interval: event.recurrenceInterval,
    recurrence_end_on: event.recurrenceEndOn,
  };
  const result = eventId
    ? await supabase.from("calendar_events").update(payload).eq("id", eventId).eq("household_id", householdId).select("id").single()
    : await supabase.from("calendar_events").insert({ ...payload, created_by: userId }).select("id").single();
  if (result.error) throw result.error;
  if (event.reminderMinutes === null) {
    const reminder = await supabase.from("calendar_event_reminders").delete().eq("event_id", result.data.id).eq("household_id", householdId);
    if (reminder.error) throw reminder.error;
  } else {
    const reminder = await supabase.from("calendar_event_reminders").upsert({
      household_id: householdId,
      event_id: result.data.id,
      minutes_before: event.reminderMinutes,
      channels: ["in_app", "email"],
    }, { onConflict: "event_id" });
    if (reminder.error) throw reminder.error;
  }
  return result.data.id;
}

export async function saveCalendarOccurrenceException(
  householdId: string,
  userId: string,
  event: CalendarOccurrence,
  changes: Partial<Pick<CalendarEventException, "cancelled" | "title" | "startsAt" | "endsAt" | "description" | "location">>,
) {
  const { error } = await getSupabaseBrowserClient().from("calendar_event_exceptions").upsert({
    household_id: householdId,
    event_id: event.id,
    occurrence_start: event.occurrenceKey,
    cancelled: changes.cancelled ?? false,
    title: changes.title ?? null,
    starts_at: changes.startsAt ?? null,
    ends_at: changes.endsAt ?? null,
    description: changes.description ?? null,
    location: changes.location ?? null,
    created_by: userId,
  }, { onConflict: "event_id,occurrence_start" });
  if (error) throw error;
}

export async function deleteCalendarEvent(householdId: string, eventId: string) {
  const { error } = await getSupabaseBrowserClient().from("calendar_events").delete().eq("id", eventId).eq("household_id", householdId);
  if (error) throw error;
}

function addMonthsPreservingDay(date: Date, count: number, preferredDay: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + count);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(preferredDay, lastDay));
  return next;
}

function addYearsPreservingDay(date: Date, count: number, month: number, preferredDay: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setFullYear(next.getFullYear() + count);
  next.setMonth(month);
  const lastDay = new Date(next.getFullYear(), month + 1, 0).getDate();
  next.setDate(Math.min(preferredDay, lastDay));
  return next;
}

function nextOccurrence(date: Date, event: CalendarEvent, preferredDay: number, preferredMonth: number) {
  if (event.recurrence === "daily") {
    const next = new Date(date);
    next.setDate(next.getDate() + event.recurrenceInterval);
    return next;
  }
  if (event.recurrence === "weekly") {
    const next = new Date(date);
    next.setDate(next.getDate() + (7 * event.recurrenceInterval));
    return next;
  }
  if (event.recurrence === "monthly") return addMonthsPreservingDay(date, event.recurrenceInterval, preferredDay);
  if (event.recurrence === "yearly") return addYearsPreservingDay(date, event.recurrenceInterval, preferredMonth, preferredDay);
  return null;
}

export function expandCalendarEvents(events: CalendarEvent[], exceptions: CalendarEventException[], rangeStart: Date, rangeEnd: Date) {
  const exceptionMap = new Map(exceptions.map((item) => [`${item.eventId}:${item.occurrenceStart}`, item]));
  const occurrences: CalendarOccurrence[] = [];
  for (const event of events) {
    const baseStart = new Date(event.startsAt);
    const duration = new Date(event.endsAt).getTime() - baseStart.getTime();
    const recurrenceLimit = event.recurrenceEndOn ? new Date(`${event.recurrenceEndOn}T23:59:59`) : rangeEnd;
    const preferredDay = baseStart.getDate();
    const preferredMonth = baseStart.getMonth();
    let cursor: Date | null = new Date(baseStart);
    let guard = 0;
    while (cursor && cursor <= rangeEnd && cursor <= recurrenceLimit && guard < 2000) {
      const occurrenceKey = cursor.toISOString();
      const exception = exceptionMap.get(`${event.id}:${occurrenceKey}`);
      if (cursor >= rangeStart && !exception?.cancelled) {
        occurrences.push({
          ...event,
          title: exception?.title ?? event.title,
          description: exception?.description ?? event.description,
          location: exception?.location ?? event.location,
          occurrenceKey,
          occurrenceStart: exception?.startsAt ?? occurrenceKey,
          occurrenceEnd: exception?.endsAt ?? new Date(cursor.getTime() + duration).toISOString(),
          isException: Boolean(exception),
        });
      }
      if (event.recurrence === "once") break;
      cursor = nextOccurrence(cursor, event, preferredDay, preferredMonth);
      guard += 1;
    }
  }
  return occurrences.sort((a, b) => a.occurrenceStart.localeCompare(b.occurrenceStart));
}
