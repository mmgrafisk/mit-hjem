export type ReminderEvent = {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  assigned_to: string | null;
  recurrence: "once" | "daily" | "weekly" | "monthly" | "yearly";
  recurrence_interval: number;
  recurrence_end_on: string | null;
};

export type ReminderException = {
  event_id: string;
  occurrence_start: string;
  cancelled: boolean;
  starts_at: string | null;
  title: string | null;
  description: string | null;
};

export type DueReminderOccurrence = {
  occurrenceKey: string;
  startsAt: Date;
  title: string;
  description: string | null;
};

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const existing = formatters.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values = Object.fromEntries(formatterFor(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function partsAsUtc(parts: ZonedParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function zonedDate(parts: ZonedParts, timeZone: string) {
  let timestamp = partsAsUtc(parts);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = zonedParts(new Date(timestamp), timeZone);
    const correction = partsAsUtc(parts) - partsAsUtc(observed);
    timestamp += correction;
    if (correction === 0) break;
  }
  return new Date(timestamp);
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addOccurrence(parts: ZonedParts, event: ReminderEvent, preferredDay: number, preferredMonth: number): ZonedParts {
  const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (event.recurrence === "daily") calendar.setUTCDate(calendar.getUTCDate() + event.recurrence_interval);
  if (event.recurrence === "weekly") calendar.setUTCDate(calendar.getUTCDate() + (7 * event.recurrence_interval));
  if (event.recurrence === "monthly") {
    calendar.setUTCDate(1);
    calendar.setUTCMonth(calendar.getUTCMonth() + event.recurrence_interval);
    calendar.setUTCDate(Math.min(preferredDay, lastDayOfMonth(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1)));
  }
  if (event.recurrence === "yearly") {
    calendar.setUTCDate(1);
    calendar.setUTCFullYear(calendar.getUTCFullYear() + event.recurrence_interval);
    calendar.setUTCMonth(preferredMonth - 1);
    calendar.setUTCDate(Math.min(preferredDay, lastDayOfMonth(calendar.getUTCFullYear(), preferredMonth)));
  }
  return {
    year: calendar.getUTCFullYear(),
    month: calendar.getUTCMonth() + 1,
    day: calendar.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function localDateKey(parts: ZonedParts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function dueReminderOccurrences(event: ReminderEvent, minutesBefore: number, from: Date, to: Date, exceptions: ReminderException[] = []) {
  const due: DueReminderOccurrence[] = [];
  const timeZone = event.timezone || "Europe/Copenhagen";
  const initialDate = new Date(event.starts_at);
  const initialParts = zonedParts(initialDate, timeZone);
  const preferredDay = initialParts.day;
  const preferredMonth = initialParts.month;
  const latestStart = new Date(to.getTime() + minutesBefore * 60_000);
  const exceptionByOccurrence = new Map(exceptions.filter((item) => item.event_id === event.id).map((item) => [new Date(item.occurrence_start).toISOString(), item]));
  let cursor = initialParts;
  let index = 0;
  while (index < 5000) {
    if (event.recurrence_end_on && localDateKey(cursor) > event.recurrence_end_on) break;
    const baseOccurrence = index === 0 ? initialDate : zonedDate(cursor, timeZone);
    if (baseOccurrence > latestStart) break;
    const occurrenceKey = baseOccurrence.toISOString();
    const exception = exceptionByOccurrence.get(occurrenceKey);
    if (!exception?.cancelled) {
      const startsAt = exception?.starts_at ? new Date(exception.starts_at) : baseOccurrence;
      const reminderAt = new Date(startsAt.getTime() - minutesBefore * 60_000);
      if (reminderAt >= from && reminderAt <= to) {
        due.push({
          occurrenceKey,
          startsAt,
          title: exception?.title ?? event.title,
          description: exception?.description ?? event.description,
        });
      }
    }
    if (event.recurrence === "once") break;
    cursor = addOccurrence(cursor, event, preferredDay, preferredMonth);
    index += 1;
  }
  return due;
}
