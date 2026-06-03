/* eslint-disable @typescript-eslint/no-require-imports */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const VastMintMarketplace = await hre.ethers.getContractFactory(
    "VastMintMarketplace"
  );
  const marketplace = await VastMintMarketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();

  console.log(
    "VastMintMarketplace deployed to:",
    await marketplace.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
