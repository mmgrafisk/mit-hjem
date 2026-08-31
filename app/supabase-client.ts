import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | undefined;

export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabaseBrowserClient(config?: PublicSupabaseConfig) {
  if (browserClient) return browserClient;

  const url = config?.url.trim();
  const publishableKey = config?.publishableKey.trim();

  if (!url || !publishableKey) {
    throw new Error("Supabase-klienten er ikke initialiseret.");
  }

  browserClient = createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}
