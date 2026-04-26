import type {
  Expense,
  ExpenseSplit,
  GroupMember,
  SplitSafeGroup,
} from "@/types/splitsafe";
import { makeId, nowIso, roundMoney } from "@/lib/utils";

export const demoWallets = {
  thant: "0x1111111111111111111111111111111111111111",
  alex: "0x2222222222222222222222222222222222222222",
  may: "0x3333333333333333333333333333333333333333",
};

export function createDemoWorkspace(createdByWallet?: string | null) {
  const createdAt = nowIso();
  const groupId = makeId();
  const thantId = makeId();
  const alexId = makeId();
  const mayId = makeId();
  const expenseId = makeId();
  const share = roundMoney(30 / 3);

  const group: SplitSafeGroup = {
    id: groupId,
    name: "ABAC Dinner Group",
    description: "Demo budget for a casual student dinner settlement.",
    budget_amount: 100,
    currency: "USDC",
    category: "food",
    created_by_wallet: createdByWallet ?? null,
    created_at: createdAt,
  };

  const members: GroupMember[] = [
    {
      id: thantId,
      group_id: groupId,
      name: "Thant",
      wallet_address: demoWallets.thant,
      role: "owner",
      created_at: createdAt,
    },
    {
      id: alexId,
      group_id: groupId,
      name: "Alex",
      wallet_address: demoWallets.alex,
      role: "member",
      created_at: createdAt,
    },
    {
      id: mayId,
      group_id: groupId,
      name: "May",
      wallet_address: demoWallets.may,
      role: "member",
      created_at: createdAt,
    },
  ];

  const expense: Expense = {
    id: expenseId,
    group_id: groupId,
    title: "Dinner",
    amount: 30,
    category: "food",
    paid_by_member_id: thantId,
    split_member_ids: [thantId, alexId, mayId],
    notes: "Split equally between all three members.",
    created_at: createdAt,
  };

  const splits: ExpenseSplit[] = [alexId, mayId].map((memberId) => ({
    id: makeId(),
    expense_id: expenseId,
    group_id: groupId,
    from_member_id: memberId,
    to_member_id: thantId,
    amount: share,
    status: "unpaid",
    settlement_tx_hash: null,
    created_at: createdAt,
    settled_at: null,
  }));

  return {
    group,
    members,
    expenses: [expense],
    splits,
  };
}
