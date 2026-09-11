import { AuthGate } from "../../auth-gate";

export default async function InvitationAcceptPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const runtimeEnv = process.env as Record<string, string | undefined>;
  const url = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  return <AuthGate appUrl={runtimeEnv.NEXT_PUBLIC_APP_URL?.trim() || null} initialPath={`/invitation/accept?token=${encodeURIComponent(token)}`} supabaseConfig={url && publishableKey ? { url, publishableKey } : null} />;
}

