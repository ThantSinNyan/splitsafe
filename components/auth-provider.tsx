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
import {
  getLocalDemoProfile,
  getLocalDemoUser,
  isLocalDemoMode,
  startLocalDemoMode,
  stopLocalDemoMode,
} from "@/lib/local-demo";
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
  startDemoSession: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let cachedAuthState: {
  checked: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
} = {
  checked: false,
  session: null,
  user: null,
  profile: null,
};

function profileFromUser(user: User): Profile {
  const metadata = user.user_metadata ?? {};
  const fallbackName = user.is_anonymous
    ? "Alex Carter"
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
  const localDemoActive = isLocalDemoMode();
  const [session, setSession] = useState<Session | null>(
    localDemoActive ? null : cachedAuthState.session,
  );
  const [user, setUser] = useState<User | null>(
    localDemoActive ? getLocalDemoUser() : cachedAuthState.user,
  );
  const [profile, setProfile] = useState<Profile | null>(
    localDemoActive ? getLocalDemoProfile() : cachedAuthState.profile,
  );
  const [loading, setLoading] = useState(
    setupStatus.configured && !localDemoActive && !cachedAuthState.checked,
  );

  const applyAuthState = useCallback(
    (nextSession: Session | null, nextUser: User | null) => {
      cachedAuthState = {
        ...cachedAuthState,
        checked: true,
        session: nextSession,
        user: nextUser,
      };
      setSession(nextSession);
      setUser(nextUser);
    },
    [],
  );

  const activateLocalDemo = useCallback(() => {
    startLocalDemoMode();
    const demoUser = getLocalDemoUser();
    const demoProfile = getLocalDemoProfile();
    cachedAuthState = {
      checked: true,
      session: null,
      user: demoUser,
      profile: demoProfile,
    };
    setSession(null);
    setUser(demoUser);
    setProfile(demoProfile);
    setLoading(false);
  }, []);

  const loadProfile = useCallback(
    async (nextUser: User | null) => {
      if (!supabase || !nextUser) {
        cachedAuthState = { ...cachedAuthState, profile: null };
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
        cachedAuthState = { ...cachedAuthState, profile: fallbackProfile };
        setProfile(fallbackProfile);
        return;
      }

      const nextProfile = {
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
      };

      cachedAuthState = { ...cachedAuthState, profile: nextProfile };
      setProfile(nextProfile);
    },
    [supabase],
  );

  useEffect(() => {
    if (isLocalDemoMode()) {
      queueMicrotask(activateLocalDemo);
      return;
    }

    if (!supabase) {
      queueMicrotask(() => {
        cachedAuthState = {
          checked: true,
          session: null,
          user: null,
          profile: null,
        };
        setLoading(false);
      });
      return;
    }

    let cancelled = false;

    if (cachedAuthState.checked) {
      queueMicrotask(() => setLoading(false));
    } else {
      supabase.auth.getSession().then(async ({ data }) => {
        if (cancelled) return;
        applyAuthState(data.session, data.session?.user ?? null);
        await loadProfile(data.session?.user ?? null);
        if (!cancelled) setLoading(false);
      });
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applyAuthState(nextSession, nextSession?.user ?? null);
        void loadProfile(nextSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [activateLocalDemo, applyAuthState, loadProfile, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isDemoUser: Boolean(user?.is_anonymous) || isLocalDemoMode(),
      loading,
      supabaseReady: setupStatus.configured,
      setupMessage: setupStatus.message,
      refreshProfile: async () => loadProfile(user),
      startDemoSession: activateLocalDemo,
      signOut: async () => {
        stopLocalDemoMode();
        if (supabase) await supabase.auth.signOut();
        cachedAuthState = {
          checked: true,
          session: null,
          user: null,
          profile: null,
        };
        setSession(null);
        setUser(null);
        setProfile(null);
      },
    }),
    [
      activateLocalDemo,
      loadProfile,
      loading,
      profile,
      session,
      setupStatus,
      supabase,
      user,
    ],
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
