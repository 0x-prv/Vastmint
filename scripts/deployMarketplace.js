import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying VastMintMarketplace...");
  console.log("Deployer:", deployer.address);

  // Treasury = deployer address mo muna
  const treasury = deployer.address;

  const Marketplace = await ethers.getContractFactory("VastMintMarketplace");
  const marketplace = await Marketplace.deploy(treasury);
  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  console.log("✅ VastMintMarketplace deployed to:", address);
  console.log("Treasury:", treasury);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});