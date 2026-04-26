"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabaseClient, getSupabaseSetupStatus } from "@/lib/supabase";
import type { Profile } from "@/types/splitsafe";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isDemoUser: boolean;
  loading: boolean;
  supabaseReady: boolean;
  setupMessage: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromUser(user: User): Profile {
  const metadata = user.user_metadata ?? {};
  const fallbackName = user.is_anonymous
    ? "Demo tester"
    : user.email?.split("@")[0] ?? "SplitSafe user";

  return {
    id: user.id,
    name:
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : fallbackName,
    email: user.email ?? null,
    avatar_url:
      typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
    wallet_address: null,
    created_at: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setupStatus = getSupabaseSetupStatus();
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(setupStatus.configured);

  const loadProfile = useCallback(
    async (nextUser: User | null) => {
      if (!supabase || !nextUser) {
        setProfile(null);
        return;
      }

      const fallbackProfile = profileFromUser(nextUser);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (error || !data) {
        await supabase.from("profiles").upsert({
          id: fallbackProfile.id,
          name: fallbackProfile.name,
          email: fallbackProfile.email,
          avatar_url: fallbackProfile.avatar_url,
        });
        setProfile(fallbackProfile);
        return;
      }

      setProfile({
        id: String(data.id),
        name: typeof data.name === "string" ? data.name : null,
        email: typeof data.email === "string" ? data.email : null,
        avatar_url:
          typeof data.avatar_url === "string" ? data.avatar_url : null,
        wallet_address:
          typeof data.wallet_address === "string" ? data.wallet_address : null,
        created_at:
          typeof data.created_at === "string"
            ? data.created_at
            : new Date().toISOString(),
      });
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user ?? null);
      if (!cancelled) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        void loadProfile(nextSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isDemoUser: Boolean(user?.is_anonymous),
      loading,
      supabaseReady: setupStatus.configured,
      setupMessage: setupStatus.message,
      refreshProfile: async () => loadProfile(user),
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      },
    }),
    [loadProfile, loading, profile, session, setupStatus, supabase, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
