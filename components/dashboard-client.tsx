"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Activity,
  WalletCards,
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
  totalSpent: number;
  totalUnpaid: number;
  pendingSettlements: number;
  pendingInvites: number;
  recentActivity: number;
  youOwe: number;
  owedToYou: number;
};

const emptyStats: DashboardStats = {
  totalSpent: 0,
  totalUnpaid: 0,
  pendingSettlements: 0,
  pendingInvites: 0,
  recentActivity: 0,
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
  const [saving, setSaving] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);

    try {
      const [nextWorkspaces, nextStats] = await Promise.all([
        listWorkspaces(),
        getDashboardStats(),
      ]);
      setWorkspaces(nextWorkspaces);
      setStats(nextStats);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load groups",
      );
    } finally {
      setLoading(false);
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

  if (authLoading || (!user && supabaseReady)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-600" aria-hidden="true" />
          Restoring session
        </div>
      </main>
    );
  }

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
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                My groups
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Welcome, {displayName}. Create private budget groups, invite
                members by email, and keep every group isolated to its members.
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
                disabled={!supabaseReady && !isDemoUser}
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
                disabled={(!supabaseReady && !isDemoUser) || sampleLoading}
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total group balance"
            value={formatMoney(stats.totalUnpaid, "USD")}
            detail="Across active groups"
            icon={WalletCards}
            tone="teal"
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
            label="Who owes who"
            value={stats.pendingSettlements.toString()}
            detail="Open payback paths"
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
          <StatCard
            label="Recent expenses"
            value={stats.recentActivity.toString()}
            detail="Expenses and payment records"
            icon={Activity}
            tone="slate"
          />
        </section>

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
                disabled={(!supabaseReady && !isDemoUser) || saving}
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
                  disabled={(!supabaseReady && !isDemoUser) || sampleLoading}
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
              {loading ? (
                <div className="flex min-h-72 items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Loading groups
                </div>
              ) : workspaces.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No groups yet"
                  body="Create a group or start with a ready-made starter group."
                  action={
                    <button
                      type="button"
                      onClick={() => void handleCreateSample()}
                      disabled={(!supabaseReady && !isDemoUser) || sampleLoading}
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
