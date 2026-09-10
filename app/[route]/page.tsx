import { AuthGate } from "../auth-gate";

export default async function AppRoutePage({ params, searchParams }: { params: Promise<{ route: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const runtimeEnv = process.env as Record<string, string | undefined>;
  const url = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const query = await searchParams;
  const { route } = await params;

  return (
    <AuthGate
      appUrl={runtimeEnv.NEXT_PUBLIC_APP_URL?.trim() || null}
      initialPath={`/${route}`}
      localPreview={process.env.NODE_ENV !== "production" && query?.preview === "1"}
      supabaseConfig={url && publishableKey ? { url, publishableKey } : null}
    />
  );
}
