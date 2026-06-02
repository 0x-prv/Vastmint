const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Marketplace = await hre.ethers.getContractFactory("VastMintMarketplace");
  const marketplace = await Marketplace.deploy(
    deployer.address  // treasury address — pwede mong palitan ng ibang address
  );

  await marketplace.waitForDeployment();
  console.log("VastMintMarketplace deployed to:", await marketplace.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});