import pkg from "hardhat";
const { ethers } = pkg;

const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";
const DEPOSIT_AMOUNT = "0.5"; // enough para sa multiple LLM calls

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Depositing RITUAL for EOA:", deployer.address);

  // Check current balance first
  const ritualWallet = new ethers.Contract(
    RITUAL_WALLET,
    ["function balanceOf(address) view returns (uint256)",
     "function deposit(uint256) payable"],
    deployer
  );

  const before = await ritualWallet.balanceOf(deployer.address);
  console.log("Balance before:", ethers.formatEther(before), "RITUAL");

  // Deposit directly from EOA
  const tx = await ritualWallet.deposit(100000, {
    value: ethers.parseEther(DEPOSIT_AMOUNT),
  });
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  const after = await ritualWallet.balanceOf(deployer.address);
  console.log("Balance after:", ethers.formatEther(after), "RITUAL");
  console.log("✅ EOA funded!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});