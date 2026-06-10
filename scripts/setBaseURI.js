require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const nft = await ethers.getContractAt(
    "VastMintNFT",
    "0xd817a4C152BBC8cF6A59e31421ff5e8639e0647b",
    signer
  );
  const tx = await nft.setBaseURI(
    "ipfs://Qmeras7Gu2sgSaCGpgbbQLFc71fKJBvTNbn4yEk17swEUt/vastmint-genesis-pass/"
  );
  console.log("TX sent:", tx.hash);
  await tx.wait();
  console.log("✅ baseURI updated!");
}

main().catch(console.error);