import { getSupabaseBrowserClient } from "./supabase-client";

export type HouseholdRole = "owner" | "member";
export type HouseholdMember = { userId: string; role: HouseholdRole; joinedAt: string; name: string; email: string | null };
export type HouseholdInvitation = { id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };

export async function loadHouseholdAccess(householdId: string, currentUserId: string, currentUserEmail: string, currentDisplayName: string) {
  const supabase = getSupabaseBrowserClient();
  const [membersResult, invitesResult] = await Promise.all([
    supabase.from("household_members").select("user_id, role, joined_at").eq("household_id", householdId).order("joined_at"),
    supabase.from("household_invitations").select("id, email, expires_at, accepted_at, revoked_at").eq("household_id", householdId).order("created_at", { ascending: false }),
  ]);
  if (membersResult.error) throw membersResult.error;
  const memberIds = (membersResult.data ?? []).map((row) => row.user_id);
  const profilesResult = memberIds.length ? await supabase.from("profiles").select("id, full_name").in("id", memberIds) : { data: [], error: null };
  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
  const members: HouseholdMember[] = (membersResult.data ?? []).map((row) => ({
    userId: row.user_id,
    role: row.role as HouseholdRole,
    joinedAt: row.joined_at,
    name: row.user_id === currentUserId ? currentDisplayName : profileById.get(row.user_id) || "Husstandsmedlem",
    email: row.user_id === currentUserId ? currentUserEmail : null,
  }));
  return {
    members,
    invitations: invitesResult.error ? [] : (invitesResult.data ?? []).map((row) => ({ id: row.id, email: row.email, expiresAt: row.expires_at, acceptedAt: row.accepted_at, revokedAt: row.revoked_at })),
    isOwner: members.some((member) => member.userId === currentUserId && member.role === "owner"),
  };
}

export async function sendHouseholdInvitation(householdId: string, email: string) {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke("household-invitations", {
    body: { action: "create", householdId, email: email.trim().toLocaleLowerCase("da-DK") },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function revokeHouseholdInvitation(householdId: string, invitationId: string) {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke("household-invitations", {
    body: { action: "revoke", householdId, invitationId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function removeHouseholdMember(householdId: string, memberUserId: string) {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke("household-invitations", {
    body: { action: "remove-member", householdId, memberUserId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function acceptHouseholdInvitation(token: string) {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke("household-invitations", {
    body: { action: "accept", token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.householdId as string;
}
