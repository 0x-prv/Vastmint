const hre = require("hardhat");

async function main() {
  const VastMintNFT = await hre.ethers.getContractFactory("VastMintNFT");

  const nft = await VastMintNFT.deploy();

  await nft.waitForDeployment();

  console.log("VastMintNFT deployed to:", await nft.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});