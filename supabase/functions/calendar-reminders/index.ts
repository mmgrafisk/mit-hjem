import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { dueReminderOccurrences, type ReminderEvent, type ReminderException } from "../_shared/calendar-recurrence.ts";
import { reminderChannelIsAvailable, type ReminderChannel } from "../_shared/reminder-channels.ts";

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");
    if (!url || !serviceKey) throw new Error("Påmindelsesservicen mangler Supabase-konfiguration.");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const suppliedSecret = request.headers.get("x-cron-secret");
    if (!suppliedSecret) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data: authorized, error: authorizationError } = await supabase.rpc("verify_calendar_reminder_cron_secret", { candidate: suppliedSecret });
    if (authorizationError) throw new Error("Påmindelsesservicen kunne ikke kontrollere cron-kaldet.");
    if (!authorized) return jsonResponse({ error: "Unauthorized" }, 401);
    const now = new Date(); const from = new Date(now.getTime() - 2 * 60000); const to = new Date(now.getTime() + 4 * 60000);
    const { data: reminders, error } = await supabase.from("calendar_event_reminders").select("minutes_before, channels, calendar_events(*)");
    if (error) throw error;
    const eventIds = (reminders ?? []).map((reminder) => (reminder.calendar_events as ReminderEvent | null)?.id).filter((id): id is string => Boolean(id));
    const exceptionsResult = eventIds.length
      ? await supabase.from("calendar_event_exceptions").select("event_id, occurrence_start, cancelled, starts_at, title, description").in("event_id", eventIds)
      : { data: [] as ReminderException[], error: null };
    if (exceptionsResult.error) throw exceptionsResult.error;
    const exceptions = (exceptionsResult.data ?? []) as ReminderException[];
    let delivered = 0;
    let skippedEmail = 0;
    for (const reminder of reminders ?? []) {
      const event = reminder.calendar_events as ReminderEvent | null; if (!event) continue;
      let occurrences;
      try {
        occurrences = dueReminderOccurrences(event, reminder.minutes_before, from, to, exceptions);
      } catch (eventReason) {
        console.error("Kalenderaftalen blev sprunget over, fordi den ikke kunne behandles.", {
          eventId: event.id,
          reason: eventReason instanceof Error ? eventReason.message : "Ukendt fejl",
        });
        continue;
      }
      if (!occurrences.length) continue;
      let memberQuery = supabase.from("household_members").select("user_id").eq("household_id", event.household_id);
      if (event.assigned_to) memberQuery = memberQuery.eq("user_id", event.assigned_to);
      const { data: members, error: membersError } = await memberQuery;
      if (membersError) throw membersError;
      for (const occurrence of occurrences) for (const member of members ?? []) {
        const { data: preferences } = await supabase.from("notification_preferences").select("in_app_enabled, email_enabled").eq("user_id", member.user_id).maybeSingle();
        for (const channel of reminder.channels as ReminderChannel[]) {
          if (channel === "in_app" && preferences?.in_app_enabled === false) continue;
          if (channel === "email" && preferences?.email_enabled === false) continue;
          if (!reminderChannelIsAvailable(channel, { resendKey, resendFrom })) {
            skippedEmail += 1;
            continue;
          }
          const occurrenceIso = occurrence.occurrenceKey;
          const { error: deliveryError } = await supabase.from("calendar_reminder_deliveries").insert({ household_id: event.household_id, event_id: event.id, occurrence_start: occurrenceIso, user_id: member.user_id, channel, status: "queued", attempted_at: now.toISOString() });
          if (deliveryError?.code === "23505") continue;
          if (deliveryError) throw deliveryError;
          try {
            if (channel === "in_app") {
              const { error: notificationError } = await supabase.from("notifications").upsert({ household_id: event.household_id, user_id: member.user_id, event_id: event.id, occurrence_start: occurrenceIso, title: occurrence.title, body: occurrence.description }, { onConflict: "user_id,event_id,occurrence_start" });
              if (notificationError) throw notificationError;
            } else {
              const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
              if (!userData.user?.email) throw new Error("Brugeren har ingen e-mailadresse.");
              const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey!}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: resendFrom!, to: [userData.user.email], subject: `Påmindelse: ${occurrence.title}`, html: `<div style="font-family:Arial,sans-serif"><h2>${escapeHtml(occurrence.title)}</h2><p>${new Intl.DateTimeFormat("da-DK", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone || "Europe/Copenhagen" }).format(occurrence.startsAt)}</p><p>${escapeHtml(occurrence.description ?? "")}</p></div>` }) });
              if (!mail.ok) throw new Error("Resend afviste mailen.");
            }
            await supabase.from("calendar_reminder_deliveries").update({ status: "sent", sent_at: new Date().toISOString() }).match({ event_id: event.id, occurrence_start: occurrenceIso, user_id: member.user_id, channel }); delivered += 1;
          } catch (deliveryReason) { await supabase.from("calendar_reminder_deliveries").update({ status: "failed", error_message: deliveryReason instanceof Error ? deliveryReason.message : "Ukendt fejl" }).match({ event_id: event.id, occurrence_start: occurrenceIso, user_id: member.user_id, channel }); }
        }
      }
    }
    return jsonResponse({ ok: true, delivered, skippedEmail });
  } catch (reason) { return jsonResponse({ error: reason instanceof Error ? reason.message : "Påmindelserne kunne ikke behandles." }, 500); }
});
