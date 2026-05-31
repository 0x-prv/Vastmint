const hre = require("hardhat");

async function main() {
  const VastMintFactory = await hre.ethers.getContractFactory("VastMintFactory");

  const factory = await VastMintFactory.deploy();

  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();

  console.log("=================================");
  console.log("VastMintFactory deployed to:");
  console.log(factoryAddress);
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});