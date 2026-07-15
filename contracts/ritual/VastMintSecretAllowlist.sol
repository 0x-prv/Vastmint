// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISecretsAccessControl {
    struct SecretsAccessPolicy { string[] allowedDestinations; string[] allowedMethods; string[] allowedPaths; string[] allowedQueryParams; string[] allowedHeaders; string secretLocation; string bodyFormat; }
    function checkAccess(address owner, address delegate, bytes32 secretsHash) external view returns (bool hasAccess, SecretsAccessPolicy memory policy);
}

interface IOwnableCollection { function owner() external view returns (address); function factory() external view returns (address); }

contract VastMintSecretAllowlist {
    address public constant HTTP_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    ISecretsAccessControl public constant SECRETS_AC = ISecretsAccessControl(0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD);

    uint8 public constant HTTP_GET = 1;
    uint256 public constant DEFAULT_TTL_BLOCKS = 100;
    uint256 public constant DEFAULT_RESULT_VALIDITY = 1 days;
    string public constant EXPECTED_RESPONSE_TYPE = "abi(bool)";

    address public owner;
    mapping(address => bool) public authorizedFactories;
    mapping(address => bool) public authorizedAdmins;

    struct AllowlistConfig {
        bool configured;
        address secretOwner;
        bytes32 secretsHash;
        string allowlistCid;
        string endpointBase;
        bool active;
        uint64 validitySeconds;
        uint64 version;
        bytes[] encryptedSecrets;
        bytes[] secretSignatures;
    }

    struct VerificationResult { bool submitted; bool resolved; bool allowed; uint64 checkedAt; uint64 expiresAt; bytes32 requestHash; uint64 configVersion; }
    struct AllowlistStatus { bool configured; bool pending; bool resolved; bool allowed; uint64 checkedAt; uint64 expiresAt; bool currentlyValid; bytes32 requestHash; uint64 configVersion; }
    struct HTTPResponse { uint16 statusCode; string[] headerKeys; string[] headerValues; bytes body; string errorMessage; }

    mapping(address => AllowlistConfig) private _configs;
    mapping(address => mapping(address => VerificationResult)) private _results;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FactoryAuthorizationUpdated(address indexed factory, bool authorized);
    event AdminAuthorizationUpdated(address indexed admin, bool authorized);
    event AllowlistConfigured(address indexed collection, address indexed secretOwner, bytes32 indexed secretsHash, string allowlistCid, uint64 version, bool active);
    event AllowlistDeactivated(address indexed collection, uint64 version);
    event AllowlistConfigurationUpdated(address indexed collection, bytes32 indexed secretsHash, string allowlistCid, uint64 version, bool active);
    event AllowlistCheckSubmitted(bytes32 indexed requestHash, address indexed collection, address indexed wallet, uint64 configVersion, uint64 submittedAt);
    event AllowlistCheckResolved(bytes32 indexed requestHash, address indexed collection, address indexed wallet, bool allowed, uint16 httpStatus, uint64 checkedAt, uint64 expiresAt);
    event AllowlistCheckFailed(bytes32 indexed requestHash, address indexed collection, address indexed wallet, string reason, uint16 httpStatus);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address[] memory factories) { owner = msg.sender; emit OwnershipTransferred(address(0), msg.sender); for (uint256 i; i < factories.length; i++) { authorizedFactories[factories[i]] = true; emit FactoryAuthorizationUpdated(factories[i], true); } }

    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "Zero owner"); emit OwnershipTransferred(owner, newOwner); owner = newOwner; }
    function setAuthorizedFactory(address factory, bool authorized) external onlyOwner { authorizedFactories[factory] = authorized; emit FactoryAuthorizationUpdated(factory, authorized); }
    function setAuthorizedAdmin(address admin, bool authorized) external onlyOwner { authorizedAdmins[admin] = authorized; emit AdminAuthorizationUpdated(admin, authorized); }

    function collectionAllowlist(address collection) external view returns (AllowlistConfig memory) { return _configs[collection]; }

    function configureAllowlist(address collection, string calldata cid, bytes32 secretsHash, address secretOwner, string calldata endpointBase, bool active, uint64 validitySeconds, bytes[] calldata encryptedSecrets, bytes[] calldata secretSignatures) external {
        require(_isAuthorizedForCollection(collection, msg.sender), "Not collection authority");
        require(collection != address(0) && secretOwner != address(0), "Zero address");
        require(bytes(cid).length > 0 && bytes(endpointBase).length > 0, "Missing config");
        require(secretsHash != bytes32(0), "Missing secrets hash");
        require(encryptedSecrets.length == secretSignatures.length, "Secret signature mismatch");
        AllowlistConfig storage cfg = _configs[collection];
        cfg.configured = true; cfg.secretOwner = secretOwner; cfg.secretsHash = secretsHash; cfg.allowlistCid = cid; cfg.endpointBase = endpointBase; cfg.active = active; cfg.validitySeconds = validitySeconds == 0 ? uint64(DEFAULT_RESULT_VALIDITY) : validitySeconds; cfg.version += 1;
        delete cfg.encryptedSecrets; delete cfg.secretSignatures;
        for (uint256 i; i < encryptedSecrets.length; i++) { cfg.encryptedSecrets.push(encryptedSecrets[i]); cfg.secretSignatures.push(secretSignatures[i]); }
        if (cfg.version == 1) emit AllowlistConfigured(collection, secretOwner, secretsHash, cid, cfg.version, active); else emit AllowlistConfigurationUpdated(collection, secretsHash, cid, cfg.version, active);
        if (!active) emit AllowlistDeactivated(collection, cfg.version);
    }

    function setActive(address collection, bool active) external { require(_isAuthorizedForCollection(collection, msg.sender), "Not collection authority"); AllowlistConfig storage cfg = _configs[collection]; require(cfg.configured, "Allowlist not configured"); cfg.active = active; cfg.version += 1; emit AllowlistConfigurationUpdated(collection, cfg.secretsHash, cfg.allowlistCid, cfg.version, active); if (!active) emit AllowlistDeactivated(collection, cfg.version); }

    function requestVerification(address collection, address executor) external returns (bool allowed) {
        address wallet = msg.sender;
        AllowlistConfig storage cfg = _configs[collection];
        require(cfg.configured, "Allowlist not configured"); require(cfg.active, "Allowlist inactive"); require(executor != address(0), "Missing executor");
        (bool hasAccess,) = SECRETS_AC.checkAccess(cfg.secretOwner, address(this), cfg.secretsHash); require(hasAccess, "No secret access");
        VerificationResult storage prior = _results[collection][wallet];
        require(!prior.submitted || prior.resolved || prior.configVersion != cfg.version || prior.expiresAt < block.timestamp, "Verification pending");
        bytes32 requestHash = keccak256(abi.encode(block.chainid, address(this), collection, wallet, cfg.allowlistCid, cfg.secretsHash, cfg.version, block.number));
        prior.submitted = true; prior.resolved = false; prior.allowed = false; prior.checkedAt = 0; prior.expiresAt = 0; prior.requestHash = requestHash; prior.configVersion = cfg.version;
        emit AllowlistCheckSubmitted(requestHash, collection, wallet, cfg.version, uint64(block.timestamp));
        string[] memory hk = new string[](2); string[] memory hv = new string[](2); hk[0] = "Accept"; hv[0] = "application/octet-stream"; hk[1] = "Authorization"; hv[1] = "Bearer API_KEY";
        bytes memory encoded = abi.encode(executor, cfg.encryptedSecrets, DEFAULT_TTL_BLOCKS, cfg.secretSignatures, bytes(""), _url(cfg.endpointBase, cfg.allowlistCid, wallet, collection, requestHash), HTTP_GET, hk, hv, bytes(""), uint256(0), uint8(0), false);
        (bool ok, bytes memory rawOutput) = HTTP_PRECOMPILE.call(encoded);
        if (!ok) { emit AllowlistCheckFailed(requestHash, collection, wallet, "RITUAL_PRECOMPILE_ERROR", 0); return false; }
        return _resolve(collection, wallet, cfg.version, requestHash, rawOutput);
    }

    function getAllowlistStatus(address collection, address wallet) external view returns (AllowlistStatus memory s) { AllowlistConfig storage cfg = _configs[collection]; VerificationResult storage r = _results[collection][wallet]; bool valid = cfg.configured && cfg.active && r.resolved && r.allowed && r.configVersion == cfg.version && r.expiresAt >= block.timestamp; return AllowlistStatus(cfg.configured, r.submitted && !r.resolved && r.configVersion == cfg.version, r.resolved && r.configVersion == cfg.version, r.allowed, r.checkedAt, r.expiresAt, valid, r.requestHash, r.configVersion); }
    function isAllowlisted(address collection, address wallet) external view returns (bool resolved, bool allowed) { AllowlistStatus memory s = this.getAllowlistStatus(collection, wallet); return (s.resolved, s.currentlyValid); }
    function verifySecretAccess(address collection) public view returns (bool) { AllowlistConfig storage cfg = _configs[collection]; (bool hasAccess,) = SECRETS_AC.checkAccess(cfg.secretOwner, address(this), cfg.secretsHash); return hasAccess; }

    function _resolve(address collection, address wallet, uint64 version, bytes32 requestHash, bytes memory rawOutput) internal returns (bool) {
        bytes memory actualOutput;
        try this.decodeFulfilledReplay(rawOutput) returns (bytes memory out) { actualOutput = out; } catch { emit AllowlistCheckFailed(requestHash, collection, wallet, "MALFORMED_FULFILLED_REPLAY", 0); return false; }
        if (actualOutput.length == 0) { emit AllowlistCheckFailed(requestHash, collection, wallet, "EMPTY_HTTP_OUTPUT", 0); return false; }
        HTTPResponse memory resp;
        try this.decodeHTTPOutput(actualOutput) returns (HTTPResponse memory decoded) { resp = decoded; } catch { emit AllowlistCheckFailed(requestHash, collection, wallet, "MALFORMED_HTTP_OUTPUT", 0); return false; }
        if (bytes(resp.errorMessage).length > 0) { emit AllowlistCheckFailed(requestHash, collection, wallet, "EXECUTOR_ERROR", resp.statusCode); return false; }
        if (resp.statusCode < 200 || resp.statusCode > 299) { emit AllowlistCheckFailed(requestHash, collection, wallet, "HTTP_NON_2XX", resp.statusCode); return false; }
        bool allowed; try this.decodeBoolBody(resp.body) returns (bool v) { allowed = v; } catch { emit AllowlistCheckFailed(requestHash, collection, wallet, "MALFORMED_BOOL_BODY", resp.statusCode); return false; }
        VerificationResult storage r = _results[collection][wallet]; r.resolved = true; r.allowed = allowed; r.checkedAt = uint64(block.timestamp); r.expiresAt = uint64(block.timestamp + _configs[collection].validitySeconds); r.requestHash = requestHash; r.configVersion = version;
        emit AllowlistCheckResolved(requestHash, collection, wallet, allowed, resp.statusCode, r.checkedAt, r.expiresAt); return allowed;
    }
    function decodeFulfilledReplay(bytes calldata raw) external pure returns (bytes memory actualOutput) { (, actualOutput) = abi.decode(raw, (bytes, bytes)); }
    function decodeHTTPOutput(bytes calldata raw) external pure returns (HTTPResponse memory resp) { resp = abi.decode(raw, (HTTPResponse)); }
    function decodeBoolBody(bytes calldata raw) external pure returns (bool allowed) { allowed = abi.decode(raw, (bool)); }
    function _isAuthorizedForCollection(address collection, address caller) internal view returns (bool) { if (caller == owner || authorizedAdmins[caller]) return true; try IOwnableCollection(collection).owner() returns (address collectionOwner) { if (caller == collectionOwner) return true; } catch {} try IOwnableCollection(collection).factory() returns (address factory) { if (caller == factory && authorizedFactories[factory]) return true; } catch {} return false; }
    function _url(string memory base, string memory cid, address wallet, address collection, bytes32 requestHash) internal pure returns (string memory) { return string.concat(base, "?cid=", cid, "&wallet=", _addr(wallet), "&collection=", _addr(collection), "&requestId=", _hex32(requestHash)); }
    function _addr(address a) internal pure returns (string memory) { return _hex(abi.encodePacked(a)); }
    function _hex32(bytes32 v) internal pure returns (string memory) { return _hex(abi.encodePacked(v)); }
    function _hex(bytes memory data) internal pure returns (string memory) { bytes16 symbols = "0123456789abcdef"; bytes memory str = new bytes(2 + data.length * 2); str[0] = "0"; str[1] = "x"; for (uint256 i; i < data.length; i++) { str[2+i*2] = symbols[uint8(data[i] >> 4)]; str[3+i*2] = symbols[uint8(data[i] & 0x0f)]; } return string(str); }
}
