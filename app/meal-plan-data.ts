import { getSupabaseBrowserClient } from "./supabase-client";

export type MealIngredient = { id?: string; name: string; quantity: number | null; unit: string | null };
export type MealPlanItem = {
  id: string;
  mealPlanId: string;
  dayOfWeek: number;
  mealSlot: number;
  title: string;
  servings: number;
  durationMinutes: number | null;
  notes: string | null;
  ingredients: MealIngredient[];
};

export type NewMealPlanItem = Omit<MealPlanItem, "id" | "mealPlanId">;

export function nextMealSlot(items: MealPlanItem[], dayOfWeek: number) {
  const occupied = new Set(items.filter((item) => item.dayOfWeek === dayOfWeek).map((item) => item.mealSlot));
  for (let slot = 1; slot <= 6; slot += 1) {
    if (!occupied.has(slot)) return slot;
  }
  return null;
}

export function mondayFor(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export async function loadMealPlan(householdId: string, weekStart: string) {
  const supabase = getSupabaseBrowserClient();
  const planResult = await supabase.from("meal_plans").select("id").eq("household_id", householdId).eq("week_start", weekStart).maybeSingle();
  if (planResult.error) throw planResult.error;
  if (!planResult.data) return { planId: null, items: [] as MealPlanItem[] };
  const [itemsResult, ingredientsResult] = await Promise.all([
    supabase.from("meal_plan_items").select("*").eq("household_id", householdId).eq("meal_plan_id", planResult.data.id).order("day_of_week").order("meal_slot"),
    supabase.from("meal_plan_ingredients").select("*").eq("household_id", householdId),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (ingredientsResult.error) throw ingredientsResult.error;
  return {
    planId: planResult.data.id,
    items: (itemsResult.data ?? []).map((row) => ({
      id: row.id,
      mealPlanId: row.meal_plan_id,
      dayOfWeek: row.day_of_week,
      mealSlot: row.meal_slot,
      title: row.title,
      servings: row.servings,
      durationMinutes: row.duration_minutes,
      notes: row.notes,
      ingredients: (ingredientsResult.data ?? []).filter((ingredient) => ingredient.meal_plan_item_id === row.id).map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
    })),
  };
}

export async function saveMealPlanItem(householdId: string, userId: string, weekStart: string, item: NewMealPlanItem, itemId?: string) {
  const supabase = getSupabaseBrowserClient();
  let plan = await supabase.from("meal_plans").select("id").eq("household_id", householdId).eq("week_start", weekStart).maybeSingle();
  if (plan.error) throw plan.error;
  if (!plan.data) {
    plan = await supabase.from("meal_plans").insert({ household_id: householdId, week_start: weekStart, created_by: userId }).select("id").single();
    if (plan.error) throw plan.error;
  }
  const payload = {
    household_id: householdId,
    meal_plan_id: plan.data.id,
    day_of_week: item.dayOfWeek,
    meal_slot: item.mealSlot,
    title: item.title.trim(),
    servings: item.servings,
    duration_minutes: item.durationMinutes,
    notes: item.notes?.trim() || null,
  };
  const saved = itemId
    ? await supabase.from("meal_plan_items").update(payload).eq("id", itemId).eq("household_id", householdId).select("id").single()
    : await supabase.from("meal_plan_items").insert(payload).select("id").single();
  if (saved.error) throw saved.error;
  const deleted = await supabase.from("meal_plan_ingredients").delete().eq("meal_plan_item_id", saved.data.id).eq("household_id", householdId);
  if (deleted.error) throw deleted.error;
  if (item.ingredients.length) {
    const inserted = await supabase.from("meal_plan_ingredients").insert(item.ingredients.map((ingredient) => ({
      household_id: householdId,
      meal_plan_item_id: saved.data.id,
      name: ingredient.name.trim(),
      quantity: ingredient.quantity,
      unit: ingredient.unit?.trim().toLocaleLowerCase("da-DK") || null,
    })));
    if (inserted.error) throw inserted.error;
  }
  return saved.data.id;
}

export async function deleteMealPlanItem(householdId: string, itemId: string) {
  const { error } = await getSupabaseBrowserClient().from("meal_plan_items").delete().eq("id", itemId).eq("household_id", householdId);
  if (error) throw error;
}

export function aggregateIngredients(items: MealPlanItem[]) {
  const grouped = new Map<string, { name: string; quantity: number | null; unit: string | null }>();
  for (const ingredient of items.flatMap((item) => item.ingredients)) {
    const name = ingredient.name.trim();
    if (!name) continue;
    const unit = ingredient.unit?.trim().toLocaleLowerCase("da-DK") || null;
    const key = `${name.toLocaleLowerCase("da-DK")}::${unit ?? ""}`;
    const current = grouped.get(key);
    grouped.set(key, {
      name: current?.name ?? name,
      unit,
      quantity: current?.quantity === null || ingredient.quantity === null ? null : (current?.quantity ?? 0) + ingredient.quantity,
    });
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "da"));
}

export type ShoppingQuantity = { quantity: number | null; unit: string | null };

export function parseShoppingQuantity(value: string | null): ShoppingQuantity {
  const normalized = value?.trim() ?? "";
  if (!normalized) return { quantity: null, unit: null };
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/u);
  if (!match) return { quantity: null, unit: normalized.toLocaleLowerCase("da-DK") };
  return {
    quantity: Number(match[1].replace(",", ".")),
    unit: match[2].trim().toLocaleLowerCase("da-DK") || null,
  };
}

export function formatShoppingQuantity(value: ShoppingQuantity) {
  if (value.quantity === null) return value.unit;
  return `${value.quantity.toLocaleString("da-DK")} ${value.unit ?? ""}`.trim();
}

export function mergeShoppingQuantity(current: ShoppingQuantity, incoming: ShoppingQuantity): ShoppingQuantity {
  if (current.quantity !== null && incoming.quantity !== null) {
    return { quantity: current.quantity + incoming.quantity, unit: incoming.unit };
  }
  if (current.quantity !== null) return current;
  if (incoming.quantity !== null) return incoming;
  return { quantity: null, unit: incoming.unit ?? current.unit };
}

export async function addIngredientsToShoppingList(householdId: string, userId: string, items: MealPlanItem[]) {
  const supabase = getSupabaseBrowserClient();
  const ingredients = aggregateIngredients(items);
  const currentResult = await supabase.from("shopping_items").select("id, title, quantity").eq("household_id", householdId).is("completed_at", null);
  if (currentResult.error) throw currentResult.error;
  const currentByKey = new Map((currentResult.data ?? []).map((row) => {
    const parsed = parseShoppingQuantity(row.quantity);
    return [`${row.title.trim().toLocaleLowerCase("da-DK")}::${parsed.unit ?? ""}`, { ...row, parsed }] as const;
  }));
  for (const ingredient of ingredients) {
    const key = `${ingredient.name.toLocaleLowerCase("da-DK")}::${ingredient.unit ?? ""}`;
    const incoming = { quantity: ingredient.quantity, unit: ingredient.unit };
    const existing = currentByKey.get(key);
    if (existing) {
      const updated = await supabase.from("shopping_items").update({ quantity: formatShoppingQuantity(mergeShoppingQuantity(existing.parsed, incoming)) }).eq("id", existing.id).eq("household_id", householdId);
      if (updated.error) throw updated.error;
    } else {
      const inserted = await supabase.from("shopping_items").insert({ household_id: householdId, created_by: userId, title: ingredient.name, quantity: formatShoppingQuantity(incoming) });
      if (inserted.error) throw inserted.error;
    }
  }
  return ingredients.length;
}
