import pkg from "hardhat";
const { ethers } = pkg;

const ORACLE_ADDRESS = "0xd16C7e0c83e8b304976BBBb4b9ed6cC8c70d656F";
const COLLECTION_ADDRESS = "0xd817a4c152bbc8cf6a59e31421ff5e8639e0647b";
const TOKEN_ID = 1;

async function main() {
  const [deployer] = await ethers.getSigners();
  const oracle = await ethers.getContractAt("AIMetadataOracle", ORACLE_ADDRESS);
  const description = await oracle.getDescription(COLLECTION_ADDRESS, TOKEN_ID);
  console.log("AI Description:", description);
}

main().catch(console.error);