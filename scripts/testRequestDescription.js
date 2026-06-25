import pkg from "hardhat";
const { ethers } = pkg;
import { encodeAbiParameters, parseAbiParameters } from "viem";

const ORACLE_ADDRESS = "0xd16C7e0c83e8b304976BBBb4b9ed6cC8c70d656F";
const COLLECTION_ADDRESS = "0xA05AE385f77D58D08351b5f6F8397F1aC3d29b4B";
const TOKEN_ID = 1;
const TEE_REGISTRY = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Caller:", deployer.address);

  const teeAbi = ["function getServicesByCapability(uint8,bool) view returns (((address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node, bool isValid, bytes32 workloadId)[])"];
  const registry = new ethers.Contract(TEE_REGISTRY, teeAbi, deployer);
  const services = await registry.getServicesByCapability(1, true);
  const executor = services.find(s => s.isValid)?.node.teeAddress;
  if (!executor) throw new Error("No live LLM executor found");
  console.log("Executor:", executor);

  const messages = JSON.stringify([{
    role: "user",
    content: `Write a 2-sentence lore description for NFT #${TOKEN_ID} of the 'VastMint Genesis Pass' collection. Tone: mysterious, on-chain native.`
  }]);

  const llmPayload = encodeAbiParameters(
    parseAbiParameters(
      "address, bytes[], uint256, bytes[], bytes, string, string, int256, string, bool, int256, string, string, uint256, bool, int256, string, bytes, int256, string, string, bool, int256, bytes, bytes, int256, int256, string, bool, (string,string,string)"
    ),
    [
      executor,
      [],
      30n,
      [],
      "0x",
      messages,
      "zai-org/GLM-4.7-FP8",
      0n,
      "",
      false,
      -1n,
      "",
      "",
      1n,
      false,
      0n,
      "medium",
      "0x",
      -1n,
      "",
      "",
      false,
      700n,
      "0x",
      "0x",
      -1n,
      1000n,
      "",
      false,
      ["", "", ""],
    ]
  );

  console.log("Payload encoded, sending to Oracle...");

  const oracle = await ethers.getContractAt("AIMetadataOracle", ORACLE_ADDRESS);
  const tx = await oracle.requestDescription(
    COLLECTION_ADDRESS, TOKEN_ID, llmPayload,
    { gasLimit: 5000000n }
  );

console.log("Tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Block:", receipt.blockNumber);

  // Check DescriptionStored event
  const iface = new ethers.Interface([
    "event DescriptionStored(address indexed collection, uint256 indexed tokenId, bool hasError, string description)"
  ]);
  
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      console.log("hasError:", parsed.args.hasError);
      console.log("description:", parsed.args.description);
    } catch(e) {}
  }

  const description = await oracle.getDescription(COLLECTION_ADDRESS, TOKEN_ID);
  console.log("\n🤖 AI Description:", description);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});