"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  BrandMark,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/ui-kit";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const { startDemoSession, user, loading, supabaseReady, setupMessage } =
    useAuth();
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode],
  );

  useEffect(() => {
    if (!loading && user) router.replace(nextPath);
  }, [loading, nextPath, router, user]);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim() || email.trim().split("@")[0],
              full_name: name.trim() || email.trim().split("@")[0],
            },
            emailRedirectTo: `${window.location.origin}${nextPath}`,
          },
        });

        if (authError) throw authError;
        setMessage(
          "Account created. If email confirmation is enabled, check your inbox before signing in.",
        );
        setMode("login");
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;
      router.replace(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    if (!supabase) return;
    setGoogleLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${nextPath}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setGoogleLoading(false);
    }
  }

  async function handleDemoLogin() {
    setDemoLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (supabase) {
        const { error: authError } = await supabase.auth.signInAnonymously({
          options: {
            data: {
              name: "Demo tester",
              full_name: "Demo tester",
            },
          },
        });

        if (!authError) {
          router.replace(nextPath);
          return;
        }
      }

      startDemoSession();
      router.replace(nextPath);
    } catch {
      startDemoSession();
      router.replace(nextPath);
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_44%,#effdfa_100%)] px-4 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
          <section className="max-w-3xl">
            <Link href="/" aria-label="SplitSafe home">
              <BrandMark />
            </Link>
            <div className="mt-14 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Real accounts, private workspaces
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Secure group budgets for people who actually share costs.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Sign in to create private workspaces, invite members by email,
              split expenses, and keep every group isolated with Supabase RLS.
            </p>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {["Private RLS data", "Google or email", "Base Sepolia ready"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
                SplitSafe Auth
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "login"
                  ? "Access your workspaces and pending invites."
                  : "Create an account before accepting workspace invites."}
              </p>
            </div>

            {!supabaseReady ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {setupMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={!supabaseReady || googleLoading || demoLoading}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="size-4" aria-hidden="true" />
              )}
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => void handleDemoLogin()}
              disabled={googleLoading || demoLoading}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(20,184,166,0.22)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {demoLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserRoundCheck className="size-4" aria-hidden="true" />
              )}
              Try demo mode
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-slate-500">
              Uses Supabase anonymous auth when available, otherwise opens a
              private in-browser demo.
            </p>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                or
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === "signup" ? (
                <FieldLabel label="Name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={fieldClassName}
                    placeholder="Thant Sin Nyan"
                  />
                </FieldLabel>
              ) : null}
              <FieldLabel label="Email">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  className={fieldClassName}
                  placeholder="you@example.com"
                />
              </FieldLabel>
              <FieldLabel label="Password">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                  minLength={6}
                  className={fieldClassName}
                  placeholder="Password"
                />
              </FieldLabel>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
                  {message}
                </div>
              ) : null}

              <PrimaryButton
                type="submit"
                disabled={!supabaseReady || submitting}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LockKeyhole className="size-4" aria-hidden="true" />
                )}
                {mode === "login" ? "Login" : "Create account"}
              </PrimaryButton>
            </form>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <SecondaryButton
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setMessage(null);
                }}
                className="w-full"
              >
                {mode === "login" ? "Need an account?" : "Already have account?"}
              </SecondaryButton>
              <Link
                href="/dashboard"
                className={cn(
                  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50",
                  !user && "pointer-events-none opacity-50",
                )}
              >
                Dashboard
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function AuthPage() {
  return (
    <Suspense>
      <AuthPageContent />
    </Suspense>
  );
}
