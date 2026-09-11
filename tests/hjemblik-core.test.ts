import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { expandCalendarEvents, type CalendarEvent } from "../app/calendar-data";
import { aggregateIngredients, type MealPlanItem } from "../app/meal-plan-data";

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

test("kerne-migrationen har RLS, ejerrolle, token-hash og idempotente leveringer", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260911113904_add_hjemblik_core_features.sql", import.meta.url), "utf8");
  assert.match(sql, /role in \('owner', 'member'\)/);
  assert.match(sql, /token_hash text not null unique/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /unique \(event_id, occurrence_start, user_id, channel\)/);
  assert.match(sql, /accept_household_invitation/);
});

