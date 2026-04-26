import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const chains = [baseSepolia] as const;
const transports = {
  [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
    ? http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL)
    : http(),
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

export { baseSepolia };
