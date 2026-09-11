import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const encoder = new TextEncoder();
function toHex(bytes: Uint8Array) { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function sha256(value: string) { return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
function randomToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return toHex(bytes); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Serverkonfigurationen mangler.");
    const authorization = request.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: "Log ind for at fortsætte." }, 401);
    const body = await request.json() as { action?: "create" | "revoke" | "accept" | "remove-member"; householdId?: string; email?: string; invitationId?: string; token?: string; memberUserId?: string };

    if (body.action === "accept") {
      if (!body.token) return jsonResponse({ error: "Invitationslinket mangler." }, 400);
      const { data, error } = await userClient.rpc("accept_household_invitation", { target_token_hash: await sha256(body.token) });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ householdId: data });
    }

    if (!body.householdId) return jsonResponse({ error: "Husstanden mangler." }, 400);
    const { data: owner } = await userClient.from("household_members").select("role").eq("household_id", body.householdId).eq("user_id", authData.user.id).maybeSingle();
    if (owner?.role !== "owner") return jsonResponse({ error: "Kun ejeren kan administrere husstanden." }, 403);

    if (body.action === "revoke") {
      if (!body.invitationId) return jsonResponse({ error: "Invitationen mangler." }, 400);
      const { error } = await admin.from("household_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", body.invitationId).eq("household_id", body.householdId).is("accepted_at", null);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (body.action === "remove-member") {
      if (!body.memberUserId || body.memberUserId === authData.user.id) return jsonResponse({ error: "Ejeren kan ikke fjerne sig selv." }, 400);
      const { error } = await admin.from("household_members").delete().eq("household_id", body.householdId).eq("user_id", body.memberUserId).eq("role", "member");
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    const email = body.email?.trim().toLocaleLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return jsonResponse({ error: "E-mailadressen er ugyldig." }, 400);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");
    const appUrl = Deno.env.get("APP_URL")?.replace(/\/$/, "");
    if (!resendKey || !resendFrom || !appUrl) return jsonResponse({ error: "E-mailafsenderen er ikke konfigureret endnu." }, 503);
    await admin.from("household_invitations").update({ revoked_at: new Date().toISOString() }).eq("household_id", body.householdId).ilike("email", email).is("accepted_at", null).is("revoked_at", null);
    const token = randomToken();
    const { error: insertError } = await admin.from("household_invitations").insert({ household_id: body.householdId, email, token_hash: await sha256(token), invited_by: authData.user.id });
    if (insertError) throw insertError;
    const inviteUrl = `${appUrl}/invitation/accept?token=${encodeURIComponent(token)}`;
    const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: resendFrom, to: [email], subject: "Du er inviteret til Hjemblik", html: `<div style="font-family:Arial,sans-serif;color:#172033"><h1>Velkommen til Hjemblik</h1><p>${authData.user.email ?? "Ejeren"} har inviteret dig til husstanden.</p><p><a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:white;text-decoration:none;border-radius:8px">Åbn invitation</a></p><p>Linket udløber efter syv dage.</p></div>` }) });
    if (!mail.ok) throw new Error("Invitationsmailen kunne ikke sendes.");
    return jsonResponse({ ok: true });
  } catch (reason) {
    return jsonResponse({ error: reason instanceof Error ? reason.message : "Invitationen kunne ikke behandles." }, 500);
  }
});

