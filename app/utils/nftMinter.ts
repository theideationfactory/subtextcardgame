// NFT Minting utilities for Subtext
import { Network, Alchemy } from 'alchemy-sdk';
import { ethers } from 'ethers';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

// Types for Subtext cards
interface SubtextCard {
  id: string;
  name: string;
  description?: string;
  type?: string; // Impact, Request, Protect, Connect, Percept, TBD
  role?: string; // Advisor, Confessor, Judge, Peacemaker, Provocateur, Entertainer, Gatekeeper, TBD
  context?: string; // Self, Family, Friendship, Therapy, Peer, Work, Art, Politics, TBD
  artStyle?: string; // Fantasy (MTG-inspired), Photorealistic, Anime, Digital Art
  imageUri?: string;
  // Add any other card properties here
}

// Configuration interface
interface NftMinterConfig {
  alchemyApiKey: string;
  pinataApiKey: string;
  pinataSecretKey: string;
  contractAddress: string;
  network: Network;
}

// Result of minting process
interface MintResult {
  success: boolean;
  imageNftTxHash?: string;
  cardNftTxHash?: string;
  imageIpfsUri?: string;
  imageMetadataUri?: string;
  cardMetadataUri?: string;
  error?: string;
}

// NFT Minter class for Subtext
export class SubtextNftMinter {
  private config: NftMinterConfig;
  private alchemy: Alchemy;
  
  constructor(config: NftMinterConfig) {
    this.config = config;
    this.alchemy = new Alchemy({
      apiKey: config.alchemyApiKey,
      network: config.network || Network.MATIC_MUMBAI, // Default to Polygon Mumbai testnet
    });
  }
  
  /**
   * Upload file to IPFS via Pinata
   * @param fileUri - Local URI of the file to upload
   * @param fileName - Name of the file
   * @returns IPFS URI (ipfs://...)
   */
  async uploadFileToPinata(fileUri: string, fileName: string): Promise<string> {
    try {
      // First, ensure we have a file that can be uploaded
      let uploadUri = fileUri;
      
      // For iOS, convert file:// paths to base64
      if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
        // Resize and compress the image to reduce size
        const manipResult = await ImageManipulator.manipulateAsync(
          fileUri,
          [{ resize: { width: 1000 } }], // Resize to reasonable dimensions
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadUri = manipResult.uri;
      }
      
      // Convert image to base64
      const base64 = await FileSystem.readAsStringAsync(uploadUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Create form data for Pinata
      const data = new FormData();
      data.append('file', {
        uri: uploadUri,
        name: fileName,
        type: 'image/jpeg', // Adjust based on your file type
      } as any);
      
      // Upload to Pinata
      const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
        maxBodyLength: Infinity,
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': this.config.pinataApiKey,
          'pinata_secret_api_key': this.config.pinataSecretKey,
        },
      });
      
      return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
      console.error('Error uploading file to Pinata:', error);
      throw error;
    }
  }
  
  /**
   * Upload metadata to IPFS via Pinata
   * @param metadata - The metadata object
   * @returns IPFS URI (ipfs://...)
   */
  async uploadMetadataToPinata(metadata: any): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        metadata,
        {
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': this.config.pinataApiKey,
            'pinata_secret_api_key': this.config.pinataSecretKey,
          },
        }
      );
      
      return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
      console.error('Error uploading metadata to Pinata:', error);
      throw error;
    }
  }
  
  /**
   * Mint an NFT
   * @param wallet - Ethers.js wallet instance
   * @param recipientAddress - Wallet address to receive the NFT
   * @param tokenURI - IPFS URI for the NFT metadata
   * @returns Transaction hash
   */
  async mintNFT(
    wallet: ethers.Wallet,
    recipientAddress: string,
    tokenURI: string
  ): Promise<string> {
    try {
      // Convert IPFS URI to HTTP gateway URL if needed
      const gatewayTokenURI = tokenURI.replace(
        'ipfs://',
        'https://gateway.pinata.cloud/ipfs/'
      );
      
      // ABI for ERC-721 mintNFT function
      const CONTRACT_ABI = [
        "function mintNFT(address recipient, string memory tokenURI) public returns (uint256)",
      ];
      
      // Connect to the NFT contract
      const nftContract = new ethers.Contract(
        this.config.contractAddress,
        CONTRACT_ABI,
        wallet
      );
      
      // Mint the NFT
      const transaction = await nftContract.mintNFT(recipientAddress, gatewayTokenURI);
      
      // Wait for transaction to be mined
      const receipt = await transaction.wait();
      
      return receipt.transactionHash;
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw error;
    }
  }
  
  /**
   * Create and mint NFTs for a Subtext card
   * @param card - The Subtext card data
   * @param wallet - Ethers.js wallet instance
   * @param recipientAddress - Wallet address to receive the NFT
   * @returns Result of the minting process
   */
  async mintSubtextCardNFTs(
    card: SubtextCard,
    wallet: ethers.Wallet,
    recipientAddress: string
  ): Promise<MintResult> {
    try {
      if (!card.imageUri) {
        throw new Error('Card image URI is required');
      }
      
      // 1. Upload card image to IPFS
      const imageFileName = `${card.id}-image.jpg`;
      const imageIpfsUri = await this.uploadFileToPinata(card.imageUri, imageFileName);
      console.log(`Card image uploaded to IPFS: ${imageIpfsUri}`);
      
      // 2. Create and upload metadata for the image NFT
      const imageMetadata = {
        name: `${card.name} - Image`,
        description: `Image for Subtext card: ${card.name}`,
        image: imageIpfsUri,
        attributes: [
          { trait_type: "Card Type", value: card.type || "TBD" },
          { trait_type: "Art Style", value: card.artStyle || "Fantasy (MTG-inspired)" }
        ]
      };
      
      const imageMetadataUri = await this.uploadMetadataToPinata(imageMetadata);
      console.log(`Image metadata uploaded to IPFS: ${imageMetadataUri}`);
      
      // 3. Create and upload metadata for the card data NFT
      const cardMetadata = {
        name: card.name,
        description: card.description || `Subtext card: ${card.name}`,
        image: imageIpfsUri, // Using same image
        attributes: [
          { trait_type: "Card Type", value: card.type || "TBD" },
          { trait_type: "Card Role", value: card.role || "TBD" },
          { trait_type: "Context", value: card.context || "TBD" },
          { trait_type: "Art Style", value: card.artStyle || "Fantasy (MTG-inspired)" },
          // Add any other card attributes here
        ]
      };
      
      const cardMetadataUri = await this.uploadMetadataToPinata(cardMetadata);
      console.log(`Card metadata uploaded to IPFS: ${cardMetadataUri}`);
      
      // 4. Mint the image NFT
      console.log("Minting image NFT...");
      const imageNftTxHash = await this.mintNFT(wallet, recipientAddress, imageMetadataUri);
      
      // 5. Mint the card data NFT
      console.log("Minting card data NFT...");
      const cardNftTxHash = await this.mintNFT(wallet, recipientAddress, cardMetadataUri);
      
      return {
        success: true,
        imageNftTxHash,
        cardNftTxHash,
        imageIpfsUri,
        imageMetadataUri,
        cardMetadataUri
      };
    } catch (error) {
      console.error('Error minting Subtext card NFTs:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Connect to a wallet using a private key
   * @param privateKey - The private key for the wallet
   * @returns Ethers.js wallet instance
   */
  connectWallet(privateKey: string): ethers.Wallet {
    // Create provider based on network
    const networkName = this.config.network === Network.MATIC_MUMBAI 
      ? 'maticmum' 
      : 'matic';
    
    const provider = new ethers.providers.AlchemyProvider(
      networkName,
      this.config.alchemyApiKey
    );
    
    // Create and return wallet
    return new ethers.Wallet(privateKey, provider);
  }
}

// Example of how to use this in your Subtext app:
/*
import { SubtextNftMinter } from './utils/nftMinter';
import { Network } from 'alchemy-sdk';

// Initialize the minter
const nftMinter = new SubtextNftMinter({
  alchemyApiKey: 'YOUR_ALCHEMY_API_KEY',
  pinataApiKey: 'YOUR_PINATA_API_KEY',
  pinataSecretKey: 'YOUR_PINATA_SECRET_KEY',
  contractAddress: 'YOUR_NFT_CONTRACT_ADDRESS',
  network: Network.MATIC_MUMBAI, // or Network.MATIC_MAINNET for production
});

// In your component where minting happens:
const mintCardAsNFT = async (card, privateKey, walletAddress) => {
  try {
    // Connect wallet
    const wallet = nftMinter.connectWallet(privateKey);
    
    // Mint NFTs
    const result = await nftMinter.mintSubtextCardNFTs(card, wallet, walletAddress);
    
    if (result.success) {
      // Show success message
      Alert.alert(
        'Success!',
        'Your card has been minted as NFTs. You can view them in your wallet.'
      );
    } else {
      // Show error message
      Alert.alert('Error', result.error || 'Failed to mint NFTs');
    }
  } catch (error) {
    console.error('Error in mintCardAsNFT:', error);
    Alert.alert('Error', 'Failed to mint NFTs: ' + error.message);
  }
};
*/
