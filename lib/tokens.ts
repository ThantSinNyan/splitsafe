import { type Address, formatUnits, isAddress, parseUnits } from "viem";
import { defaultSettlementNetwork, type SettlementNetworkId } from "@/lib/networks";

export const demoUSDCAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "faucetMint",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const configuredAddress = process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS;

export const demoUSDC = {
  id: "demo-usdc",
  name: "SplitSafe Demo USDC",
  symbol: "dUSDC",
  decimals: 6,
  network: defaultSettlementNetwork.id satisfies SettlementNetworkId,
  address:
    configuredAddress && isAddress(configuredAddress)
      ? (configuredAddress as Address)
      : undefined,
  isDemo: true,
} as const;

export function isDemoUSDCConfigured() {
  return Boolean(demoUSDC.address);
}

export function parseDemoUSDCAmount(amount: string | number) {
  return parseUnits(String(amount), demoUSDC.decimals);
}

export function formatDemoUSDCAmount(amount: bigint) {
  return `${formatUnits(amount, demoUSDC.decimals)} ${demoUSDC.symbol}`;
}
