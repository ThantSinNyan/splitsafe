"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { waitForTransactionReceipt } from "@wagmi/core";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Database,
  ExternalLink,
  Landmark,
  Loader2,
  MailPlus,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { isAddress, parseEther, type Address, type Hash } from "viem";
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { useAuth } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import {
  AvatarToken,
  Badge,
  EmptyState,
  FieldLabel,
  PrimaryButton,
  ProgressBar,
  SectionCard,
  SectionHeader,
  StatCard,
  fieldClassName,
  textareaClassName,
} from "@/components/ui-kit";
import { WalletPanel } from "@/components/wallet-panel";
import {
  acceptInvite,
  addExpense,
  createInvite,
  getWorkspace,
  recordSettlement,
  saveAiMessage,
} from "@/lib/storage";
import { baseSepolia, wagmiConfig } from "@/lib/wagmi";
import {
  cn,
  formatMoney,
  makeId,
  memberName,
  profileLabel,
  shortAddress,
} from "@/lib/utils";
import type {
  AiMessage,
  CreateExpenseInput,
  CreateInviteInput,
  Expense,
  ExpenseSplit,
  WorkspaceData,
  WorkspaceMember,
} from "@/types/splitsafe";

const expenseCategories = [
  "food",
  "travel",
  "family",
  "event",
  "dorm",
  "transport",
  "supplies",
  "other",
];

const suggestedPrompts = [
  "Who still needs to pay?",
  "Are we over budget?",
  "Where did we spend the most?",
  "What should we reduce?",
  "Summarize this group",
  "What should we do next?",
];

type AiStatus = "idle" | "gemini" | "fallback" | "unavailable";

const initialInviteForm: CreateInviteInput = {
  invited_email: "",
  role: "member",
};

const initialExpenseForm: CreateExpenseInput = {
  title: "",
  amount: 30,
  category: "food",
  paid_by: "",
  split_user_ids: [],
  notes: "",
};

function baseSepoliaTxUrl(hash: string) {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

function mockHash() {
  const body = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

  return `0x${body}`;
}

function userName(userId: string, members: WorkspaceMember[]) {
  return memberName(userId, members);
}

function activeMembers(members: WorkspaceMember[]) {
  return members.filter((member) => member.status === "active");
}

export function GroupWorkspace({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteForm, setInviteForm] =
    useState<CreateInviteInput>(initialInviteForm);
  const [expenseForm, setExpenseForm] =
    useState<CreateExpenseInput>(initialExpenseForm);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState("Who still needs to pay?");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/workspaces/${groupId}`);
    }
  }, [authLoading, groupId, router, user]);

  const refreshWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const nextWorkspace = await getWorkspace(groupId);
      setWorkspace(nextWorkspace);

      const nextMembers = activeMembers(nextWorkspace?.members ?? []);
      if (nextMembers.length) {
        setExpenseForm((current) => ({
          ...current,
          paid_by: current.paid_by || user.id,
          split_user_ids:
            current.split_user_ids.length > 0
              ? current.split_user_ids
              : nextMembers.map((member) => member.user_id),
        }));
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load workspace",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => {
    if (!user) return;

    queueMicrotask(() => void refreshWorkspace());
  }, [refreshWorkspace, user]);

  const members = useMemo(
    () => activeMembers(workspace?.members ?? []),
    [workspace?.members],
  );

  const expensesById = useMemo(
    () => new Map((workspace?.expenses ?? []).map((expense) => [expense.id, expense])),
    [workspace?.expenses],
  );

  const canManage =
    workspace?.currentMember?.role === "owner" ||
    workspace?.currentMember?.role === "admin";

  const metrics = useMemo(() => {
    if (!workspace) {
      return {
        totalSpent: 0,
        remaining: 0,
        spentPercent: 0,
        topCategory: "none",
        pendingAmount: 0,
        categoryTotals: [] as Array<[string, number]>,
      };
    }

    const totalSpent = workspace.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const remaining = workspace.workspace.total_budget - totalSpent;
    const categoryTotals = workspace.expenses.reduce<Record<string, number>>(
      (totals, expense) => {
        totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
        return totals;
      },
      {},
    );
    const sortedCategories = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1],
    );
    const pendingAmount = workspace.splits
      .filter((split) => split.status === "unpaid")
      .reduce((sum, split) => sum + split.amount_owed, 0);

    return {
      totalSpent,
      remaining,
      spentPercent:
        workspace.workspace.total_budget > 0
          ? Math.min((totalSpent / workspace.workspace.total_budget) * 100, 100)
          : 0,
      topCategory: sortedCategories[0]?.[0] ?? "none",
      pendingAmount,
      categoryTotals: sortedCategories,
    };
  }, [workspace]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteSaving(true);
    setError(null);
    setInviteLink(null);

    try {
      if (!inviteForm.invited_email.trim()) {
        throw new Error("Invite email is required");
      }

      const invite = await createInvite(groupId, inviteForm);
      const link = `${window.location.origin}/invite/${invite.invite_token}`;
      setInviteLink(link);
      await navigator.clipboard?.writeText(link);
      setInviteForm(initialInviteForm);
      await refreshWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create invite");
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleAddExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseSaving(true);
    setError(null);

    try {
      if (!expenseForm.title.trim()) throw new Error("Expense title is required");
      if (!Number.isFinite(expenseForm.amount) || expenseForm.amount <= 0) {
        throw new Error("Expense amount must be greater than zero");
      }
      if (!expenseForm.paid_by) throw new Error("Choose who paid");
      if (expenseForm.split_user_ids.length === 0) {
        throw new Error("Choose at least one member to split with");
      }

      await addExpense(groupId, expenseForm);
      setExpenseForm({
        ...initialExpenseForm,
        paid_by: user?.id ?? "",
        split_user_ids: members.map((member) => member.user_id),
      });
      await refreshWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add expense");
    } finally {
      setExpenseSaving(false);
    }
  }

  function toggleSplitUser(userId: string) {
    setExpenseForm((current) => {
      const selected = current.split_user_ids.includes(userId);

      return {
        ...current,
        split_user_ids: selected
          ? current.split_user_ids.filter((id) => id !== userId)
          : [...current.split_user_ids, userId],
      };
    });
  }

  async function handleSettle(split: ExpenseSplit) {
    setSettlingId(split.id);
    setError(null);

    try {
      const expense = expensesById.get(split.expense_id);
      if (!expense) throw new Error("Expense not found");

      const receiverWallet = expense.paid_by_profile?.wallet_address ?? "";
      let txHash = mockHash();
      let settlementStatus: "confirmed" | "mocked" = "mocked";
      let senderWallet = address ?? "mock-wallet";

      if (isConnected && address && isAddress(receiverWallet)) {
        if (chainId !== baseSepolia.id) {
          await switchChainAsync({ chainId: baseSepolia.id });
        }

        const hash = await sendTransactionAsync({
          to: receiverWallet as Address,
          value: parseEther("0.000001"),
        });

        await waitForTransactionReceipt(wagmiConfig, {
          chainId: baseSepolia.id,
          hash: hash as Hash,
        });

        txHash = hash;
        senderWallet = address;
        settlementStatus = "confirmed";
      }

      await recordSettlement({
        splitId: split.id,
        senderWallet,
        receiverWallet: receiverWallet || "mock-recipient",
        amount: split.amount_owed,
        txHash,
        status: settlementStatus,
      });
      await refreshWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settlement failed");
    } finally {
      setSettlingId(null);
    }
  }

  async function handleAskAi(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;

    const question = aiQuestion.trim();
    if (!question) return;

    setAiLoading(true);
    setError(null);

    const optimisticUserMessage: AiMessage = {
      id: makeId(),
      workspace_id: workspace.workspace.id,
      user_id: user?.id ?? null,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };

    setWorkspace((current) =>
      current
        ? {
            ...current,
            aiMessages: [...current.aiMessages, optimisticUserMessage],
          }
        : current,
    );

    try {
      await saveAiMessage(workspace.workspace.id, "user", question);

      const response = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          workspace: workspace.workspace,
          members: workspace.members,
          expenses: workspace.expenses,
          splits: workspace.splits,
          settlements: workspace.settlements,
        }),
      });

      if (!response.ok) throw new Error("AI assistant request failed");
      const result = (await response.json()) as {
        summary?: string;
        mode?: "gemini" | "fallback";
        indicator?: string;
      };
      const summary =
        result.summary ?? "I could not summarize this workspace yet.";
      setAiStatus(
        result.mode === "gemini"
          ? "gemini"
          : result.indicator?.toLowerCase().includes("unavailable")
            ? "unavailable"
            : "fallback",
      );
      const assistantMessage = await saveAiMessage(
        workspace.workspace.id,
        "assistant",
        summary,
      );

      setWorkspace((current) =>
        current
          ? {
              ...current,
              aiMessages: [...current.aiMessages, assistantMessage],
            }
          : current,
      );
      setAiQuestion("");
    } catch (caught) {
      setAiStatus("unavailable");
      setError(caught instanceof Error ? caught.message : "AI assistant failed");
    } finally {
      setAiLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-600" aria-hidden="true" />
          Loading workspace
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <AppShell>
        <SectionCard className="mx-auto max-w-3xl text-center">
          <EmptyState
            icon={Database}
            title="Workspace not found"
            body="This workspace does not exist or your account is not a member."
            action={
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            }
          />
        </SectionCard>
      </AppShell>
    );
  }

  const { aiMessages, expenses, invites, settlements, splits, workspace: room } =
    workspace;
  const sharePreview =
    expenseForm.split_user_ids.length > 0
      ? expenseForm.amount / expenseForm.split_user_ids.length
      : 0;

  return (
    <AppShell eyebrow={`${room.name} workspace`}>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-[34px] border border-white/80 bg-white/82 p-7 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
          <div className="absolute -right-24 -top-28 size-72 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-32 w-96 bg-gradient-to-l from-cyan-100/70 to-transparent" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Dashboard
              </Link>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Badge tone="teal">{room.currency}</Badge>
                <Badge tone="green">Private workspace</Badge>
                <Badge tone={metrics.remaining < 0 ? "rose" : "green"}>
                  {metrics.remaining < 0 ? "Over budget" : "On budget"}
                </Badge>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {room.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                {room.description || "No description yet."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Pending
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatMoney(metrics.pendingAmount, room.currency)}
                </p>
              </div>
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                  Your role
                </p>
                <p className="mt-2 text-2xl font-semibold capitalize text-emerald-900">
                  {workspace.currentMember?.role ?? "member"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <WalletPanel />

        <div className="rounded-[24px] border border-sky-200 bg-sky-50/90 p-5 text-sm leading-6 text-sky-900 shadow-sm">
          Supabase RLS protects this workspace. Only active members can read
          expenses, splits, AI messages, invites, and settlement history.
        </div>

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total budget"
            value={formatMoney(room.total_budget, room.currency)}
            detail="Workspace budget cap"
            icon={CircleDollarSign}
            tone="blue"
          />
          <StatCard
            label="Total spent"
            value={formatMoney(metrics.totalSpent, room.currency)}
            detail={`${metrics.spentPercent.toFixed(0)}% of budget used`}
            icon={ReceiptText}
            tone="teal"
          />
          <StatCard
            label="Remaining"
            value={formatMoney(metrics.remaining, room.currency)}
            detail={metrics.remaining < 0 ? "Needs attention" : "Available budget"}
            icon={Wallet}
            tone={metrics.remaining < 0 ? "amber" : "green"}
          />
          <StatCard
            label="Members"
            value={members.length.toString()}
            detail="Active accounts"
            icon={Users}
            tone="slate"
          />
        </section>

        <SectionCard elevated>
          <SectionHeader
            eyebrow="Budget health"
            title="Usage and category signal"
            description={`Highest category: ${metrics.topCategory}. ${splits.filter((split) => split.status === "unpaid").length} unpaid split rows remain.`}
            action={
              <Badge tone={metrics.remaining < 0 ? "rose" : "green"}>
                <TrendingUp className="size-3.5" aria-hidden="true" />
                {metrics.spentPercent.toFixed(0)}% used
              </Badge>
            }
          />
          <ProgressBar
            value={metrics.spentPercent}
            danger={metrics.remaining < 0}
            className="mt-6 h-4"
          />
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {metrics.categoryTotals.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-3">
                Add expenses to see category breakdown.
              </div>
            ) : (
              metrics.categoryTotals.slice(0, 3).map(([category, amount]) => (
                <div
                  key={category}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {category}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {formatMoney(amount, room.currency)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="space-y-6">
            <MembersPanel
              members={members}
              invites={invites}
              canManage={canManage}
              inviteForm={inviteForm}
              inviteSaving={inviteSaving}
              inviteLink={inviteLink}
              setInviteForm={setInviteForm}
              onInvite={handleInvite}
            />
            <ExpenseFormPanel
              members={members}
              canManage={canManage}
              currentUserId={user?.id ?? ""}
              groupCurrency={room.currency}
              expenseForm={expenseForm}
              expenseSaving={expenseSaving}
              sharePreview={sharePreview}
              setExpenseForm={setExpenseForm}
              toggleSplitUser={toggleSplitUser}
              onSubmit={handleAddExpense}
            />
          </div>
          <div className="space-y-6">
            <AssistantPanel
              aiMessages={aiMessages}
              aiQuestion={aiQuestion}
              aiLoading={aiLoading}
              aiStatus={aiStatus}
              setAiQuestion={setAiQuestion}
              onSubmit={handleAskAi}
            />
            <BalancesPanel
              splits={splits}
              expenses={expenses}
              members={members}
              currency={room.currency}
              settlingId={settlingId}
              onSettle={handleSettle}
            />
            <ExpensesPanel
              expenses={expenses}
              members={members}
              currency={room.currency}
            />
            {settlements.length > 0 ? (
              <SettlementHistoryPanel
                settlements={settlements}
                currency={room.currency}
              />
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MembersPanel({
  members,
  invites,
  canManage,
  inviteForm,
  inviteSaving,
  inviteLink,
  setInviteForm,
  onInvite,
}: {
  members: WorkspaceMember[];
  invites: WorkspaceData["invites"];
  canManage: boolean;
  inviteForm: CreateInviteInput;
  inviteSaving: boolean;
  inviteLink: string | null;
  setInviteForm: React.Dispatch<React.SetStateAction<CreateInviteInput>>;
  onInvite: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="People"
        title="Members"
        description="Invite accounts by email. Access is enforced by Supabase RLS."
      />

      {canManage ? (
        <form onSubmit={onInvite} className="mt-6 space-y-4">
          <FieldLabel label="Invite email">
            <input
              value={inviteForm.invited_email}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  invited_email: event.target.value,
                }))
              }
              type="email"
              className={fieldClassName}
              placeholder="friend@example.com"
            />
          </FieldLabel>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <select
              value={inviteForm.role}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  role: event.target.value as CreateInviteInput["role"],
                }))
              }
              className={fieldClassName}
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <PrimaryButton type="submit" disabled={inviteSaving} className="px-4">
              {inviteSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <MailPlus className="size-4" aria-hidden="true" />
              )}
              Invite
            </PrimaryButton>
          </div>
          {inviteLink ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(inviteLink)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-left text-xs font-semibold text-teal-800"
            >
              <span className="truncate">{inviteLink}</span>
              <Copy className="size-4 shrink-0" aria-hidden="true" />
            </button>
          ) : null}
        </form>
      ) : (
        <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Only owners and admins can invite members.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50/70 p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <AvatarToken name={profileLabel(member.profile)} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">
                  {profileLabel(member.profile)}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {member.profile?.email ?? "No email"}
                </p>
              </div>
            </div>
            <Badge tone={member.role === "owner" ? "teal" : "slate"}>
              {member.role}
            </Badge>
          </div>
        ))}
      </div>

      {invites.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Invites
          </p>
          <div className="mt-3 space-y-2">
            {invites.slice(0, 4).map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                <span className="truncate text-slate-600">
                  {invite.invited_email}
                </span>
                <Badge tone={invite.status === "pending" ? "amber" : "green"}>
                  {invite.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ExpenseFormPanel({
  members,
  canManage,
  currentUserId,
  groupCurrency,
  expenseForm,
  expenseSaving,
  sharePreview,
  setExpenseForm,
  toggleSplitUser,
  onSubmit,
}: {
  members: WorkspaceMember[];
  canManage: boolean;
  currentUserId: string;
  groupCurrency: string;
  expenseForm: CreateExpenseInput;
  expenseSaving: boolean;
  sharePreview: number;
  setExpenseForm: React.Dispatch<React.SetStateAction<CreateExpenseInput>>;
  toggleSplitUser: (userId: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const payerOptions = canManage
    ? members
    : members.filter((member) => member.user_id === currentUserId);

  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Expense"
        title="Add expense"
        description="Split selected members equally and create unpaid balances."
      />

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <FieldLabel label="Title">
          <input
            value={expenseForm.title}
            onChange={(event) =>
              setExpenseForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            className={fieldClassName}
            placeholder="Dinner"
          />
        </FieldLabel>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldLabel label="Amount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  amount: Number(event.target.value),
                }))
              }
              className={fieldClassName}
            />
          </FieldLabel>
          <FieldLabel label="Category">
            <select
              value={expenseForm.category}
              onChange={(event) =>
                setExpenseForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              className={fieldClassName}
            >
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>

        <FieldLabel label="Paid by">
          <select
            value={expenseForm.paid_by}
            onChange={(event) =>
              setExpenseForm((current) => ({
                ...current,
                paid_by: event.target.value,
              }))
            }
            className={fieldClassName}
          >
            <option value="">Select payer</option>
            {payerOptions.map((member) => (
              <option key={member.id} value={member.user_id}>
                {profileLabel(member.profile)}
              </option>
            ))}
          </select>
        </FieldLabel>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Split between</p>
            <Badge tone="teal">
              Each {formatMoney(sharePreview, groupCurrency)}
            </Badge>
          </div>
          <div className="mt-4 grid gap-2">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <AvatarToken
                    name={profileLabel(member.profile)}
                    className="size-8 rounded-xl text-xs"
                  />
                  <span className="truncate">{profileLabel(member.profile)}</span>
                </span>
                <input
                  type="checkbox"
                  checked={expenseForm.split_user_ids.includes(member.user_id)}
                  onChange={() => toggleSplitUser(member.user_id)}
                  className="size-4 accent-teal-600"
                />
              </label>
            ))}
          </div>
        </div>

        <FieldLabel label="Notes">
          <textarea
            value={expenseForm.notes}
            onChange={(event) =>
              setExpenseForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            className={textareaClassName}
            placeholder="Optional note"
          />
        </FieldLabel>

        <PrimaryButton
          type="submit"
          disabled={expenseSaving || members.length === 0}
          className="w-full"
        >
          {expenseSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Add expense
        </PrimaryButton>
      </form>
    </SectionCard>
  );
}

function AssistantPanel({
  aiMessages,
  aiQuestion,
  aiLoading,
  aiStatus,
  setAiQuestion,
  onSubmit,
}: {
  aiMessages: AiMessage[];
  aiQuestion: string;
  aiLoading: boolean;
  aiStatus: AiStatus;
  setAiQuestion: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const status =
    aiLoading || aiStatus === "gemini"
      ? { label: "Using Gemini AI", tone: "teal" as const }
      : aiStatus === "unavailable"
        ? {
            label: "AI unavailable, fallback response shown",
            tone: "amber" as const,
          }
        : aiStatus === "fallback"
          ? { label: "Using local fallback", tone: "slate" as const }
          : { label: "Using local fallback", tone: "slate" as const };

  return (
    <SectionCard elevated className="relative overflow-hidden">
      <div className="absolute -right-20 -top-24 size-64 rounded-full bg-violet-200/30 blur-3xl" />
      <div className="relative">
        <SectionHeader
          eyebrow="Assistant"
          title="AI spending copilot"
          description="Ask for budget summaries, payment status, or category guidance."
          action={
            <Badge tone={status.tone}>
              <Sparkles className="size-3.5" aria-hidden="true" />
              {status.label}
            </Badge>
          }
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setAiQuestion(prompt)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-6 max-h-[420px] space-y-3 overflow-y-auto rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          {aiMessages.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Ask the workspace budget"
              body="Try one of the prompt chips above or ask your own spending question."
            />
          ) : (
            aiMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] rounded-[22px] border p-4 text-sm leading-6 shadow-sm",
                  message.role === "assistant"
                    ? "border-teal-100 bg-white text-slate-700"
                    : "ml-auto border-slate-900 bg-slate-950 text-white",
                )}
              >
                <p
                  className={cn(
                    "mb-1 text-xs font-semibold uppercase tracking-[0.14em]",
                    message.role === "assistant" ? "text-teal-600" : "text-slate-400",
                  )}
                >
                  {message.role === "assistant" ? "SplitSafe AI" : "You"}
                </p>
                {message.content}
              </div>
            ))
          )}
          {aiLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Thinking
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={aiQuestion}
            onChange={(event) => setAiQuestion(event.target.value)}
            className={cn(fieldClassName, "flex-1")}
            placeholder="Are we over budget?"
          />
          <PrimaryButton type="submit" disabled={aiLoading} className="sm:w-32">
            {aiLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bot className="size-4" aria-hidden="true" />
            )}
            Ask
          </PrimaryButton>
        </form>
      </div>
    </SectionCard>
  );
}

function BalancesPanel({
  splits,
  expenses,
  members,
  currency,
  settlingId,
  onSettle,
}: {
  splits: ExpenseSplit[];
  expenses: Expense[];
  members: WorkspaceMember[];
  currency: string;
  settlingId: string | null;
  onSettle: (split: ExpenseSplit) => Promise<void>;
}) {
  const unpaidCount = splits.filter((split) => split.status === "unpaid").length;
  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]));

  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Settlement"
        title="Balances"
        description={`${unpaidCount} unpaid balance${unpaidCount === 1 ? "" : "s"} ready for testnet or mock settlement.`}
      />

      <div className="mt-6 space-y-3">
        {splits.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No balances yet"
            body="Add an expense split between multiple members to create balances."
          />
        ) : (
          splits.map((split) => {
            const expense = expensesById.get(split.expense_id);
            const settled = split.status === "paid";

            return (
              <div
                key={split.id}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <AvatarToken name={profileLabel(split.profile)} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">
                          {profileLabel(split.profile)} owes{" "}
                          {expense
                            ? userName(expense.paid_by, members)
                            : "the payer"}
                        </p>
                        <Badge tone={settled ? "green" : "amber"}>
                          {settled ? "paid" : "unpaid"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {formatMoney(split.amount_owed, currency)}
                      </p>
                      {split.settlement_tx_hash ? (
                        <a
                          href={baseSepoliaTxUrl(split.settlement_tx_hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 font-mono text-xs font-semibold text-teal-700 hover:underline"
                        >
                          {shortAddress(split.settlement_tx_hash)}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {settled ? (
                    <span className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Paid
                    </span>
                  ) : (
                    <PrimaryButton
                      type="button"
                      onClick={() => void onSettle(split)}
                      disabled={settlingId === split.id}
                      className="h-11 bg-teal-600 shadow-[0_16px_36px_rgba(13,148,136,0.22)] hover:bg-teal-700"
                    >
                      {settlingId === split.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="size-4" aria-hidden="true" />
                      )}
                      Settle
                    </PrimaryButton>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function ExpensesPanel({
  expenses,
  members,
  currency,
}: {
  expenses: Expense[];
  members: WorkspaceMember[];
  currency: string;
}) {
  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Ledger"
        title="Expenses"
        description="Every expense updates spending and equal-split balances."
      />
      <div className="mt-6 space-y-3">
        {expenses.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No expenses"
            body="Add the first receipt to start tracking workspace spending."
          />
        ) : (
          expenses.map((expense) => (
            <div
              key={expense.id}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{expense.title}</h3>
                    <Badge tone="slate">{expense.category}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Paid by {userName(expense.paid_by, members)}.
                  </p>
                  {expense.notes ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {expense.notes}
                    </p>
                  ) : null}
                </div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">
                  {formatMoney(expense.amount, currency)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

function SettlementHistoryPanel({
  settlements,
  currency,
}: {
  settlements: WorkspaceData["settlements"];
  currency: string;
}) {
  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Receipts"
        title="Settlement history"
        description="Confirmed and mock settlements are kept with explorer-ready hashes."
      />
      <div className="mt-6 space-y-3">
        {settlements.map((settlement) => (
          <a
            key={settlement.id}
            href={baseSepoliaTxUrl(settlement.tx_hash)}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-950">
                  {formatMoney(settlement.amount, currency)} settled
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {shortAddress(settlement.tx_hash)} / {settlement.status}
                </p>
              </div>
            </div>
            <ExternalLink className="size-4 text-slate-400" aria-hidden="true" />
          </a>
        ))}
      </div>
    </SectionCard>
  );
}

export function InviteAcceptance({ token }: { token: string }) {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [status, setStatus] = useState<"idle" | "accepting" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("Checking invite");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?next=/invite/${token}`);
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStatus("accepting");
      setMessage("Accepting workspace invite");

      acceptInvite(token)
        .then((workspaceId) => {
          if (cancelled) return;
          setStatus("done");
          setMessage("Invite accepted. Opening workspace.");
          router.replace(`/workspaces/${workspaceId}`);
        })
        .catch((caught) => {
          if (cancelled) return;
          setStatus("error");
          setMessage(caught instanceof Error ? caught.message : "Invite failed");
        });
    });

    return () => {
      cancelled = true;
    };
  }, [loading, router, token, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_44%,#effdfa_100%)] px-4">
      <SectionCard className="w-full max-w-xl text-center" elevated>
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          {status === "error" ? (
            <MailPlus className="size-6" aria-hidden="true" />
          ) : (
            <Loader2
              className={cn("size-6", status !== "done" && "animate-spin")}
              aria-hidden="true"
            />
          )}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          Workspace invite
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        {status === "error" ? (
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            Back to dashboard
          </Link>
        ) : null}
      </SectionCard>
    </main>
  );
}
