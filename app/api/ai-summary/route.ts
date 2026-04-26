import type {
  Expense,
  ExpenseSplit,
  GroupMember,
  Settlement,
  SplitSafeGroup,
} from "@/types/splitsafe";
import { formatMoney, memberName, shortAddress } from "@/lib/utils";

type SummaryPayload = {
  question?: string;
  group?: SplitSafeGroup;
  members?: GroupMember[];
  expenses?: Expense[];
  splits?: ExpenseSplit[];
  settlements?: Settlement[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
};

type SummaryContext = ReturnType<typeof buildSummaryContext>;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(request: Request) {
  const payload = (await request.json()) as SummaryPayload;
  const context = buildSummaryContext(payload);
  const fallbackSummary = buildRuleBasedSummary(payload, context);

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({
      summary: fallbackSummary,
      mode: "fallback",
      indicator: "Using local fallback",
    });
  }

  try {
    const geminiSummary = await tryGeminiSummary(payload, context);

    if (geminiSummary) {
      return Response.json({
        summary: geminiSummary,
        mode: "gemini",
        indicator: "Using Gemini AI",
      });
    }

    return Response.json({
      summary: fallbackSummary,
      mode: "fallback",
      indicator: "AI unavailable, fallback response shown",
    });
  } catch {
    return Response.json({
      summary: fallbackSummary,
      mode: "fallback",
      indicator: "AI unavailable, fallback response shown",
    });
  }
}

async function tryGeminiSummary(payload: SummaryPayload, context: SummaryContext) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              "You are SplitSafe AI, a concise group budgeting and settlement assistant.",
              "You only help with SplitSafe group budgets, expense splitting, spending insights, balances, and settlement status.",
              "Product rules: SplitSafe is testnet only. Base Sepolia is used for demo settlement. Demo USDC is not real USDC unless explicitly configured.",
              "Never tell users to use real money, never suggest mainnet transactions, and never give investment or trading advice.",
              "Treat wallet addresses as public identifiers. Do not ask for private keys, seed phrases, or service role keys.",
              "If the question is unclear, briefly explain what SplitSafe AI can help with.",
              "Keep answers short, clear, natural, and demo-friendly. Prefer 2-4 sentences.",
            ].join(" "),
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildGeminiPrompt(payload.question, context),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 320,
      },
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as GeminiResponse;
  return extractGeminiText(data);
}

function extractGeminiText(data: GeminiResponse) {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .trim();

  return text || null;
}

function buildGeminiPrompt(question: string | undefined, context: SummaryContext) {
  return [
    `User question: ${question || "Summarize this group budget."}`,
    "Use this SplitSafe group context as the source of truth:",
    JSON.stringify(context, null, 2),
    "Answer as SplitSafe AI. If there are unpaid balances, name who owes whom and the amount. If settlements are completed, mention transaction hashes only when relevant.",
  ].join("\n\n");
}

function buildSummaryContext(payload: SummaryPayload) {
  const {
    group,
    members = [],
    expenses = [],
    splits = [],
    settlements = [],
  } = payload;
  const currency = group?.currency ?? "USDC";
  const budget = group?.budget_amount ?? 0;
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = budget - totalSpent;
  const budgetUsagePercentage = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
  const categoryTotals = expenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
    return totals;
  }, {});
  const paidTotals = expenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.paid_by_member_id] =
      (totals[expense.paid_by_member_id] ?? 0) + expense.amount;
    return totals;
  }, {});

  return {
    product: {
      name: "SplitSafe",
      rules: [
        "testnet only",
        "Base Sepolia demo settlement",
        "demo USDC is not real USDC unless explicitly configured",
        "no mainnet funds",
        "no investment or trading advice",
      ],
    },
    group: {
      id: group?.id ?? null,
      name: group?.name ?? "Unknown group",
      description: group?.description ?? null,
      totalBudget: budget,
      currency,
      category: group?.category ?? "other",
      totalSpent,
      remainingBudget: remaining,
      budgetUsagePercentage,
      settlementStatus:
        splits.length === 0
          ? "no balances"
          : splits.every((split) => split.status === "settled")
            ? "all settled"
            : "unpaid balances remain",
    },
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      walletAddress: member.wallet_address,
      role: member.role,
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      paidBy: memberName(expense.paid_by_member_id, members),
      splitBetween: expense.split_member_ids.map((id) => memberName(id, members)),
      notes: expense.notes,
    })),
    categoryTotals: Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount })),
    paidTotals: Object.entries(paidTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([memberId, amount]) => ({
        member: memberName(memberId, members),
        amount,
      })),
    unpaidBalances: splits
      .filter((split) => split.status === "unpaid")
      .map((split) => ({
        from: memberName(split.from_member_id, members),
        to: memberName(split.to_member_id, members),
        amount: split.amount,
        currency,
        expenseId: split.expense_id,
        status: split.status,
      })),
    settledBalances: splits
      .filter((split) => split.status === "settled")
      .map((split) => ({
        from: memberName(split.from_member_id, members),
        to: memberName(split.to_member_id, members),
        amount: split.amount,
        currency,
        expenseId: split.expense_id,
        status: split.status,
        transactionHash: split.settlement_tx_hash,
        explorerLabel: split.settlement_tx_hash
          ? shortAddress(split.settlement_tx_hash)
          : null,
      })),
    settlements: settlements.map((settlement) => ({
      senderWallet: settlement.sender_wallet,
      receiverWallet: settlement.receiver_wallet,
      amount: settlement.amount,
      currency,
      network: settlement.network,
      status: settlement.status,
      transactionHash: settlement.tx_hash,
      explorerLabel: shortAddress(settlement.tx_hash),
    })),
  };
}

function buildRuleBasedSummary(payload: SummaryPayload, context = buildSummaryContext(payload)) {
  const question = (payload.question ?? "").toLowerCase();
  const currency = context.group.currency;
  const budget = context.group.totalBudget;
  const totalSpent = context.group.totalSpent;
  const remaining = context.group.remainingBudget;
  const topCategory = context.categoryTotals[0];
  const topPayer = context.paidTotals[0];
  const unpaid = context.unpaidBalances;
  const settled = context.settledBalances;

  const unpaidText =
    unpaid.length > 0
      ? unpaid
          .map(
            (split) =>
              `${split.from} owes ${split.to} ${formatMoney(split.amount, currency)}`,
          )
          .join("; ")
      : "No one has unpaid balances.";

  const statusText =
    remaining < 0
      ? `You are over budget by ${formatMoney(Math.abs(remaining), currency)}.`
      : `You still have ${formatMoney(remaining, currency)} remaining.`;

  if (isGreeting(question)) {
    return `Hi, I am SplitSafe AI. I can help explain ${context.group.name}'s budget, unpaid balances, category spending, and Base Sepolia settlement status.`;
  }

  if (question.includes("who still") || question.includes("needs to pay") || question.includes("owe")) {
    return unpaidText;
  }

  if (question.includes("over budget") || question.includes("budget")) {
    return `${formatMoney(totalSpent, currency)} has been spent from a ${formatMoney(
      budget,
      currency,
    )} budget. ${statusText}`;
  }

  if (question.includes("where") || question.includes("most") || question.includes("category")) {
    return topCategory
      ? `The highest spending category is ${topCategory.category} at ${formatMoney(
          topCategory.amount,
          currency,
        )}. Total spending is ${formatMoney(totalSpent, currency)}.`
      : "No expenses have been recorded yet, so there is no top spending category.";
  }

  if (question.includes("reduce") || question.includes("cut") || question.includes("save")) {
    return topCategory
      ? `Reduce ${topCategory.category} first because it is the largest category at ${formatMoney(
          topCategory.amount,
          currency,
        )}. ${statusText}`
      : "Add expenses first, then I can suggest what category to reduce.";
  }

  if (question.includes("summarize") || question.includes("summary")) {
    return `${context.group.name} has spent ${formatMoney(
      totalSpent,
      currency,
    )} out of ${formatMoney(budget, currency)} (${context.group.budgetUsagePercentage}%). ${unpaidText} ${statusText}`;
  }

  if (question.includes("who paid")) {
    return topPayer
      ? `${topPayer.member} paid the most so far: ${formatMoney(
          topPayer.amount,
          currency,
        )}.`
      : "No one has paid for an expense yet.";
  }

  if (question.includes("remaining") || question.includes("left")) {
    return statusText;
  }

  if (question.includes("settlement") || question.includes("completed") || question.includes("settled")) {
    return settled.length > 0
      ? settled
          .map(
            (split) =>
              `${split.from} to ${split.to} is settled for ${formatMoney(
                split.amount,
                currency,
              )}${split.explorerLabel ? ` (${split.explorerLabel})` : ""}`,
          )
          .join("; ")
      : "No settlements are completed yet.";
  }

  if (question.includes("next") || question.includes("do next")) {
    if (unpaid.length > 0) {
      return `Next, settle the unpaid balances on Base Sepolia testnet: ${unpaidText}`;
    }

    return "Next, add any missing expenses or ask for a spending summary. All current balances look settled.";
  }

  return "I can help with group budget summaries, unpaid balances, top spending categories, remaining budget, who paid the most, and Base Sepolia settlement status.";
}

function isGreeting(question: string) {
  const normalized = question.trim().replace(/[!?.\s]/g, "");
  return ["hi", "hello", "hey", "gm", "yo"].includes(normalized);
}
