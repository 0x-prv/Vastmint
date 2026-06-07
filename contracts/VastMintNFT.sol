// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract VastMintNFT is ERC721, Ownable, ReentrancyGuard {

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum Phase { Paused, Whitelist, Public }

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 public nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public whitelistPrice;
    uint256 public maxPerWallet;
    Phase   public phase;
    bytes32 public whitelistRoot;

    string public baseURI;
    string public collectionDescription;
    string public collectionImage;
    address public factory;

    mapping(address => uint256) public mintCount;

    // ─── Events ──────────────────────────────────────────────────────────────
    event PhaseChanged(Phase newPhase);
    event WhitelistRootUpdated(bytes32 newRoot);
    event MintPricesUpdated(uint256 publicPrice, uint256 wlPrice);
    event MaxPerWalletUpdated(uint256 newMax);
    event BaseURIUpdated(string newBaseURI);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _image,
        string memory _baseURI,
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _whitelistPrice,
        uint256 _maxPerWallet,
        bytes32 _whitelistRoot,
        address _creator
    ) ERC721(_name, _symbol) Ownable(_creator) {
        baseURI           = _baseURI;
        maxSupply         = _maxSupply;
        mintPrice         = _mintPrice;
        whitelistPrice    = _whitelistPrice;
        maxPerWallet      = _maxPerWallet;
        whitelistRoot     = _whitelistRoot;
        collectionDescription = _description;
        collectionImage   = _image;
        factory           = msg.sender;
        phase             = Phase.Paused;
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

    // ─── tokenURI override ───────────────────────────────────────────────────
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < nextTokenId, "Token does not exist");
        return string(abi.encodePacked(baseURI, _toString(tokenId), ".json"));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // ─── Mint Functions ──────────────────────────────────────────────────────

    function mintNFT(
        address to
    ) public payable nonReentrant withinSupply withinWalletLimit(to) returns (uint256) {
        require(phase == Phase.Public, "Public mint not active");
        require(msg.value >= mintPrice, "Insufficient payment");
        return _mintToken(to);
    }

    function whitelistMint(
        address to,
        bytes32[] calldata proof
    ) public payable nonReentrant withinSupply withinWalletLimit(to) returns (uint256) {
        require(phase == Phase.Whitelist, "Whitelist mint not active");
        require(whitelistRoot != bytes32(0), "Whitelist not configured");
        require(msg.value >= whitelistPrice, "Insufficient payment");

        bytes32 leaf = keccak256(abi.encodePacked(to));
        require(MerkleProof.verify(proof, whitelistRoot, leaf), "Not whitelisted");

        return _mintToken(to);
    }

    function _mintToken(address to) internal returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        mintCount[to]++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    // ─── Owner Functions ─────────────────────────────────────────────────────

    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }

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
