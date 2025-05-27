// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title SubtextNFT
 * @dev ERC721 contract for Subtext card game NFTs
 */
contract SubtextNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    // Optional mapping for card names
    mapping(uint256 => string) private _cardNames;
    
    // Events
    event CardMinted(uint256 tokenId, address recipient, string tokenURI);
    
    constructor() ERC721("SubtextCard", "SBTX") Ownable(msg.sender) {}
    
    /**
     * @dev Mints a new Subtext card NFT
     * @param recipient The address that will own the minted NFT
     * @param tokenURI The token URI pointing to the card's metadata
     * @return The ID of the newly minted token
     */
    function mintNFT(address recipient, string memory tokenURI) public returns (uint256) {
        require(recipient != address(0), "Cannot mint to the zero address");
        
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        
        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);
        
        emit CardMinted(newItemId, recipient, tokenURI);
        
        return newItemId;
    }
    
    /**
     * @dev Sets the name for a card
     * @param tokenId The ID of the token
     * @param name The name to set
     */
    function setCardName(uint256 tokenId, string memory name) public {
        require(_ownerOf(tokenId) != address(0), "Card does not exist");
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        
        _cardNames[tokenId] = name;
    }
    
    /**
     * @dev Gets the name of a card
     * @param tokenId The ID of the token
     * @return The name of the card
     */
    function cardName(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Card does not exist");
        return _cardNames[tokenId];
    }
    
    /**
     * @dev Returns the total number of tokens minted
     * @return The total supply
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }
}
