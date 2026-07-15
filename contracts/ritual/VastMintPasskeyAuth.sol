// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VastMintPasskeyAuth
/// @notice Phase 1 — adds Passkey (SECP256R1/P-256) login and Ed25519 signature
///         verification on top of VastMint's existing wallet-based auth.
///         Ritual natively exposes:
///           - P256VERIFY precompile at 0x0100 (EIP-7212) for passkey/WebAuthn sigs
///           - Ed25519 precompile at 0x0009 for creator-signed metadata checks
contract VastMintPasskeyAuth {
    address constant P256_VERIFY = 0x0000000000000000000000000000000000000100;
    address constant ED25519_VERIFY = 0x0000000000000000000000000000000000000009;

    /// @dev Maps a deterministic passkey-derived address to whether it's registered.
    mapping(address => bool) public isPasskeyAccount;

    /// @dev Maps a collection (factory-deployed NFT contract) to the creator's
    ///      Ed25519 public key, so metadata signed off-chain can be verified on-chain.
    mapping(address => bytes32) public creatorEd25519PubKey;

    event PasskeyRegistered(address indexed account, bytes32 pubKeyX, bytes32 pubKeyY);
    event CreatorKeyRegistered(address indexed collection, bytes32 pubKey);

    /// @notice Derive the deterministic account address from a P-256 public key,
    ///         exactly like Ritual's native TxPasskey (0x77) does.
    function derivePasskeyAddress(bytes32 pubKeyX, bytes32 pubKeyY) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(pubKeyX, pubKeyY)))));
    }

    /// @notice Register a passkey account. Call this once per new passkey the
    ///         frontend generates via WebAuthn (navigator.credentials.create()).
    function registerPasskey(bytes32 pubKeyX, bytes32 pubKeyY) external {
        address account = derivePasskeyAddress(pubKeyX, pubKeyY);
        isPasskeyAccount[account] = true;
        emit PasskeyRegistered(account, pubKeyX, pubKeyY);
    }

    /// @notice Verify a P-256/WebAuthn signature via the P256VERIFY precompile.
    /// @param messageHash keccak256 hash of the signed payload (e.g. a mint-auth message)
    /// @param r, s        signature components
    /// @param pubKeyX, pubKeyY  the passkey's public key coordinates
    function verifyPasskeySignature(
        bytes32 messageHash,
        bytes32 r,
        bytes32 s,
        bytes32 pubKeyX,
        bytes32 pubKeyY
    ) public view returns (bool) {
        bytes memory input = abi.encodePacked(messageHash, r, s, pubKeyX, pubKeyY);
        (bool ok, bytes memory result) = P256_VERIFY.staticcall(input);
        require(ok, "P256VERIFY call failed");
        return result.length > 0 && result[result.length - 1] == 0x01;
    }

    /// @notice Register a collection creator's Ed25519 public key (done once,
    ///         e.g. at collection-creation time via VastMintFactory).
    function registerCreatorKey(address collection, bytes32 pubKey) external {
        creatorEd25519PubKey[collection] = pubKey;
        emit CreatorKeyRegistered(collection, pubKey);
    }

    /// @notice Verify that collection metadata (baseURI, royalty config, etc.)
    ///         was signed by the registered creator before VastMintFactory
    ///         finalizes a collection deployment.
    /// @param collection   the collection this metadata belongs to
    /// @param message      the metadata payload that was signed
    /// @param signature    64-byte Ed25519 signature
    function verifyCreatorMetadata(
        address collection,
        bytes memory message,
        bytes memory signature
    ) public view returns (bool) {
        bytes32 pubKey = creatorEd25519PubKey[collection];
        require(pubKey != bytes32(0), "no creator key registered");
        require(signature.length == 64, "signature must be 64 bytes");

        bytes memory input = abi.encodePacked(pubKey, signature, message);
        (bool ok, bytes memory result) = ED25519_VERIFY.staticcall(input);
        require(ok, "ED25519 call failed");
        return result.length > 0 && result[result.length - 1] == 0x01;
    }
}