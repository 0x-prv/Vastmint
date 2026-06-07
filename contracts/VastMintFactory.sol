// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./VastMintNFT.sol";

contract VastMintFactory {

    struct CollectionInfo {
        address contractAddress;
        address creator;
        string name;
        string symbol;
        string description;
        string image;
        string baseURI;
        uint256 maxSupply;
        uint256 mintPrice;
        uint256 whitelistPrice;
        uint256 maxPerWallet;
        uint256 createdAt;
        string slug;
    }

    CollectionInfo[] public collections;
    mapping(address => CollectionInfo[]) public creatorCollections;
    mapping(string => address) public slugToAddress;

    event CollectionCreated(
        address indexed contractAddress,
        address indexed creator,
        string name,
        string slug,
        uint256 createdAt
    );

    function createCollection(
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
        string memory _slug
    ) external returns (address) {
        require(slugToAddress[_slug] == address(0), "Slug already taken");
        require(_maxSupply > 0, "Supply must be greater than 0");
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_symbol).length > 0, "Symbol required");
        require(bytes(_slug).length > 0, "Slug required");

        VastMintNFT newCollection = new VastMintNFT(
            _name,
            _symbol,
            _description,
            _image,
            _baseURI,
            _maxSupply,
            _mintPrice,
            _whitelistPrice,
            _maxPerWallet,
            _whitelistRoot,
            msg.sender
        );

        CollectionInfo memory info = CollectionInfo({
            contractAddress: address(newCollection),
            creator: msg.sender,
            name: _name,
            symbol: _symbol,
            description: _description,
            image: _image,
            baseURI: _baseURI,
            maxSupply: _maxSupply,
            mintPrice: _mintPrice,
            whitelistPrice: _whitelistPrice,
            maxPerWallet: _maxPerWallet,
            createdAt: block.timestamp,
            slug: _slug
        });

        collections.push(info);
        creatorCollections[msg.sender].push(info);
        slugToAddress[_slug] = address(newCollection);

        emit CollectionCreated(
            address(newCollection),
            msg.sender,
            _name,
            _slug,
            block.timestamp
        );

        return address(newCollection);
    }

    function getAllCollections() external view returns (CollectionInfo[] memory) {
        return collections;
    }

    function getCreatorCollections(address _creator) external view returns (CollectionInfo[] memory) {
        return creatorCollections[_creator];
    }

    function getCollectionBySlug(string memory _slug) external view returns (CollectionInfo memory) {
        address contractAddr = slugToAddress[_slug];
        require(contractAddr != address(0), "Collection not found");

        for (uint256 i = 0; i < collections.length; i++) {
            if (collections[i].contractAddress == contractAddr) {
                return collections[i];
            }
        }

        revert("Collection not found");
    }

    function totalCollections() external view returns (uint256) {
        return collections.length;
    }
}
