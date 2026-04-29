"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Database,
  ExternalLink,
  ScanLine,
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
  XCircle,
} from "lucide-react";
import { isAddress, type Address, type Hash } from "viem";
import {
  useAccount,
  useChainId,
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
import { SmartSlipScanModal } from "@/components/SmartSlipScanModal";
import { getAxlStatus } from "@/lib/axl";
import {
  acceptInvite,
  addExpense,
  cancelInvite,
  createInvite,
  getInvitePreview,
  getWorkspace,
  recordSettlement,
  saveAiMessage,
} from "@/lib/storage";
import {
  defaultSettlementNetwork,
  settlementNetworkLabel,
  settlementNetworkTxUrl,
} from "@/lib/networks";
import {
  demoUSDC,
  demoUSDCAbi,
  formatDemoUSDCAmount,
  isDemoUSDCConfigured,
  parseDemoUSDCAmount,
} from "@/lib/tokens";
import { wagmiConfig } from "@/lib/wagmi";
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
  Invite,
  InvitePreview,
  WorkspaceData,
  WorkspaceMember,
} from "@/types/splitsafe";
import type { SlipScanResult } from "@/types/slip-scan";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

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
type GroupTab = "overview" | "expenses" | "balances" | "ai" | "members";

const groupTabs: Array<{
  id: GroupTab;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Budget, activity, and quick actions",
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Add, scan, and review the ledger",
  },
  {
    id: "balances",
    label: "Balances",
    description: "Who owes who and payment history",
  },
  {
    id: "ai",
    label: "AI",
    description: "Copilot and Smart Settlement",
  },
  {
    id: "members",
    label: "Members",
    description: "People, roles, and invites",
  },
];

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

function mapScanCategory(category: string) {
  const directCategory = expenseCategories.includes(category) ? category : null;

  if (directCategory) return directCategory;
  if (category === "hotel") return "travel";
  if (category === "shopping" || category === "utilities") return "supplies";
  if (category === "entertainment") return "event";

  return "other";
}

function buildScanNotes(result: SlipScanResult) {
  return [
    "Scanned by AI.",
    result.merchant ? `Merchant: ${result.merchant}` : null,
    result.date ? `Date: ${result.date}` : null,
    result.currency ? `Currency: ${result.currency}` : null,
    `Payment method: ${result.paymentMethod}`,
    result.transactionReference ? `Reference: ${result.transactionReference}` : null,
    `Confidence: ${Math.round(result.confidence * 100)}%`,
    result.notes ? `Notes: ${result.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function splitExpenseNotes(notes?: string | null) {
  const lines = (notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const technicalPrefixes = [
    "paymentStatus:",
    "checkoutStatus:",
    "contractAddress:",
    "checkoutSessionId:",
    "network:",
    "settlementMethod:",
    "transactionHash:",
  ];
  const technicalLines = lines.filter((line) =>
    technicalPrefixes.some((prefix) => line.startsWith(prefix)),
  );
  const publicLines = lines.filter(
    (line) =>
      !technicalLines.includes(line) && line !== "Demo payment references only.",
  );

  return {
    publicNotes: publicLines.join("\n"),
    technicalDetails: technicalLines.map((line) => {
      const [label, ...valueParts] = line.split(":");
      return {
        label,
        value: valueParts.join(":").trim(),
      };
    }),
  };
}

function technicalValue(notes: string | null | undefined, key: string) {
  const { technicalDetails } = splitExpenseNotes(notes);
  return technicalDetails.find((detail) => detail.label === key)?.value ?? null;
}

function humanizeTechnicalLabel(label: string) {
  const labels: Record<string, string> = {
    paymentStatus: "Payment status",
    checkoutStatus: "Checkout status",
    contractAddress: "Contract",
    checkoutSessionId: "Checkout session",
    network: "Network",
    settlementMethod: "Method",
    transactionHash: "Transaction",
  };

  return labels[label] ?? label;
}

function paymentStatusTone(status?: string | null): "green" | "amber" | "rose" | "slate" {
  const normalized = status?.toLowerCase();

  if (normalized === "paid" || normalized === "confirmed") return "green";
  if (normalized === "verified" || normalized === "settled") return "green";
  if (normalized === "failed") return "rose";
  if (normalized === "rejected") return "rose";
  if (
    normalized === "pending" ||
    normalized === "mock_checkout_created" ||
    normalized === "instructions_shown" ||
    normalized === "proof_submitted" ||
    normalized === "verifying"
  ) return "amber";

  return "slate";
}

function paymentStatusLabel(status?: string | null) {
  const normalized = status?.toLowerCase();

  if (!normalized) return "Ready";
  if (normalized === "paid" || normalized === "confirmed") return "Paid";
  if (normalized === "pending" || normalized === "mock_checkout_created") return "Ready";
  if (normalized === "mocked") return "Recorded";
  if (normalized === "settled" || normalized === "verified") return "Settled";
  if (normalized === "proof_submitted") return "Proof submitted";
  if (normalized === "instructions_shown") return "Instructions shown";
  if (normalized === "verifying") return "Verifying";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "failed") return "Needs review";

  return normalized.replaceAll("_", " ");
}

function normalizeTxHashInput(value: string) {
  return value.match(/0x[a-fA-F0-9]{64}/)?.[0] ?? value.trim();
}

function isTxHash(value?: string | null) {
  return Boolean(value?.match(/^0x[a-fA-F0-9]{64}$/));
}

function settlementErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : String(caught);
  const lowered = message.toLowerCase();

  if (
    lowered.includes("user rejected") ||
    lowered.includes("user denied") ||
    lowered.includes("rejected the request")
  ) {
    return "Transaction cancelled.";
  }

  if (lowered.includes("insufficient funds") || lowered.includes("gas")) {
    return "You need 0G testnet tokens for gas. Get them from the 0G faucet.";
  }

  return message || "Settlement failed.";
}

function transactionExplorerUrl(hash: string, network?: string | null) {
  return settlementNetworkTxUrl(hash, network);
}

function userName(userId: string, members: WorkspaceMember[]) {
  return memberName(userId, members);
}

function activeMembers(members: WorkspaceMember[]) {
  return members.filter((member) => member.status === "active");
}

function inviteUrl(inviteToken: string) {
  const origin =
    typeof window === "undefined"
      ? "https://splitsafe.vercel.app"
      : window.location.origin;

  return `${origin}/invite/${inviteToken}`;
}

function formatInviteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function inviteStatusTone(status: Invite["status"]) {
  if (status === "pending") return "amber";
  if (status === "accepted") return "green";
  return "slate";
}

export function GroupWorkspace({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { isDemoUser, loading: authLoading, user } = useAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteForm, setInviteForm] =
    useState<CreateInviteInput>(initialInviteForm);
  const [expenseForm, setExpenseForm] =
    useState<CreateExpenseInput>(initialExpenseForm);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviteEmailNotice, setInviteEmailNotice] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState("Who still needs to pay?");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<SlipScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<GroupTab>("overview");
  const [settlementSplit, setSettlementSplit] = useState<ExpenseSplit | null>(
    null,
  );
  const [settlementProof, setSettlementProof] = useState("");
  const [settlementNotice, setSettlementNotice] = useState<string | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementAction, setSettlementAction] = useState<string | null>(null);
  const [demoUsdcBalance, setDemoUsdcBalance] = useState<string | null>(null);

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
        caught instanceof Error ? caught.message : "Could not load group",
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

  const settlementExpense = settlementSplit
    ? expensesById.get(settlementSplit.expense_id) ?? null
    : null;

  const loadDemoUsdcBalance = useCallback(async () => {
    if (!address || !demoUSDC.address) {
      setDemoUsdcBalance(null);
      return;
    }

    try {
      const balance = await readContract(wagmiConfig, {
        address: demoUSDC.address,
        abi: demoUSDCAbi,
        functionName: "balanceOf",
        args: [address],
        chainId: defaultSettlementNetwork.chainId,
      });

      setDemoUsdcBalance(formatDemoUSDCAmount(balance));
    } catch {
      setDemoUsdcBalance(null);
    }
  }, [address]);

  useEffect(() => {
    if (!settlementSplit) return;
    queueMicrotask(() => void loadDemoUsdcBalance());
  }, [loadDemoUsdcBalance, settlementSplit]);

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
        topCategoryAmount: 0,
        pendingAmount: 0,
        unpaidCount: 0,
        youOwe: 0,
        owedToYou: 0,
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
    const unpaidSplits = workspace.splits.filter((split) => split.status === "unpaid");
    const expensesById = new Map(workspace.expenses.map((expense) => [expense.id, expense]));
    const currentUserId = user?.id ?? "";

    return {
      totalSpent,
      remaining,
      spentPercent:
        workspace.workspace.total_budget > 0
          ? Math.min((totalSpent / workspace.workspace.total_budget) * 100, 100)
          : 0,
      topCategory: sortedCategories[0]?.[0] ?? "none",
      topCategoryAmount: sortedCategories[0]?.[1] ?? 0,
      pendingAmount,
      unpaidCount: unpaidSplits.length,
      youOwe: unpaidSplits
        .filter((split) => split.user_id === currentUserId)
        .reduce((sum, split) => sum + split.amount_owed, 0),
      owedToYou: unpaidSplits
        .filter((split) => expensesById.get(split.expense_id)?.paid_by === currentUserId)
        .reduce((sum, split) => sum + split.amount_owed, 0),
      categoryTotals: sortedCategories,
    };
  }, [user?.id, workspace]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteSaving(true);
    setError(null);
    setInviteLink(null);
    setInviteNotice(null);
    setInviteEmailNotice(null);

    try {
      if (!inviteForm.invited_email.trim()) {
        throw new Error("Invite email is required");
      }

      const invite = await createInvite(groupId, inviteForm);
      const link = inviteUrl(invite.invite_token);
      setInviteLink(link);
      setInviteNotice("Invite created. Share this link or send by email.");
      setInviteEmailNotice(
        "Email delivery is not configured yet. Copy the invite link to share manually.",
      );
      setInviteForm(initialInviteForm);
      await refreshWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create invite");
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleCopyInvite(inviteToken: string) {
    const link = inviteUrl(inviteToken);
    await navigator.clipboard?.writeText(link);
    setInviteLink(link);
    setInviteNotice("Invite link copied.");
  }

  async function handleCancelInvite(inviteId: string) {
    setCancellingInviteId(inviteId);
    setError(null);

    try {
      await cancelInvite(inviteId);
      setInviteNotice("Invite cancelled.");
      await refreshWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel invite");
    } finally {
      setCancellingInviteId(null);
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
      setScanNotice(null);
      setLastScanResult(null);
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

  function handleUseScanResult(result: SlipScanResult) {
    setExpenseForm((current) => ({
      ...current,
      title: result.title || result.merchant || "Scanned expense",
      amount: result.amount ?? current.amount,
      category: mapScanCategory(result.category),
      notes: buildScanNotes(result),
    }));
    setLastScanResult(result);
    setScanNotice("Expense auto-filled from slip. Please review before saving.");
  }

  async function ensureDefaultSettlementNetwork() {
    if (chainId !== defaultSettlementNetwork.chainId) {
      await switchChainAsync({ chainId: defaultSettlementNetwork.chainId });
    }
  }

  function openSettlement(split: ExpenseSplit) {
    setSettlementSplit(split);
    setSettlementProof("");
    setSettlementNotice(null);
    setSettlementError(null);
    setSettlementAction(null);
  }

  function handleSettle(split: ExpenseSplit) {
    openSettlement(split);
  }

  function handleSettleAllMyDebts() {
    const myDebts = (workspace?.splits ?? []).filter(
      (split) => split.status === "unpaid" && split.user_id === user?.id,
    );
    if (myDebts.length === 0) return;

    openSettlement(myDebts[0]);
  }

  async function handleAddDemoUsdcToWallet() {
    setSettlementError(null);

    if (!demoUSDC.address) {
      setSettlementError("Demo USDC contract is not configured yet.");
      return;
    }

    const ethereum = window.ethereum as EthereumProvider | undefined;

    if (!ethereum) {
      setSettlementNotice(
        `MetaMask import is unavailable. Import ${demoUSDC.symbol} manually with ${demoUSDC.address}.`,
      );
      return;
    }

    try {
      await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: demoUSDC.address,
            symbol: demoUSDC.symbol,
            decimals: demoUSDC.decimals,
          },
        },
      });
      setSettlementNotice("dUSDC added to MetaMask.");
    } catch (caught) {
      setSettlementError(settlementErrorMessage(caught));
    }
  }

  async function handleGetDemoUsdc() {
    setSettlementAction("mint");
    setSettlementError(null);
    setSettlementNotice(null);

    try {
      if (!demoUSDC.address) {
        throw new Error("Demo USDC contract is not configured yet.");
      }
      if (!isConnected || !address) {
        throw new Error("Connect your wallet to get demo dUSDC.");
      }

      await ensureDefaultSettlementNetwork();

      const hash = await writeContract(wagmiConfig, {
        address: demoUSDC.address,
        abi: demoUSDCAbi,
        functionName: "faucetMint",
        chainId: defaultSettlementNetwork.chainId,
      });

      await waitForTransactionReceipt(wagmiConfig, {
        chainId: defaultSettlementNetwork.chainId,
        hash: hash as Hash,
      });

      setSettlementNotice("1000 dUSDC minted to your wallet.");
      await loadDemoUsdcBalance();
    } catch (caught) {
      setSettlementError(settlementErrorMessage(caught));
    } finally {
      setSettlementAction(null);
    }
  }

  async function verifyAndRecordSettlement(
    split: ExpenseSplit,
    txHash: string,
    senderWallet: string,
  ) {
    const expense = expensesById.get(split.expense_id);
    const receiverWallet = expense?.paid_by_profile?.wallet_address ?? "";

    if (!demoUSDC.address) {
      throw new Error("Demo USDC contract is not configured.");
    }
    if (!isAddress(senderWallet)) {
      throw new Error("Connect the wallet that sent the dUSDC payment.");
    }
    if (!isAddress(receiverWallet)) {
      throw new Error("Recipient wallet is missing for this member.");
    }

    setSettlementAction("verify");
    setSettlementNotice("Verifying dUSDC transfer on 0G Galileo Testnet...");

    const response = await fetch("/api/verify-token-settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network: defaultSettlementNetwork.id,
        txHash,
        tokenAddress: demoUSDC.address,
        expectedSender: senderWallet,
        expectedRecipient: receiverWallet,
        expectedAmount: String(split.amount_owed),
        decimals: demoUSDC.decimals,
      }),
    });

    const result = (await response.json()) as {
      ok: boolean;
      verified?: boolean;
      reason?: string;
      error?: string;
      explorerUrl?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Could not verify transaction.");
    }

    if (!result.verified) {
      throw new Error(result.reason || "No matching dUSDC transfer found.");
    }

    await recordSettlement({
      splitId: split.id,
      senderWallet,
      receiverWallet,
      amount: split.amount_owed,
      txHash,
      status: "settled",
      network: defaultSettlementNetwork.id,
    });

    setSettlementNotice("Verified on 0G Galileo Testnet.");
    await refreshWorkspace();
  }

  async function handleSendDemoUsdc(split: ExpenseSplit) {
    const expense = expensesById.get(split.expense_id);
    const receiverWallet = expense?.paid_by_profile?.wallet_address ?? "";

    setSettlementAction("send");
    setSettlementError(null);
    setSettlementNotice(null);

    try {
      if (!demoUSDC.address) {
        throw new Error("Demo USDC contract is not configured.");
      }
      if (!isConnected || !address) {
        throw new Error("Connect your wallet to send dUSDC.");
      }
      if (!isAddress(receiverWallet)) {
        throw new Error("Recipient wallet is missing for this member.");
      }

      await ensureDefaultSettlementNetwork();

      const hash = await writeContract(wagmiConfig, {
        address: demoUSDC.address,
        abi: demoUSDCAbi,
        functionName: "transfer",
        args: [receiverWallet as Address, parseDemoUSDCAmount(split.amount_owed)],
        chainId: defaultSettlementNetwork.chainId,
      });

      await waitForTransactionReceipt(wagmiConfig, {
        chainId: defaultSettlementNetwork.chainId,
        hash: hash as Hash,
      });

      setSettlementProof(hash);
      await verifyAndRecordSettlement(split, hash, address);
      await loadDemoUsdcBalance();
    } catch (caught) {
      setSettlementError(settlementErrorMessage(caught));
    } finally {
      setSettlementAction(null);
    }
  }

  async function handleVerifyManualProof(split: ExpenseSplit) {
    setSettlementAction("verify");
    setSettlementError(null);
    setSettlementNotice(null);

    try {
      if (!address) throw new Error("Connect the wallet that paid with dUSDC.");
      const txHash = normalizeTxHashInput(settlementProof);
      await verifyAndRecordSettlement(split, txHash, address);
    } catch (caught) {
      setSettlementError(settlementErrorMessage(caught));
    } finally {
      setSettlementAction(null);
    }
  }

  async function handleUseMockProof(split: ExpenseSplit) {
    const expense = expensesById.get(split.expense_id);
    const receiverWallet = expense?.paid_by_profile?.wallet_address ?? "mock-recipient";

    setSettlementAction("mock");
    setSettlementError(null);
    setSettlementNotice(null);

    try {
      if (!isDemoUser || isDemoUSDCConfigured()) {
        throw new Error("Mock dUSDC proof is only available for demo mode.");
      }

      await recordSettlement({
        splitId: split.id,
        senderWallet: address ?? "mock-wallet",
        receiverWallet,
        amount: split.amount_owed,
        txHash: `mock-dusdc-proof-${Date.now()}`,
        status: "settled",
        network: defaultSettlementNetwork.id,
      });

      setSettlementNotice("Mock dUSDC proof recorded for demo only.");
      await refreshWorkspace();
    } catch (caught) {
      setSettlementError(settlementErrorMessage(caught));
    } finally {
      setSettlementAction(null);
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
        result.summary ?? "I could not summarize this group yet.";
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

  function openAiWithQuestion(question: string) {
    setAiQuestion(question);
    setActiveTab("ai");
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-600" aria-hidden="true" />
          Loading group
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
            title="Group not found"
            body="This group does not exist or your account is not a member."
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
    <AppShell eyebrow={`${room.name} group`}>
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
                <Badge tone="green">Private group</Badge>
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
                  Unpaid balances
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

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800 shadow-sm">
            {error}
          </div>
        ) : null}

        <FlowSteps />
        <GroupTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Group budget"
                value={formatMoney(room.total_budget, room.currency)}
                detail={`Budget currency: ${room.currency}`}
                icon={CircleDollarSign}
                tone="blue"
              />
              <StatCard
                label="Spent"
                value={formatMoney(metrics.totalSpent, room.currency)}
                detail={`${metrics.spentPercent.toFixed(0)}% through budget`}
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

            <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
              <div className="space-y-6">
                <SpendingOverviewCard
                  metrics={metrics}
                  currency={room.currency}
                />
                <AiSummaryCard
                  groupName={room.name}
                  budget={room.total_budget}
                  currency={room.currency}
                  totalSpent={metrics.totalSpent}
                  remaining={metrics.remaining}
                  unpaidCount={metrics.unpaidCount}
                  topCategory={metrics.topCategory}
                />
                <AiInsightCards
                  metrics={metrics}
                  currency={room.currency}
                  onAskAi={openAiWithQuestion}
                  onSettle={() => setActiveTab("balances")}
                  onAddExpense={() => setActiveTab("expenses")}
                />
              </div>
              <div className="space-y-6">
                <QuickActionsPanel
                  canManage={canManage}
                  onAddExpense={() => setActiveTab("expenses")}
                  onScanReceipt={() => {
                    setActiveTab("expenses");
                    setScanOpen(true);
                  }}
                  onInviteMember={() => setActiveTab("members")}
                  onSettle={() => setActiveTab("balances")}
                />
                <RecentActivityPanel
                  expenses={expenses}
                  settlements={settlements}
                  invites={invites}
                  currency={room.currency}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "members" ? (
          <MembersPanel
            members={members}
            invites={invites}
            canManage={canManage}
            inviteForm={inviteForm}
            inviteSaving={inviteSaving}
            inviteLink={inviteLink}
            inviteNotice={inviteNotice}
            inviteEmailNotice={inviteEmailNotice}
            cancellingInviteId={cancellingInviteId}
            setInviteForm={setInviteForm}
            onInvite={handleInvite}
            onCopyInvite={handleCopyInvite}
            onCancelInvite={handleCancelInvite}
          />
        ) : null}

        {activeTab === "expenses" ? (
          <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
            <ExpenseFormPanel
              members={members}
              canManage={canManage}
              currentUserId={user?.id ?? ""}
              groupCurrency={room.currency}
              expenseForm={expenseForm}
              expenseSaving={expenseSaving}
              sharePreview={sharePreview}
              scanNotice={scanNotice}
              lastScanResult={lastScanResult}
              onOpenScan={() => setScanOpen(true)}
              setExpenseForm={setExpenseForm}
              toggleSplitUser={toggleSplitUser}
              onSubmit={handleAddExpense}
            />
            <ExpensesPanel
              expenses={expenses}
              members={members}
              currency={room.currency}
            />
          </section>
        ) : null}

        {activeTab === "balances" ? (
          <div className="space-y-6">
            <BalancesPanel
              splits={splits}
              expenses={expenses}
              settlements={settlements}
              members={members}
              currency={room.currency}
              currentUserId={user?.id ?? ""}
              onSettle={handleSettle}
              onSettleAll={handleSettleAllMyDebts}
            />
            {settlements.length > 0 ? (
              <SettlementHistoryPanel
                settlements={settlements}
                currency={room.currency}
              />
            ) : null}
          </div>
        ) : null}

        {activeTab === "ai" ? (
          <div className="space-y-6">
            <AiInsightCards
              metrics={metrics}
              currency={room.currency}
              onAskAi={openAiWithQuestion}
              onSettle={() => setActiveTab("balances")}
              onAddExpense={() => setActiveTab("expenses")}
            />
            <SmartSettlementPanel onSettle={() => setActiveTab("balances")} />
            <AssistantPanel
              aiMessages={aiMessages}
              aiQuestion={aiQuestion}
              aiLoading={aiLoading}
              aiStatus={aiStatus}
              setAiQuestion={setAiQuestion}
              onSubmit={handleAskAi}
            />
          </div>
        ) : null}
        <SmartSlipScanModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onUseResult={handleUseScanResult}
        />
        {settlementSplit ? (
          <DemoUsdcSettlementModal
            split={settlementSplit}
            expense={settlementExpense}
            connectedAddress={address}
            isConnected={isConnected}
            chainId={chainId}
            isDemoUser={isDemoUser}
            balance={demoUsdcBalance}
            proof={settlementProof}
            notice={settlementNotice}
            error={settlementError}
            action={settlementAction}
            onProofChange={setSettlementProof}
            onClose={() => {
              setSettlementSplit(null);
              setSettlementProof("");
              setSettlementNotice(null);
              setSettlementError(null);
              setSettlementAction(null);
            }}
            onSwitchNetwork={() => void ensureDefaultSettlementNetwork()}
            onAddToken={() => void handleAddDemoUsdcToWallet()}
            onMint={() => void handleGetDemoUsdc()}
            onSend={() => void handleSendDemoUsdc(settlementSplit)}
            onVerifyProof={() => void handleVerifyManualProof(settlementSplit)}
            onMockProof={() => void handleUseMockProof(settlementSplit)}
            onCopy={(text, message) => {
              void navigator.clipboard.writeText(text);
              setSettlementNotice(message);
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function FlowSteps() {
  const steps = [
    "Create group",
    "Add or scan expense",
    "See who owes",
    "Ask AI",
    "Settle payment",
  ];

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/85 p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-slate-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupTabs({
  activeTab,
  onChange,
}: {
  activeTab: GroupTab;
  onChange: (tab: GroupTab) => void;
}) {
  return (
    <div className="grid gap-2 rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm md:grid-cols-5">
      {groupTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-2xl px-4 py-3 text-left hover:bg-slate-50",
            activeTab === tab.id && "bg-slate-950 text-white hover:bg-slate-950",
          )}
        >
          <span className="block text-sm font-semibold">{tab.label}</span>
          <span
            className={cn(
              "mt-1 block text-xs leading-5 text-slate-500",
              activeTab === tab.id && "text-slate-300",
            )}
          >
            {tab.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function QuickActionsPanel({
  canManage,
  onAddExpense,
  onScanReceipt,
  onInviteMember,
  onSettle,
}: {
  canManage: boolean;
  onAddExpense: () => void;
  onScanReceipt: () => void;
  onInviteMember: () => void;
  onSettle: () => void;
}) {
  const actions = [
    { label: "Add expense", icon: Plus, onClick: onAddExpense, primary: true },
    { label: "Scan receipt", icon: ScanLine, onClick: onScanReceipt },
    { label: "Invite member", icon: MailPlus, onClick: onInviteMember, disabled: !canManage },
    { label: "Settle", icon: Send, onClick: onSettle },
  ];

  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Next step"
        title="Quick actions"
        description="Move through the core SplitSafe flow without hunting through the page."
      />
      <div className="mt-5 grid gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "flex h-12 items-center justify-between rounded-2xl border px-4 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-55",
              action.primary
                ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-800",
            )}
          >
            <span className="flex items-center gap-2">
              <action.icon className="size-4" aria-hidden="true" />
              {action.label}
            </span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

function RecentActivityPanel({
  expenses,
  settlements,
  invites,
  currency,
}: {
  expenses: Expense[];
  settlements: WorkspaceData["settlements"];
  invites: Invite[];
  currency: string;
}) {
  const activity = [
    ...expenses.slice(0, 3).map((expense) => ({
      id: `expense-${expense.id}`,
      title: expense.title,
      detail: `${formatMoney(expense.amount, currency)} expense`,
      date: expense.created_at,
    })),
    ...settlements.slice(0, 2).map((settlement) => ({
      id: `settlement-${settlement.id}`,
      title: "Payment recorded",
      detail: `${formatMoney(settlement.amount, demoUSDC.symbol)} settled`,
      date: settlement.created_at,
    })),
    ...invites.slice(0, 2).map((invite) => ({
      id: `invite-${invite.id}`,
      title: invite.invited_email,
      detail: `${invite.status} invite`,
      date: invite.created_at,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Activity"
        title="Recent activity"
        description="Latest expenses, invites, and payments in this group."
      />
      <div className="mt-5 space-y-3">
        {activity.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nothing yet"
            body="Add an expense or invite a member to start the timeline."
          />
        ) : (
          activity.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <p className="font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {item.detail} · {formatInviteDate(item.date)}
              </p>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

function SpendingOverviewCard({
  metrics,
  currency,
}: {
  metrics: {
    spentPercent: number;
    remaining: number;
    topCategory: string;
    categoryTotals: Array<[string, number]>;
  };
  currency: string;
}) {
  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Spending overview"
        title="Top spending category"
        description={`Highest category: ${metrics.topCategory}. Track this first before adding more expenses.`}
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
                {formatMoney(amount, currency)}
              </p>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

function AiSummaryCard({
  groupName,
  budget,
  currency,
  totalSpent,
  remaining,
  unpaidCount,
  topCategory,
}: {
  groupName: string;
  budget: number;
  currency: string;
  totalSpent: number;
  remaining: number;
  unpaidCount: number;
  topCategory: string;
}) {
  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="AI summary"
        title="Group snapshot"
        description="A plain-language budget brief without opening the chat."
      />
      <p className="mt-5 rounded-[24px] border border-teal-100 bg-teal-50/70 p-5 text-sm leading-7 text-slate-700">
        {groupName} has spent {formatMoney(totalSpent, currency)} out of{" "}
        {formatMoney(budget, currency)}. Top spending is {topCategory}.{" "}
        {unpaidCount} unpaid balance{unpaidCount === 1 ? "" : "s"} remain.{" "}
        {remaining < 0
          ? `The group is over budget by ${formatMoney(Math.abs(remaining), currency)}.`
          : `${formatMoney(remaining, currency)} remains.`}
      </p>
    </SectionCard>
  );
}

function AiInsightCards({
  metrics,
  currency,
  onAskAi,
  onSettle,
  onAddExpense,
}: {
  metrics: {
    topCategory: string;
    topCategoryAmount: number;
    unpaidCount: number;
    spentPercent: number;
  };
  currency: string;
  onAskAi: (question: string) => void;
  onSettle: () => void;
  onAddExpense: () => void;
}) {
  const cards = [
    {
      title:
        metrics.topCategory === "none"
          ? "No spending category yet"
          : `${metrics.topCategory} is your highest category`,
      detail:
        metrics.topCategory === "none"
          ? "Add the first expense to unlock category insights."
          : `${formatMoney(metrics.topCategoryAmount, currency)} recorded so far.`,
      action: "Ask AI",
      onClick: () => onAskAi("Where did we spend the most?"),
    },
    {
      title: `${metrics.unpaidCount} unpaid balance${metrics.unpaidCount === 1 ? "" : "s"} remain`,
      detail: "Open balances to settle with dUSDC.",
      action: "Settle now",
      onClick: onSettle,
    },
    {
      title: `You are ${metrics.spentPercent.toFixed(0)}% through budget`,
      detail: "Scan another receipt or add a manual expense to keep the ledger fresh.",
      action: "Add expense",
      onClick: onAddExpense,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.06)]"
        >
          <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-950">
            {card.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{card.detail}</p>
          <button
            type="button"
            onClick={card.onClick}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            {card.action}
          </button>
        </div>
      ))}
    </div>
  );
}

function MembersPanel({
  members,
  invites,
  canManage,
  inviteForm,
  inviteSaving,
  inviteLink,
  inviteNotice,
  inviteEmailNotice,
  cancellingInviteId,
  setInviteForm,
  onInvite,
  onCopyInvite,
  onCancelInvite,
}: {
  members: WorkspaceMember[];
  invites: WorkspaceData["invites"];
  canManage: boolean;
  inviteForm: CreateInviteInput;
  inviteSaving: boolean;
  inviteLink: string | null;
  inviteNotice: string | null;
  inviteEmailNotice: string | null;
  cancellingInviteId: string | null;
  setInviteForm: React.Dispatch<React.SetStateAction<CreateInviteInput>>;
  onInvite: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCopyInvite: (inviteToken: string) => Promise<void>;
  onCancelInvite: (inviteId: string) => Promise<void>;
}) {
  const groupedInvites = {
    pending: invites.filter((invite) => invite.status === "pending"),
    accepted: invites.filter((invite) => invite.status === "accepted"),
    expired: invites.filter((invite) => invite.status === "expired"),
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
      <SectionCard elevated>
        <SectionHeader
          eyebrow="Members"
          title="Invite members"
          description="Private group: only members can access this group."
        />

        {canManage ? (
          <form onSubmit={onInvite} className="mt-6 space-y-4">
            <FieldLabel label="Invite by email">
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
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
            {inviteNotice ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-800">
                {inviteNotice}
              </div>
            ) : null}
            {inviteEmailNotice ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {inviteEmailNotice}
              </div>
            ) : null}
            {inviteLink ? (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(inviteLink)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-800"
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
      </SectionCard>

      <SectionCard elevated>
        <SectionHeader
          eyebrow="Invites"
          title="Pending invites"
          description="Copy invite links manually until email delivery is configured."
        />

        <div className="mt-6 space-y-6">
          <InviteStatusList
            title="Pending invites"
            empty="No pending invites."
            invites={groupedInvites.pending}
            canManage={canManage}
            cancellingInviteId={cancellingInviteId}
            onCopyInvite={onCopyInvite}
            onCancelInvite={onCancelInvite}
          />
          <InviteStatusList
            title="Accepted invites"
            empty="No accepted invites yet."
            invites={groupedInvites.accepted}
            canManage={canManage}
            cancellingInviteId={cancellingInviteId}
            onCopyInvite={onCopyInvite}
            onCancelInvite={onCancelInvite}
          />
          <InviteStatusList
            title="Expired invites"
            empty="No expired invites."
            invites={groupedInvites.expired}
            canManage={canManage}
            cancellingInviteId={cancellingInviteId}
            onCopyInvite={onCopyInvite}
            onCancelInvite={onCancelInvite}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function InviteStatusList({
  title,
  empty,
  invites,
  canManage,
  cancellingInviteId,
  onCopyInvite,
  onCancelInvite,
}: {
  title: string;
  empty: string;
  invites: Invite[];
  canManage: boolean;
  cancellingInviteId: string | null;
  onCopyInvite: (inviteToken: string) => Promise<void>;
  onCancelInvite: (inviteId: string) => Promise<void>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {invites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            {empty}
          </div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm md:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-slate-950">
                    {invite.invited_email}
                  </p>
                  <Badge tone={inviteStatusTone(invite.status)}>
                    {invite.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {invite.role} · Invited {formatInviteDate(invite.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => void onCopyInvite(invite.invite_token)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-800"
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  Copy invite link
                </button>
                {canManage && invite.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => void onCancelInvite(invite.id)}
                    disabled={cancellingInviteId === invite.id}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancellingInviteId === invite.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-3.5" aria-hidden="true" />
                    )}
                    Cancel invite
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
  scanNotice,
  lastScanResult,
  onOpenScan,
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
  scanNotice: string | null;
  lastScanResult: SlipScanResult | null;
  onOpenScan: () => void;
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
        <div className="rounded-[24px] border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                AI Assist
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload a receipt or bank slip to auto-fill this expense.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenScan}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-teal-200 hover:-translate-y-0.5 hover:bg-teal-50"
            >
              <ScanLine className="size-4 text-teal-700" aria-hidden="true" />
              Smart Slip Scan
            </button>
          </div>
          {scanNotice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              {scanNotice}
            </div>
          ) : null}
          {lastScanResult ? (
            <ScanResultCard result={lastScanResult} groupCurrency={groupCurrency} />
          ) : null}
        </div>

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

function ScanResultCard({
  result,
  groupCurrency,
}: {
  result: SlipScanResult;
  groupCurrency: string;
}) {
  const amount =
    result.amount === null
      ? "Amount missing"
      : formatMoney(result.amount, result.currency ?? groupCurrency);

  return (
    <div className="mt-4 rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            Scan result added to expense
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {result.merchant ?? result.title ?? "Scanned expense"}
          </p>
        </div>
        <Badge tone={result.confidence < 0.7 ? "amber" : "green"}>
          {Math.round(result.confidence * 100)}% confidence
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniDetail label="Amount" value={amount} />
        <MiniDetail label="Category" value={result.category} />
        <MiniDetail label="Status" value="Added to expense" />
      </div>
    </div>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function titleCaseStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SmartSettlementPanel({ onSettle }: { onSettle: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const axlStatus = getAxlStatus();
  const cards = [
    {
      title: "Expense checked",
      description: "We review the amount, payer, members, and split method.",
    },
    {
      title: "Split calculated",
      description: "The app calculates each person's share automatically.",
    },
    {
      title: "Settlement ready",
      description: "See the simplest payback path and mark payments as settled.",
    },
  ];

  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="Settlement"
        title="Smart Settlement"
        description="AI checks expenses, calculates who owes whom, and helps the group settle faster."
        action={
          <div className="text-right">
            <Badge tone="teal">AXL-ready</Badge>
            <p className="mt-1 max-w-52 text-xs leading-5 text-slate-500">
              AI coordination layer for secure settlement processing.
            </p>
          </div>
        }
      />

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {cards.map((card, index) => (
          <div
            key={card.title}
            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-950">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <PrimaryButton type="button" onClick={onSettle}>
          <Send className="size-4" aria-hidden="true" />
          Settle up
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50"
        >
          View details
        </button>
      </div>

      {showDetails ? (
        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-950">
            AI Infrastructure
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniDetail label="AI Routing" value={titleCaseStatus(axlStatus.routing)} />
            <MiniDetail label="AXL Process" value={titleCaseStatus(axlStatus.axlProcess)} />
            <MiniDetail
              label="Settlement Assistant"
              value={titleCaseStatus(axlStatus.settlementAssistant)}
            />
            <MiniDetail label="Safety Check" value={titleCaseStatus(axlStatus.safetyCheck)} />
          </div>
        </div>
      ) : null}
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
      ? { label: "AI assistant active", tone: "teal" as const }
      : aiStatus === "unavailable"
        ? {
            label: "AI assistant needs review",
            tone: "amber" as const,
          }
        : aiStatus === "fallback"
          ? { label: "AI assistant ready", tone: "slate" as const }
          : { label: "AI assistant ready", tone: "slate" as const };

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
              title="Ask the group budget"
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
  settlements,
  members,
  currency,
  currentUserId,
  onSettle,
  onSettleAll,
}: {
  splits: ExpenseSplit[];
  expenses: Expense[];
  settlements: WorkspaceData["settlements"];
  members: WorkspaceMember[];
  currency: string;
  currentUserId: string;
  onSettle: (split: ExpenseSplit) => void;
  onSettleAll: () => void;
}) {
  const unpaidSplits = splits.filter((split) => split.status === "unpaid");
  const unpaidCount = unpaidSplits.length;
  const myDebts = unpaidSplits.filter((split) => split.user_id === currentUserId);
  const myDebtTotal = myDebts.reduce((sum, split) => sum + split.amount_owed, 0);
  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]));
  const settlementsBySplitId = new Map(
    settlements.map((settlement) => [settlement.expense_split_id, settlement]),
  );

  return (
    <SectionCard elevated>
      <SectionHeader
        eyebrow="dUSDC settlement"
        title="Unpaid balances"
        description={`${unpaidCount} balance${
          unpaidCount === 1 ? "" : "s"
        } ready for dUSDC settlement.`}
        action={
          myDebts.length > 0 ? (
            <PrimaryButton
              type="button"
              onClick={() => void onSettleAll()}
              className="h-11 bg-teal-600 px-4 shadow-[0_16px_36px_rgba(13,148,136,0.22)] hover:bg-teal-700"
            >
              <Send className="size-4" aria-hidden="true" />
              Settle up
            </PrimaryButton>
          ) : null
        }
      />

      {myDebts.length > 0 ? (
        <div className="mt-5 rounded-[24px] border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            Your settlement total
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-slate-950">
                {formatMoney(myDebtTotal, currency)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Pay {formatMoney(myDebtTotal, demoUSDC.symbol)} on{" "}
                {defaultSettlementNetwork.label}.
              </p>
              <p className="mt-1 text-xs font-semibold text-teal-700">
                Testnet demo token - no real value.
              </p>
            </div>
            <Badge tone="teal">Settlement token: {demoUSDC.symbol}</Badge>
          </div>
        </div>
      ) : null}

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
            const settlement = settlementsBySplitId.get(split.id);
            const splitNetwork = settlement?.network ?? defaultSettlementNetwork.id;
            const settled = split.status === "paid";

            return (
              <div
                key={split.id}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <AvatarToken name={profileLabel(split.profile)} />
                    <div className="min-w-0 flex-1">
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
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                           Token: {demoUSDC.symbol}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          Network: {settlementNetworkLabel(splitNetwork)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                           Gas token: {defaultSettlementNetwork.nativeSymbol}
                        </span>
                      </div>
                      {split.settlement_tx_hash ? (
                        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                            View technical details
                          </summary>
                          {isTxHash(split.settlement_tx_hash) ? (
                            <a
                              href={transactionExplorerUrl(
                                split.settlement_tx_hash,
                                splitNetwork,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-1 font-mono text-xs font-semibold text-teal-700 hover:underline"
                            >
                              {shortAddress(split.settlement_tx_hash)}
                              <ExternalLink className="size-3" aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="mt-3 inline-flex font-mono text-xs font-semibold text-slate-600">
                              {split.settlement_tx_hash}
                            </span>
                          )}
                        </details>
                      ) : null}
                    </div>
                  </div>

                  {settled ? (
                    <span className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Paid
                    </span>
                  ) : (
                    <div className="w-full rounded-[22px] border border-teal-100 bg-teal-50/70 p-4 lg:w-80">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                        dUSDC payment
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <CheckoutSummaryRow
                          label="Recipient"
                          value={expense ? userName(expense.paid_by, members) : "Payer"}
                        />
                        <CheckoutSummaryRow
                          label="You owe"
                          value={formatMoney(split.amount_owed, currency)}
                        />
                        <CheckoutSummaryRow
                          label="Pay"
                          value={formatMoney(split.amount_owed, demoUSDC.symbol)}
                        />
                        <CheckoutSummaryRow
                          label="Gas token"
                          value={defaultSettlementNetwork.nativeSymbol}
                        />
                        <CheckoutSummaryRow
                          label="Network"
                          value={defaultSettlementNetwork.shortLabel}
                        />
                      </div>
                      <PrimaryButton
                        type="button"
                        onClick={() => void onSettle(split)}
                        className="mt-4 h-11 w-full bg-teal-600 shadow-[0_16px_36px_rgba(13,148,136,0.22)] hover:bg-teal-700"
                      >
                        <Send className="size-4" aria-hidden="true" />
                        Settle with dUSDC
                      </PrimaryButton>
                    </div>
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

function CheckoutSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function DemoUsdcSettlementModal({
  split,
  expense,
  connectedAddress,
  isConnected,
  chainId,
  isDemoUser,
  balance,
  proof,
  notice,
  error,
  action,
  onProofChange,
  onClose,
  onSwitchNetwork,
  onAddToken,
  onMint,
  onSend,
  onVerifyProof,
  onMockProof,
  onCopy,
}: {
  split: ExpenseSplit;
  expense: Expense | null;
  connectedAddress?: string;
  isConnected: boolean;
  chainId: number;
  isDemoUser: boolean;
  balance: string | null;
  proof: string;
  notice: string | null;
  error: string | null;
  action: string | null;
  onProofChange: (value: string) => void;
  onClose: () => void;
  onSwitchNetwork: () => void;
  onAddToken: () => void;
  onMint: () => void;
  onSend: () => void;
  onVerifyProof: () => void;
  onMockProof: () => void;
  onCopy: (value: string, message: string) => void;
}) {
  const recipientWallet = expense?.paid_by_profile?.wallet_address ?? "";
  const recipientName = expense ? profileLabel(expense.paid_by_profile) : "Recipient";
  const tokenConfigured = isDemoUSDCConfigured();
  const onDefaultNetwork = chainId === defaultSettlementNetwork.chainId;
  const canSend =
    tokenConfigured &&
    isConnected &&
    onDefaultNetwork &&
    isAddress(recipientWallet) &&
    !action;
  const amountLabel = formatMoney(split.amount_owed, demoUSDC.symbol);
  const recipientLabel = recipientWallet
    ? shortAddress(recipientWallet)
    : "Wallet needed";
  const contractLabel = demoUSDC.address
    ? shortAddress(demoUSDC.address)
    : "Not configured";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/80 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">Testnet only</Badge>
              <Badge tone={tokenConfigured ? "green" : "amber"}>
                {tokenConfigured ? "dUSDC ready" : "Contract needed"}
              </Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Settle with dUSDC
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              dUSDC is a fake testnet token used to simulate USDC settlement. It
              has no real value.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Close settlement modal"
          >
            <XCircle className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SettlementInfoTile
                label="You owe"
                value={formatMoney(split.amount_owed, "USD")}
              />
              <SettlementInfoTile label="Pay" value={amountLabel} />
              <SettlementInfoTile
                label="Recipient wallet"
                value={recipientLabel}
                mono
              />
              <SettlementInfoTile
                label="Network"
                value={defaultSettlementNetwork.label}
              />
              <SettlementInfoTile
                label="Gas token"
                value={defaultSettlementNetwork.nativeSymbol}
              />
              <SettlementInfoTile label="Token" value={demoUSDC.name} />
              <SettlementInfoTile label="Contract" value={contractLabel} mono />
              <SettlementInfoTile
                label="Your dUSDC balance"
                value={balance ?? (tokenConfigured ? "Connect wallet" : "Unavailable")}
              />
            </div>

            {!tokenConfigured ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Demo USDC contract not configured yet. Set{" "}
                <span className="font-mono font-semibold">
                  NEXT_PUBLIC_DEMO_USDC_ADDRESS
                </span>{" "}
                after deployment to enable mint, send, and verify.
              </div>
            ) : null}

            {!onDefaultNetwork && isConnected ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
                Switch to {defaultSettlementNetwork.label} before minting or
                sending dUSDC.
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {notice}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                {error}
                {error.includes("0G testnet tokens") ? (
                  <a
                    href="https://faucet.0g.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-1 underline"
                  >
                    Open faucet
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">
                I already paid
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={proof}
                  onChange={(event) => onProofChange(event.target.value)}
                  placeholder="Paste 0G transaction hash or ChainScan URL"
                  className={cn(fieldClassName, "min-w-0 flex-1 bg-white")}
                />
                <PrimaryButton
                  type="button"
                  onClick={onVerifyProof}
                  disabled={!proof.trim() || Boolean(action)}
                  className="h-11 bg-slate-950 px-4 hover:bg-slate-800 sm:w-40"
                >
                  {action === "verify" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  )}
                  Verify
                </PrimaryButton>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                SplitSafe verifies the dUSDC Transfer event before marking this
                balance as settled.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <PrimaryButton
              type="button"
              onClick={onSwitchNetwork}
              disabled={action === "switch" || onDefaultNetwork}
              className="h-11 w-full bg-slate-950 hover:bg-slate-800"
            >
              <Wallet className="size-4" aria-hidden="true" />
              {onDefaultNetwork ? "0G selected" : "Switch to 0G"}
            </PrimaryButton>
            <SecondarySettlementButton onClick={onAddToken} disabled={!tokenConfigured}>
              Add dUSDC to MetaMask
            </SecondarySettlementButton>
            <SecondarySettlementButton
              onClick={onMint}
              disabled={!tokenConfigured || Boolean(action)}
            >
              {action === "mint" ? "Minting..." : "Get demo dUSDC"}
            </SecondarySettlementButton>
            <PrimaryButton
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="h-11 w-full bg-teal-600 hover:bg-teal-700"
            >
              {action === "send" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Send dUSDC
            </PrimaryButton>
            <SecondarySettlementButton
              onClick={() => onCopy(recipientWallet, "Recipient wallet copied.")}
              disabled={!recipientWallet}
            >
              Copy recipient wallet
            </SecondarySettlementButton>
            <SecondarySettlementButton
              onClick={() => onCopy(String(split.amount_owed), "Amount copied.")}
            >
              Copy amount
            </SecondarySettlementButton>
            {isDemoUser && !tokenConfigured ? (
              <button
                type="button"
                onClick={onMockProof}
                disabled={Boolean(action)}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mock dUSDC proof for demo only
              </button>
            ) : null}
            <a
              href="https://faucet.0g.ai"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Get 0G gas
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
            <p className="text-xs leading-5 text-slate-500">
              0G faucet provides gas only. dUSDC comes from the SplitSafe Demo
              USDC contract.
            </p>
            {connectedAddress ? (
              <p className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                Connected:{" "}
                <span className="font-mono font-semibold text-slate-800">
                  {shortAddress(connectedAddress)}
                </span>
              </p>
            ) : null}
            <p className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Recipient: <span className="font-semibold">{recipientName}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettlementInfoTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-semibold text-slate-950",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SecondarySettlementButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function TechnicalDetailsDisclosure({
  details,
}: {
  details: Array<{ label: string; value: string }>;
}) {
  if (details.length === 0) return null;

  const networkValue =
    details.find((detail) => detail.label === "network")?.value ??
    defaultSettlementNetwork.id;

  return (
    <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600">
        View technical details
      </summary>
      <div className="mt-3 space-y-2">
        {details.map((detail) => {
          const isExplorerHash =
            detail.label === "transactionHash" && isTxHash(detail.value);
          const value =
            detail.label === "transactionHash" || detail.label === "contractAddress"
              ? shortAddress(detail.value)
              : detail.label === "network"
                ? settlementNetworkLabel(detail.value)
              : detail.value;

          return (
            <div
              key={`${detail.label}-${detail.value}`}
              className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-semibold text-slate-500">
                {humanizeTechnicalLabel(detail.label)}
              </span>
              {isExplorerHash ? (
                <a
                  href={transactionExplorerUrl(detail.value, networkValue)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono font-semibold text-teal-700 hover:underline"
                >
                  {value}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="break-all font-mono font-semibold text-slate-700">
                  {value}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </details>
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
            body="Add the first receipt to start tracking group spending."
          />
        ) : (
          expenses.map((expense) => {
            const { publicNotes, technicalDetails } = splitExpenseNotes(expense.notes);
            const method =
              technicalValue(expense.notes, "settlementMethod") ??
              "Manual split";
            const network = settlementNetworkLabel(
              technicalValue(expense.notes, "network") ??
                defaultSettlementNetwork.id,
            );
            const status =
              technicalValue(expense.notes, "paymentStatus") ??
              technicalValue(expense.notes, "checkoutStatus");

            return (
              <div
                key={expense.id}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{expense.title}</h3>
                      <Badge tone="slate">{expense.category}</Badge>
                      {status ? (
                        <Badge tone={paymentStatusTone(status)}>
                          Status: {paymentStatusLabel(status)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Paid by {userName(expense.paid_by, members)}.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        Method: {method}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        Network: {network}
                      </span>
                    </div>
                    {publicNotes ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {publicNotes}
                      </p>
                    ) : null}
                    <TechnicalDetailsDisclosure details={technicalDetails} />
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatMoney(expense.amount, currency)}
                  </p>
                </div>
              </div>
            );
          })
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
        title="Payment history"
        description="dUSDC receipts stay readable, with transaction hashes hidden until needed."
      />
      <div className="mt-6 space-y-3">
        {settlements.map((settlement) => (
          <div
            key={settlement.id}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-950">
                  {formatMoney(settlement.amount, demoUSDC.symbol)} settled
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Balance cleared: {formatMoney(settlement.amount, currency)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={paymentStatusTone(settlement.status)}>
                Status: {paymentStatusLabel(settlement.status)}
              </Badge>
              <Badge tone="teal">Token: {demoUSDC.symbol}</Badge>
              <Badge tone="blue">
                Network: {settlementNetworkLabel(settlement.network)}
              </Badge>
            </div>
            <TechnicalDetailsDisclosure
              details={[
                { label: "transactionHash", value: settlement.tx_hash },
                {
                  label: "network",
                  value: settlement.network,
                },
              ]}
            />
          </div>
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
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getInvitePreview(token)
      .then((nextPreview) => {
        if (cancelled) return;
        setPreview(nextPreview);
      })
      .catch(() => {
        if (cancelled) return;
        setPreview(null);
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (loading || previewLoading || !user || status !== "idle") return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      const userEmail = user.email?.toLowerCase() ?? "";
      if (preview?.status && preview.status !== "pending") {
        setStatus("error");
        setMessage(`This invite is ${preview.status}.`);
        return;
      }

      if (preview?.invited_email && preview.invited_email !== userEmail) {
        setStatus("error");
        setMessage("This invite was sent to another email.");
        return;
      }

      setStatus("accepting");
      setMessage("Accepting group invite");

      acceptInvite(token)
        .then((workspaceId) => {
          if (cancelled) return;
          setStatus("done");
          setMessage("Invite accepted. Opening group.");
          router.replace(`/workspaces/${workspaceId}`);
        })
        .catch((caught) => {
          if (cancelled) return;
          const rawMessage =
            caught instanceof Error ? caught.message : "Invite failed";
          setStatus("error");
          setMessage(
            rawMessage.toLowerCase().includes("different email")
              ? "This invite was sent to another email."
              : rawMessage,
          );
        });
    });

    return () => {
      cancelled = true;
    };
  }, [loading, preview, previewLoading, router, status, token, user]);

  const groupName = preview?.group_name ?? "a SplitSafe group";
  const loggedOut = !loading && !user;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_44%,#effdfa_100%)] px-4">
      <SectionCard className="w-full max-w-xl text-center" elevated>
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          {status === "error" || loggedOut ? (
            <MailPlus className="size-6" aria-hidden="true" />
          ) : (
            <Loader2
              className={cn("size-6", status !== "done" && "animate-spin")}
              aria-hidden="true"
            />
          )}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          You&apos;ve been invited to join {groupName}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {loggedOut
            ? "Sign in to accept this invite."
            : previewLoading
              ? "Loading invite details."
              : message}
        </p>
        {preview ? (
          <div className="mt-5 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
            <CheckoutSummaryRow label="Role" value={preview.role} />
            <CheckoutSummaryRow label="Status" value={preview.status} />
            <CheckoutSummaryRow
              label="Invited email"
              value={preview.invited_email}
            />
          </div>
        ) : null}
        {loggedOut ? (
          <Link
            href={`/login?next=/invite/${token}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            Sign in to accept invite
          </Link>
        ) : null}
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
