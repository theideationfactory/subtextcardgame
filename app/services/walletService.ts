/**
 * Wallet Service for NFT Minting
 * Handles wallet connection and transaction signing using WalletConnect
 */

import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WalletConnectionResult {
  address: string;
  provider: ethers.providers.Web3Provider;
  signer: ethers.Signer;
}

export class WalletService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private address: string | null = null;
  
  /**
   * Connect to user's wallet using WalletConnect
   * In a production app, this would show QR code or deep link to wallet app
   */
  async connect(): Promise<WalletConnectionResult> {
    try {
      // For React Native, you'll need to implement WalletConnect v2
      // This is a placeholder that shows the structure
      
      // In production, use WalletConnect v2 or similar:
      // const connector = new WalletConnect({...});
      // await connector.connect();
      
      // For now, we'll use a simpler approach for testing
      // You can replace this with actual WalletConnect implementation
      
      throw new Error(
        'WalletConnect integration required. Please implement wallet connection.\n\n' +
        'Options:\n' +
        '1. WalletConnect v2 for React Native\n' +
        '2. MetaMask Mobile SDK\n' +
        '3. Rainbow Kit\n\n' +
        'See docs/NFT_PRODUCTION_DEPLOYMENT_GUIDE.md for detailed setup'
      );
      
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }
  
  /**
   * Connect using Alchemy provider directly (for testing with private key)
   * ⚠️ WARNING: NEVER use this in production with user private keys
   * This is only for testing/development purposes
   */
  async connectWithPrivateKey(privateKey: string, network: 'amoy' | 'mumbai' | 'mainnet' = 'amoy'): Promise<WalletConnectionResult> {
    try {
      const alchemyApiKey = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;
      if (!alchemyApiKey) {
        throw new Error('ALCHEMY_API_KEY not found in environment');
      }
      
      // Create provider based on network
      // Note: Mumbai testnet was deprecated in April 2024, use Amoy instead
      let provider;
      
      if (network === 'amoy') {
        // Amoy testnet (Polygon's new testnet)
        provider = new ethers.providers.JsonRpcProvider(
          `https://polygon-amoy.g.alchemy.com/v2/${alchemyApiKey}`,
          {
            chainId: 80002,
            name: 'polygon-amoy'
          }
        );
      } else if (network === 'mumbai') {
        // Mumbai (deprecated but kept for backwards compatibility)
        console.warn('⚠️ Mumbai testnet is deprecated. Use Amoy testnet instead.');
        provider = new ethers.providers.AlchemyProvider('maticmum', alchemyApiKey);
      } else {
        // Polygon Mainnet - using public RPC for better reliability
        provider = new ethers.providers.JsonRpcProvider(
          'https://polygon-rpc.com',
          {
            chainId: 137,
            name: 'matic'
          }
        );
        console.log('🌐 Using public Polygon RPC endpoint');
      }
      
      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, provider);
      const address = await wallet.getAddress();
      
      console.log('✅ Connected to', network, 'network');
      console.log('📍 Wallet address:', address);
      
      this.provider = provider as any;
      this.signer = wallet;
      this.address = address;
      
      // Save connection state
      await AsyncStorage.setItem('wallet_address', address);
      
      return {
        address,
        provider: provider as any,
        signer: wallet
      };
    } catch (error) {
      console.error('Private key connection error:', error);
      throw error;
    }
  }
  
  /**
   * Disconnect wallet and clear stored data
   */
  async disconnect(): Promise<void> {
    try {
      this.provider = null;
      this.signer = null;
      this.address = null;
      
      // Clear stored address
      await AsyncStorage.removeItem('wallet_address');
      
      console.log('Wallet disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }
  
  /**
   * Get the current signer (required for transactions)
   */
  getSigner(): ethers.Signer {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect first.');
    }
    return this.signer;
  }
  
  /**
   * Get the current provider
   */
  getProvider(): ethers.providers.Web3Provider {
    if (!this.provider) {
      throw new Error('Wallet not connected. Please connect first.');
    }
    return this.provider;
  }
  
  /**
   * Get the connected wallet address
   */
  getAddress(): string {
    if (!this.address) {
      throw new Error('Wallet not connected. Please connect first.');
    }
    return this.address;
  }
  
  /**
   * Check if wallet is currently connected
   */
  isConnected(): boolean {
    return this.signer !== null && this.address !== null;
  }
  
  /**
   * Get the network chain ID
   */
  async getChainId(): Promise<number> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }
    const network = await this.provider.getNetwork();
    return network.chainId;
  }
  
  /**
   * Check if connected to the correct network
   * Chain IDs: 80002 (Amoy testnet), 80001 (Mumbai - deprecated), 137 (Polygon mainnet)
   */
  async verifyNetwork(expectedChainId: number = 80002): Promise<boolean> {
    try {
      const chainId = await this.getChainId();
      return chainId === expectedChainId;
    } catch {
      return false;
    }
  }
  
  /**
   * Restore connection from stored address (if available)
   */
  async restoreConnection(): Promise<string | null> {
    try {
      const storedAddress = await AsyncStorage.getItem('wallet_address');
      return storedAddress;
    } catch (error) {
      console.error('Failed to restore connection:', error);
      return null;
    }
  }
}

export default WalletService;
