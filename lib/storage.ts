import { createDemoWorkspace } from "@/lib/demo-data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { makeId, nowIso, roundMoney } from "@/lib/utils";
import type {
  AiMessage,
  AiRole,
  CreateExpenseInput,
  CreateGroupInput,
  CreateMemberInput,
  Expense,
  ExpenseSplit,
  GroupMember,
  GroupWorkspaceData,
  Settlement,
  SettlementInput,
  SplitSafeGroup,
} from "@/types/splitsafe";

type Store = {
  groups: SplitSafeGroup[];
  members: GroupMember[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  aiMessages: AiMessage[];
};

const STORAGE_KEY = "splitsafe_store_v1";

const emptyStore = (): Store => ({
  groups: [],
  members: [],
  expenses: [],
  splits: [],
  settlements: [],
  aiMessages: [],
});

export function getStorageMode() {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;

    return {
      groups: parsed.groups ?? [],
      members: parsed.members ?? [],
      expenses: parsed.expenses ?? [],
      splits: parsed.splits ?? [],
      settlements: parsed.settlements ?? [],
      aiMessages: parsed.aiMessages ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

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

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeGroup(value: unknown): SplitSafeGroup {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    name: asText(row.name),
    description: asNullableText(row.description),
    budget_amount: asNumber(row.budget_amount),
    currency: asText(row.currency, "USDC"),
    category: asText(row.category, "other") as SplitSafeGroup["category"],
    created_by_wallet: asNullableText(row.created_by_wallet),
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeMember(value: unknown): GroupMember {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    group_id: asText(row.group_id),
    name: asText(row.name),
    wallet_address: asText(row.wallet_address),
    role: asText(row.role, "member") as GroupMember["role"],
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeExpense(value: unknown): Expense {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    group_id: asText(row.group_id),
    title: asText(row.title),
    amount: asNumber(row.amount),
    category: asText(row.category, "other"),
    paid_by_member_id: asText(row.paid_by_member_id),
    split_member_ids: asStringArray(row.split_member_ids),
    notes: asNullableText(row.notes),
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeSplit(value: unknown): ExpenseSplit {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    expense_id: asText(row.expense_id),
    group_id: asText(row.group_id),
    from_member_id: asText(row.from_member_id),
    to_member_id: asText(row.to_member_id),
    amount: asNumber(row.amount),
    status: asText(row.status, "unpaid") as ExpenseSplit["status"],
    settlement_tx_hash: asNullableText(row.settlement_tx_hash),
    created_at: asText(row.created_at, nowIso()),
    settled_at: asNullableText(row.settled_at),
  };
}

function normalizeSettlement(value: unknown): Settlement {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    group_id: asText(row.group_id),
    expense_split_id: asText(row.expense_split_id),
    sender_wallet: asText(row.sender_wallet),
    receiver_wallet: asText(row.receiver_wallet),
    amount: asNumber(row.amount),
    tx_hash: asText(row.tx_hash),
    network: asText(row.network, "base-sepolia"),
    status: asText(row.status, "confirmed"),
    created_at: asText(row.created_at, nowIso()),
  };
}

function normalizeAiMessage(value: unknown): AiMessage {
  const row = asRecord(value);

  return {
    id: asText(row.id),
    group_id: asText(row.group_id),
    role: asText(row.role, "assistant") as AiRole,
    content: asText(row.content),
    created_at: asText(row.created_at, nowIso()),
  };
}

function throwIfError(error: { message?: string } | null) {
  if (error) {
    throw new Error(error.message ?? "SplitSafe data request failed");
  }
}

export async function listGroups() {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    throwIfError(error);
    return (data ?? []).map(normalizeGroup);
  }

  return readStore().groups.sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export async function getDashboardStats() {
  const supabase = getSupabaseClient();

  if (supabase) {
    const [groups, expenses, splits] = await Promise.all([
      supabase.from("groups").select("budget_amount"),
      supabase.from("expenses").select("amount"),
      supabase.from("expense_splits").select("status"),
    ]);

    throwIfError(groups.error);
    throwIfError(expenses.error);
    throwIfError(splits.error);

    return {
      totalBudget: (groups.data ?? []).reduce(
        (sum, row) => sum + asNumber(asRecord(row).budget_amount),
        0,
      ),
      totalSpent: (expenses.data ?? []).reduce(
        (sum, row) => sum + asNumber(asRecord(row).amount),
        0,
      ),
      pendingSettlements: (splits.data ?? []).filter(
        (row) => asText(asRecord(row).status, "unpaid") === "unpaid",
      ).length,
    };
  }

  const store = readStore();
  return {
    totalBudget: store.groups.reduce((sum, group) => sum + group.budget_amount, 0),
    totalSpent: store.expenses.reduce((sum, expense) => sum + expense.amount, 0),
    pendingSettlements: store.splits.filter((split) => split.status === "unpaid")
      .length,
  };
}

export async function createGroup(
  input: CreateGroupInput,
  createdByWallet?: string | null,
) {
  const group: SplitSafeGroup = {
    id: makeId(),
    name: input.name.trim(),
    description: input.description.trim() || null,
    budget_amount: input.budget_amount,
    currency: input.currency || "USDC",
    category: input.category,
    created_by_wallet: createdByWallet ?? null,
    created_at: nowIso(),
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("groups")
      .insert(group)
      .select("*")
      .single();
    throwIfError(error);
    return normalizeGroup(data);
  }

  const store = readStore();
  store.groups.unshift(group);
  writeStore(store);
  return group;
}

export async function loadDemoData(createdByWallet?: string | null) {
  const demo = createDemoWorkspace(createdByWallet);
  const supabase = getSupabaseClient();

  if (supabase) {
    const groupInsert = await supabase.from("groups").insert(demo.group);
    throwIfError(groupInsert.error);

    const memberInsert = await supabase.from("group_members").insert(demo.members);
    throwIfError(memberInsert.error);

    const expenseInsert = await supabase.from("expenses").insert(demo.expenses);
    throwIfError(expenseInsert.error);

    const splitInsert = await supabase.from("expense_splits").insert(demo.splits);
    throwIfError(splitInsert.error);

    return demo.group;
  }

  const store = readStore();
  store.groups.unshift(demo.group);
  store.members.unshift(...demo.members);
  store.expenses.unshift(...demo.expenses);
  store.splits.unshift(...demo.splits);
  writeStore(store);
  return demo.group;
}

export async function getGroupWorkspace(
  groupId: string,
): Promise<GroupWorkspaceData | null> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const groupRequest = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupRequest.error) {
      if (groupRequest.error.code === "PGRST116") return null;
      throwIfError(groupRequest.error);
    }

    const [members, expenses, splits, settlements, aiMessages] =
      await Promise.all([
        supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: true }),
        supabase
          .from("expenses")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase
          .from("expense_splits")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase
          .from("settlements")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_messages")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: true }),
      ]);

    throwIfError(members.error);
    throwIfError(expenses.error);
    throwIfError(splits.error);
    throwIfError(settlements.error);
    throwIfError(aiMessages.error);

    return {
      group: normalizeGroup(groupRequest.data),
      members: (members.data ?? []).map(normalizeMember),
      expenses: (expenses.data ?? []).map(normalizeExpense),
      splits: (splits.data ?? []).map(normalizeSplit),
      settlements: (settlements.data ?? []).map(normalizeSettlement),
      aiMessages: (aiMessages.data ?? []).map(normalizeAiMessage),
    };
  }

  const store = readStore();
  const group = store.groups.find((item) => item.id === groupId);
  if (!group) return null;

  return {
    group,
    members: store.members.filter((item) => item.group_id === groupId),
    expenses: store.expenses.filter((item) => item.group_id === groupId),
    splits: store.splits.filter((item) => item.group_id === groupId),
    settlements: store.settlements.filter((item) => item.group_id === groupId),
    aiMessages: store.aiMessages.filter((item) => item.group_id === groupId),
  };
}

export async function addMember(groupId: string, input: CreateMemberInput) {
  const member: GroupMember = {
    id: makeId(),
    group_id: groupId,
    name: input.name.trim(),
    wallet_address: input.wallet_address.trim(),
    role: input.role,
    created_at: nowIso(),
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("group_members")
      .insert(member)
      .select("*")
      .single();
    throwIfError(error);
    return normalizeMember(data);
  }

  const store = readStore();
  store.members.push(member);
  writeStore(store);
  return member;
}

export async function addExpense(groupId: string, input: CreateExpenseInput) {
  const createdAt = nowIso();
  const expenseId = makeId();
  const splitMemberIds = input.split_member_ids;
  const share = roundMoney(input.amount / splitMemberIds.length);

  const expense: Expense = {
    id: expenseId,
    group_id: groupId,
    title: input.title.trim(),
    amount: input.amount,
    category: input.category.trim() || "other",
    paid_by_member_id: input.paid_by_member_id,
    split_member_ids: splitMemberIds,
    notes: input.notes.trim() || null,
    created_at: createdAt,
  };

  const splits: ExpenseSplit[] = splitMemberIds
    .filter((memberId) => memberId !== input.paid_by_member_id)
    .map((memberId) => ({
      id: makeId(),
      expense_id: expenseId,
      group_id: groupId,
      from_member_id: memberId,
      to_member_id: input.paid_by_member_id,
      amount: share,
      status: "unpaid",
      settlement_tx_hash: null,
      created_at: createdAt,
      settled_at: null,
    }));

  const supabase = getSupabaseClient();
  if (supabase) {
    const expenseInsert = await supabase
      .from("expenses")
      .insert(expense)
      .select("*")
      .single();
    throwIfError(expenseInsert.error);

    if (splits.length > 0) {
      const splitInsert = await supabase.from("expense_splits").insert(splits);
      throwIfError(splitInsert.error);
    }

    return {
      expense: normalizeExpense(expenseInsert.data),
      splits,
    };
  }

  const store = readStore();
  store.expenses.unshift(expense);
  store.splits.unshift(...splits);
  writeStore(store);
  return { expense, splits };
}

export async function recordSettlement(input: SettlementInput) {
  const supabase = getSupabaseClient();
  const settledAt = nowIso();

  if (supabase) {
    const splitRequest = await supabase
      .from("expense_splits")
      .select("*")
      .eq("id", input.splitId)
      .single();
    throwIfError(splitRequest.error);

    const split = normalizeSplit(splitRequest.data);
    const updateRequest = await supabase
      .from("expense_splits")
      .update({
        status: "settled",
        settlement_tx_hash: input.txHash,
        settled_at: settledAt,
      })
      .eq("id", input.splitId);
    throwIfError(updateRequest.error);

    const settlement: Settlement = {
      id: makeId(),
      group_id: split.group_id,
      expense_split_id: split.id,
      sender_wallet: input.senderWallet,
      receiver_wallet: input.receiverWallet,
      amount: input.amount,
      tx_hash: input.txHash,
      network: "base-sepolia",
      status: input.status,
      created_at: settledAt,
    };

    const insertRequest = await supabase
      .from("settlements")
      .insert(settlement)
      .select("*")
      .single();
    throwIfError(insertRequest.error);

    return normalizeSettlement(insertRequest.data);
  }

  const store = readStore();
  const split = store.splits.find((item) => item.id === input.splitId);
  if (!split) throw new Error("Split not found");

  split.status = "settled";
  split.settlement_tx_hash = input.txHash;
  split.settled_at = settledAt;

  const settlement: Settlement = {
    id: makeId(),
    group_id: split.group_id,
    expense_split_id: split.id,
    sender_wallet: input.senderWallet,
    receiver_wallet: input.receiverWallet,
    amount: input.amount,
    tx_hash: input.txHash,
    network: "base-sepolia",
    status: input.status,
    created_at: settledAt,
  };

  store.settlements.unshift(settlement);
  writeStore(store);
  return settlement;
}

export async function saveAiMessage(
  groupId: string,
  role: AiRole,
  content: string,
) {
  const message: AiMessage = {
    id: makeId(),
    group_id: groupId,
    role,
    content,
    created_at: nowIso(),
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("ai_messages")
      .insert(message)
      .select("*")
      .single();
    throwIfError(error);
    return normalizeAiMessage(data);
  }

  const store = readStore();
  store.aiMessages.push(message);
  writeStore(store);
  return message;
}
