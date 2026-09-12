import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { expandCalendarEvents, type CalendarEvent } from "../app/calendar-data";
import { aggregateIngredients, mergeShoppingQuantity, nextMealSlot, parseShoppingQuantity, type MealPlanItem } from "../app/meal-plan-data";
import { dueReminderOccurrences, type ReminderEvent } from "../supabase/functions/_shared/calendar-recurrence";
import { reminderChannelIsAvailable } from "../supabase/functions/_shared/reminder-channels";

process.env.TZ = "Europe/Copenhagen";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: "event-1", householdId: "house-1", title: "Aftale", description: null, location: null, startsAt: "2028-01-31T08:00:00.000Z", endsAt: "2028-01-31T09:00:00.000Z", allDay: false, timezone: "Europe/Copenhagen", assignedTo: null, recurrence: "monthly", recurrenceInterval: 1, recurrenceEndOn: null, reminderMinutes: 60, ...overrides };
}

test("månedlig gentagelse bevarer månedsafslutninger", () => {
  const rows = expandCalendarEvents([event()], [], new Date("2028-01-01T00:00:00Z"), new Date("2028-04-01T00:00:00Z"));
  assert.deepEqual(rows.map((row) => row.occurrenceStart.slice(0, 10)), ["2028-01-31", "2028-02-29", "2028-03-31"]);
});

test("ugentlig gentagelse bevarer lokalt klokkeslæt over sommertid", () => {
  const rows = expandCalendarEvents([event({ startsAt: new Date(2028, 2, 20, 8, 0).toISOString(), endsAt: new Date(2028, 2, 20, 9, 0).toISOString(), recurrence: "weekly" })], [], new Date(2028, 2, 19), new Date(2028, 3, 10));
  assert.ok(rows.length >= 3);
  assert.deepEqual(rows.slice(0, 3).map((row) => new Date(row.occurrenceStart).getHours()), [8, 8, 8]);
});

test("undtagelse kan springe én kalenderforekomst over", () => {
  const source = event({ recurrence: "weekly" });
  const first = expandCalendarEvents([source], [], new Date("2028-01-01"), new Date("2028-02-29"));
  const skipped = expandCalendarEvents([source], [{ id: "x", eventId: source.id, occurrenceStart: first[1].occurrenceKey, cancelled: true, title: null, startsAt: null, endsAt: null, description: null, location: null }], new Date("2028-01-01"), new Date("2028-02-29"));
  assert.equal(skipped.some((row) => row.occurrenceKey === first[1].occurrenceKey), false);
});

test("identiske ingredienser med samme enhed samles", () => {
  const items: MealPlanItem[] = [
    { id: "1", mealPlanId: "p", dayOfWeek: 1, mealSlot: 1, title: "A", servings: 2, durationMinutes: 20, notes: null, ingredients: [{ name: "Tomater", quantity: 400, unit: "g" }] },
    { id: "2", mealPlanId: "p", dayOfWeek: 2, mealSlot: 1, title: "B", servings: 2, durationMinutes: 20, notes: null, ingredients: [{ name: "tomater", quantity: 250, unit: "G" }, { name: "Citron", quantity: 1, unit: "stk" }] },
  ];
  assert.deepEqual(aggregateIngredients(items), [{ name: "Citron", quantity: 1, unit: "stk" }, { name: "Tomater", quantity: 650, unit: "g" }]);
});

test("indkøbsmængder lægges til eksisterende varer med samme enhed", () => {
  const existing = parseShoppingQuantity("1,5 kg");
  assert.deepEqual(existing, { quantity: 1.5, unit: "kg" });
  assert.deepEqual(mergeShoppingQuantity(existing, { quantity: 0.75, unit: "kg" }), { quantity: 2.25, unit: "kg" });
  assert.notDeepEqual(parseShoppingQuantity("2 stk"), parseShoppingQuantity("2 kg"));
});

test("nyt måltid genbruger første ledige plads efter en sletning", () => {
  const items = [
    { id: "1", mealPlanId: "p", dayOfWeek: 1, mealSlot: 1, title: "A", servings: 2, durationMinutes: null, notes: null, ingredients: [] },
    { id: "3", mealPlanId: "p", dayOfWeek: 1, mealSlot: 3, title: "C", servings: 2, durationMinutes: null, notes: null, ingredients: [] },
    { id: "4", mealPlanId: "p", dayOfWeek: 1, mealSlot: 4, title: "D", servings: 2, durationMinutes: null, notes: null, ingredients: [] },
  ] satisfies MealPlanItem[];
  assert.equal(nextMealSlot(items, 1), 2);
  assert.equal(nextMealSlot(items, 2), 1);
  assert.equal(nextMealSlot([...items, { ...items[0], id: "2", mealSlot: 2 }, { ...items[0], id: "5", mealSlot: 5 }, { ...items[0], id: "6", mealSlot: 6 }], 1), null);
});

function reminderEvent(overrides: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    id: "event-1",
    household_id: "house-1",
    title: "Aftale",
    description: null,
    starts_at: "2028-03-20T07:00:00.000Z",
    ends_at: "2028-03-20T08:00:00.000Z",
    timezone: "Europe/Copenhagen",
    assigned_to: null,
    recurrence: "weekly",
    recurrence_interval: 1,
    recurrence_end_on: null,
    ...overrides,
  };
}

test("påmindelser bevarer lokalt klokkeslæt over sommertid", () => {
  const rows = dueReminderOccurrences(
    reminderEvent(),
    0,
    new Date("2028-04-03T05:59:00.000Z"),
    new Date("2028-04-03T06:01:00.000Z"),
  );
  assert.equal(rows.length, 1);
  assert.equal(new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }).format(rows[0].startsAt), "08.00");
});

test("påmindelser bruger flyttede forekomster og springer annullerede over", () => {
  const source = reminderEvent({ starts_at: "2028-01-01T09:00:00.000Z", recurrence: "daily" });
  const exceptions = [{ event_id: source.id, occurrence_start: "2028-01-02T09:00:00.000Z", cancelled: false, starts_at: "2028-01-02T11:00:00.000Z", title: "Flyttet", description: "Ny tid" }];
  const moved = dueReminderOccurrences(source, 60, new Date("2028-01-02T09:59:00.000Z"), new Date("2028-01-02T10:01:00.000Z"), exceptions);
  assert.deepEqual(moved.map((row) => [row.title, row.startsAt.toISOString()]), [["Flyttet", "2028-01-02T11:00:00.000Z"]]);
  const cancelled = dueReminderOccurrences(source, 60, new Date("2028-01-02T07:59:00.000Z"), new Date("2028-01-02T08:01:00.000Z"), [{ ...exceptions[0], cancelled: true, starts_at: null }]);
  assert.equal(cancelled.length, 0);
});

test("påmindelser kan udløses dagen før en fremtidig forekomst", () => {
  const rows = dueReminderOccurrences(reminderEvent({ starts_at: "2028-04-04T08:00:00.000Z", recurrence: "once" }), 1440, new Date("2028-04-03T07:59:00.000Z"), new Date("2028-04-03T08:01:00.000Z"));
  assert.equal(rows.length, 1);
});

test("in-app-påmindelser virker uden Resend", () => {
  assert.equal(reminderChannelIsAvailable("in_app", {}), true);
  assert.equal(reminderChannelIsAvailable("email", {}), false);
  assert.equal(reminderChannelIsAvailable("email", { resendKey: "key-only" }), false);
});

test("e-mailpåmindelser aktiveres først med komplet Resend-konfiguration", () => {
  assert.equal(reminderChannelIsAvailable("email", { resendKey: "re_test", resendFrom: "Hjemblik <hej@example.dk>" }), true);
});

test("ugyldige kalendertidszoner afvises i databasen", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260911151818_validate_calendar_timezones.sql", import.meta.url), "utf8");
  assert.match(sql, /pg_catalog\.pg_timezone_names/i);
  assert.match(sql, /create trigger calendar_events_validate_timezone/i);
});

test("kerne-migrationen har RLS, ejerrolle, token-hash og idempotente leveringer", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260911113904_add_hjemblik_core_features.sql", import.meta.url), "utf8");
  assert.match(sql, /role in \('owner', 'member'\)/);
  assert.match(sql, /token_hash text not null unique/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /unique \(event_id, occurrence_start, user_id, channel\)/);
  assert.match(sql, /accept_household_invitation/);
});

test("invitationsaccept er begrænset til serverens service role", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260911145511_harden_household_invitation_acceptance.sql", import.meta.url), "utf8");
  assert.match(sql, /create function public\.accept_household_invitation[\s\S]*?security invoker/i);
  assert.match(sql, /revoke all .* authenticated/i);
  assert.match(sql, /grant execute .* service_role/i);
});

test("cron-hemmeligheden valideres server-side og er ikke offentlig", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260911215156_verify_calendar_reminder_cron_secret.sql", import.meta.url), "utf8");
  const schedulerSql = await readFile(new URL("../supabase/migrations/20260912082000_restrict_reminder_scheduler.sql", import.meta.url), "utf8");
  assert.match(sql, /from vault\.decrypted_secrets/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all .* public, anon, authenticated/i);
  assert.match(sql, /grant execute .* service_role/i);
  assert.match(schedulerSql, /revoke all .* public, anon, authenticated/i);
});

test("førstegangsoprettelse af husstand er atomisk og kun tilgængelig efter login", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260912075000_finish_rls_household_bootstrap.sql", import.meta.url), "utf8");
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /membership_exists := found/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all .* public, anon/i);
  assert.match(sql, /grant execute .* authenticated/i);
});
