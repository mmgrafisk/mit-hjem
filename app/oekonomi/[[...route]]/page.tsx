import { AuthGate } from "../../auth-gate";

export default function FinanceRoutePage() {
  const runtimeEnv = process.env as Record<string, string | undefined>;
  const url = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  return (
    <AuthGate
      appUrl={runtimeEnv.NEXT_PUBLIC_APP_URL?.trim() || null}
      supabaseConfig={url && publishableKey ? { url, publishableKey } : null}
    />
  );
}
