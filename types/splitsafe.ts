export type GroupCategory =
  | "food"
  | "travel"
  | "family"
  | "event"
  | "dorm"
  | "other";

export type MemberRole = "owner" | "member";
export type SplitStatus = "unpaid" | "settled";
export type AiRole = "user" | "assistant";

export type Profile = {
  id: string;
  wallet_address: string;
  display_name: string | null;
  created_at: string;
};

export type SplitSafeGroup = {
  id: string;
  name: string;
  description: string | null;
  budget_amount: number;
  currency: string;
  category: GroupCategory;
  created_by_wallet: string | null;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  name: string;
  wallet_address: string;
  role: MemberRole;
  created_at: string;
};

export type Expense = {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  category: string;
  paid_by_member_id: string;
  split_member_ids: string[];
  notes: string | null;
  created_at: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  status: SplitStatus;
  settlement_tx_hash: string | null;
  created_at: string;
  settled_at: string | null;
};

export type Settlement = {
  id: string;
  group_id: string;
  expense_split_id: string;
  sender_wallet: string;
  receiver_wallet: string;
  amount: number;
  tx_hash: string;
  network: string;
  status: string;
  created_at: string;
};

export type AiMessage = {
  id: string;
  group_id: string;
  role: AiRole;
  content: string;
  created_at: string;
};

export type GroupWorkspaceData = {
  group: SplitSafeGroup;
  members: GroupMember[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  aiMessages: AiMessage[];
};

export type CreateGroupInput = {
  name: string;
  description: string;
  budget_amount: number;
  currency: string;
  category: GroupCategory;
};

export type CreateMemberInput = {
  name: string;
  wallet_address: string;
  role: MemberRole;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
  category: string;
  paid_by_member_id: string;
  split_member_ids: string[];
  notes: string;
};

export type SettlementInput = {
  splitId: string;
  senderWallet: string;
  receiverWallet: string;
  amount: number;
  txHash: string;
  status: "confirmed" | "mocked";
};
