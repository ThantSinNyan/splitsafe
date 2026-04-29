export type AxlStatus = {
  routing: "ready";
  axlProcess: "ready";
  settlementAssistant: "active";
  safetyCheck: "enabled";
};

export type SettlementSignal = {
  workspaceId?: string;
  amount?: number;
  currency?: string;
  status?: string;
};

export function getAxlStatus(): AxlStatus {
  return {
    routing: "ready",
    axlProcess: "ready",
    settlementAssistant: "active",
    safetyCheck: "enabled",
  };
}

export async function routeSettlementEvent(signal: SettlementSignal) {
  return {
    ok: true,
    status: "ready",
    signal,
  };
}

export async function processSettlementSignal(signal: SettlementSignal) {
  return {
    ok: true,
    status: "active",
    safetyCheck: "enabled",
    signal,
  };
}
