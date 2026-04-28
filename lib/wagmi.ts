import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import {
  defaultSettlementNetwork,
  fallbackSettlementNetwork,
  getRpcUrl,
  settlementChainList,
} from "@/lib/networks";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const chains = settlementChainList;
const transports = {
  [defaultSettlementNetwork.chainId]: http(getRpcUrl(defaultSettlementNetwork.id)),
  [fallbackSettlementNetwork.chainId]: http(getRpcUrl(fallbackSettlementNetwork.id)),
};

export const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "SplitSafe",
      projectId: walletConnectProjectId,
      chains,
      transports,
      ssr: true,
    })
  : createConfig({
      chains,
      transports,
      ssr: true,
      connectors: connectorsForWallets(
        [
          {
            groupName: "Installed wallets",
            wallets: [injectedWallet],
          },
        ],
        {
          appName: "SplitSafe",
          projectId: "local-demo",
        },
      ),
    });

export {
  defaultSettlementNetwork,
  fallbackSettlementNetwork,
  settlementNetworks,
  zeroGGalileoTestnet,
} from "@/lib/networks";
