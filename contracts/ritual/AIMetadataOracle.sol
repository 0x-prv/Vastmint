// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AIMetadataOracle
 * ------------------------------------------------------------------
 * Standalone contract — does NOT touch Factory.sol, VastMintNFT.sol,
 * or Marketplace.sol. You only need to make ONE call from your existing
 * mint flow into `requestDescription()` below (or call it off-chain
 * via your dApp frontend before mint, then store the result).
 *
 * What it does:
 *   - Calls the Ritual LLM precompile (0x0802) to AI-generate an NFT
 *     description/trait blurb at mint time, using the collection name
 *     + a user-supplied prompt/theme as input.
 *   - Stores the result on-chain, keyed by tokenId, so your tokenURI()
 *     logic (or frontend) can read it later.
 *
 * Chain: Ritual Network, Chain ID 1979 (same chain VastMint is already on)
 * ------------------------------------------------------------------
 */

interface ITEEServiceRegistry {
    struct TEEServiceNode {
        address paymentAddress;
        address teeAddress;
        uint8 teeType;
        bytes publicKey;
        string endpoint;
        bytes32 certPubKeyHash;
        uint8 capability;
    }

    struct TEEServiceContext {
        TEEServiceNode node;
        bool isValid;
        bytes32 workloadId;
    }

    function getServicesByCapability(uint8 capability, bool checkValidity)
        external
        view
        returns (TEEServiceContext[] memory);
}

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function balanceOf(address account) external view returns (uint256);
}

contract AIMetadataOracle {
    // ---- Ritual system contracts (fixed addresses, same on all Ritual dApps) ----
    address constant LLM_PRECOMPILE     = 0x0000000000000000000000000000000000000802;
    address constant RITUAL_WALLET      = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address constant TEE_SERVICE_REGISTRY = 0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F;
    uint8   constant CAPABILITY_LLM     = 1; // enum value for LLM in TEEServiceRegistry

    // Only confirmed live model as of this writing — do not change unless you've
    // verified a new model string against the live registry first.
    string constant MODEL = "zai-org/GLM-4.7-FP8";

    address public owner;

    // collectionAddress => tokenId => AI-generated description
    mapping(address => mapping(uint256 => string)) public tokenDescriptions;

    // Mirrors the (platform, path, keyRef) StorageRef tuple used by the
    // LLM precompile's convoHistory field. Needed as a named struct because
    // Solidity can't abi.decode directly into an inline tuple type.
    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    event DescriptionRequested(address indexed collection, uint256 indexed tokenId, address executor);
    event DescriptionStored(address indexed collection, uint256 indexed tokenId, bool hasError, string description);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ------------------------------------------------------------------
    // Step 1 — fund YOUR OWN wallet's RitualWallet balance (not the contract's).
    // Async precompiles (like LLM) check balanceOf(signer) — the EOA that
    // sends the transaction — not balanceOf(this contract). depositFor()
    // credits the caller's own EOA balance directly.
    // Each LLM call costs ~0.05 RITUAL (model-dependent). Call this once
    // with enough RITUAL to cover however many mints you expect to AI-describe.
    // ------------------------------------------------------------------
    function depositForFees() external payable {
        (bool ok, ) = RITUAL_WALLET.call{value: msg.value}(
            abi.encodeWithSignature("depositFor(address,uint256)", msg.sender, uint256(100000))
        );
        require(ok, "Deposit failed");
    }

    // ------------------------------------------------------------------
    // Step 2 — pick a live LLM executor from the TEE registry.
    // Do NOT hardcode an executor address — node operators rotate.
    // Call this off-chain (view call) from your frontend before minting,
    // or call it on-chain right before requestDescription().
    // ------------------------------------------------------------------
    function getLLMExecutor() public view returns (address executor, bytes memory publicKey) {
        ITEEServiceRegistry.TEEServiceContext[] memory services =
            ITEEServiceRegistry(TEE_SERVICE_REGISTRY).getServicesByCapability(CAPABILITY_LLM, true);

        require(services.length > 0, "No live LLM executors");

        // naive pick: first valid one. Fine for low-volume launches.
        // For high-volume, rotate / randomize across services.length.
        for (uint256 i = 0; i < services.length; i++) {
            if (services[i].isValid) {
                return (services[i].node.teeAddress, services[i].node.publicKey);
            }
        }
        revert("No valid LLM executor found");
    }

    // ------------------------------------------------------------------
    // Step 3 — request an AI-generated description for a given tokenId.
    // Call this from your VastMintNFT mint function (or right after mint),
    // passing the collection address + tokenId + a prompt built from your
    // collection name / theme / traits.
    //
    // Example prompt you'd build off-chain and pass in as `userPrompt`:
    //   "Write a 2-sentence lore description for NFT #42 of the
    //    'VastMint Genesis Pass' collection. Tone: mysterious, on-chain native."
    // ------------------------------------------------------------------
    function requestDescription(
        address collection,
        uint256 tokenId,
        string calldata userPrompt
    ) external returns (bool hasError, string memory description) {
        (address executor, ) = getLLMExecutor();

        string memory messagesJson = string(
            abi.encodePacked('[{"role":"user","content":"', _escapeJson(userPrompt), '"}]')
        );

        bytes memory input = abi.encode(
            executor,            // 0  executor
            new bytes[](0),      // 1  encryptedSecrets
            uint256(300),        // 2  ttl (blocks)
            new bytes[](0),      // 3  secretSignatures
            bytes(""),           // 4  userPublicKey
            messagesJson,        // 5  messagesJson
            MODEL,                // 6  model
            int256(0),            // 7  frequencyPenalty
            "",                   // 8  logitBiasJson
            false,                // 9  logprobs
            int256(4096),          // 10 maxCompletionTokens (GLM-4.7-FP8 needs >=4096: ~500-1500 tokens go to hidden <think> reasoning before the actual answer)
            "",                   // 11 metadataJson
            "",                   // 12 modalitiesJson
            uint256(1),           // 13 n
            true,                 // 14 parallelToolCalls (ABI placeholder)
            int256(0),            // 15 presencePenalty
            "medium",             // 16 reasoningEffort
            bytes(""),            // 17 responseFormatData
            int256(-1),           // 18 seed (null)
            "auto",               // 19 serviceTier
            "",                   // 20 stopJson
            false,                // 21 stream
            int256(700),          // 22 temperature (0.7 x1000)
            bytes(""),            // 23 toolChoiceData
            bytes(""),            // 24 toolsData
            int256(-1),           // 25 topLogprobs (null)
            int256(1000),         // 26 topP (1.0 x1000)
            "",                   // 27 user
            false,                // 28 piiEnabled
            StorageRef("", "", "") // 29 convoHistory — unused, single-turn (pass struct directly, NOT abi.encode'd)
        );

        emit DescriptionRequested(collection, tokenId, executor);

        (bool success, bytes memory result) = LLM_PRECOMPILE.call(input);
        require(success, "LLM precompile call failed");

        // Short-running async envelope: (simmedInput, actualOutput)
        (, bytes memory actualOutput) = abi.decode(result, (bytes, bytes));

        bytes memory completionData;
        bytes memory modelMeta;
        string memory errorMsg;
        StorageRef memory updatedConvoHistory;
        (hasError, completionData, modelMeta, errorMsg, updatedConvoHistory) = abi.decode(
            actualOutput,
            (bool, bytes, bytes, string, StorageRef)
        );

        if (hasError) {
            // Do NOT attempt to parse completionData on error — store nothing,
            // let the caller (frontend or mint function) retry or fall back
            // to a default description.
            emit DescriptionStored(collection, tokenId, true, errorMsg);
            return (true, errorMsg);
        }

        // completionData is ABI-encoded raw text from the model.
        description = abi.decode(completionData, (string));
        tokenDescriptions[collection][tokenId] = description;

        emit DescriptionStored(collection, tokenId, false, description);
        return (false, description);
    }

    // ------------------------------------------------------------------
    // Read helper — your tokenURI() in VastMintNFT.sol can call this
    // (via an external call or interface) to pull the AI description
    // when building metadata JSON.
    // ------------------------------------------------------------------
    function getDescription(address collection, uint256 tokenId)
        external
        view
        returns (string memory)
    {
        return tokenDescriptions[collection][tokenId];
    }

    // Minimal JSON string escaper for the prompt (handles quotes/newlines).
    // Keep prompts simple (no special chars) to avoid needing more than this.
    function _escapeJson(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        bytes memory out = new bytes(b.length * 2);
        uint256 j = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '"' || b[i] == "\\") {
                out[j++] = "\\";
            }
            out[j++] = b[i];
        }
        bytes memory trimmed = new bytes(j);
        for (uint256 k = 0; k < j; k++) {
            trimmed[k] = out[k];
        }
        return string(trimmed);
    }
}