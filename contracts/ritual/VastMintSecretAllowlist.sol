// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISecretsAccessControl {
    struct SecretsAccessPolicy {
        string[] allowedDestinations;
        string[] allowedMethods;
        string[] allowedPaths;
        string[] allowedQueryParams;
        string[] allowedHeaders;
        string secretLocation;
        string bodyFormat;
    }

    function grantAccess(address delegate, bytes32 secretsHash, uint256 expiresAt, SecretsAccessPolicy calldata policy) external;
    function revokeAccess(address delegate, bytes32 secretsHash) external;
    function checkAccess(address owner, address delegate, bytes32 secretsHash) external view returns (bool hasAccess, SecretsAccessPolicy memory policy);
}

contract VastMintSecretAllowlist {
    address public constant HTTP_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address public constant ASYNC_DELIVERY_SENDER = 0x5A16214fF555848411544b005f7Ac063742f39F6;

    ISecretsAccessControl public constant SECRETS_AC =
        ISecretsAccessControl(0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD);

    address public owner;

    struct AllowlistConfig {
        bool configured;
        address creator;
        bytes32 secretsHash; // hash of the ECIES-encrypted allowlist-service credential, registered via SecretsAccessControl
        bool active;
    }

    struct PendingCheck {
        address collection;
        address wallet;
        bool resolved;
    }

    mapping(address => AllowlistConfig) public collectionAllowlist;       // collection => config
    mapping(bytes32 => PendingCheck) public pendingChecks;                // jobId => pending check
    mapping(address => mapping(address => bool)) public allowlistResult;  // collection => wallet => allowed
    mapping(address => mapping(address => bool)) public allowlistResolved; // collection => wallet => has result

    event AllowlistConfigured(address indexed collection, address indexed creator, bytes32 secretsHash);
    event AllowlistCheckSubmitted(bytes32 indexed jobId, address indexed collection, address indexed wallet);
    event AllowlistCheckResolved(address indexed collection, address indexed wallet, bool allowed, uint16 httpStatus);
    event AllowlistCheckFailed(address indexed collection, address indexed wallet, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function configureAllowlist(address collection, bytes32 secretsHash) external {
        collectionAllowlist[collection] = AllowlistConfig({
            configured: true,
            creator: msg.sender,
            secretsHash: secretsHash,
            active: true
        });
        emit AllowlistConfigured(collection, msg.sender, secretsHash);
    }

    function verifySecretAccess(address collection) public view returns (bool) {
        AllowlistConfig memory cfg = collectionAllowlist[collection];
        (bool hasAccess, ) = SECRETS_AC.checkAccess(cfg.creator, address(this), cfg.secretsHash);
        return hasAccess;
    }

    /// @dev encodedRequest must be pre-built off-chain per the HTTP precompile's 13-field ABI:
    /// (executor, encryptedSecrets, ttl, secretSignatures, userPublicKey, url, method,
    ///  headersKeys, headersValues, body, dkmsKeyIndex, dkmsKeyFormat, piiEnabled)
    function submitAllowlistCheck(
        address collection,
        address wallet,
        bytes calldata encodedRequest
    ) external {
        AllowlistConfig memory cfg = collectionAllowlist[collection];
        require(cfg.configured, "Allowlist not configured");
        require(cfg.active, "Allowlist inactive");
        require(verifySecretAccess(collection), "No secret access");

        (bool success, bytes memory result) = HTTP_PRECOMPILE.call(encodedRequest);
        require(success, "Precompile call failed");

        bytes32 jobId = bytes32(result);
        pendingChecks[jobId] = PendingCheck({
            collection: collection,
            wallet: wallet,
            resolved: false
        });

        emit AllowlistCheckSubmitted(jobId, collection, wallet);
    }

    function handleCallback(bytes32 jobId, bytes calldata responseData) external {
        require(msg.sender == ASYNC_DELIVERY_SENDER, "Unauthorized callback");

        PendingCheck memory pending = pendingChecks[jobId];
        require(pending.collection != address(0), "Unknown job");
        require(!pending.resolved, "Already resolved");

        (uint16 status, , , bytes memory body, string memory errorMsg) =
            abi.decode(responseData, (uint16, string[], string[], bytes, string));

        pendingChecks[jobId].resolved = true;

        if (status != 200) {
            emit AllowlistCheckFailed(pending.collection, pending.wallet, errorMsg);
            return;
        }

        bool allowed = abi.decode(body, (bool));
        allowlistResult[pending.collection][pending.wallet] = allowed;
        allowlistResolved[pending.collection][pending.wallet] = true;

        emit AllowlistCheckResolved(pending.collection, pending.wallet, allowed, status);
    }

    function isAllowlisted(address collection, address wallet)
        external
        view
        returns (bool resolved, bool allowed)
    {
        return (allowlistResolved[collection][wallet], allowlistResult[collection][wallet]);
    }

    function setActive(address collection, bool _active) external {
        require(collectionAllowlist[collection].creator == msg.sender, "Not collection creator");
        collectionAllowlist[collection].active = _active;
    }
}