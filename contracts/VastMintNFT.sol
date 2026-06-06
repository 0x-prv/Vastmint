// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract VastMintNFT is ERC721URIStorage, Ownable, ReentrancyGuard {

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum Phase { Paused, Whitelist, Public }

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 public nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;          // Public mint price
    uint256 public whitelistPrice;     // WL mint price (can be lower or same)
    uint256 public maxPerWallet;       // 0 = unlimited
    Phase   public phase;              // Current mint phase
    bytes32 public whitelistRoot;      // Merkle root for WL verification

    string public collectionDescription;
    string public collectionImage;
    address public factory;

    // Track mints per wallet
    mapping(address => uint256) public mintCount;

    // ─── Events ──────────────────────────────────────────────────────────────
    event PhaseChanged(Phase newPhase);
    event WhitelistRootUpdated(bytes32 newRoot);
    event MintPricesUpdated(uint256 publicPrice, uint256 wlPrice);
    event MaxPerWalletUpdated(uint256 newMax);

    // ─── Constructor ─────────────────────────────────────────────────────────
   constructor(
    string memory _name,
    string memory _symbol,
    string memory _description,
    string memory _image,
   uint256 _maxSupply,
    uint256 _mintPrice,
    uint256 _whitelistPrice,
    uint256 _maxPerWallet,
    bytes32 _whitelistRoot,
    address _creator
    ) ERC721(_name, _symbol) Ownable(_creator) {
        maxSupply        = _maxSupply;
        mintPrice        = _mintPrice;
        whitelistPrice   = _whitelistPrice;
        maxPerWallet     = _maxPerWallet;
        whitelistRoot = _whitelistRoot;

        collectionDescription = _description;
        collectionImage  = _image;
        factory          = msg.sender;
        phase            = Phase.Paused; // Start paused — creator controls when to open
    }
    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier withinSupply() {
        require(nextTokenId < maxSupply, "Max supply reached");
        _;
    }

    modifier withinWalletLimit(address to) {
        if (maxPerWallet > 0) {
            require(mintCount[to] < maxPerWallet, "Wallet mint limit reached");
        }
        _;
    }

    // ─── Mint Functions ──────────────────────────────────────────────────────

    // Public mint — open to everyone during Public phase
    function mintNFT(
        address to,
        string memory tokenURI
    ) public payable nonReentrant withinSupply withinWalletLimit(to) returns (uint256) {
        require(phase == Phase.Public, "Public mint not active");
        require(msg.value >= mintPrice, "Insufficient payment");

        return _mintToken(to, tokenURI);
    }

    // Whitelist mint — requires valid Merkle proof
    function whitelistMint(
        address to,
        string memory tokenURI,
        bytes32[] calldata proof
    ) public payable nonReentrant withinSupply withinWalletLimit(to) returns (uint256) {
        require(phase == Phase.Whitelist, "Whitelist mint not active");
        require(whitelistRoot != bytes32(0), "Whitelist not configured");
        require(msg.value >= whitelistPrice, "Insufficient payment");

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(to));
        require(MerkleProof.verify(proof, whitelistRoot, leaf), "Not whitelisted");

        return _mintToken(to, tokenURI);
    }

    // Internal mint logic
    function _mintToken(
        address to,
        string memory tokenURI
    ) internal returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        mintCount[to]++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return tokenId;
    }

    // ─── Owner Functions ─────────────────────────────────────────────────────

    function setPhase(Phase _phase) external onlyOwner {
        phase = _phase;
        emit PhaseChanged(_phase);
    }

    function setWhitelistRoot(bytes32 _root) external onlyOwner {
        whitelistRoot = _root;
        emit WhitelistRootUpdated(_root);
    }

    function setMintPrices(uint256 _publicPrice, uint256 _wlPrice) external onlyOwner {
        mintPrice      = _publicPrice;
        whitelistPrice = _wlPrice;
        emit MintPricesUpdated(_publicPrice, _wlPrice);
    }

    function setMaxPerWallet(uint256 _max) external onlyOwner {
        maxPerWallet = _max;
        emit MaxPerWalletUpdated(_max);
    }

    function totalSupply() public view returns (uint256) {
        return nextTokenId;
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdraw failed");
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    function isWhitelisted(address wallet, bytes32[] calldata proof) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(wallet));
        return MerkleProof.verify(proof, whitelistRoot, leaf);
    }

    function getMintInfo() external view returns (
        Phase currentPhase,
        uint256 publicPrice,
        uint256 wlPrice,
        uint256 maxWallet,
        uint256 minted,
        uint256 supply
    ) {
        return (phase, mintPrice, whitelistPrice, maxPerWallet, nextTokenId, maxSupply);
    }
}
