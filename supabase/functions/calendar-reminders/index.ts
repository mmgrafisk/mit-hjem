import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type EventRow = { id: string; household_id: string; title: string; description: string | null; starts_at: string; ends_at: string; recurrence: "once" | "daily" | "weekly" | "monthly" | "yearly"; recurrence_interval: number; recurrence_end_on: string | null };
function nextOccurrence(date: Date, event: EventRow, day: number, month: number) { const next = new Date(date); if (event.recurrence === "daily") next.setUTCDate(next.getUTCDate() + event.recurrence_interval); else if (event.recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7 * event.recurrence_interval); else if (event.recurrence === "monthly") { next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + event.recurrence_interval); next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate())); } else if (event.recurrence === "yearly") { next.setUTCDate(1); next.setUTCFullYear(next.getUTCFullYear() + event.recurrence_interval); next.setUTCMonth(month); next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), month + 1, 0)).getUTCDate())); } return next; }
function dueOccurrences(event: EventRow, minutesBefore: number, from: Date, to: Date) { const due: Date[] = []; let occurrence = new Date(event.starts_at); const day = occurrence.getUTCDate(); const month = occurrence.getUTCMonth(); const limit = event.recurrence_end_on ? new Date(`${event.recurrence_end_on}T23:59:59Z`) : to; let guard = 0; while (occurrence <= to && occurrence <= limit && guard < 5000) { const reminderAt = new Date(occurrence.getTime() - minutesBefore * 60000); if (reminderAt >= from && reminderAt <= to) due.push(new Date(occurrence)); if (event.recurrence === "once") break; occurrence = nextOccurrence(occurrence, event, day, month); guard += 1; } return due; }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expectedSecret = Deno.env.get("CALENDAR_REMINDER_CRON_SECRET");
  if (!expectedSecret || request.headers.get("x-cron-secret") !== expectedSecret) return jsonResponse({ error: "Unauthorized" }, 401);
  try {
    const url = Deno.env.get("SUPABASE_URL"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const resendKey = Deno.env.get("RESEND_API_KEY"); const resendFrom = Deno.env.get("RESEND_FROM");
    if (!url || !serviceKey || !resendKey || !resendFrom) throw new Error("Påmindelsesservicen mangler konfiguration.");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const now = new Date(); const from = new Date(now.getTime() - 2 * 60000); const to = new Date(now.getTime() + 4 * 60000);
    const { data: reminders, error } = await supabase.from("calendar_event_reminders").select("minutes_before, channels, calendar_events(*)");
    if (error) throw error;
    let delivered = 0;
    for (const reminder of reminders ?? []) {
      const event = reminder.calendar_events as EventRow | null; if (!event) continue;
      const occurrences = dueOccurrences(event, reminder.minutes_before, from, to);
      if (!occurrences.length) continue;
      const { data: members } = await supabase.from("household_members").select("user_id").eq("household_id", event.household_id);
      for (const occurrence of occurrences) for (const member of members ?? []) {
        const { data: preferences } = await supabase.from("notification_preferences").select("in_app_enabled, email_enabled").eq("user_id", member.user_id).maybeSingle();
        for (const channel of reminder.channels as Array<"in_app" | "email">) {
          if (channel === "in_app" && preferences?.in_app_enabled === false) continue;
          if (channel === "email" && preferences?.email_enabled === false) continue;
          const occurrenceIso = occurrence.toISOString();
          const { error: deliveryError } = await supabase.from("calendar_reminder_deliveries").insert({ household_id: event.household_id, event_id: event.id, occurrence_start: occurrenceIso, user_id: member.user_id, channel, status: "queued", attempted_at: now.toISOString() });
          if (deliveryError?.code === "23505") continue;
          if (deliveryError) throw deliveryError;
          try {
            if (channel === "in_app") {
              const { error: notificationError } = await supabase.from("notifications").upsert({ household_id: event.household_id, user_id: member.user_id, event_id: event.id, occurrence_start: occurrenceIso, title: event.title, body: event.description }, { onConflict: "user_id,event_id,occurrence_start" });
              if (notificationError) throw notificationError;
            } else {
              const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
              if (userData.user?.email) {
                const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: resendFrom, to: [userData.user.email], subject: `Påmindelse: ${event.title}`, html: `<div style="font-family:Arial,sans-serif"><h2>${event.title}</h2><p>${new Intl.DateTimeFormat("da-DK", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(occurrence)}</p><p>${event.description ?? ""}</p></div>` }) });
                if (!mail.ok) throw new Error("Resend afviste mailen.");
              }
            }
            await supabase.from("calendar_reminder_deliveries").update({ status: "sent", sent_at: new Date().toISOString() }).match({ event_id: event.id, occurrence_start: occurrenceIso, user_id: member.user_id, channel }); delivered += 1;
          } catch (deliveryReason) { await supabase.from("calendar_reminder_deliveries").update({ status: "failed", error_message: deliveryReason instanceof Error ? deliveryReason.message : "Ukendt fejl" }).match({ event_id: event.id, occurrence_start: occurrenceIso, user_id: member.user_id, channel }); }
        }
      }
    }
    return jsonResponse({ ok: true, delivered });
  } catch (reason) { return jsonResponse({ error: reason instanceof Error ? reason.message : "Påmindelserne kunne ikke behandles." }, 500); }
});

