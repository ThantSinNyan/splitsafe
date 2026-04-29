import {
  buildLocalAgentWorkflow,
  type AgentWorkflowContext,
  type AgentWorkflowStep,
} from "@/lib/agents";

export type AgentWorkflowResult = {
  ok: true;
  mode: "local-demo" | "axl";
  steps: AgentWorkflowStep[];
  message: string;
};

export type AgentWorkflowMessage = {
  context: AgentWorkflowContext;
  steps?: AgentWorkflowStep[];
};

function axlEndpoint() {
  const publicAxlEnabled = process.env.NEXT_PUBLIC_GENSYN_AXL_ENABLED === "true";
  const publicEndpoint = publicAxlEnabled
    ? process.env.NEXT_PUBLIC_GENSYN_AXL_ENDPOINT
    : undefined;

  return process.env.GENSYN_AXL_ENDPOINT ?? publicEndpoint;
}

export async function sendAgentMessageViaAXL(message: AgentWorkflowMessage) {
  const endpoint = axlEndpoint();

  if (!endpoint) {
    return {
      ok: false,
      reason: "Gensyn AXL endpoint not configured",
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `Gensyn AXL request failed with ${response.status}`,
    };
  }

  return { ok: true };
}

export async function runAgentWorkflow(
  context: AgentWorkflowContext,
): Promise<AgentWorkflowResult> {
  const steps = buildLocalAgentWorkflow(context);
  const endpoint = axlEndpoint();

  if (!endpoint) {
    return {
      ok: true,
      mode: "local-demo",
      steps,
      message:
        "Running locally for demo. Configure Gensyn AXL endpoint to route agent messages peer-to-peer.",
    };
  }

  const axlResult = await sendAgentMessageViaAXL({ context, steps });

  return {
    ok: true,
    mode: axlResult.ok ? "axl" : "local-demo",
    steps,
    message: axlResult.ok
      ? "Gensyn AXL endpoint accepted the agent workflow message."
      : `${axlResult.reason}. Running locally for demo.`,
  };
}
