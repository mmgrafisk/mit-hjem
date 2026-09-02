import { getSupabaseBrowserClient } from "./supabase-client";

export type SubscriptionStatus = "trial" | "active" | "cancelled";

export type Subscription = {
  id: string;
  name: string;
  websiteUrl: string | null;
  accountIdentifier: string | null;
  passwordManagerUrl: string | null;
  amount: number | null;
  billingIntervalMonths: number;
  trialEndsOn: string | null;
  cancellationDeadlineOn: string | null;
  nextPaymentOn: string | null;
  status: SubscriptionStatus;
  linkedTransactionId: string | null;
  linkedDocumentIds: string[];
};

export type NewSubscription = Omit<Subscription, "id">;

export function subscriptionIntervalLabel(months: number) {
  if (months === 1) return "Hver måned";
  if (months === 3) return "Hvert kvartal";
  if (months === 6) return "Hvert halve år";
  if (months === 12) return "Hvert år";
  return `Hver ${months}. måned`;
}

export async function loadSubscriptions(householdId: string): Promise<Subscription[]> {
  const supabase = getSupabaseBrowserClient();
  const [subscriptionsResult, linksResult] = await Promise.all([
    supabase.from("subscriptions").select("id, name, website_url, account_identifier, password_manager_url, amount, billing_interval_months, trial_ends_on, cancellation_deadline_on, next_payment_on, status, linked_transaction_id").eq("household_id", householdId).order("cancellation_deadline_on", { ascending: true, nullsFirst: false }).order("name"),
    supabase.from("subscription_documents").select("subscription_id, document_id").eq("household_id", householdId),
  ]);
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (linksResult.error) throw linksResult.error;
  const documentIdsBySubscription = new Map<string, string[]>();
  for (const link of linksResult.data ?? []) {
    documentIdsBySubscription.set(link.subscription_id, [...(documentIdsBySubscription.get(link.subscription_id) ?? []), link.document_id]);
  }
  return (subscriptionsResult.data ?? []).map((subscription) => ({
    id: subscription.id,
    name: subscription.name,
    websiteUrl: subscription.website_url,
    accountIdentifier: subscription.account_identifier,
    passwordManagerUrl: subscription.password_manager_url,
    amount: subscription.amount === null ? null : Number(subscription.amount),
    billingIntervalMonths: subscription.billing_interval_months,
    trialEndsOn: subscription.trial_ends_on,
    cancellationDeadlineOn: subscription.cancellation_deadline_on,
    nextPaymentOn: subscription.next_payment_on,
    status: subscription.status as SubscriptionStatus,
    linkedTransactionId: subscription.linked_transaction_id,
    linkedDocumentIds: documentIdsBySubscription.get(subscription.id) ?? [],
  }));
}

async function syncSubscriptionDocuments(householdId: string, userId: string, subscriptionId: string, documentIds: string[]) {
  const supabase = getSupabaseBrowserClient();
  const removed = await supabase.from("subscription_documents").delete().eq("household_id", householdId).eq("subscription_id", subscriptionId);
  if (removed.error) throw removed.error;
  const uniqueDocumentIds = [...new Set(documentIds)];
  if (!uniqueDocumentIds.length) return;
  const inserted = await supabase.from("subscription_documents").insert(uniqueDocumentIds.map((documentId) => ({ household_id: householdId, subscription_id: subscriptionId, document_id: documentId, created_by: userId })));
  if (inserted.error) throw inserted.error;
}

function subscriptionRow(subscription: NewSubscription) {
  return {
    name: subscription.name,
    website_url: subscription.websiteUrl || null,
    account_identifier: subscription.accountIdentifier || null,
    password_manager_url: subscription.passwordManagerUrl || null,
    amount: subscription.amount,
    billing_interval_months: subscription.billingIntervalMonths,
    trial_ends_on: subscription.trialEndsOn || null,
    cancellation_deadline_on: subscription.cancellationDeadlineOn || null,
    next_payment_on: subscription.nextPaymentOn || null,
    status: subscription.status,
    linked_transaction_id: subscription.linkedTransactionId || null,
  };
}

export async function addSubscription(householdId: string, userId: string, subscription: NewSubscription) {
  const supabase = getSupabaseBrowserClient();
  const result = await supabase.from("subscriptions").insert({ household_id: householdId, created_by: userId, ...subscriptionRow(subscription) }).select("id").single();
  if (result.error) throw result.error;
  await syncSubscriptionDocuments(householdId, userId, result.data.id, subscription.linkedDocumentIds);
}

export async function updateSubscription(householdId: string, userId: string, subscriptionId: string, subscription: NewSubscription) {
  const result = await getSupabaseBrowserClient().from("subscriptions").update(subscriptionRow(subscription)).eq("household_id", householdId).eq("id", subscriptionId).select("id").single();
  if (result.error) throw result.error;
  await syncSubscriptionDocuments(householdId, userId, subscriptionId, subscription.linkedDocumentIds);
}

export async function deleteSubscription(householdId: string, subscriptionId: string) {
  const result = await getSupabaseBrowserClient().from("subscriptions").delete().eq("household_id", householdId).eq("id", subscriptionId).select("id").single();
  if (result.error) throw result.error;
}
