import {
  buildSettlementWorkflowSteps,
  getAxlStatus,
  type SettlementSignal,
} from "@/lib/axl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AxlRequestBody = {
  signal?: unknown;
};

const allowedStringFields = [
  "workspaceId",
  "currency",
  "status",
  "network",
  "token",
  "event",
] as const;

const allowedNumberFields = [
  "amount",
  "unpaidCount",
  "memberCount",
  "expenseCount",
] as const;

function normalizeSignal(value: unknown): SettlementSignal {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value as Record<string, unknown>;
  const signal: SettlementSignal = {};

  for (const field of allowedStringFields) {
    const nextValue = source[field];
    if (typeof nextValue === "string" && nextValue.trim()) {
      signal[field] = nextValue.trim().slice(0, 120);
    }
  }

  for (const field of allowedNumberFields) {
    const nextValue = source[field];
    if (typeof nextValue === "number" && Number.isFinite(nextValue)) {
      signal[field] = nextValue;
    }
  }

  return signal;
}

function fallbackResponse(
  signal: SettlementSignal,
  reason?: string,
  endpointStatus?: number,
) {
  return Response.json({
    ok: true,
    mode: "axl-ready",
    connected: false,
    status: getAxlStatus("axl-ready"),
    steps: buildSettlementWorkflowSteps(signal),
    reason,
    endpointStatus,
  });
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: AxlRequestBody;

  try {
    body = (await request.json()) as AxlRequestBody;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid AXL request." },
      { status: 400 },
    );
  }

  const signal = normalizeSignal(body.signal ?? body);
  const endpoint = process.env.GENSYN_AXL_ENDPOINT?.trim();

  if (!endpoint) {
    return fallbackResponse(signal, "GENSYN_AXL_ENDPOINT not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const steps = buildSettlementWorkflowSteps(signal);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "splitsafe.settlement.workflow",
        source: "splitsafe",
        signal,
        agents: [
          "receipt-agent",
          "budget-agent",
          "settlement-agent",
          "safety-agent",
        ],
        steps,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackResponse(signal, "AXL endpoint unavailable", response.status);
    }

    const axlResponse = await readJsonSafely(response);
    const routedSteps = steps.map((step) =>
      step.id === "settlement-route"
        ? {
            ...step,
            status: "complete" as const,
            message:
              "Settlement signal routed through the configured AXL endpoint.",
          }
        : step,
    );

    return Response.json({
      ok: true,
      mode: "axl",
      connected: true,
      status: getAxlStatus("axl"),
      steps: routedSteps,
      axl: {
        accepted: true,
        responseType:
          axlResponse && typeof axlResponse === "object" ? "json" : "empty",
      },
    });
  } catch {
    clearTimeout(timeout);
    return fallbackResponse(signal, "AXL endpoint unavailable");
  }
}
