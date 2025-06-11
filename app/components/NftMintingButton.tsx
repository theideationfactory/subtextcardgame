import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Network } from 'alchemy-sdk';
import { Text, TouchableOpacity } from 'react-native';
import { SubtextNftMinter } from '@/app/utils/nftMinter';
import * as Haptics from 'expo-haptics';

interface NftMintingButtonProps {
  card: {
    id: string;
    name: string;
    description?: string;
    type?: string;
    role?: string;
    context?: string;
    artStyle?: string;
    imageUri?: string;
  };
  walletAddress?: string;
}

export default function NftMintingButton({ card, walletAddress }: NftMintingButtonProps) {
  const [isMinting, setIsMinting] = useState(false);

  const handleMintNft = async () => {
    // Provide haptic feedback when button is pressed
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Check if wallet is connected
    if (!walletAddress) {
      Alert.alert(
        'Wallet Not Connected',
        'Please connect your wallet to mint this card as an NFT.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Connect Wallet', 
            onPress: () => {
              // Navigate to wallet connection screen or show wallet connection modal
              // This would depend on your app's navigation/wallet connection implementation
            } 
          }
        ]
      );
      return;
    }

    // Check if card has an image
    if (!card.imageUri) {
      Alert.alert('Error', 'This card does not have an image to mint.');
      return;
    }

    try {
      setIsMinting(true);

      // Initialize the NFT minter with environment variables
      const nftMinter = new SubtextNftMinter({
        alchemyApiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY || '',
        pinataApiKey: process.env.EXPO_PUBLIC_PINATA_API_KEY || '',
        pinataSecretKey: process.env.EXPO_PUBLIC_PINATA_SECRET_KEY || '',
        contractAddress: process.env.EXPO_PUBLIC_NFT_CONTRACT_ADDRESS || '',
        network: (process.env.EXPO_PUBLIC_BLOCKCHAIN_NETWORK === 'MATIC_MAINNET' 
          ? Network.MATIC_MAINNET 
          : Network.MATIC_MUMBAI)
      });

      // For a real implementation, you would need to:
      // 1. Get the user's private key securely (possibly via a secure wallet connection)
      // 2. Connect to their wallet
      // 3. Mint the NFT

      // This is a simplified example - in a real app, you'd use a proper wallet connection
      Alert.alert(
        'Ready to Mint',
        'Your card is ready to be minted as an NFT. In a production app, this would connect to your wallet and mint the NFT.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // In a real implementation, this would trigger the actual minting process
              console.log('NFT minting would start here with card:', card);
            } 
          }
        ]
      );

      // For demonstration purposes only - this simulates a successful mint
      setTimeout(() => {
        // Provide success haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          'Success!',
          'Your card has been prepared for minting. In a production app, it would now be available in your wallet.',
        );
        setIsMinting(false);
      }, 2000);

    } catch (error) {
      console.error('Error in mintCardAsNFT:', error);
      
      // Provide error haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert('Error', 'Failed to mint NFT: ' + (error as Error).message);
      setIsMinting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          isMinting && styles.buttonDisabled
        ]}
        onPress={handleMintNft}
        disabled={isMinting}
        activeOpacity={0.4} // Enhanced visual feedback
      >
        <Text style={styles.buttonText}>
          {isMinting ? 'Minting...' : 'Mint as NFT'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#8247E5', // Polygon/Matic purple
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
