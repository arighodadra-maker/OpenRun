/**
 * Supabase is optional until keys are added to .env.local.
 * These helpers let the rest of the app degrade gracefully (no crashes,
 * auth UI just stays hidden) when it isn't configured yet.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
