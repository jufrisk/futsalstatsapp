import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
// Accept either name: the browser-safe key is called "publishable" in the newer
// Supabase key system and "anon" in the older one.
const anonKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
)?.trim();

/** True when the shared cloud database is configured (env vars present). */
export const syncConfigured = Boolean(url && anonKey);

export const APP_STATE_TABLE = "app_state";
export const APP_STATE_ID = "main";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 2 } },
    });
  }
  return client;
}
