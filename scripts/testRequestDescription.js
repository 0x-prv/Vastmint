import pkg from "hardhat";
const { ethers } = pkg;

// ---- EDIT THIS: same oracle address as before ----
const ORACLE_ADDRESS = "0x276c4Bf006c516C376Bf7eb1111d6B7F5776b99E";

// ---- EDIT THIS: a placeholder collection address + tokenId to test with ----
// (doesn't have to be a real deployed NFT yet, this just keys the storage mapping)
const TEST_COLLECTION = "0x925498132975b7D317a7c89530Db2aA6d5F37C27";
const TEST_TOKEN_ID = 1;

// ---- EDIT THIS: your test prompt ----
const TEST_PROMPT =
  "Write a 2-sentence lore description for NFT #1 of the 'VastMint Genesis Pass' collection. Tone: mysterious, on-chain native.";

async function main() {
  const oracle = await ethers.getContractAt("AIMetadataOracle", ORACLE_ADDRESS);

  console.log("Checking for a live LLM executor...");
  const [executor, publicKey] = await oracle.getLLMExecutor();
  console.log("Executor:", executor);
  console.log("Public key length:", publicKey.length, "bytes");

  console.log("\nRequesting AI description...");
  console.log("Prompt:", TEST_PROMPT);

  const tx = await oracle.requestDescription(TEST_COLLECTION, TEST_TOKEN_ID, TEST_PROMPT);
  console.log("Tx sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Tx confirmed in block:", receipt.blockNumber);

  // Read back the stored result
  const description = await oracle.getDescription(TEST_COLLECTION, TEST_TOKEN_ID);
  console.log("\n📝 Stored description:", description);

  // Also surface the DescriptionStored event for hasError visibility
  for (const log of receipt.logs) {
    try {
      const parsed = oracle.interface.parseLog(log);
      if (parsed?.name === "DescriptionStored") {
        console.log("hasError:", parsed.args.hasError);
      }
    } catch {
      // not this contract's event, skip
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});