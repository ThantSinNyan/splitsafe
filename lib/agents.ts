export type AgentId =
  | "receipt-agent"
  | "budget-agent"
  | "settlement-agent"
  | "safety-agent";

export type AgentStatus = "idle" | "running" | "complete" | "needs-review";

export type AgentWorkflowStep = {
  id: AgentId;
  name: string;
  role: string;
  status: AgentStatus;
  lastMessage: string;
  confidence: number;
  output: string;
};

export type AgentWorkflowContext = {
  groupName: string;
  totalSpent: number;
  budget: number;
  unpaidCount: number;
  topCategory: string;
};

export const splitSafeAgents: AgentWorkflowStep[] = [
  {
    id: "receipt-agent",
    name: "Receipt Agent",
    role: "Reads receipts and payment slips",
    status: "idle",
    lastMessage: "Ready to extract expense details.",
    confidence: 0,
    output: "",
  },
  {
    id: "budget-agent",
    name: "Budget Agent",
    role: "Analyzes spending and budget impact",
    status: "idle",
    lastMessage: "Ready to update spending impact.",
    confidence: 0,
    output: "",
  },
  {
    id: "settlement-agent",
    name: "Settlement Agent",
    role: "Prepares who-owes-who actions",
    status: "idle",
    lastMessage: "Ready to prepare repayment options.",
    confidence: 0,
    output: "",
  },
  {
    id: "safety-agent",
    name: "Safety Agent",
    role: "Checks confidence before saving or payment",
    status: "idle",
    lastMessage: "Ready to ask for confirmation when needed.",
    confidence: 0,
    output: "",
  },
];

export function buildLocalAgentWorkflow(
  context: AgentWorkflowContext,
): AgentWorkflowStep[] {
  const spentPercent =
    context.budget > 0 ? Math.min((context.totalSpent / context.budget) * 100, 100) : 0;

  return [
    {
      ...splitSafeAgents[0],
      status: "complete",
      lastMessage: "Receipt Agent scanned the latest expense context.",
      confidence: 0.88,
      output: "Expense fields are ready for user review before saving.",
    },
    {
      ...splitSafeAgents[1],
      status: "complete",
      lastMessage: "Budget Agent updated spending impact.",
      confidence: 0.84,
      output: `${context.groupName} is ${spentPercent.toFixed(0)}% through budget. Top category: ${context.topCategory}.`,
    },
    {
      ...splitSafeAgents[2],
      status: "complete",
      lastMessage: "Settlement Agent prepared repayment options.",
      confidence: 0.82,
      output: `${context.unpaidCount} unpaid balance${context.unpaidCount === 1 ? "" : "s"} ready for checkout settlement.`,
    },
    {
      ...splitSafeAgents[3],
      status: "needs-review",
      lastMessage: "Safety Agent requires user confirmation.",
      confidence: 0.91,
      output: "Review extracted data and settlement details before saving or paying.",
    },
  ];
}
