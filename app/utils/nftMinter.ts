// NFT Minting utilities for Subtext
import { Network, Alchemy } from 'alchemy-sdk';
import { ethers } from 'ethers';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import SubtextNFTABI from '@/app/services/abi/SubtextNFT.json';

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
  imageTokenId?: number;
  cardTokenId?: number;
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
   * @param fileUri - Local URI or Supabase URL of the file to upload
   * @param fileName - Name of the file
   * @returns IPFS URI (ipfs://...)
   */
  async uploadFileToPinata(fileUri: string, fileName: string): Promise<string> {
    try {
      console.log('📤 Uploading to IPFS...');
      console.log('  File URI:', fileUri);
      
      let uploadUri = fileUri;
      
      // If it's a Supabase storage URL, download it first
      if (fileUri.includes('/storage/v1/object/public/') || fileUri.startsWith('http')) {
        console.log('📥 Downloading from Supabase storage...');
        
        // Convert Supabase path to full URL if needed
        let downloadUrl = fileUri;
        if (fileUri.startsWith('/storage/')) {
          // Get Supabase URL from environment
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
          }
          downloadUrl = `${supabaseUrl}${fileUri}`;
        }
        
        console.log('  Download URL:', downloadUrl);
        
        // Download to temporary local file
        const tempPath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.downloadAsync(downloadUrl, tempPath);
        uploadUri = tempPath;
        console.log('  Downloaded to:', uploadUri);
      }
      
      // Resize and compress the image to reduce size
      console.log('🖼️ Processing image...');
      const manipResult = await ImageManipulator.manipulateAsync(
        uploadUri,
        [{ resize: { width: 1000 } }], // Resize to reasonable dimensions
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      uploadUri = manipResult.uri;
      
      console.log('  Processed image:', uploadUri);
      
      // Convert image to base64
      const base64 = await FileSystem.readAsStringAsync(uploadUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('  Base64 size:', Math.round(base64.length / 1024), 'KB');
      
      // Create form data for Pinata
      const data = new FormData();
      data.append('file', {
        uri: uploadUri,
        name: fileName,
        type: 'image/jpeg',
      } as any);
      
      // Upload to Pinata
      console.log('☁️ Uploading to Pinata...');
      const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
        maxBodyLength: Infinity,
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': this.config.pinataApiKey,
          'pinata_secret_api_key': this.config.pinataSecretKey,
        },
      });
      
      const ipfsUri = `ipfs://${response.data.IpfsHash}`;
      console.log('✅ Uploaded to IPFS:', ipfsUri);
      
      return ipfsUri;
    } catch (error) {
      console.error('❌ Error uploading file to Pinata:', error);
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
   * @param signer - Ethers.js signer instance (from wallet or WalletConnect)
   * @param recipientAddress - Wallet address to receive the NFT
   * @param tokenURI - IPFS URI for the NFT metadata
   * @returns Transaction hash and token ID
   */
  async mintNFT(
    signer: ethers.Signer,
    recipientAddress: string,
    tokenURI: string
  ): Promise<{ txHash: string; tokenId?: number }> {
    try {
      console.log('🎨 Minting NFT...');
      console.log('  Recipient:', recipientAddress);
      console.log('  Token URI:', tokenURI);
      
      // Convert IPFS URI to HTTP gateway URL if needed
      const gatewayTokenURI = tokenURI.replace(
        'ipfs://',
        'https://gateway.pinata.cloud/ipfs/'
      );
      
      // Connect to the NFT contract using the imported ABI
      const nftContract = new ethers.Contract(
        this.config.contractAddress,
        SubtextNFTABI,
        signer
      );
      
      console.log('📝 Sending transaction to contract:', this.config.contractAddress);
      
      // Get current gas price from network and add 20% buffer for faster confirmation
      const provider = signer.provider;
      if (!provider) {
        throw new Error('Provider not available');
      }
      const currentGasPrice = await provider.getGasPrice();
      const gasPrice = currentGasPrice.mul(120).div(100); // 20% higher than current
      
      console.log('⛽ Gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'Gwei');
      
      // Get correct nonce directly from blockchain
      const currentNonce = await signer.getTransactionCount('pending');
      console.log('🔢 Current nonce from blockchain:', currentNonce);
      
      // Estimate gas and add 20% buffer
      const estimatedGas = await nftContract.estimateGas.mintNFT(recipientAddress, gatewayTokenURI);
      const gasLimit = estimatedGas.mul(120).div(100); // 20% buffer
      
      console.log('⛽ Estimated gas:', estimatedGas.toString());
      console.log('⛽ Gas limit:', gasLimit.toString());
      
      // Mint the NFT - the contract returns the token ID
      // Explicitly set nonce to ensure no gaps
      const transaction = await nftContract.mintNFT(recipientAddress, gatewayTokenURI, {
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        nonce: currentNonce
      });
      
      console.log('⏳ Transaction sent, waiting for confirmation...');
      console.log('  TX Hash:', transaction.hash);
      console.log('  Nonce:', transaction.nonce);
      console.log('  From:', transaction.from);
      console.log('  To:', transaction.to);
      
      // Verify transaction was broadcast by checking if it exists on the network
      try {
        const provider = signer.provider;
        if (provider) {
          const txCheck = await provider.getTransaction(transaction.hash);
          if (txCheck) {
            console.log('✅ Transaction found on network');
          } else {
            console.log('⚠️ Transaction NOT found on network - may not have been broadcast');
          }
        }
      } catch (checkError) {
        console.log('⚠️ Could not verify transaction on network:', checkError);
      }
      
      // Wait for transaction to be mined with timeout
      console.log('⏰ Waiting for confirmation (max 5 minutes)...');
      const receipt = await Promise.race([
        transaction.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout after 5 minutes')), 300000)
        )
      ]) as any;
      
      console.log('✅ NFT minted successfully!');
      console.log('  Block:', receipt.blockNumber);
      console.log('  Gas used:', receipt.gasUsed.toString());
      
      // Extract token ID from the CardMinted event
      let tokenId: number | undefined;
      if (receipt.events && receipt.events.length > 0) {
        const mintEvent = receipt.events.find((e: any) => e.event === 'CardMinted');
        if (mintEvent && mintEvent.args) {
          tokenId = mintEvent.args.tokenId.toNumber();
          console.log('  Token ID:', tokenId);
        }
      }
      
      return { txHash: receipt.transactionHash, tokenId };
    } catch (error) {
      console.error('❌ Error minting NFT:', error);
      throw error;
    }
  }
  
  /**
   * Create and mint NFTs for a Subtext card
   * @param card - The Subtext card data
   * @param signer - Ethers.js signer instance (from wallet or WalletConnect)
   * @param recipientAddress - Wallet address to receive the NFT
   * @returns Result of the minting process
   */
  async mintSubtextCardNFTs(
    card: SubtextCard,
    signer: ethers.Signer,
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
      console.log("🖼️ Minting image NFT...");
      const imageResult = await this.mintNFT(signer, recipientAddress, imageMetadataUri);
      
      // 5. Mint the card data NFT
      console.log("🎴 Minting card data NFT...");
      const cardResult = await this.mintNFT(signer, recipientAddress, cardMetadataUri);
      
      return {
        success: true,
        imageNftTxHash: imageResult.txHash,
        cardNftTxHash: cardResult.txHash,
        imageTokenId: imageResult.tokenId,
        cardTokenId: cardResult.tokenId,
        imageIpfsUri,
        imageMetadataUri,
        cardMetadataUri
      };
    } catch (error: any) {
      console.error('Error minting Subtext card NFTs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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

// Default export for React Native routing compatibility
export default SubtextNftMinter;
