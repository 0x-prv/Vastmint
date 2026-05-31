// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IOwnableNFT {
    function owner() external view returns (address);
}

contract VastMintMarketplace is Ownable, ReentrancyGuard {

    uint256 public platformFeeBps = 200; // 2% platform fee
    uint256 public royaltyBps = 500;     // 5% royalty to creator
    address public treasury;

    struct Listing {
        uint256 listingId;
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
        uint256 createdAt;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;
    mapping(address => mapping(uint256 => uint256)) public tokenToListingId;

    // creator royalty per NFT contract
    mapping(address => address) public contractCreator;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    event Sold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    event Cancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Treasury required");
        treasury = _treasury;
    }

    function listNFT(
        address _nftContract,
        uint256 _tokenId,
        uint256 _price
    ) external {
        require(_nftContract != address(0), "NFT contract required");
        require(_price > 0, "Price must be greater than 0");
        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_tokenId) == msg.sender, "Not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(_tokenId) == address(this),
            "Marketplace not approved"
        );

        // Cancel existing listing if any
        uint256 existingId = tokenToListingId[_nftContract][_tokenId];
        if (existingId != 0 && listings[existingId].active) {
            listings[existingId].active = false;
        }

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            nftContract: _nftContract,
            tokenId: _tokenId,
            price: _price,
            active: true,
            createdAt: block.timestamp
        });

        tokenToListingId[_nftContract][_tokenId] = listingId;

        if (contractCreator[_nftContract] == address(0)) {
            address creator = IOwnableNFT(_nftContract).owner();
            require(creator != address(0), "Creator required");
            contractCreator[_nftContract] = creator;
        }

        emit Listed(listingId, msg.sender, _nftContract, _tokenId, _price);
    }

    function buyNFT(uint256 _listingId) external payable nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");
        require(IERC721(listing.nftContract).ownerOf(listing.tokenId) == listing.seller, "Seller no longer owns NFT");

        listing.active = false;
        delete tokenToListingId[listing.nftContract][listing.tokenId];

        uint256 platformFee = (listing.price * platformFeeBps) / 10000;
        uint256 royalty = (listing.price * royaltyBps) / 10000;
        uint256 sellerAmount = listing.price - platformFee - royalty;

        // Transfer NFT before funds; nonReentrant and listing deactivation prevent reentry purchases.
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        _sendValue(treasury, platformFee);

        address creator = contractCreator[listing.nftContract];
        if (creator != address(0) && royalty > 0) {
            _sendValue(creator, royalty);
        } else {
            sellerAmount += royalty;
        }

        _sendValue(listing.seller, sellerAmount);

        if (msg.value > listing.price) {
            _sendValue(msg.sender, msg.value - listing.price);
        }

        emit Sold(_listingId, msg.sender, listing.nftContract, listing.tokenId, listing.price);
    }

    function cancelListing(uint256 _listingId) external {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender || msg.sender == owner(), "Not authorized");
        listing.active = false;
        delete tokenToListingId[listing.nftContract][listing.tokenId];
        emit Cancelled(_listingId, msg.sender);
    }

    function getActiveListings() external view returns (Listing[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].active) count++;
        }

        Listing[] memory active = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].active) {
                active[index++] = listings[i];
            }
        }
        return active;
    }

    function getListingsByContract(address _nftContract) external view returns (Listing[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].active && listings[i].nftContract == _nftContract) count++;
        }

        Listing[] memory result = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].active && listings[i].nftContract == _nftContract) {
                result[index++] = listings[i];
            }
        }
        return result;
    }

    function getListingsBySeller(address _seller) external view returns (Listing[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].active && listings[i].seller == _seller) count++;
        }

        Listing[] memory result = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].active && listings[i].seller == _seller) {
                result[index++] = listings[i];
            }
        }
        return result;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury required");
        treasury = _treasury;
    }

    function setPlatformFee(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        require(_bps + royaltyBps <= 10000, "Fees exceed price");
        platformFeeBps = _bps;
    }

    function setRoyalty(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        require(platformFeeBps + _bps <= 10000, "Fees exceed price");
        royaltyBps = _bps;
    }

    function _sendValue(address to, uint256 amount) private {
        if (amount == 0) return;
        require(to != address(0), "Payment recipient required");
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Payment failed");
    }
}
