import { defineChain } from "viem";
import { baseSepolia } from "wagmi/chains";

export const zeroGGalileoTestnet = defineChain({
  id: 16_602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evmrpc-testnet.0g.ai"],
    },
  },
  blockExplorers: {
    default: {
      name: "0G Galileo ChainScan",
      url: "https://chainscan-galileo.0g.ai",
    },
  },
  testnet: true,
});

export type SettlementNetworkId = "0g-galileo" | "base-sepolia";
export type SettlementChainId = 16_602 | 84_532;

type SettlementNetwork = {
  id: SettlementNetworkId;
  label: string;
  shortLabel: string;
  chain: typeof zeroGGalileoTestnet | typeof baseSepolia;
  chainId: SettlementChainId;
  defaultRpcUrl: string;
  rpcEnvVar: "NEXT_PUBLIC_0G_GALILEO_RPC_URL" | "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL";
  explorerUrl: string;
  nativeSymbol: string;
  settlementCurrency: string;
  role: "default" | "fallback";
  aliases: string[];
};

export const settlementNetworks = {
  "0g-galileo": {
    id: "0g-galileo",
    label: "0G Galileo Testnet",
    shortLabel: "0G Galileo",
    chain: zeroGGalileoTestnet,
    chainId: zeroGGalileoTestnet.id,
    defaultRpcUrl: "https://evmrpc-testnet.0g.ai",
    rpcEnvVar: "NEXT_PUBLIC_0G_GALILEO_RPC_URL",
    explorerUrl: "https://chainscan-galileo.0g.ai",
    nativeSymbol: "0G",
    settlementCurrency: "USDC demo",
    role: "default",
    aliases: [
      "0g",
      "0g galileo",
      "0g galileo testnet",
      "0g-galileo",
      "0g-galileo-testnet",
      "zero g",
      "zero g galileo",
    ],
  },
  "base-sepolia": {
    id: "base-sepolia",
    label: "Base Sepolia",
    shortLabel: "Base Sepolia",
    chain: baseSepolia,
    chainId: baseSepolia.id,
    defaultRpcUrl: "https://sepolia.base.org",
    rpcEnvVar: "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
    explorerUrl: "https://sepolia.basescan.org",
    nativeSymbol: "ETH",
    settlementCurrency: "USDC demo",
    role: "fallback",
    aliases: ["base", "base sepolia", "base-sepolia"],
  },
} as const satisfies Record<SettlementNetworkId, SettlementNetwork>;

export const defaultSettlementNetwork = settlementNetworks["0g-galileo"];
export const fallbackSettlementNetwork = settlementNetworks["base-sepolia"];
export const settlementChainList = [
  defaultSettlementNetwork.chain,
  fallbackSettlementNetwork.chain,
] as const;
const settlementNetworkList = Object.values(
  settlementNetworks,
) as readonly SettlementNetwork[];

const rpcUrlsByNetwork: Record<SettlementNetworkId, string | undefined> = {
  "0g-galileo": process.env.NEXT_PUBLIC_0G_GALILEO_RPC_URL,
  "base-sepolia": process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
};

export function getRpcUrl(networkId: SettlementNetworkId) {
  return rpcUrlsByNetwork[networkId] || settlementNetworks[networkId].defaultRpcUrl;
}

export function getSettlementNetworkByChainId(chainId: number | undefined) {
  return (
    settlementNetworkList.find((network) => network.chainId === chainId) ??
    null
  );
}

export function normalizeSettlementNetworkId(
  value: string | null | undefined,
): SettlementNetworkId | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();

  if (normalized in settlementNetworks) {
    return normalized as SettlementNetworkId;
  }

  return (
    settlementNetworkList.find((network) => network.aliases.includes(normalized))
      ?.id ?? null
  );
}

export function settlementNetworkLabel(value: string | null | undefined) {
  const networkId = normalizeSettlementNetworkId(value);

  return networkId ? settlementNetworks[networkId].label : value || defaultSettlementNetwork.label;
}

export function settlementNetworkTxUrl(
  hash: string,
  value: string | null | undefined = defaultSettlementNetwork.id,
) {
  const networkId = normalizeSettlementNetworkId(value) ?? defaultSettlementNetwork.id;

  return `${settlementNetworks[networkId].explorerUrl}/tx/${hash}`;
}
