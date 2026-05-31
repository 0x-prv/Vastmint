// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VastMintMarketplace is Ownable, ReentrancyGuard {

    uint256 public platformFeeBps = 200;
    uint256 public royaltyBps = 500;
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

    uint256 public nextListingId = 1; // ✅ starts at 1, avoids zero-value collision

    mapping(uint256 => Listing) public listings;
    mapping(address => mapping(uint256 => uint256)) public tokenToListingId;
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
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ✅ _creator removed — derived from NFT owner
    function listNFT(
        address _nftContract,
        uint256 _tokenId,
        uint256 _price
    ) external {
        require(_price > 0, "Price must be greater than 0");
        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_tokenId) == msg.sender, "Not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(_tokenId) == address(this),
            "Marketplace not approved"
        );

        // ✅ Cancel existing listing and clear stale mapping
        uint256 existingId = tokenToListingId[_nftContract][_tokenId];
        if (existingId != 0 && listings[existingId].active) {
            listings[existingId].active = false;
            emit Cancelled(existingId, msg.sender);
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

        // ✅ Derive creator from NFT owner at time of first listing
        if (contractCreator[_nftContract] == address(0)) {
            contractCreator[_nftContract] = msg.sender;
        }

        emit Listed(listingId, msg.sender, _nftContract, _tokenId, _price);
    }

    function buyNFT(uint256 _listingId) external payable nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");

        // ✅ Validate seller still owns the NFT
        require(
            IERC721(listing.nftContract).ownerOf(listing.tokenId) == listing.seller,
            "Seller no longer owns NFT"
        );

        listing.active = false;

        // ✅ Clear stale mapping on buy
        tokenToListingId[listing.nftContract][listing.tokenId] = 0;

        uint256 platformFee = (listing.price * platformFeeBps) / 10000;
        uint256 royalty = (listing.price * royaltyBps) / 10000;
        uint256 sellerAmount = listing.price - platformFee - royalty;

        // Transfer NFT first
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        // ✅ .call() instead of .transfer()
        (bool feeSent, ) = payable(treasury).call{value: platformFee}("");
        require(feeSent, "Platform fee transfer failed");

        address creator = contractCreator[listing.nftContract];
        if (creator != address(0) && royalty > 0) {
            (bool royaltySent, ) = payable(creator).call{value: royalty}("");
            if (!royaltySent) sellerAmount += royalty;
        } else {
            sellerAmount += royalty;
        }

        (bool sellerSent, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerSent, "Seller payment failed");

        // Refund excess
        if (msg.value > listing.price) {
            (bool refundSent, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            require(refundSent, "Refund failed");
        }

        emit Sold(_listingId, msg.sender, listing.nftContract, listing.tokenId, listing.price);
    }

    function cancelListing(uint256 _listingId) external {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender || msg.sender == owner(), "Not authorized");

        listing.active = false;

        // ✅ Clear stale mapping on cancel
        tokenToListingId[listing.nftContract][listing.tokenId] = 0;

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
            if (listings[i].active) active[index++] = listings[i];
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
            if (listings[i].active && listings[i].nftContract == _nftContract) result[index++] = listings[i];
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
            if (listings[i].active && listings[i].seller == _seller) result[index++] = listings[i];
        }
        return result;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
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