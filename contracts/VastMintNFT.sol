// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VastMintNFT is ERC721URIStorage, Ownable {

    uint256 public nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;
    string public collectionDescription;
    string public collectionImage;
    address public factory;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _image,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address _creator
    ) ERC721(_name, _symbol) Ownable(_creator) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        collectionDescription = _description;
        collectionImage = _image;
        factory = msg.sender;
    }

    function mintNFT(
        address to,
        string memory tokenURI
    ) public payable returns (uint256) {
        require(nextTokenId < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        nextTokenId++;

        return tokenId;
    }

    function totalSupply() public view returns (uint256) {
        return nextTokenId;
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");
        payable(owner()).transfer(balance);
    }
}