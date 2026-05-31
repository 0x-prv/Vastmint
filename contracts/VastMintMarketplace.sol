// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    uint256 public nextListingId;
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
        treasury = _treasury;
    }

    function listNFT(
        address _nftContract,
        uint256 _tokenId,
        uint256 _price,
        address _creator
    ) external {
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
            contractCreator[_nftContract] = _creator;
        }

        emit Listed(listingId, msg.sender, _nftContract, _tokenId, _price);
    }

    function buyNFT(uint256 _listingId) external payable nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");

        listing.active = false;

        uint256 platformFee = (listing.price * platformFeeBps) / 10000;
        uint256 royalty = (listing.price * royaltyBps) / 10000;
        uint256 sellerAmount = listing.price - platformFee - royalty;

        // Transfer NFT
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        // Pay platform fee
        payable(treasury).transfer(platformFee);

        // Pay royalty to creator
        address creator = contractCreator[listing.nftContract];
        if (creator != address(0) && royalty > 0) {
            payable(creator).transfer(royalty);
        } else {
            sellerAmount += royalty;
        }

        // Pay seller
        payable(listing.seller).transfer(sellerAmount);

        // Refund excess
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit Sold(_listingId, msg.sender, listing.nftContract, listing.tokenId, listing.price);
    }

    function cancelListing(uint256 _listingId) external {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender || msg.sender == owner(), "Not authorized");
        listing.active = false;
        emit Cancelled(_listingId, msg.sender);
    }

    function getActiveListings() external view returns (Listing[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active) count++;
        }

        Listing[] memory active = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active) {
                active[index++] = listings[i];
            }
        }
        return active;
    }

    function getListingsByContract(address _nftContract) external view returns (Listing[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active && listings[i].nftContract == _nftContract) count++;
        }

        Listing[] memory result = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active && listings[i].nftContract == _nftContract) {
                result[index++] = listings[i];
            }
        }
        return result;
    }

    function getListingsBySeller(address _seller) external view returns (Listing[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active && listings[i].seller == _seller) count++;
        }

        Listing[] memory result = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active && listings[i].seller == _seller) {
                result[index++] = listings[i];
            }
        }
        return result;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setPlatformFee(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        platformFeeBps = _bps;
    }

    function setRoyalty(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        royaltyBps = _bps;
    }
}