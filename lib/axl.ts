export type AxlStatus = {
  routing: "ready" | "connected";
  axlProcess: "ready" | "connected";
  settlementAssistant: "active";
  safetyCheck: "enabled";
};

export type AxlMode = "axl-ready" | "axl";

export type SettlementSignal = {
  workspaceId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  network?: string;
  token?: string;
  unpaidCount?: number;
  memberCount?: number;
  expenseCount?: number;
  event?: string;
};

export type AxlWorkflowStep = {
  id: "expense-check" | "split-calc" | "settlement-route" | "safety-check";
  label: string;
  status: "ready" | "active" | "complete";
  message: string;
};

export type AxlRouteResult = {
  ok: boolean;
  mode: AxlMode;
  connected: boolean;
  status: AxlStatus;
  steps: AxlWorkflowStep[];
  reason?: string;
  endpointStatus?: number;
};

export function getAxlStatus(mode: AxlMode = "axl-ready"): AxlStatus {
  const connected = mode === "axl";

  return {
    routing: connected ? "connected" : "ready",
    axlProcess: connected ? "connected" : "ready",
    settlementAssistant: "active",
    safetyCheck: "enabled",
  };
}

export function buildSettlementWorkflowSteps(
  signal: SettlementSignal = {},
): AxlWorkflowStep[] {
  const amount =
    typeof signal.amount === "number" && Number.isFinite(signal.amount)
      ? signal.amount
      : 0;
  const currency = signal.currency || "USD";
  const token = signal.token || "dUSDC";

  return [
    {
      id: "expense-check",
      label: "Expense checked",
      status: "complete",
      message: "Expense amount, payer, members, and split method are prepared.",
    },
    {
      id: "split-calc",
      label: "Split calculated",
      status: "complete",
      message: `${amount.toFixed(2)} ${currency} is ready for settlement planning.`,
    },
    {
      id: "settlement-route",
      label: "Settlement routed",
      status: "ready",
      message: `Settlement signal is ready for ${token} payment coordination.`,
    },
    {
      id: "safety-check",
      label: "Safety checked",
      status: "ready",
      message: "User confirmation is required before payment is recorded.",
    },
  ];
}

export async function routeSettlementEvent(
  signal: SettlementSignal,
): Promise<AxlRouteResult> {
  if (typeof window === "undefined") {
    return {
      ok: true,
      mode: "axl-ready",
      connected: false,
      status: getAxlStatus(),
      steps: buildSettlementWorkflowSteps(signal),
    };
  }

  const response = await fetch("/api/axl/settlement", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signal }),
  });

  if (!response.ok) {
    return {
      ok: false,
      mode: "axl-ready",
      connected: false,
      status: getAxlStatus(),
      steps: buildSettlementWorkflowSteps(signal),
      reason: "AXL route unavailable",
      endpointStatus: response.status,
    };
  }

  return (await response.json()) as AxlRouteResult;
}

export async function processSettlementSignal(signal: SettlementSignal) {
  return {
    ok: true,
    mode: "axl-ready" satisfies AxlMode,
    connected: false,
    status: getAxlStatus(),
    steps: buildSettlementWorkflowSteps(signal),
    signal,
  };
}
