export type WorkspaceRole = "owner" | "admin" | "member";
export type MemberStatus = "active" | "pending";
export type InviteStatus = "pending" | "accepted" | "expired";
export type SplitStatus = "unpaid" | "paid";
export type AiRole = "user" | "assistant";

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  created_at: string;
};

export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  currency: string;
  total_budget: number;
  created_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MemberStatus;
  created_at: string;
  profile: Profile | null;
};

export type Invite = {
  id: string;
  workspace_id: string;
  invited_email: string;
  invited_by: string;
  invite_token: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: InviteStatus;
  created_at: string;
  accepted_at: string | null;
  expires_at: string | null;
};

export type Expense = {
  id: string;
  workspace_id: string;
  paid_by: string;
  title: string;
  amount: number;
  category: string;
  notes: string | null;
  created_at: string;
  paid_by_profile: Profile | null;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  workspace_id: string;
  user_id: string;
  amount_owed: number;
  status: SplitStatus;
  settlement_tx_hash: string | null;
  settled_at: string | null;
  created_at: string;
  profile: Profile | null;
};

export type Settlement = {
  id: string;
  workspace_id: string;
  expense_split_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  sender_wallet: string;
  receiver_wallet: string;
  amount: number;
  tx_hash: string;
  network: string;
  status: "confirmed" | "mocked";
  created_at: string;
};

export type AiMessage = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  role: AiRole;
  content: string;
  created_at: string;
};

export type WorkspaceData = {
  workspace: Workspace;
  currentMember: WorkspaceMember | null;
  members: WorkspaceMember[];
  invites: Invite[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  aiMessages: AiMessage[];
};

export type CreateWorkspaceInput = {
  name: string;
  description: string;
  total_budget: number;
  currency: string;
};

export type CreateInviteInput = {
  invited_email: string;
  role: Exclude<WorkspaceRole, "owner">;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  split_user_ids: string[];
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
