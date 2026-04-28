import type {
  AiMessage,
  Expense,
  ExpenseSplit,
  Invite,
  Profile,
  Settlement,
  Workspace,
  WorkspaceMember,
} from "@/types/splitsafe";
import { defaultSettlementNetwork } from "@/lib/networks";
import { roundMoney } from "@/lib/utils";

export const demoUserId = "demo-alex";

const contractAddress = "0x7A3bC9dE12F45a6789bCdEf0123456789AbCdEf0";
const checkoutSessionId = "locus_demo_checkout_001";
const network = defaultSettlementNetwork.id;
const settlementMethod = "Locus Checkout Demo";

const demoTransactionHashes = [
  "0x8f3a9c2b7d6e4f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a",
  "0x4b2c9f8a7e6d5c3b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b",
  "0x91c0f8e7d6b5a4c3f2e1d0c9b8a7f6e5d4c3b2a1908f7e6d5c4b3a2f1e0d9c",
];

type DemoSeedState = {
  profiles: Profile[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  invites: Invite[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  aiMessages: AiMessage[];
};

type DemoMemberSeed = {
  id: string;
  role: WorkspaceMember["role"];
};

type DemoExpenseSeed = {
  id: string;
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  notes?: string;
  paidSplitUserIds?: string[];
  paymentStatus?: "pending" | "paid" | "failed";
  checkoutStatus?: "mock_checkout_created" | "paid";
};

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function profile(
  id: string,
  name: string,
  email: string,
  walletAddress: string,
): Profile {
  return {
    id,
    name,
    email,
    avatar_url: null,
    wallet_address: walletAddress,
    created_at: isoMinutesAgo(9000),
  };
}

const profiles = [
  profile(demoUserId, "Alex Demo", "demo@splitsafe.app", "demo-wallet-alex"),
  profile("demo-maya", "Maya Chen", "maya.chen@example.test", "demo-wallet-maya"),
  profile("demo-chris", "Chris Wong", "chris.wong@example.test", "demo-wallet-chris"),
  profile("demo-thant", "Thant Nyan", "thant.nyan@example.test", "demo-wallet-thant"),
  profile("demo-yuki", "Yuki Tanaka", "yuki.tanaka@example.test", "demo-wallet-yuki"),
  profile("demo-min", "Min Zaw", "min.zaw@example.test", "demo-wallet-min"),
  profile("demo-sarah", "Sarah Lee", "sarah.lee@example.test", "demo-wallet-sarah"),
  profile("demo-bot", "Builder Bot", "builder.bot@example.test", "demo-wallet-builder"),
  profile("demo-jamie", "Jamie Dev", "jamie.dev@example.test", "demo-wallet-jamie"),
];

function profileById(userId: string) {
  return profiles.find((item) => item.id === userId) ?? null;
}

function paymentNotes(
  note: string,
  paymentStatus: "pending" | "paid" | "failed",
  checkoutStatus: "mock_checkout_created" | "paid",
  txHash?: string,
) {
  return [
    note,
    "",
    "Demo payment references only.",
    `paymentStatus: ${paymentStatus}`,
    `checkoutStatus: ${checkoutStatus}`,
    `contractAddress: ${contractAddress}`,
    `checkoutSessionId: ${checkoutSessionId}`,
    `network: ${network}`,
    `settlementMethod: ${settlementMethod}`,
    txHash ? `transactionHash: ${txHash}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildWorkspace(
  workspace: Omit<Workspace, "created_at">,
  memberSeeds: DemoMemberSeed[],
  expenseSeeds: DemoExpenseSeed[],
  messages: string[],
  createdMinutesAgo: number,
) {
  const createdAt = isoMinutesAgo(createdMinutesAgo);
  const workspaceRow: Workspace = {
    ...workspace,
    created_at: createdAt,
  };
  const memberIds = memberSeeds.map((member) => member.id);
  const members: WorkspaceMember[] = memberSeeds.map((member, index) => ({
    id: `${workspace.id}-member-${member.id}`,
    workspace_id: workspace.id,
    user_id: member.id,
    role: member.role,
    status: "active",
    created_at: isoMinutesAgo(createdMinutesAgo - index),
    profile: profileById(member.id),
  }));
  const expenses: Expense[] = [];
  const splits: ExpenseSplit[] = [];
  const settlements: Settlement[] = [];

  expenseSeeds.forEach((expenseSeed, index) => {
    const txHash = demoTransactionHashes[(index + createdMinutesAgo) % demoTransactionHashes.length];
    const paymentStatus = expenseSeed.paymentStatus ?? "pending";
    const checkoutStatus = expenseSeed.checkoutStatus ?? "mock_checkout_created";
    const expenseCreatedAt = isoMinutesAgo(createdMinutesAgo - 20 - index * 18);
    const expense: Expense = {
      id: expenseSeed.id,
      workspace_id: workspace.id,
      paid_by: expenseSeed.paidBy,
      title: expenseSeed.title,
      amount: expenseSeed.amount,
      category: expenseSeed.category,
      notes: paymentNotes(
        expenseSeed.notes ?? "Sample demo expense.",
        paymentStatus,
        checkoutStatus,
        paymentStatus === "paid" ? txHash : undefined,
      ),
      created_at: expenseCreatedAt,
      paid_by_profile: profileById(expenseSeed.paidBy),
    };
    const share = roundMoney(expense.amount / memberIds.length);

    expenses.push(expense);

    memberIds
      .filter((userId) => userId !== expenseSeed.paidBy)
      .forEach((userId, splitIndex) => {
        const paid = expenseSeed.paidSplitUserIds?.includes(userId) ?? false;
        const splitId = `${expense.id}-split-${userId}`;
        const split: ExpenseSplit = {
          id: splitId,
          expense_id: expense.id,
          workspace_id: workspace.id,
          user_id: userId,
          amount_owed: share,
          status: paid ? "paid" : "unpaid",
          settlement_tx_hash: paid ? txHash : null,
          settled_at: paid ? isoMinutesAgo(createdMinutesAgo - 100 - splitIndex) : null,
          created_at: expenseCreatedAt,
          profile: profileById(userId),
        };

        splits.push(split);

        if (paid) {
          settlements.push({
            id: `${splitId}-settlement`,
            workspace_id: workspace.id,
            expense_split_id: splitId,
            sender_user_id: userId,
            receiver_user_id: expenseSeed.paidBy,
            sender_wallet: profileById(userId)?.wallet_address ?? "demo-wallet-sender",
            receiver_wallet:
              profileById(expenseSeed.paidBy)?.wallet_address ?? "demo-wallet-receiver",
            amount: share,
            tx_hash: txHash,
            network,
            status: "mocked",
            created_at: split.settled_at ?? isoMinutesAgo(createdMinutesAgo - 100),
          });
        }
      });
  });

  const aiMessages: AiMessage[] = messages.map((content, index) => ({
    id: `${workspace.id}-message-${index}`,
    workspace_id: workspace.id,
    user_id: memberIds[index % memberIds.length] ?? demoUserId,
    role: "user",
    content,
    created_at: isoMinutesAgo(createdMinutesAgo - 200 - index * 5),
  }));

  return {
    workspace: workspaceRow,
    members,
    expenses,
    splits,
    settlements,
    aiMessages,
  };
}

export function createDemoSeedState(): DemoSeedState {
  const thailand = buildWorkspace(
    {
      id: "demo-group-thailand-trip",
      owner_id: demoUserId,
      name: "Thailand Trip",
      description:
        "Shared budget for food, transport, hotel, and activities in Bangkok.",
      currency: "USD",
      total_budget: 1000,
    },
    [
      { id: demoUserId, role: "owner" },
      { id: "demo-maya", role: "member" },
      { id: "demo-chris", role: "member" },
      { id: "demo-thant", role: "member" },
    ],
    [
      {
        id: "demo-expense-hotel-deposit",
        title: "Hotel deposit",
        amount: 320,
        category: "travel",
        paidBy: demoUserId,
        paidSplitUserIds: ["demo-maya"],
        paymentStatus: "paid",
        checkoutStatus: "paid",
        notes: "Bangkok hotel deposit split across the trip group.",
      },
      {
        id: "demo-expense-thonglor-dinner",
        title: "Dinner at Thonglor",
        amount: 85,
        category: "food",
        paidBy: "demo-maya",
        notes: "Restaurant bill after the first night.",
      },
      {
        id: "demo-expense-grab-rides",
        title: "Grab rides",
        amount: 42,
        category: "transport",
        paidBy: "demo-chris",
        notes: "Airport and city rides.",
      },
      {
        id: "demo-expense-floating-market",
        title: "Floating market snacks",
        amount: 28,
        category: "food",
        paidBy: "demo-thant",
        notes: "Snacks and drinks at the floating market.",
      },
      {
        id: "demo-expense-sim-cards",
        title: "SIM cards",
        amount: 36,
        category: "supplies",
        paidBy: demoUserId,
        paymentStatus: "failed",
        notes: "Demo failed payment reference is kept for status testing.",
      },
    ],
    [
      "I added the hotel deposit.",
      "Can someone check who still needs to pay?",
      "AI summary looks useful for the trip budget.",
    ],
    1400,
  );

  const dinner = buildWorkspace(
    {
      id: "demo-group-abac-dinner",
      owner_id: demoUserId,
      name: "ABAC Dinner Group",
      description: "Dinner split for university friends.",
      currency: "USD",
      total_budget: 250,
    },
    [
      { id: demoUserId, role: "owner" },
      { id: "demo-yuki", role: "member" },
      { id: "demo-min", role: "member" },
      { id: "demo-sarah", role: "member" },
    ],
    [
      {
        id: "demo-expense-korean-bbq",
        title: "Korean BBQ dinner",
        amount: 120,
        category: "food",
        paidBy: demoUserId,
        paidSplitUserIds: ["demo-sarah"],
        paymentStatus: "paid",
        checkoutStatus: "paid",
        notes: "Dinner was split equally after service charge.",
      },
      {
        id: "demo-expense-bubble-tea",
        title: "Bubble tea",
        amount: 24,
        category: "food",
        paidBy: "demo-sarah",
        notes: "After-dinner drinks.",
      },
      {
        id: "demo-expense-taxi-home",
        title: "Taxi back home",
        amount: 18,
        category: "transport",
        paidBy: "demo-min",
        notes: "Shared taxi back from the restaurant.",
      },
    ],
    ["Dinner was great.", "Please settle before tomorrow.", "Who owes Alex?"],
    900,
  );

  const hackathon = buildWorkspace(
    {
      id: "demo-group-hackathon-team",
      owner_id: demoUserId,
      name: "Hackathon Team",
      description: "Shared spending for project tools, credits, and deployment.",
      currency: "USD",
      total_budget: 150,
    },
    [
      { id: demoUserId, role: "owner" },
      { id: "demo-bot", role: "admin" },
      { id: "demo-jamie", role: "member" },
    ],
    [
      {
        id: "demo-expense-gemini-credits",
        title: "Gemini API testing credits",
        amount: 10,
        category: "supplies",
        paidBy: demoUserId,
        paidSplitUserIds: ["demo-bot"],
        paymentStatus: "paid",
        checkoutStatus: "paid",
        notes: "Credits used for AI summary and Smart Slip Scan testing.",
      },
      {
        id: "demo-expense-locus-credits",
        title: "Locus checkout testing credits",
        amount: 10,
        category: "supplies",
        paidBy: "demo-jamie",
        notes: "Mock checkout testing for the settlement demo.",
      },
      {
        id: "demo-expense-domain-name",
        title: "Domain name",
        amount: 14,
        category: "supplies",
        paidBy: "demo-bot",
        notes: "Demo domain reference for the hackathon deck.",
      },
      {
        id: "demo-expense-deployment-tools",
        title: "Deployment tools",
        amount: 20,
        category: "supplies",
        paidBy: demoUserId,
        notes: "Deployment and preview tooling.",
      },
    ],
    [
      "Checkout demo is ready.",
      "Need to test AI summary again.",
      "Let's record the demo video tonight.",
    ],
    500,
  );

  const groups = [thailand, dinner, hackathon];

  return {
    profiles,
    workspaces: groups.map((group) => group.workspace),
    members: groups.flatMap((group) => group.members),
    invites: [],
    expenses: groups.flatMap((group) => group.expenses),
    splits: groups.flatMap((group) => group.splits),
    settlements: groups.flatMap((group) => group.settlements),
    aiMessages: groups.flatMap((group) => group.aiMessages),
  };
}
