// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AIMetadataOracle {
    address constant LLM_PRECOMPILE = 0x0000000000000000000000000000000000000802;

    address public owner;

    mapping(address => mapping(uint256 => string)) public tokenDescriptions;

    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    event DescriptionRequested(address indexed collection, uint256 indexed tokenId);
    event DescriptionStored(address indexed collection, uint256 indexed tokenId, bool hasError, string description);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function requestDescription(
        address collection,
        uint256 tokenId,
        bytes calldata llmPayload
    ) external returns (bool hasError, string memory description) {
        emit DescriptionRequested(collection, tokenId);

        (bool success, bytes memory result) = LLM_PRECOMPILE.call(llmPayload);
        require(success, "LLM precompile call failed");

        (, bytes memory actualOutput) = abi.decode(result, (bytes, bytes));

        bytes memory completionData;
        string memory errorMsg;
        StorageRef memory _convo;

        (hasError, completionData, , errorMsg, _convo) = abi.decode(
            actualOutput,
            (bool, bytes, bytes, string, StorageRef)
        );

        if (hasError) {
            emit DescriptionStored(collection, tokenId, true, errorMsg);
            return (true, errorMsg);
        }

        description = abi.decode(completionData, (string));
        tokenDescriptions[collection][tokenId] = description;

        emit DescriptionStored(collection, tokenId, false, description);
        return (false, description);
    }

    function getDescription(address collection, uint256 tokenId)
        external
        view
        returns (string memory)
    {
        return tokenDescriptions[collection][tokenId];
    }
}