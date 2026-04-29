import { config as loadEnv } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

loadEnv();
loadEnv({ path: ".env.local", override: true });

const ogGalileoRpcUrl =
  process.env.OG_GALILEO_RPC_URL || "https://evmrpc-testnet.0g.ai";
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ogGalileo: {
      url: ogGalileoRpcUrl,
      chainId: 16_602,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
};

export default config;
