import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying VastMintSecretAllowlist...");
  console.log("Deployer:", deployer.address);

  const VastMintSecretAllowlist = await ethers.getContractFactory("VastMintSecretAllowlist");
  const secretAllowlist = await VastMintSecretAllowlist.deploy();
  await secretAllowlist.waitForDeployment();

  const address = await secretAllowlist.getAddress();
  console.log("✅ VastMintSecretAllowlist deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});