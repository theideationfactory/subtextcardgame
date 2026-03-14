// Alchemy NFT Minter for Subtext Cards
require('dotenv').config();
const { Network, Alchemy } = require('alchemy-sdk');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Pinata API for IPFS storage
const PINATA_API_KEY = process.env.PINATA_API_KEY || "YOUR_PINATA_API_KEY";
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || "YOUR_PINATA_SECRET_KEY";

// Alchemy settings
const settings = {
  apiKey: process.env.ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY",
  network: Network.MATIC_MUMBAI, // Using Polygon Mumbai testnet for lower gas fees
};

// NFT Contract Address - replace with your deployed contract
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || "YOUR_CONTRACT_ADDRESS";

// ABI for ERC-721 mintNFT function
const CONTRACT_ABI = [
  "function mintNFT(address recipient, string memory tokenURI) public returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

// Initialize Alchemy SDK
const alchemy = new Alchemy(settings);

/**
 * Upload file to IPFS via Pinata
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - Name of the file
 * @returns {Promise<string>} - IPFS hash (CID)
 */
async function uploadFileToPinata(fileBuffer, fileName) {
  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, { filename: fileName });

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      maxContentLength: Infinity,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      }
    });

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error);
    throw error;
  }
}

/**
 * Upload metadata to IPFS via Pinata
 * @param {Object} metadata - The metadata object
 * @returns {Promise<string>} - IPFS hash (CID)
 */
async function uploadMetadataToPinata(metadata) {
  try {
    const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadata, {
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      }
    });

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading metadata to Pinata:', error);
    throw error;
  }
}

/**
 * Mint an NFT
 * @param {string} recipientAddress - Wallet address to receive the NFT
 * @param {string} tokenURI - IPFS URI for the NFT metadata
 * @returns {Promise<string>} - Transaction hash
 */
async function mintNFT(recipientAddress, tokenURI) {
  try {
    // Convert IPFS URI to HTTP gateway URL if needed
    const gatewayTokenURI = tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
    
    // Connect to wallet using private key
    const provider = new ethers.providers.AlchemyProvider(
      settings.network === Network.MATIC_MUMBAI ? 'maticmum' : 'matic',
      settings.apiKey
    );
    
    const privateKey = process.env.PRIVATE_KEY || "YOUR_PRIVATE_KEY";
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Connect to the NFT contract
    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    // Mint the NFT
    const transaction = await nftContract.mintNFT(recipientAddress, gatewayTokenURI);
    
    // Wait for transaction to be mined
    const receipt = await transaction.wait();
    
    console.log(`NFT minted successfully! Transaction hash: ${receipt.transactionHash}`);
    return receipt.transactionHash;
  } catch (error) {
    console.error('Error minting NFT:', error);
    throw error;
  }
}

/**
 * Create and mint NFTs for a Subtext card
 * @param {Object} cardData - The card data from Subtext
 * @param {string} imagePath - Path to the card image
 * @param {string} recipientAddress - Wallet address to receive the NFT
 */
async function mintSubtextCardNFTs(cardData, imagePath, recipientAddress) {
  try {
    // 1. Upload card image to IPFS
    const imageBuffer = fs.readFileSync(imagePath);
    const imageFileName = path.basename(imagePath);
    const imageIpfsUri = await uploadFileToPinata(imageBuffer, imageFileName);
    console.log(`Card image uploaded to IPFS: ${imageIpfsUri}`);
    
    // 2. Create and upload metadata for the image NFT
    const imageMetadata = {
      name: `${cardData.name} - Image`,
      description: `Image for Subtext card: ${cardData.name}`,
      image: imageIpfsUri,
      attributes: [
        { trait_type: "Card Type", value: cardData.type || "TBD" },
        { trait_type: "Art Style", value: cardData.artStyle || "Fantasy (MTG-inspired)" }
      ]
    };
    
    const imageMetadataUri = await uploadMetadataToPinata(imageMetadata);
    console.log(`Image metadata uploaded to IPFS: ${imageMetadataUri}`);
    
    // 3. Create and upload metadata for the card data NFT
    const cardMetadata = {
      name: cardData.name,
      description: cardData.description || `Subtext card: ${cardData.name}`,
      image: imageIpfsUri, // Using same image
      attributes: [
        { trait_type: "Card Type", value: cardData.type || "TBD" },
        { trait_type: "Card Role", value: cardData.role || "TBD" },
        { trait_type: "Context", value: cardData.context || "TBD" },
        { trait_type: "Art Style", value: cardData.artStyle || "Fantasy (MTG-inspired)" },
        // Add any other card attributes here
      ]
    };
    
    const cardMetadataUri = await uploadMetadataToPinata(cardMetadata);
    console.log(`Card metadata uploaded to IPFS: ${cardMetadataUri}`);
    
    // 4. Mint the image NFT
    console.log("Minting image NFT...");
    const imageNftTxHash = await mintNFT(recipientAddress, imageMetadataUri);
    
    // 5. Mint the card data NFT
    console.log("Minting card data NFT...");
    const cardNftTxHash = await mintNFT(recipientAddress, cardMetadataUri);
    
    return {
      imageNftTxHash,
      cardNftTxHash,
      imageIpfsUri,
      imageMetadataUri,
      cardMetadataUri
    };
  } catch (error) {
    console.error('Error minting Subtext card NFTs:', error);
    throw error;
  }
}

// Example usage
async function main() {
  // Example card data
  const exampleCard = {
    name: "Wisdom Seeker",
    description: "A card that encourages introspection and personal growth",
    type: "Impact",
    role: "Advisor",
    context: "Self",
    artStyle: "Fantasy (MTG-inspired)"
  };
  
  // Replace with actual values
  const imagePath = path.join(__dirname, 'example-card-image.jpg');
  const recipientAddress = process.env.RECIPIENT_ADDRESS || "YOUR_WALLET_ADDRESS";
  
  try {
    // Check if we have all required environment variables
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY || 
        !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY || 
        !process.env.NFT_CONTRACT_ADDRESS || !process.env.RECIPIENT_ADDRESS) {
      console.log("Please set all required environment variables in a .env file:");
      console.log("PINATA_API_KEY, PINATA_SECRET_KEY, ALCHEMY_API_KEY, PRIVATE_KEY, NFT_CONTRACT_ADDRESS, RECIPIENT_ADDRESS");
      return;
    }
    
    // Check if example image exists
    if (!fs.existsSync(imagePath)) {
      console.log(`Example image not found at ${imagePath}`);
      console.log("Please create an example image or update the imagePath in the script.");
      return;
    }
    
    console.log("Starting NFT minting process for Subtext card...");
    const result = await mintSubtextCardNFTs(exampleCard, imagePath, recipientAddress);
    
    console.log("\nNFT Minting Completed Successfully!");
    console.log("Image NFT Transaction:", result.imageNftTxHash);
    console.log("Card Data NFT Transaction:", result.cardNftTxHash);
    console.log("\nIPFS URIs:");
    console.log("Image:", result.imageIpfsUri);
    console.log("Image Metadata:", result.imageMetadataUri);
    console.log("Card Metadata:", result.cardMetadataUri);
  } catch (error) {
    console.error("Failed to mint NFTs:", error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  uploadFileToPinata,
  uploadMetadataToPinata,
  mintNFT,
  mintSubtextCardNFTs
};
