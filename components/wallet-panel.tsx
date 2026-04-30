"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ChevronDown,
  Network,
  ShieldCheck,
  Wallet,
  Wifi,
} from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui-kit";
import { localDemoUserId } from "@/lib/local-demo";
import {
  defaultSettlementNetwork,
  getSettlementNetworkByChainId,
} from "@/lib/networks";
import { getSupabaseClient } from "@/lib/supabase";
import { cn, shortAddress } from "@/lib/utils";

export function WalletMiniControl() {
  return (
    <>
      <WalletProfileSync />
      <WalletConnectControl />
    </>
  );
}

function WalletProfileSync() {
  const { address } = useAccount();
  const { profile, refreshProfile, user } = useAuth();

  useEffect(() => {
    if (!user || !address) return;
    if (user.id === localDemoUserId) return;
    if (profile?.wallet_address?.toLowerCase() === address.toLowerCase()) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    void supabase
      .from("profiles")
      .update({ wallet_address: address })
      .eq("id", user.id)
      .then(({ error }) => {
        if (!error) void refreshProfile();
      });
  }, [address, profile?.wallet_address, refreshProfile, user]);

  return null;
}

function WalletConnectControl() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const connected = mounted && account && chain;

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <Wallet className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Connect wallet</span>
              <span className="sm:hidden">Connect</span>
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(245,158,11,0.22)] hover:-translate-y-0.5 hover:bg-amber-600"
            >
              <Network className="size-4" aria-hidden="true" />
              Switch network
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className="hidden h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 shadow-sm hover:-translate-y-0.5 sm:inline-flex"
            >
              <Wifi className="size-4" aria-hidden="true" />
              {chain.name}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm hover:-translate-y-0.5 hover:border-slate-300"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-400 text-[10px] font-bold text-white">
                {account.displayName.slice(0, 2).toUpperCase()}
              </span>
              <span className="max-w-28 truncate">{account.displayName}</span>
              <ChevronDown className="size-4 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function WalletPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const connectedNetwork = getSettlementNetworkByChainId(chainId);
  const onDefaultNetwork = connectedNetwork?.id === defaultSettlementNetwork.id;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="absolute -right-20 -top-24 size-52 rounded-full bg-teal-300/18 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
            <Wallet className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-slate-950">
                Payment network
              </h2>
              <Badge
                tone={
                  isConnected
                    ? connectedNetwork
                      ? onDefaultNetwork
                        ? "green"
                        : "blue"
                      : "amber"
                    : "slate"
                }
              >
                {isConnected
                  ? connectedNetwork
                    ? connectedNetwork.shortLabel
                    : "Wrong network"
                  : "Wallet optional"}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {isConnected
                ? `${shortAddress(address)} is ready for ${
                    connectedNetwork?.shortLabel ?? "the selected network"
                  } dUSDC settlement.`
                : "Connect a wallet for dUSDC settlement, or record payments manually."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {!compact ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Protected
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                Wallets stay optional
              </p>
            </div>
          ) : null}
          <WalletMiniControl />
        </div>
      </div>
    </div>
  );
}
