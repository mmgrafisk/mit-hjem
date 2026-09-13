import { getSupabaseBrowserClient } from "./supabase-client";

export type HouseholdNotification = { id: string; title: string; body: string | null; createdAt: string; readAt: string | null };
export type NotificationPreferences = { inAppEnabled: boolean; emailEnabled: boolean };

export async function loadNotifications(householdId: string, userId: string) {
  const { data, error } = await getSupabaseBrowserClient().from("notifications").select("id, title, body, created_at, read_at").eq("household_id", householdId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at, readAt: row.read_at }));
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const { error } = await getSupabaseBrowserClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", userId);
  if (error) throw error;
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await getSupabaseBrowserClient().from("notification_preferences").select("in_app_enabled, email_enabled").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return { inAppEnabled: data?.in_app_enabled ?? true, emailEnabled: data?.email_enabled ?? false };
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  const { error } = await getSupabaseBrowserClient().from("notification_preferences").upsert({ user_id: userId, in_app_enabled: preferences.inAppEnabled, email_enabled: preferences.emailEnabled }, { onConflict: "user_id" });
  if (error) throw error;
}
