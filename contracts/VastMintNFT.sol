// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VastMintNFT is ERC721URIStorage, Ownable {

    uint256 public nextTokenId;

    constructor() ERC721("VastMint NFT", "VMNFT") Ownable(msg.sender) {}

    function mintNFT(
        address to,
        string memory tokenURI
    ) public onlyOwner returns (uint256) {

        uint256 tokenId = nextTokenId;

        _safeMint(to, tokenId);

        _setTokenURI(tokenId, tokenURI);

        nextTokenId++;

        return tokenId;
    }
}