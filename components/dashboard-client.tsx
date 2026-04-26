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
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
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
import { WalletPanel } from "@/components/wallet-panel";
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
  totalBudget: number;
  totalSpent: number;
  pendingSettlements: number;
};

const emptyStats: DashboardStats = {
  totalBudget: 0,
  totalSpent: 0,
  pendingSettlements: 0,
};

export function DashboardClient() {
  const router = useRouter();
  const { loading: authLoading, profile, setupMessage, supabaseReady, user } =
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
        caught instanceof Error ? caught.message : "Could not load workspaces",
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
      if (!form.name.trim()) throw new Error("Workspace name is required");
      if (!Number.isFinite(form.total_budget) || form.total_budget <= 0) {
        throw new Error("Budget amount must be greater than zero");
      }

      const workspace = await createWorkspace(form);
      setForm(initialForm);
      await refreshDashboard();
      router.push(`/workspaces/${workspace.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create workspace",
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
          : "Could not create sample workspace",
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
                <Badge tone={supabaseReady ? "green" : "amber"}>
                  {supabaseReady ? "Supabase Auth active" : "Setup required"}
                </Badge>
                <Badge tone="teal">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  RLS protected
                </Badge>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                My workspaces
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Welcome, {displayName}. Create private budget workspaces, invite
                members by email, and keep every group isolated to its members.
              </p>
            </div>
            <PrimaryButton
              type="button"
              onClick={() => void handleCreateSample()}
              disabled={!supabaseReady || sampleLoading}
              className="min-w-56 bg-gradient-to-r from-slate-950 to-teal-900"
            >
              {sampleLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Create sample workspace
            </PrimaryButton>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Workspaces"
            value={workspaces.length.toString()}
            detail="Private groups you belong to"
            icon={WalletCards}
            tone="teal"
          />
          <StatCard
            label="Total budget"
            value={formatMoney(stats.totalBudget, "USD")}
            detail="Across your workspaces"
            icon={CircleDollarSign}
            tone="blue"
          />
          <StatCard
            label="Total spent"
            value={formatMoney(stats.totalSpent, "USD")}
            detail="Visible to your memberships"
            icon={ReceiptText}
            tone="green"
          />
          <StatCard
            label="Pending splits"
            value={stats.pendingSettlements.toString()}
            detail="Unpaid balances"
            icon={Landmark}
            tone="amber"
          />
        </section>

        <WalletPanel />

        {!supabaseReady ? (
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
              eyebrow="New workspace"
              title="Create a workspace"
              description="Set the budget shell first. Members and expenses are managed inside the workspace."
            />

            <form onSubmit={handleCreateWorkspace} className="mt-6 space-y-5">
              <FieldLabel label="Workspace name">
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
                disabled={!supabaseReady || saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Create workspace
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard id="groups" elevated>
            <SectionHeader
              eyebrow="Portfolio"
              title="My Workspaces"
              description="Only workspaces where you are owner or member appear here."
              action={
                <button
                  type="button"
                  onClick={() => void handleCreateSample()}
                  disabled={!supabaseReady || sampleLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 hover:-translate-y-0.5 hover:bg-teal-100"
                >
                  {sampleLoading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-4" aria-hidden="true" />
                  )}
                  Sample
                </button>
              }
            />

            <div className="mt-6">
              {loading ? (
                <div className="flex min-h-72 items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Loading workspaces
                </div>
              ) : workspaces.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No workspaces yet"
                  body="Create Thailand Trip or invite another account to prove private multi-user access."
                  action={
                    <button
                      type="button"
                      onClick={() => void handleCreateSample()}
                      disabled={!supabaseReady || sampleLoading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                      Create sample
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
