import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying AIMetadataOracle...");
  console.log("Deployer:", deployer.address);

  const AIMetadataOracle = await ethers.getContractFactory("AIMetadataOracle");
  const oracle = await AIMetadataOracle.deploy();
  await oracle.waitForDeployment();

  const address = await oracle.getAddress();
  console.log("✅ AIMetadataOracle deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});