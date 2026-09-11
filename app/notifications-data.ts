import { getSupabaseBrowserClient } from "./supabase-client";

export type HouseholdNotification = { id: string; title: string; body: string | null; createdAt: string; readAt: string | null };

export async function loadNotifications(householdId: string, userId: string) {
  const { data, error } = await getSupabaseBrowserClient().from("notifications").select("id, title, body, created_at, read_at").eq("household_id", householdId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at, readAt: row.read_at }));
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const { error } = await getSupabaseBrowserClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", userId);
  if (error) throw error;
}

