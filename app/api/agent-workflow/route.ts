import { NextResponse } from "next/server";
import { runAgentWorkflow } from "@/lib/gensyn-axl";
import type { AgentWorkflowContext } from "@/lib/agents";

export async function POST(request: Request) {
  const context = (await request.json()) as AgentWorkflowContext;
  const result = await runAgentWorkflow(context);

  return NextResponse.json(result);
}
