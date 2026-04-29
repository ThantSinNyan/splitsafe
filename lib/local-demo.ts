import type { User } from "@supabase/supabase-js";
import { createDemoSeedState, demoUserId } from "@/lib/demo-data";
import { defaultSettlementNetwork } from "@/lib/networks";
import { makeId, nowIso, roundMoney } from "@/lib/utils";
import type {
  AiMessage,
  AiRole,
  CreateExpenseInput,
  CreateInviteInput,
  CreateWorkspaceInput,
  Expense,
  ExpenseSplit,
  Invite,
  Profile,
  Settlement,
  SettlementInput,
  Workspace,
  WorkspaceData,
  WorkspaceMember,
} from "@/types/splitsafe";

const localDemoSessionKey = "splitsafe.localDemo.session";
const localDemoDataKey = "splitsafe.localDemo.data";

export const localDemoUserId = demoUserId;

type LocalDemoState = {
  profiles: Profile[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  invites: Invite[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  aiMessages: AiMessage[];
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emptyState(): LocalDemoState {
  return createDemoSeedState();
}

function writeState(state: LocalDemoState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(localDemoDataKey, JSON.stringify(state));
}

function readState(): LocalDemoState {
  if (!canUseStorage()) return emptyState();

  const raw = window.localStorage.getItem(localDemoDataKey);
  if (!raw) {
    const state = emptyState();
    writeState(state);
    return state;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDemoState>;
    const state: LocalDemoState = {
      profiles: parsed.profiles ?? [],
      workspaces: parsed.workspaces ?? [],
      members: parsed.members ?? [],
      invites: parsed.invites ?? [],
      expenses: parsed.expenses ?? [],
      splits: parsed.splits ?? [],
      settlements: parsed.settlements ?? [],
      aiMessages: parsed.aiMessages ?? [],
    };

    if (state.workspaces.length === 0) {
      const seeded = emptyState();
      writeState(seeded);
      return seeded;
    }

    return state;
  } catch {
    const state = emptyState();
    writeState(state);
    return state;
  }
}

function profileById(state: LocalDemoState, userId: string) {
  return state.profiles.find((profile) => profile.id === userId) ?? null;
}

function withProfile(state: LocalDemoState, member: WorkspaceMember): WorkspaceMember {
  return {
    ...member,
    profile: profileById(state, member.user_id),
  };
}

function expenseWithProfile(state: LocalDemoState, expense: Expense): Expense {
  return {
    ...expense,
    paid_by_profile: profileById(state, expense.paid_by),
  };
}

function splitWithProfile(state: LocalDemoState, split: ExpenseSplit): ExpenseSplit {
  return {
    ...split,
    profile: profileById(state, split.user_id),
  };
}

export function isLocalDemoMode() {
  return canUseStorage() && window.localStorage.getItem(localDemoSessionKey) === "active";
}

export function resetLocalDemoData() {
  const state = emptyState();
  writeState(state);
  return state;
}

export function startLocalDemoMode() {
  if (!canUseStorage()) return;
  window.localStorage.setItem(localDemoSessionKey, "active");
  readState();
}

export function stopLocalDemoMode() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(localDemoSessionKey);
}

export function getLocalDemoProfile() {
  return profileById(readState(), localDemoUserId) ?? {
    id: localDemoUserId,
    name: "Alex Demo",
    email: "demo@splitsafe.app",
    avatar_url: null,
    wallet_address: null,
    created_at: nowIso(),
  };
}

export function getLocalDemoUser() {
  return {
    id: localDemoUserId,
    app_metadata: {
      provider: "local-demo",
      providers: ["local-demo"],
    },
    user_metadata: {
      name: "Alex Demo",
      full_name: "Alex Demo",
    },
    aud: "authenticated",
    created_at: nowIso(),
    email: "demo@splitsafe.app",
    is_anonymous: true,
  } as User;
}

export function listLocalWorkspaces() {
  const state = readState();
  return [...state.workspaces].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getLocalDashboardStats() {
  const state = readState();
  const unpaidSplits = state.splits.filter((split) => split.status === "unpaid");
  const expensesById = new Map(state.expenses.map((expense) => [expense.id, expense]));
  const pendingInvites = state.invites.filter(
    (invite) => invite.status === "pending",
  ).length;

  return {
    totalSpent: state.expenses.reduce((sum, expense) => sum + expense.amount, 0),
    totalUnpaid: unpaidSplits.reduce((sum, split) => sum + split.amount_owed, 0),
    pendingSettlements: unpaidSplits.length,
    pendingInvites,
    recentActivity: state.expenses.length + state.settlements.length + pendingInvites,
    youOwe: unpaidSplits
      .filter((split) => split.user_id === localDemoUserId)
      .reduce((sum, split) => sum + split.amount_owed, 0),
    owedToYou: unpaidSplits
      .filter((split) => expensesById.get(split.expense_id)?.paid_by === localDemoUserId)
      .reduce((sum, split) => sum + split.amount_owed, 0),
  };
}

export function createLocalWorkspace(input: CreateWorkspaceInput) {
  const state = readState();
  const createdAt = nowIso();
  const workspace: Workspace = {
    id: makeId(),
    owner_id: localDemoUserId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    currency: input.currency.trim() || "USD",
    total_budget: input.total_budget,
    created_at: createdAt,
  };

  state.workspaces.push(workspace);
  state.members.push({
    id: makeId(),
    workspace_id: workspace.id,
    user_id: localDemoUserId,
    role: "owner",
    status: "active",
    created_at: createdAt,
    profile: profileById(state, localDemoUserId),
  });

  writeState(state);
  return workspace;
}

export function createLocalSampleWorkspace() {
  const state = readState();
  const existing =
    state.workspaces.find((workspace) => workspace.name === "Thailand Trip") ??
    state.workspaces[0];

  if (existing) return existing;

  const seeded = resetLocalDemoData();
  return seeded.workspaces[0];
}

export function getLocalWorkspace(workspaceId: string): WorkspaceData | null {
  const state = readState();
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return null;

  const members = state.members
    .filter((member) => member.workspace_id === workspaceId)
    .map((member) => withProfile(state, member));

  return {
    workspace,
    currentMember:
      members.find((member) => member.user_id === localDemoUserId) ?? null,
    members,
    invites: state.invites
      .filter((invite) => invite.workspace_id === workspaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    expenses: state.expenses
      .filter((expense) => expense.workspace_id === workspaceId)
      .map((expense) => expenseWithProfile(state, expense))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    splits: state.splits
      .filter((split) => split.workspace_id === workspaceId)
      .map((split) => splitWithProfile(state, split))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    settlements: state.settlements
      .filter((settlement) => settlement.workspace_id === workspaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    aiMessages: state.aiMessages
      .filter((message) => message.workspace_id === workspaceId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export function createLocalInvite(
  workspaceId: string,
  input: CreateInviteInput,
) {
  const state = readState();
  const invite: Invite = {
    id: makeId(),
    workspace_id: workspaceId,
    invited_email: input.invited_email.trim().toLowerCase(),
    invited_by: localDemoUserId,
    invite_token: makeId().replace(/-/g, ""),
    role: input.role,
    status: "pending",
    created_at: nowIso(),
    accepted_at: null,
    expires_at: null,
  };

  state.invites.unshift(invite);
  writeState(state);
  return invite;
}

export function getLocalInvitePreview(inviteToken: string) {
  const state = readState();
  const invite = state.invites.find((item) => item.invite_token === inviteToken);
  if (!invite) return null;

  const workspace = state.workspaces.find((item) => item.id === invite.workspace_id);
  if (!workspace) return null;

  return {
    workspace_id: invite.workspace_id,
    group_name: workspace.name,
    invited_email: invite.invited_email,
    role: invite.role,
    status: invite.status,
    expires_at: invite.expires_at,
  };
}

export function acceptLocalInvite(inviteToken: string) {
  const state = readState();
  const invite = state.invites.find((item) => item.invite_token === inviteToken);
  if (!invite) throw new Error("Invite not found in local demo mode.");

  invite.status = "accepted";
  invite.accepted_at = nowIso();
  writeState(state);
  return invite.workspace_id;
}

export function cancelLocalInvite(inviteId: string) {
  const state = readState();
  const invite = state.invites.find((item) => item.id === inviteId);
  if (!invite) throw new Error("Invite not found in local demo mode.");

  if (invite.status === "pending") {
    invite.status = "expired";
  }

  writeState(state);
  return invite.workspace_id;
}

export function addLocalExpense(
  workspaceId: string,
  input: CreateExpenseInput,
) {
  const state = readState();
  const createdAt = nowIso();
  const share = roundMoney(input.amount / input.split_user_ids.length);
  const expense: Expense = {
    id: makeId(),
    workspace_id: workspaceId,
    paid_by: input.paid_by,
    title: input.title.trim(),
    amount: input.amount,
    category: input.category.trim() || "other",
    notes: input.notes.trim() || null,
    created_at: createdAt,
    paid_by_profile: profileById(state, input.paid_by),
  };

  const splits: ExpenseSplit[] = input.split_user_ids
    .filter((userId) => userId !== input.paid_by)
    .map((userId) => ({
      id: makeId(),
      expense_id: expense.id,
      workspace_id: workspaceId,
      user_id: userId,
      amount_owed: share,
      status: "unpaid",
      settlement_tx_hash: null,
      settled_at: null,
      created_at: createdAt,
      profile: profileById(state, userId),
    }));

  state.expenses.push(expense);
  state.splits.push(...splits);
  writeState(state);
  return expense;
}

export function recordLocalSettlement(input: SettlementInput) {
  const state = readState();
  const split = state.splits.find((item) => item.id === input.splitId);
  if (!split) throw new Error("Split not found in local demo mode.");

  const expense = state.expenses.find((item) => item.id === split.expense_id);
  if (!expense) throw new Error("Expense not found in local demo mode.");

  const settledAt = nowIso();
  split.status = "paid";
  split.settlement_tx_hash = input.txHash;
  split.settled_at = settledAt;

  const settlement: Settlement = {
    id: makeId(),
    workspace_id: split.workspace_id,
    expense_split_id: split.id,
    sender_user_id: localDemoUserId,
    receiver_user_id: expense.paid_by,
    sender_wallet: input.senderWallet,
    receiver_wallet: input.receiverWallet,
    amount: input.amount,
    tx_hash: input.txHash,
    network: input.network ?? defaultSettlementNetwork.id,
    status: input.status,
    created_at: settledAt,
  };

  state.settlements.unshift(settlement);
  writeState(state);
  return settlement;
}

export function saveLocalAiMessage(
  workspaceId: string,
  role: AiRole,
  content: string,
) {
  const state = readState();
  const message: AiMessage = {
    id: makeId(),
    workspace_id: workspaceId,
    user_id: localDemoUserId,
    role,
    content,
    created_at: nowIso(),
  };

  state.aiMessages.push(message);
  writeState(state);
  return message;
}
