require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Your wallet:", signer.address);

  const nft = await ethers.getContractAt(
    "VastMintNFT",
    "0xd817a4C152BBC8cF6A59e31421ff5e8639e0647b",
    signer
  );

  const owner = await nft.owner();
  console.log("Contract owner:", owner);
  console.log("Match:", signer.address.toLowerCase() === owner.toLowerCase());
}

main().catch(console.error);