import pkg from "hardhat";
const { ethers } = pkg;

// ---- EDIT THIS: the address from your deploy output ----
const ORACLE_ADDRESS = " 0xd16C7e0c83e8b304976BBBb4b9ed6cC8c70d656F";

// ---- EDIT THIS: how much RITUAL to deposit for LLM call fees ----
const DEPOSIT_AMOUNT = "0.1"; // in RITUAL

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Funding AIMetadataOracle...");
  console.log("Caller:", deployer.address);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Amount:", DEPOSIT_AMOUNT, "RITUAL");

  const oracle = await ethers.getContractAt("AIMetadataOracle", ORACLE_ADDRESS);

  const tx = await oracle.depositForFees({
    value: ethers.parseEther(DEPOSIT_AMOUNT),
  });

  console.log("Tx sent:", tx.hash);
  await tx.wait();

  console.log("✅ Deposit confirmed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});