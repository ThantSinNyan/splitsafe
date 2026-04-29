import hardhat from "hardhat";

const { ethers, network } = hardhat;

const explorerBaseUrl = "https://chainscan-galileo.0g.ai";

async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required locally to deploy dUSDC.");
  }

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const DemoUSDC = await ethers.getContractFactory("DemoUSDC");
  const token = await DemoUSDC.deploy();

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();

  console.log("SplitSafe Demo USDC deployed");
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chain.chainId.toString()}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`dUSDC address: ${tokenAddress}`);
  console.log(`Explorer: ${explorerBaseUrl}/address/${tokenAddress}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Add NEXT_PUBLIC_DEMO_USDC_ADDRESS to Vercel.");
  console.log("2. Redeploy SplitSafe.");
  console.log("3. Use Get demo dUSDC in the app to call faucetMint().");
  console.log("Reminder: dUSDC is fake testnet money only and has no real value.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
