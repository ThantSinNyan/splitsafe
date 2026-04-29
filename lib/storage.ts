import type { User } from "@supabase/supabase-js";
import {
  acceptLocalInvite,
  addLocalExpense,
  cancelLocalInvite,
  createLocalInvite,
  createLocalSampleWorkspace,
  createLocalWorkspace,
  getLocalDashboardStats,
  getLocalDemoUser,
  getLocalInvitePreview,
  getLocalWorkspace,
  isLocalDemoMode,
  listLocalWorkspaces,
  removeLocalWorkspaceMember,
  recordLocalSettlement,
  resetLocalDemoData,
  saveLocalAiMessage,
} from "@/lib/local-demo";
import { defaultSettlementNetwork } from "@/lib/networks";
import { requireSupabaseClient } from "@/lib/supabase";
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
  InvitePreview,
  Profile,
  Settlement,
  SettlementInput,
  Workspace,
  WorkspaceData,
  WorkspaceMember,
} from "@/types/splitsafe";

function asRecord(value: unknown) {
  return (value ?? {}) as Record<string, unknown>;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function normalizeProfile(value: unknown): Profile | null {
  if (!value) return null;
  const row = asRecord(value);

  return {
    id: asText(row.id),
    name: asNullableText(row.name),
    email: asNullableText(row.email),
    avatar_url: asNullableText(row.avatar_url),
    wallet_address: asNullableText(row.wallet_address),
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeWorkspace(value: unknown): Workspace {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    owner_id: asText(row.owner_id),
    name: asText(row.name),
    description: asNullableText(row.description),
    currency: asText(row.currency, "USD"),
    total_budget: asNumber(row.total_budget),
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeMember(value: unknown): WorkspaceMember {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    workspace_id: asText(row.workspace_id),
    user_id: asText(row.user_id),
    role: asText(row.role, "member") as WorkspaceMember["role"],
    status: asText(row.status, "active") as WorkspaceMember["status"],
    created_at: asText(row.created_at, nowIso()),
    profile: normalizeProfile(row.profile ?? row.profiles),
  };
}

function normalizeInvite(value: unknown): Invite {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    workspace_id: asText(row.workspace_id),
    invited_email: asText(row.invited_email),
    invited_by: asText(row.invited_by),
    invite_token: asText(row.invite_token),
    role: asText(row.role, "member") as Invite["role"],
    status: asText(row.status, "pending") as Invite["status"],
    created_at: asText(row.created_at, nowIso()),
    accepted_at: asNullableText(row.accepted_at),
    expires_at: asNullableText(row.expires_at),
  };
}

function normalizeInvitePreview(value: unknown): InvitePreview {
  const row = asRecord(value);

  return {
    workspace_id: asText(row.workspace_id),
    group_name: asText(row.group_name, "SplitSafe group"),
    invited_email: asText(row.invited_email),
    role: asText(row.role, "member") as InvitePreview["role"],
    status: asText(row.status, "pending") as InvitePreview["status"],
    expires_at: asNullableText(row.expires_at),
  };
}

function normalizeExpense(value: unknown): Expense {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    workspace_id: asText(row.workspace_id),
    paid_by: asText(row.paid_by),
    title: asText(row.title),
    amount: asNumber(row.amount),
    category: asText(row.category, "other"),
    notes: asNullableText(row.notes),
    created_at: asText(row.created_at, nowIso()),
    paid_by_profile: normalizeProfile(row.paid_by_profile ?? row.profiles),
  };
}

function normalizeSplit(value: unknown): ExpenseSplit {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    expense_id: asText(row.expense_id),
    workspace_id: asText(row.workspace_id),
    user_id: asText(row.user_id),
    amount_owed: asNumber(row.amount_owed),
    status: asText(row.status, "unpaid") as ExpenseSplit["status"],
    settlement_tx_hash: asNullableText(row.settlement_tx_hash),
    settled_at: asNullableText(row.settled_at),
    created_at: asText(row.created_at, nowIso()),
    profile: normalizeProfile(row.profile ?? row.profiles),
  };
}

function normalizeSettlement(value: unknown): Settlement {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    workspace_id: asText(row.workspace_id),
    expense_split_id: asText(row.expense_split_id),
    sender_user_id: asText(row.sender_user_id),
    receiver_user_id: asText(row.receiver_user_id),
    sender_wallet: asText(row.sender_wallet),
    receiver_wallet: asText(row.receiver_wallet),
    amount: asNumber(row.amount),
    tx_hash: asText(row.tx_hash),
    network: asText(row.network, defaultSettlementNetwork.id),
    status: asText(row.status, "proof_submitted") as Settlement["status"],
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeAiMessage(value: unknown): AiMessage {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    workspace_id: asText(row.workspace_id),
    user_id: asNullableText(row.user_id),
    role: asText(row.role, "assistant") as AiRole,
    content: asText(row.content),
    created_at: asText(row.created_at, nowIso()),
  };
}

function throwIfError(error: { code?: string; message?: string } | null) {
  if (!error) return;

  if (
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("schema cache") ||
    error.message?.toLowerCase().includes("could not find the table")
  ) {
    throw new Error(
      "SplitSafe Supabase v2 tables are missing. Run supabase/schema.sql in Supabase SQL Editor, then refresh.",
    );
  }

  throw new Error(error.message ?? "SplitSafe data request failed");
}

async function getCurrentUser() {
  if (isLocalDemoMode()) return getLocalDemoUser();

  const supabase = requireSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  throwIfError(error);

  if (!user) {
    throw new Error("Please sign in to use SplitSafe groups.");
  }

  return user;
}

export async function ensureProfile(user: User) {
  if (isLocalDemoMode()) return null;

  const supabase = requireSupabaseClient();
  const fallbackName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const defaultName = user.is_anonymous
    ? "Guest user"
    : user.email?.split("@")[0] ?? "SplitSafe user";

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      name:
        typeof fallbackName === "string"
          ? fallbackName
          : defaultName,
      email: user.email?.toLowerCase() ?? null,
      avatar_url:
        typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null,
    })
    .select("*")
    .single();

  throwIfError(error);
  return normalizeProfile(data);
}

export async function listWorkspaces() {
  if (isLocalDemoMode()) return listLocalWorkspaces();

  await getCurrentUser();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data ?? []).map(normalizeWorkspace);
}

export async function getDashboardStats() {
  if (isLocalDemoMode()) return getLocalDashboardStats();

  const user = await getCurrentUser();
  const supabase = requireSupabaseClient();
  const [expenses, splits, invites, settlements] = await Promise.all([
    supabase.from("expenses").select("id, amount, paid_by"),
    supabase.from("expense_splits").select("status, amount_owed, user_id, expense_id"),
    supabase.from("invites").select("status"),
    supabase.from("settlements").select("id"),
  ]);

  throwIfError(expenses.error);
  throwIfError(splits.error);
  throwIfError(invites.error);
  throwIfError(settlements.error);

  const expenseRows = expenses.data ?? [];
  const splitRows = splits.data ?? [];
  const inviteRows = invites.data ?? [];
  const settlementRows = settlements.data ?? [];
  const expensesById = new Map(
    expenseRows.map((row) => [asText(asRecord(row).id), asRecord(row)]),
  );
  const unpaidSplits = splitRows
    .map(asRecord)
    .filter((row) => asText(row.status, "unpaid") === "unpaid");

  return {
    totalSpent: expenseRows.reduce(
      (sum, row) => sum + asNumber(asRecord(row).amount),
      0,
    ),
    totalUnpaid: unpaidSplits.reduce(
      (sum, row) => sum + asNumber(row.amount_owed),
      0,
    ),
    pendingSettlements: unpaidSplits.length,
    pendingInvites: inviteRows
      .map(asRecord)
      .filter((row) => asText(row.status) === "pending").length,
    recentActivity: expenseRows.length + settlementRows.length + inviteRows.length,
    youOwe: unpaidSplits
      .filter((row) => asText(row.user_id) === user.id)
      .reduce((sum, row) => sum + asNumber(row.amount_owed), 0),
    owedToYou: unpaidSplits
      .filter((row) => {
        const expense = expensesById.get(asText(row.expense_id));
        return asText(expense?.paid_by) === user.id;
      })
      .reduce((sum, row) => sum + asNumber(row.amount_owed), 0),
  };
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  if (isLocalDemoMode()) return createLocalWorkspace(input);

  const user = await getCurrentUser();
  await ensureProfile(user);

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name: input.name.trim(),
      description: input.description.trim() || null,
      currency: input.currency.trim() || "USD",
      total_budget: input.total_budget,
      owner_id: user.id,
    })
    .select("*")
    .single();
  throwIfError(error);

  const workspace = normalizeWorkspace(data);
  const memberInsert = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
    status: "active",
  });
  throwIfError(memberInsert.error);

  return workspace;
}

export async function createSampleWorkspace() {
  if (isLocalDemoMode()) return createLocalSampleWorkspace();

  const workspace = await createWorkspace({
    name: "Thailand Trip",
    description: "Private sample group for food, transport, and rooms.",
    currency: "USD",
    total_budget: 100,
  });

  return workspace;
}

export async function resetDemoData() {
  if (!isLocalDemoMode()) {
    throw new Error("Guest reset is only available for guest accounts.");
  }

  return resetLocalDemoData();
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceData | null> {
  if (isLocalDemoMode()) return getLocalWorkspace(workspaceId);

  const user = await getCurrentUser();
  const supabase = requireSupabaseClient();

  const workspaceRequest = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  throwIfError(workspaceRequest.error);
  if (!workspaceRequest.data) return null;

  const [members, invites, expenses, splits, settlements, aiMessages] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("*, profile:profiles(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invites")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("*, paid_by_profile:profiles(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("expense_splits")
        .select("*, profile:profiles(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("settlements")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_messages")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
    ]);

  throwIfError(members.error);
  throwIfError(invites.error);
  throwIfError(expenses.error);
  throwIfError(splits.error);
  throwIfError(settlements.error);
  throwIfError(aiMessages.error);

  const normalizedMembers = (members.data ?? []).map(normalizeMember);

  return {
    workspace: normalizeWorkspace(workspaceRequest.data),
    currentMember:
      normalizedMembers.find((member) => member.user_id === user.id) ?? null,
    members: normalizedMembers,
    invites: (invites.data ?? []).map(normalizeInvite),
    expenses: (expenses.data ?? []).map(normalizeExpense),
    splits: (splits.data ?? []).map(normalizeSplit),
    settlements: (settlements.data ?? []).map(normalizeSettlement),
    aiMessages: (aiMessages.data ?? []).map(normalizeAiMessage),
  };
}

export async function createInvite(
  workspaceId: string,
  input: CreateInviteInput,
) {
  if (isLocalDemoMode()) return createLocalInvite(workspaceId, input);

  const user = await getCurrentUser();
  const supabase = requireSupabaseClient();
  const inviteToken = makeId().replace(/-/g, "");

  const { data, error } = await supabase
    .from("invites")
    .insert({
      workspace_id: workspaceId,
      invited_email: input.invited_email.trim().toLowerCase(),
      invited_by: user.id,
      invite_token: inviteToken,
      role: input.role,
      status: "pending",
    })
    .select("*")
    .single();

  throwIfError(error);
  return normalizeInvite(data);
}

export async function getInvitePreview(inviteToken: string) {
  if (isLocalDemoMode()) return getLocalInvitePreview(inviteToken);

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .rpc("invite_preview", { target_invite_token: inviteToken })
    .maybeSingle();

  throwIfError(error);
  return data ? normalizeInvitePreview(data) : null;
}

export async function acceptInvite(inviteToken: string) {
  if (isLocalDemoMode()) return acceptLocalInvite(inviteToken);

  await getCurrentUser();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("accept_invite", {
    target_invite_token: inviteToken,
  });

  throwIfError(error);
  return String(data);
}

export async function cancelInvite(inviteId: string) {
  if (isLocalDemoMode()) return cancelLocalInvite(inviteId);

  await getCurrentUser();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("cancel_invite", {
    target_invite_id: inviteId,
  });

  throwIfError(error);
  return String(data);
}

export async function removeWorkspaceMember(memberId: string) {
  if (isLocalDemoMode()) return removeLocalWorkspaceMember(memberId);

  await getCurrentUser();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("remove_workspace_member", {
    target_member_id: memberId,
  });

  throwIfError(error);
  return String(data);
}

export async function addExpense(
  workspaceId: string,
  input: CreateExpenseInput,
) {
  if (isLocalDemoMode()) return addLocalExpense(workspaceId, input);

  const supabase = requireSupabaseClient();
  const splitUserIds = input.split_user_ids;
  const share = roundMoney(input.amount / splitUserIds.length);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      workspace_id: workspaceId,
      paid_by: input.paid_by,
      title: input.title.trim(),
      amount: input.amount,
      category: input.category.trim() || "other",
      notes: input.notes.trim() || null,
    })
    .select("*, paid_by_profile:profiles(*)")
    .single();

  throwIfError(error);
  const expense = normalizeExpense(data);

  const splits = splitUserIds
    .filter((userId) => userId !== input.paid_by)
    .map((userId) => ({
      workspace_id: workspaceId,
      expense_id: expense.id,
      user_id: userId,
      amount_owed: share,
      status: "unpaid",
    }));

  if (splits.length > 0) {
    const splitInsert = await supabase.from("expense_splits").insert(splits);
    throwIfError(splitInsert.error);
  }

  return expense;
}

export async function recordSettlement(input: SettlementInput) {
  if (isLocalDemoMode()) return recordLocalSettlement(input);

  const user = await getCurrentUser();
  const supabase = requireSupabaseClient();
  const settledAt = nowIso();

  const splitRequest = await supabase
    .from("expense_splits")
    .select("*")
    .eq("id", input.splitId)
    .single();
  throwIfError(splitRequest.error);
  const split = normalizeSplit(splitRequest.data);

  if (split.status === "paid") {
    throw new Error("This balance is already settled.");
  }

  const expenseRequest = await supabase
    .from("expenses")
    .select("*")
    .eq("id", split.expense_id)
    .single();
  throwIfError(expenseRequest.error);
  const expense = normalizeExpense(expenseRequest.data);

  const updateRequest = await supabase
    .from("expense_splits")
    .update({
      status: "paid",
      settlement_tx_hash: input.txHash,
      settled_at: settledAt,
    })
    .eq("id", input.splitId);
  throwIfError(updateRequest.error);

  const insertRequest = await supabase
    .from("settlements")
    .insert({
      workspace_id: split.workspace_id,
      expense_split_id: split.id,
      sender_user_id: user.id,
      receiver_user_id: expense.paid_by,
      sender_wallet: input.senderWallet,
      receiver_wallet: input.receiverWallet,
      amount: input.amount,
      tx_hash: input.txHash,
      network: input.network ?? defaultSettlementNetwork.id,
      status: input.status,
    })
    .select("*")
    .single();
  throwIfError(insertRequest.error);

  return normalizeSettlement(insertRequest.data);
}

export async function saveAiMessage(
  workspaceId: string,
  role: AiRole,
  content: string,
) {
  if (isLocalDemoMode()) return saveLocalAiMessage(workspaceId, role, content);

  const supabase = requireSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      workspace_id: workspaceId,
      user_id: user?.id ?? null,
      role,
      content,
    })
    .select("*")
    .single();

  throwIfError(error);
  return normalizeAiMessage(data);
}
