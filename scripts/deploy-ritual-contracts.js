const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy a FRESH VastMintMarketplace owned by your current wallet
  //    (treasury = your own wallet for now; you can change later with setTreasury)
  const Marketplace = await hre.ethers.getContractFactory("VastMintMarketplace");
  const marketplace = await Marketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("NEW VastMintMarketplace deployed to:", marketplaceAddress);

  // 2. Reuse your already-deployed PasskeyAuth and Scheduler contracts
  const passkeyAuth = await hre.ethers.getContractAt(
    "VastMintPasskeyAuth",
    "0xC1C99f29cB1A1Ec92AE98761C2d7f83548A27C1C"
  );
  const scheduler = await hre.ethers.getContractAt(
    "VastMintScheduler",
    "0xFA34028DdE443Cc4AfFaaaBfA726b9824C79f5B0"
  );

  // 3. Wire scheduler <-> new marketplace
  let tx = await marketplace.setSchedulerContract(await scheduler.getAddress());
  await tx.wait();
  console.log("Marketplace.schedulerContract set");

  tx = await scheduler.setMarketplace(marketplaceAddress);
  await tx.wait();
  console.log("Scheduler.marketplace set");

  console.log("\n=== IMPORTANT ===");
  console.log("Update your .env: NEXT_PUBLIC_MARKETPLACE_ADDRESS=" + marketplaceAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});