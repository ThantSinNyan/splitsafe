"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CircleDollarSign,
  Database,
  Landmark,
  Loader2,
  MailPlus,
  Plus,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import {
  AvatarToken,
  Badge,
  EmptyState,
  FieldLabel,
  PrimaryButton,
  SectionCard,
  SectionHeader,
  StatCard,
  fieldClassName,
  textareaClassName,
} from "@/components/ui-kit";
import {
  createSampleWorkspace,
  createWorkspace,
  getDashboardStats,
  listWorkspaces,
} from "@/lib/storage";
import { formatMoney, profileLabel } from "@/lib/utils";
import type { CreateWorkspaceInput, Workspace } from "@/types/splitsafe";

const initialForm: CreateWorkspaceInput = {
  name: "",
  description: "",
  total_budget: 100,
  currency: "USD",
};

type DashboardStats = {
  pendingSettlements: number;
  pendingInvites: number;
  youOwe: number;
  owedToYou: number;
};

const emptyStats: DashboardStats = {
  pendingSettlements: 0,
  pendingInvites: 0,
  youOwe: 0,
  owedToYou: 0,
};

export function DashboardClient() {
  const router = useRouter();
  const { isDemoUser, loading: authLoading, profile, setupMessage, supabaseReady, user } =
    useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [form, setForm] = useState<CreateWorkspaceInput>(initialForm);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedDashboardUserIdRef = useRef<string | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  const displayName = useMemo(
    () => profileLabel({ name: profile?.name, email: profile?.email }),
    [profile?.email, profile?.name],
  );
  const firstGroupHref = workspaces[0] ? `/workspaces/${workspaces[0].id}` : null;

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/dashboard");
  }, [authLoading, router, user]);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;
    const initialLoad = loadedDashboardUserIdRef.current !== user.id;
    if (initialLoad) {
      setDashboardLoaded(false);
      setWorkspaces([]);
      setStats(emptyStats);
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);

    try {
      const [nextWorkspaces, nextStats] = await Promise.all([
        listWorkspaces(),
        getDashboardStats(),
      ]);
      setWorkspaces(nextWorkspaces);
      setStats(nextStats);
      loadedDashboardUserIdRef.current = user.id;
      setDashboardLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load groups",
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    queueMicrotask(() => void refreshDashboard());
  }, [refreshDashboard, user]);

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) throw new Error("Group name is required");
      if (!Number.isFinite(form.total_budget) || form.total_budget <= 0) {
        throw new Error("Budget amount must be greater than zero");
      }

      const workspace = await createWorkspace(form);
      setForm(initialForm);
      await refreshDashboard();
      router.push(`/workspaces/${workspace.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create group",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSample() {
    setSampleLoading(true);
    setError(null);

    try {
      const workspace = await createSampleWorkspace();
      await refreshDashboard();
      router.push(`/workspaces/${workspace.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create starter group",
      );
    } finally {
      setSampleLoading(false);
    }
  }

  const waitingForAuth = authLoading || (!user && supabaseReady);
  const showInitialSkeleton = waitingForAuth || (loading && !dashboardLoaded);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-[34px] border border-white/80 bg-white/80 p-7 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
          <div className="absolute -right-24 -top-28 size-72 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-28 w-80 bg-gradient-to-l from-cyan-100/60 to-transparent" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={supabaseReady || isDemoUser ? "green" : "amber"}>
                  {isDemoUser ? "Guest account" : supabaseReady ? "Private groups" : "Setup required"}
                </Badge>
                <Badge tone="teal">Only members can view groups</Badge>
                {syncing ? (
                  <Badge tone="blue">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Syncing
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                My groups
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Welcome, {displayName}. Add expenses, split bills, and settle
                balances with the groups you trust.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <PrimaryButton
                type="button"
                onClick={() => {
                  document.getElementById("create")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                disabled={waitingForAuth || (!supabaseReady && !isDemoUser)}
                className="min-w-56 bg-gradient-to-r from-slate-950 to-teal-900"
              >
                <Plus className="size-4" aria-hidden="true" />
                Create group
              </PrimaryButton>
              {firstGroupHref ? (
                <Link
                  href={firstGroupHref}
                  className="inline-flex h-12 min-w-56 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-5 text-sm font-semibold text-teal-800 shadow-sm hover:-translate-y-0.5 hover:bg-teal-100"
                >
                  <ReceiptText className="size-4" aria-hidden="true" />
                  Add expense
                </Link>
              ) : null}
              {firstGroupHref ? (
                <Link
                  href={firstGroupHref}
                  className="inline-flex h-12 min-w-56 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  <Landmark className="size-4" aria-hidden="true" />
                  Settle up
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCreateSample()}
                disabled={waitingForAuth || (!supabaseReady && !isDemoUser) || sampleLoading}
                className="inline-flex h-12 min-w-56 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sampleLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                Use starter group
              </button>
            </div>
          </div>
        </header>

        {showInitialSkeleton ? (
          <DashboardStatsSkeleton />
        ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="My groups"
            value={workspaces.length.toString()}
            detail="Groups you can open"
            icon={Database}
            tone="slate"
          />
          <StatCard
            label="You owe"
            value={formatMoney(stats.youOwe, "USD")}
            detail="Your unpaid balances"
            icon={CircleDollarSign}
            tone="rose"
          />
          <StatCard
            label="Owed to you"
            value={formatMoney(stats.owedToYou, "USD")}
            detail="Unpaid balances friends owe"
            icon={ReceiptText}
            tone="green"
          />
          <StatCard
            label="Pending settlements"
            value={stats.pendingSettlements.toString()}
            detail="Open balances"
            icon={Landmark}
            tone="amber"
          />
          <StatCard
            label="Pending invites"
            value={stats.pendingInvites.toString()}
            detail="Waiting for members"
            icon={MailPlus}
            tone="blue"
          />
        </section>
        )}

        {!supabaseReady && !isDemoUser ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-6 text-amber-900 shadow-sm">
            {setupMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <SectionCard id="create" elevated>
            <SectionHeader
              eyebrow="New group"
              title="Create a group"
              description="Set a budget first. Members and expenses are managed inside the group."
            />

            <form onSubmit={handleCreateWorkspace} className="mt-6 space-y-5">
              <FieldLabel label="Group name">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={fieldClassName}
                  placeholder="Thailand Trip"
                />
              </FieldLabel>

              <FieldLabel label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className={textareaClassName}
                  placeholder="Shared budget for food, transport, and rooms"
                />
              </FieldLabel>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Budget">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.total_budget}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        total_budget: Number(event.target.value),
                      }))
                    }
                    className={fieldClassName}
                  />
                </FieldLabel>

                <FieldLabel label="Currency">
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        currency: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  >
                    {["USD", "USDC", "THB", "EUR", "SGD"].map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>

              <PrimaryButton
                type="submit"
                disabled={waitingForAuth || (!supabaseReady && !isDemoUser) || saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Create group
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard id="groups" elevated>
            <SectionHeader
              eyebrow="Portfolio"
              title="My Groups"
              description="Only groups where you are owner or member appear here."
              action={
                <button
                  type="button"
                  onClick={() => void handleCreateSample()}
                  disabled={waitingForAuth || (!supabaseReady && !isDemoUser) || sampleLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 hover:-translate-y-0.5 hover:bg-teal-100"
                >
                  {sampleLoading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                  Starter
                </button>
              }
            />

            <div className="mt-6">
              {showInitialSkeleton ? (
                <GroupListSkeleton />
              ) : workspaces.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No groups yet"
                  body="Create a group or use a starter group."
                  action={
                    <button
                      type="button"
                      onClick={() => void handleCreateSample()}
                      disabled={waitingForAuth || (!supabaseReady && !isDemoUser) || sampleLoading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                      Use starter group
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-4">
                  {workspaces.map((workspace) => (
                    <Link
                      key={workspace.id}
                      href={`/workspaces/${workspace.id}`}
                      className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_24px_70px_rgba(15,23,42,0.09)]"
                    >
                      <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-teal-50 to-transparent opacity-0 group-hover:opacity-100" />
                      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <AvatarToken name={workspace.name} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold tracking-tight text-slate-950">
                                {workspace.name}
                              </h3>
                              <Badge tone="slate">{workspace.currency}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                              {workspace.description || "No description yet"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-6 md:min-w-56 md:justify-end">
                          <div className="text-left md:text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Budget
                            </p>
                            <p className="mt-1 font-semibold text-slate-950">
                              {formatMoney(
                                workspace.total_budget,
                                workspace.currency,
                              )}
                            </p>
                          </div>
                          <span className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 group-hover:border-teal-200 group-hover:text-teal-700">
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </section>
      </div>
    </AppShell>
  );
}

function DashboardStatsSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="min-h-32 animate-pulse rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="mt-5 h-8 w-28 rounded-full bg-slate-100" />
          <div className="mt-4 h-3 w-32 rounded-full bg-slate-100" />
        </div>
      ))}
    </section>
  );
}

function GroupListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-slate-100" />
            <div className="min-w-0 flex-1">
              <div className="h-5 w-40 rounded-full bg-slate-200" />
              <div className="mt-3 h-4 w-full max-w-md rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
