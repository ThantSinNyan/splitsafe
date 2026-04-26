import type { WorkspaceMember } from "@/types/splitsafe";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatMoney(amount: number, currency = "USDC") {
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })} ${currency}`;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function shortAddress(address?: string | null) {
  if (!address) return "No wallet";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function profileLabel(profile?: {
  name?: string | null;
  email?: string | null;
} | null) {
  return profile?.name || profile?.email || "Unknown";
}

export function memberName(userId: string, members: WorkspaceMember[]) {
  const member = members.find((item) => item.user_id === userId);
  return profileLabel(member?.profile);
}
