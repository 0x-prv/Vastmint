/* eslint-disable @typescript-eslint/no-require-imports */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy Factory
  console.log("\n1. Deploying VastMintFactory...");
  const Factory = await hre.ethers.getContractFactory("VastMintFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("VastMintFactory deployed to:", factoryAddress);

  // 2. Deploy Marketplace
  console.log("\n2. Deploying VastMintMarketplace...");
  const Marketplace = await hre.ethers.getContractFactory("VastMintMarketplace");
  const marketplace = await Marketplace.deploy(
    deployer.address // treasury — palitan ng gusto mong address
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("VastMintMarketplace deployed to:", marketplaceAddress);

  // 3. Summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Factory:     ", factoryAddress);
  console.log("Marketplace: ", marketplaceAddress);
  console.log("\nI-update mo ang .env.local:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log("\nI-update mo rin ang Netlify environment variables!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});