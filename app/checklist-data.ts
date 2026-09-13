import { getSupabaseBrowserClient } from "./supabase-client";

export type TaskItem = {
  id: string | number;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  dueAt: string | null;
  recurrence: string | null;
  createdBy: string | null;
  done: boolean;
};

export type ShoppingListItem = {
  id: string | number;
  title: string;
  quantity: string | null;
  createdBy: string | null;
  done: boolean;
};

export type TaskInput = {
  title: string;
  description: string | null;
  assignedTo: string | null;
  dueAt: string | null;
};

export type ShoppingInput = {
  title: string;
  quantity: string | null;
};

function recurrenceLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const frequency = "frequency" in value ? value.frequency : null;
  if (frequency === "daily") return "Hver dag";
  if (frequency === "weekly") return "Hver uge";
  if (frequency === "monthly") return "Hver måned";
  return null;
}

export function taskMeta(item: TaskItem) {
  const parts: string[] = [];
  if (item.dueAt) parts.push(new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.dueAt)));
  if (item.assignedName) parts.push(item.assignedName);
  if (item.recurrence) parts.push(item.recurrence);
  return parts.join(" · ") || "Ingen frist";
}

export async function loadTasks(householdId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, description, assigned_to, due_at, completed_at, recurrence, created_by")
    .eq("household_id", householdId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const assignedIds = [...new Set((data ?? []).map((item) => item.assigned_to).filter((value): value is string => Boolean(value)))];
  const profilesResult = assignedIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assignedIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;
  const names = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name || "Husstandsmedlem"]));

  return (data ?? []).map<TaskItem>((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    assignedTo: item.assigned_to,
    assignedName: item.assigned_to ? names.get(item.assigned_to) || "Husstandsmedlem" : null,
    dueAt: item.due_at,
    recurrence: recurrenceLabel(item.recurrence),
    createdBy: item.created_by,
    done: Boolean(item.completed_at),
  }));
}

export async function saveTask(householdId: string, userId: string, input: TaskInput, taskId?: string) {
  const supabase = getSupabaseBrowserClient();
  const values = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assigned_to: input.assignedTo || null,
    due_at: input.dueAt,
  };
  const result = taskId
    ? await supabase.from("tasks").update(values).eq("id", taskId).eq("household_id", householdId)
    : await supabase.from("tasks").insert({ ...values, household_id: householdId, created_by: userId });
  if (result.error) throw result.error;
}

export async function setTaskCompleted(householdId: string, taskId: string, completed: boolean) {
  const { error } = await getSupabaseBrowserClient().from("tasks").update({ completed_at: completed ? new Date().toISOString() : null }).eq("id", taskId).eq("household_id", householdId);
  if (error) throw error;
}

export async function deleteTask(householdId: string, taskId: string) {
  const { error } = await getSupabaseBrowserClient().from("tasks").delete().eq("id", taskId).eq("household_id", householdId);
  if (error) throw error;
}

export async function loadShoppingItems(householdId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("shopping_items")
    .select("id, title, quantity, completed_at, created_by")
    .eq("household_id", householdId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map<ShoppingListItem>((item) => ({ id: item.id, title: item.title, quantity: item.quantity, createdBy: item.created_by, done: Boolean(item.completed_at) }));
}

export async function saveShoppingItem(householdId: string, userId: string, input: ShoppingInput, itemId?: string) {
  const values = { title: input.title.trim(), quantity: input.quantity?.trim() || null };
  const result = itemId
    ? await getSupabaseBrowserClient().from("shopping_items").update(values).eq("id", itemId).eq("household_id", householdId)
    : await getSupabaseBrowserClient().from("shopping_items").insert({ ...values, household_id: householdId, created_by: userId });
  if (result.error) throw result.error;
}

export async function setShoppingItemCompleted(householdId: string, itemId: string, completed: boolean) {
  const { error } = await getSupabaseBrowserClient().from("shopping_items").update({ completed_at: completed ? new Date().toISOString() : null }).eq("id", itemId).eq("household_id", householdId);
  if (error) throw error;
}

export async function deleteShoppingItem(householdId: string, itemId: string) {
  const { error } = await getSupabaseBrowserClient().from("shopping_items").delete().eq("id", itemId).eq("household_id", householdId);
  if (error) throw error;
}

export async function clearCompletedShoppingItems(householdId: string, itemIds: string[]) {
  if (!itemIds.length) return;
  const { error } = await getSupabaseBrowserClient().from("shopping_items").delete().eq("household_id", householdId).in("id", itemIds).not("completed_at", "is", null);
  if (error) throw error;
}
