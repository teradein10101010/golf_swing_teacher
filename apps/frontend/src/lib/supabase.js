import { createClient } from "@supabase/supabase-js";

export const FREE_ACCESS = /^(1|true|yes|on)$/.test(
  String(import.meta.env.VITE_FREE_ACCESS || "").toLowerCase(),
);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);

const createStubSupabase = () => {
  const emptySession = { data: { session: null }, error: null };
  const emptySubscription = { unsubscribe() {} };
  return {
    auth: {
      getSession: async () => emptySession,
      onAuthStateChange: () => ({ data: { subscription: emptySubscription } }),
      signInWithPassword: async () => ({
        error: new Error("Supabase is not configured"),
      }),
      signUp: async () => ({ error: new Error("Supabase is not configured") }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };
};

export const supabase = SUPABASE_CONFIGURED
  ? createClient(supabaseUrl, supabaseAnonKey)
  : FREE_ACCESS
  ? createStubSupabase()
  : (() => {
      throw new Error(
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
    })();
