/* eslint-disable @typescript-eslint/no-require-imports */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const VastMintNFT = await hre.ethers.getContractFactory("VastMintNFT");
  const nft = await VastMintNFT.deploy(
    "Ritual Genesis Pass",
    "RGP",
    "The founding collection of VastMint — minted on Ritual testnet.",
    "ipfs://bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4",
    1000,
    0,
    deployer.address,
  );
  await nft.waitForDeployment();
  console.log("VastMintNFT deployed to:", await nft.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
