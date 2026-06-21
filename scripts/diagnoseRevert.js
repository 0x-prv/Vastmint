import pkg from "hardhat";
const { ethers } = pkg;

// ---- same as your current testRequestDescription.js ----
const ORACLE_ADDRESS = "0x276c4Bf006c516C376Bf7eb1111d6B7F5776b99E";
const TEST_COLLECTION = "0x925498132975b7D317a7c89530Db2aA6d5F37C27";
const TEST_TOKEN_ID = 1;
const TEST_PROMPT =
  "Write a 2-sentence lore description for NFT #1 of the 'VastMint Genesis Pass' collection. Tone: mysterious, on-chain native.";

async function main() {
  const oracle = await ethers.getContractAt("AIMetadataOracle", ORACLE_ADDRESS);
  const [signer] = await ethers.getSigners();

  console.log("Signer:", signer.address);

  // Check RitualWallet balance for the signer directly
  const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";
  const walletAbi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function lockUntil(address account) external view returns (uint256)",
  ];
  const wallet = new ethers.Contract(RITUAL_WALLET, walletAbi, ethers.provider);

  const balance = await wallet.balanceOf(signer.address);
  const lockUntil = await wallet.lockUntil(signer.address);
  const currentBlock = await ethers.provider.getBlockNumber();

  console.log("RitualWallet balance for signer:", ethers.formatEther(balance), "RITUAL");
  console.log("Lock expires at block:", lockUntil.toString());
  console.log("Current block:", currentBlock);

  // Now try a staticCall to get the real revert reason without spending gas
  console.log("\nAttempting staticCall to surface revert reason...");
  try {
    const result = await oracle.requestDescription.staticCall(
      TEST_COLLECTION,
      TEST_TOKEN_ID,
      TEST_PROMPT
    );
    console.log("staticCall succeeded:", result);
  } catch (err) {
    console.log("\n--- REVERT DETAILS (ethers high-level) ---");
    console.log("reason:", err.reason);
    console.log("shortMessage:", err.shortMessage);
    console.log("data:", err.data);
    console.log("message:", err.message);
    console.log("full error:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  // Raw fallback: build the calldata manually and use eth_call directly
  console.log("\n--- Attempting raw provider.call fallback ---");
  try {
    const txData = oracle.interface.encodeFunctionData("requestDescription", [
      TEST_COLLECTION,
      TEST_TOKEN_ID,
      TEST_PROMPT,
    ]);
    const rawResult = await ethers.provider.call({
      to: ORACLE_ADDRESS,
      from: signer.address,
      data: txData,
      gasLimit: 3_000_000n,
    });
    console.log("Raw call succeeded:", rawResult);
  } catch (rawErr) {
    console.log("Raw call error message:", rawErr.message);
    console.log("Raw call error data:", rawErr.data ?? rawErr.info?.error?.data);
    // Try to decode the revert reason from the raw data if present
    const data = rawErr.data ?? rawErr.info?.error?.data;
    if (data && typeof data === "string" && data.startsWith("0x08c379a0")) {
      try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["string"],
          "0x" + data.slice(10)
        );
        console.log("Decoded revert string:", decoded[0]);
      } catch (decodeErr) {
        console.log("Could not decode revert string:", decodeErr.message);
      }
    }
  }

  // ---- Real attempt: send actual tx with EXPLICIT gas limit, skipping estimateGas ----
  // The Ritual skill docs note 3,000,000 gas is standard for LLM precompile calls.
  // Hardhat's automatic eth_estimateGas can fail/revert on async precompiles because
  // simulation doesn't reflect the deferred fulfilled-replay execution model.
  console.log("\n--- Attempting real tx with explicit gasLimit (skipping estimateGas) ---");
  try {
    const tx = await oracle.requestDescription(TEST_COLLECTION, TEST_TOKEN_ID, TEST_PROMPT, {
      gasLimit: 3_000_000n,
    });
    console.log("Tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Tx confirmed in block:", receipt.blockNumber);

    const description = await oracle.getDescription(TEST_COLLECTION, TEST_TOKEN_ID);
    console.log("📝 Stored description:", description);
  } catch (txErr) {
    console.log("Real tx error message:", txErr.message);
    console.log("Real tx error data:", txErr.data ?? txErr.info?.error?.data);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});