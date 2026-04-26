"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  ArrowRight,
  CircleDollarSign,
  Database,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  Sparkles,
  WalletCards,
} from "lucide-react";
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
import { baseSepolia } from "@/lib/wagmi";
import {
  createGroup,
  getDashboardStats,
  getStorageMode,
  listGroups,
  loadDemoData,
} from "@/lib/storage";
import { cn, formatMoney, shortAddress } from "@/lib/utils";
import type {
  CreateGroupInput,
  GroupCategory,
  SplitSafeGroup,
} from "@/types/splitsafe";

const categories: GroupCategory[] = [
  "food",
  "travel",
  "family",
  "event",
  "dorm",
  "other",
];

const initialForm: CreateGroupInput = {
  name: "",
  description: "",
  budget_amount: 100,
  currency: "USDC",
  category: "food",
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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [groups, setGroups] = useState<SplitSafeGroup[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [form, setForm] = useState<CreateGroupInput>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageMode = getStorageMode();

  const networkLabel = useMemo(() => {
    if (!isConnected) return "Demo mode";
    return chainId === baseSepolia.id ? "Base Sepolia" : "Switch network";
  }, [chainId, isConnected]);

  async function refreshDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [nextGroups, nextStats] = await Promise.all([
        listGroups(),
        getDashboardStats(),
      ]);
      setGroups(nextGroups);
      setStats(nextStats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      setLoading(true);
      setError(null);

      try {
        const [nextGroups, nextStats] = await Promise.all([
          listGroups(),
          getDashboardStats(),
        ]);
        if (!cancelled) {
          setGroups(nextGroups);
          setStats(nextStats);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load groups",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) throw new Error("Group name is required");
      if (!Number.isFinite(form.budget_amount) || form.budget_amount <= 0) {
        throw new Error("Budget amount must be greater than zero");
      }

      await createGroup(form, address);
      setForm(initialForm);
      await refreshDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create group");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadDemoData() {
    setDemoLoading(true);
    setError(null);

    try {
      await loadDemoData(address);
      await refreshDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load demo data");
    } finally {
      setDemoLoading(false);
    }
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
                <Badge tone={storageMode === "supabase" ? "green" : "amber"}>
                  {storageMode === "supabase" ? "Supabase synced" : "Local demo mode"}
                </Badge>
                <Badge tone={isConnected ? "green" : "slate"}>{networkLabel}</Badge>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Group finance command center
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Create budget rooms, load a judge-friendly demo, and open a
                workspace where expenses, balances, AI, and testnet settlement
                live together.
              </p>
            </div>
            <PrimaryButton
              type="button"
              onClick={handleLoadDemoData}
              disabled={demoLoading}
              className="min-w-48 bg-gradient-to-r from-slate-950 to-teal-900"
            >
              {demoLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Load Demo Data
            </PrimaryButton>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total groups"
            value={groups.length.toString()}
            detail="Active shared budgets"
            icon={WalletCards}
            tone="teal"
          />
          <StatCard
            label="Total budget"
            value={formatMoney(stats.totalBudget, "USDC")}
            detail="Across all workspaces"
            icon={CircleDollarSign}
            tone="blue"
          />
          <StatCard
            label="Total spent"
            value={formatMoney(stats.totalSpent, "USDC")}
            detail="Recorded expenses"
            icon={ReceiptText}
            tone="green"
          />
          <StatCard
            label="Pending settlement"
            value={stats.pendingSettlements.toString()}
            detail="Unpaid split rows"
            icon={Landmark}
            tone="amber"
          />
        </section>

        <WalletPanel />

        {storageMode === "demo" ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-6 text-amber-900 shadow-sm">
            Supabase keys are not configured, so SplitSafe is using localStorage.
            The demo flow stays fully usable on this machine.
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
              title="Create a group"
              description="Set a budget and category. Members and expenses are added inside the workspace."
            />

            <form onSubmit={handleCreateGroup} className="mt-6 space-y-5">
              <FieldLabel label="Group name">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={fieldClassName}
                  placeholder="Thailand trip"
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
                    value={form.budget_amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        budget_amount: Number(event.target.value),
                      }))
                    }
                    className={fieldClassName}
                  />
                </FieldLabel>

                <FieldLabel label="Category">
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as GroupCategory,
                      }))
                    }
                    className={fieldClassName}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>

              <PrimaryButton type="submit" disabled={saving} className="w-full">
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
              title="Groups"
              description={
                isConnected
                  ? `Wallet connected as ${shortAddress(address)}.`
                  : "Wallet is optional until you settle a balance."
              }
              action={
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  disabled={demoLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 hover:-translate-y-0.5 hover:bg-teal-100"
                >
                  {demoLoading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-4" aria-hidden="true" />
                  )}
                  Demo data
                </button>
              }
            />

            <div className="mt-6">
              {loading ? (
                <div className="flex min-h-72 items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Loading groups
                </div>
              ) : groups.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No groups yet"
                  body="Create a new group or load ABAC Dinner Group to show the complete hackathon flow."
                  action={
                    <button
                      type="button"
                      onClick={handleLoadDemoData}
                      disabled={demoLoading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                      Load demo
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-4">
                  {groups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_24px_70px_rgba(15,23,42,0.09)]"
                    >
                      <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-teal-50 to-transparent opacity-0 group-hover:opacity-100" />
                      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <AvatarToken name={group.name} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold tracking-tight text-slate-950">
                                {group.name}
                              </h3>
                              <Badge tone="slate">{group.category}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                              {group.description || "No description yet"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-6 md:min-w-56 md:justify-end">
                          <div className="text-left md:text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Budget
                            </p>
                            <p className="mt-1 font-semibold text-slate-950">
                              {formatMoney(group.budget_amount, group.currency)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 group-hover:border-teal-200 group-hover:text-teal-700",
                            )}
                          >
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
