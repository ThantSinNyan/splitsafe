import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseSetupStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      configured: false,
      message:
        "Supabase URL or public anon key is missing. Account workspaces require Supabase Auth.",
    };
  }

  try {
    const parsed = new URL(url);
    const validProjectUrl =
      parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");

    if (!validProjectUrl) {
      return {
        configured: false,
        message:
          "Supabase URL is invalid. Use the Project URL from Supabase Data API, not an API key.",
      };
    }
  } catch {
    return {
      configured: false,
      message:
        "Supabase URL is invalid. Use the Project URL from Supabase Data API, not an API key.",
    };
  }

  return { configured: true, message: null };
}

export function isSupabaseConfigured() {
  return getSupabaseSetupStatus().configured;
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      },
    );
  }

  return browserClient;
}

export function requireSupabaseClient() {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error(
      getSupabaseSetupStatus().message ??
        "Supabase is not configured for SplitSafe.",
    );
  }

  return client;
}
