import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddress,
  isHash,
  parseAbiItem,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import {
  defaultSettlementNetwork,
  getRpcUrl,
  normalizeSettlementNetworkId,
  settlementNetworkTxUrl,
} from "@/lib/networks";
import { demoUSDC } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

type VerifyRequest = {
  network?: string;
  txHash?: string;
  tokenAddress?: string;
  expectedSender?: string;
  expectedRecipient?: string;
  expectedAmount?: string;
  decimals?: number;
};

function normalizeTxHash(value: string | undefined) {
  if (!value) return "";
  const match = value.match(/0x[a-fA-F0-9]{64}/);
  return match?.[0] ?? value.trim();
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyRequest;
    const networkId =
      normalizeSettlementNetworkId(body.network) ?? defaultSettlementNetwork.id;

    if (networkId !== "0g-galileo") {
      return Response.json({
        ok: true,
        verified: false,
        reason: "dUSDC verification is available on 0G Galileo Testnet.",
      });
    }

    const txHash = normalizeTxHash(body.txHash);
    const tokenAddress = body.tokenAddress ?? demoUSDC.address;
    const expectedSender = body.expectedSender;
    const expectedRecipient = body.expectedRecipient;
    const decimals = body.decimals ?? demoUSDC.decimals;
    const expectedAmount = body.expectedAmount ?? "";

    if (
      !isHash(txHash) ||
      !tokenAddress ||
      !isAddress(tokenAddress) ||
      !expectedSender ||
      !isAddress(expectedSender) ||
      !expectedRecipient ||
      !isAddress(expectedRecipient) ||
      !expectedAmount
    ) {
      return Response.json(
        { ok: false, error: "Invalid settlement verification request." },
        { status: 400 },
      );
    }

    const expectedValue = parseUnits(expectedAmount, decimals);
    const client = createPublicClient({
      chain: defaultSettlementNetwork.chain,
      transport: http(getRpcUrl("0g-galileo")),
    });

    const receipt = await client
      .getTransactionReceipt({ hash: txHash as Hash })
      .catch(() => null);

    if (!receipt) {
      return Response.json({
        ok: true,
        verified: false,
        reason: "Transaction not found.",
      });
    }

    if (receipt.status !== "success") {
      return Response.json({
        ok: true,
        verified: false,
        reason: "Transaction was not successful.",
      });
    }

    let senderMismatch = false;
    let recipientMismatch = false;
    let amountTooLow = false;

    for (const log of receipt.logs) {
      if (!sameAddress(log.address, tokenAddress)) continue;

      try {
        const decoded = decodeEventLog({
          abi: [transferEvent],
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== "Transfer") continue;

        const from = decoded.args.from as Address;
        const to = decoded.args.to as Address;
        const value = decoded.args.value as bigint;
        const senderMatches = sameAddress(from, expectedSender);
        const recipientMatches = sameAddress(to, expectedRecipient);
        const amountMatches = value >= expectedValue;

        if (senderMatches && recipientMatches && amountMatches) {
          return Response.json({
            ok: true,
            verified: true,
            token: demoUSDC.symbol,
            amount: expectedAmount,
            from,
            to,
            explorerUrl: settlementNetworkTxUrl(txHash, networkId),
          });
        }

        if (!senderMatches) senderMismatch = true;
        if (!recipientMatches) recipientMismatch = true;
        if (senderMatches && recipientMatches && !amountMatches) {
          amountTooLow = true;
        }
      } catch {
        continue;
      }
    }

    const reason = amountTooLow
      ? "Amount too low."
      : recipientMismatch && !senderMismatch
        ? "Recipient mismatch."
        : senderMismatch && !recipientMismatch
          ? "Sender mismatch."
          : "No dUSDC transfer found.";

    return Response.json({
      ok: true,
      verified: false,
      reason,
    });
  } catch {
    return Response.json(
      { ok: false, error: "Could not verify transaction." },
      { status: 500 },
    );
  }
}
