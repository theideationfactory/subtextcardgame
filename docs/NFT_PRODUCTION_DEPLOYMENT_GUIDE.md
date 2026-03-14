# NFT Production Deployment Guide for Subtext Card Game

## Current Status

Your app has **NFT infrastructure built but not integrated**. The UI shows NFT minting options, but they're **simulations only** that don't actually interact with the blockchain.

### What Exists
- ✅ Smart contract deployed: `SubtextNFT.sol` (ERC721)
- ✅ Minting utilities: `nftMinter.ts` with Alchemy/Pinata integration
- ✅ Environment configuration for Polygon Mumbai testnet
- ✅ UI buttons and state management
- ⚠️ **PROBLEM**: UI uses mock wallet and fake minting (setTimeout simulations)

---

## Architecture Overview

```
User Interaction (UI)
    ↓
Wallet Connection (Missing!)
    ↓
Sign Transaction (Missing!)
    ↓
nftMinter.ts (Exists but not called)
    ↓
Blockchain (Alchemy/Polygon) + IPFS (Pinata)
```

---

## Production Deployment Checklist

### Phase 1: Wallet Integration (Critical)

#### 1.1 Choose Wallet Solution
**Recommended for React Native:**
- **WalletConnect v2** - Most widely supported
- **MetaMask Mobile SDK** - Good for MetaMask users
- **Rainbow Kit** - User-friendly, modern UI

**Install Dependencies:**
```bash
npm install @walletconnect/react-native-dapp
npm install @walletconnect/web3-provider
npm install @react-native-async-storage/async-storage
```

#### 1.2 Implement Wallet Connection Service
**Create:** `app/services/walletService.ts`

```typescript
import WalletConnectProvider from '@walletconnect/web3-provider';
import { ethers } from 'ethers';

export class WalletService {
  private provider: WalletConnectProvider | null = null;
  private signer: ethers.Signer | null = null;
  
  async connect(): Promise<string> {
    // Initialize WalletConnect provider
    this.provider = new WalletConnectProvider({
      rpc: {
        80001: "https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY",
        137: "https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
      },
      chainId: 80001, // Mumbai testnet
    });
    
    // Enable session (triggers QR Code modal)
    await this.provider.enable();
    
    // Get Web3 provider
    const web3Provider = new ethers.providers.Web3Provider(this.provider);
    this.signer = web3Provider.getSigner();
    
    // Get address
    const address = await this.signer.getAddress();
    return address;
  }
  
  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
      this.signer = null;
    }
  }
  
  getSigner(): ethers.Signer {
    if (!this.signer) throw new Error('Wallet not connected');
    return this.signer;
  }
  
  isConnected(): boolean {
    return this.provider?.connected || false;
  }
}
```

#### 1.3 Update Cards Tab (`app/(tabs)/index.tsx`)

**Replace lines 488-554** with real implementation:

```typescript
import { WalletService } from '@/app/services/walletService';
import { SubtextNftMinter } from '@/app/utils/nftMinter';
import { Network } from 'alchemy-sdk';

// Add at component level
const walletService = useRef(new WalletService()).current;

const handleMintNFT = async (card: Card) => {
  setShowActions(false);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
  try {
    // Real wallet connection
    if (!walletConnected) {
      setMintingNFT(true);
      const address = await walletService.connect();
      setWalletAddress(address);
      setWalletConnected(true);
      setMintingNFT(false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Wallet Connected',
        `Connected: ${address.substring(0, 6)}...${address.substring(38)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mint NFT', onPress: () => mintCardAsNFT(card) }
        ]
      );
      return;
    }
    
    await mintCardAsNFT(card);
  } catch (error) {
    setMintingNFT(false);
    Alert.alert('Connection Failed', error.message);
  }
};

const mintCardAsNFT = async (card: Card) => {
  setMintingNFT(true);
  
  try {
    // Initialize NFT minter with real config
    const nftMinter = new SubtextNftMinter({
      alchemyApiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY!,
      pinataApiKey: process.env.EXPO_PUBLIC_PINATA_API_KEY!,
      pinataSecretKey: process.env.EXPO_PUBLIC_PINATA_SECRET_KEY!,
      contractAddress: process.env.EXPO_PUBLIC_NFT_CONTRACT_ADDRESS!,
      network: Network.MATIC_MUMBAI
    });
    
    // Get signer from wallet
    const signer = walletService.getSigner();
    
    // Convert card to format expected by minter
    const subtextCard = {
      id: card.id,
      name: card.name,
      description: card.description,
      type: card.type,
      role: card.role,
      context: card.context,
      artStyle: card.art_style,
      imageUri: card.image_url
    };
    
    // Real blockchain minting
    const result = await nftMinter.mintSubtextCardNFTs(
      subtextCard,
      signer as any, // Type assertion for ethers Wallet
      walletAddress
    );
    
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'NFT Minted Successfully!',
        `Transaction Hash: ${result.imageNftTxHash}\n\nYour card will appear in your wallet soon.`,
        [{ text: 'OK' }]
      );
    } else {
      throw new Error(result.error || 'Minting failed');
    }
  } catch (error) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Minting Failed', error.message);
  } finally {
    setMintingNFT(false);
  }
};
```

---

### Phase 2: Security Considerations

#### 2.1 Never Store Private Keys
- ❌ **DON'T**: Store private keys in app state or AsyncStorage
- ✅ **DO**: Use wallet apps (MetaMask, Trust Wallet) via WalletConnect
- ✅ **DO**: Let users sign transactions through their wallet app

#### 2.2 Environment Variables
**Ensure these are properly configured:**

```bash
# .env
EXPO_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key_here
EXPO_PUBLIC_PINATA_API_KEY=your_pinata_api_key
EXPO_PUBLIC_PINATA_SECRET_KEY=your_pinata_secret_key
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourContractAddress
EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MUMBAI # or MATIC_MAINNET
```

**⚠️ Security Notes:**
- Pinata keys should ideally be on backend, not exposed in client
- Consider creating a backend API endpoint for IPFS uploads
- Rate-limit minting to prevent abuse

#### 2.3 Backend API Alternative (Recommended)
Create Supabase Edge Function for secure minting:

**Create:** `supabase/functions/mint-nft/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { cardId, walletAddress } = await req.json();
  
  // Verify user owns the card
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .single();
  
  if (!card) {
    return new Response(JSON.stringify({ error: 'Card not found' }), {
      status: 404
    });
  }
  
  // Call minting service (keep keys server-side)
  // Upload to IPFS, mint NFT, return transaction hash
  
  return new Response(JSON.stringify({ success: true, txHash: '...' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

### Phase 3: Testing Requirements

#### 3.1 Testnet Testing (Mumbai)
1. **Get Test MATIC**:
   - Faucet: https://faucet.polygon.technology/
   - Need ~0.1 MATIC for gas fees

2. **Test Wallets**:
   - Create fresh wallet for testing
   - Never use real funds on testnet

3. **Verify Smart Contract**:
   ```bash
   # Visit contract on PolygonScan Mumbai
   https://mumbai.polygonscan.com/address/0xd9145CCE52D386f254917e481eB44e9943F39138
   
   # Verify it's deployed and working
   # Check recent transactions
   ```

#### 3.2 Test Cases
- [ ] Wallet connection flow
- [ ] Wallet disconnection
- [ ] Minting with sufficient gas
- [ ] Minting with insufficient gas (error handling)
- [ ] Network switch (if wrong network)
- [ ] Transaction rejection by user
- [ ] IPFS upload success/failure
- [ ] Metadata correctness
- [ ] Card appears in wallet (OpenSea testnet)

#### 3.3 Monitor Transactions
```typescript
// Add transaction monitoring
const receipt = await transaction.wait();
console.log('Transaction confirmed:', receipt.transactionHash);
console.log('Gas used:', receipt.gasUsed.toString());
console.log('Block number:', receipt.blockNumber);

// Verify on PolygonScan
const explorerUrl = `https://mumbai.polygonscan.com/tx/${receipt.transactionHash}`;
```

---

### Phase 4: Mainnet Deployment

#### 4.1 Pre-Deployment Checklist
- [ ] Smart contract audited (recommended for production)
- [ ] All testnet tests passing
- [ ] Gas optimization completed
- [ ] Error handling comprehensive
- [ ] User feedback/UI polished
- [ ] Terms of service updated (NFT-specific terms)
- [ ] Legal review completed (NFT regulations vary by jurisdiction)

#### 4.2 Deploy to Mainnet
1. **Update environment:**
   ```bash
   EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MAINNET
   ```

2. **Deploy new contract** (if needed):
   ```bash
   # Hardhat deployment script
   npx hardhat run scripts/deploy.js --network polygon
   ```

3. **Update contract address** in `.env`

4. **Fund deployment wallet** with real MATIC

#### 4.3 Gas Fee Considerations
- Current Polygon gas fees: ~$0.01-0.10 per transaction
- Consider who pays:
  - **Gasless** (sponsored): You pay via relay service (Biconomy, Gelato)
  - **User pays**: Simplest, user needs MATIC
  - **Hybrid**: Free mints for first X cards, then user pays

---

### Phase 5: User Experience Enhancements

#### 5.1 Loading States
```typescript
// Better loading feedback
if (mintingNFT) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#8247E5" />
      <Text>Uploading to IPFS...</Text>
      <Text>Waiting for blockchain confirmation...</Text>
      <Text>This may take 1-2 minutes</Text>
    </View>
  );
}
```

#### 5.2 Transaction History
Store minted NFTs in database:

```sql
CREATE TABLE nft_mints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  card_id UUID REFERENCES cards(id),
  transaction_hash TEXT NOT NULL,
  image_nft_hash TEXT,
  card_nft_hash TEXT,
  wallet_address TEXT NOT NULL,
  network TEXT DEFAULT 'MATIC_MUMBAI',
  status TEXT DEFAULT 'pending', -- pending, confirmed, failed
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 5.3 View on OpenSea
```typescript
const openSeaUrl = `https://opensea.io/assets/matic/${contractAddress}/${tokenId}`;
// Or testnet: https://testnets.opensea.io/assets/mumbai/...

Alert.alert(
  'NFT Minted!',
  'View your NFT on OpenSea',
  [
    { text: 'Later', style: 'cancel' },
    { text: 'View on OpenSea', onPress: () => Linking.openURL(openSeaUrl) }
  ]
);
```

---

### Phase 6: Cost Analysis

#### 6.1 Ongoing Costs
| Service | Cost | Notes |
|---------|------|-------|
| Alchemy API | Free tier: 300M compute units/month | Should be sufficient for MVP |
| Pinata IPFS | Free tier: 1GB storage | ~500-1000 cards |
| Gas fees (Polygon) | ~$0.01-0.10 per mint | User or app pays |
| Smart contract deployment | ~$5-20 one-time | Already done |

#### 6.2 Scaling Considerations
- **At 1,000 mints/month**: ~$50-100 in gas if app pays
- **At 10,000 mints/month**: Consider gasless relay service
- **IPFS storage**: May need paid Pinata plan at scale

---

### Phase 7: Alternative: Remove NFT Features

If you decide NFT functionality is not needed right now:

**Files to clean up:**
1. Remove from `app/(tabs)/index.tsx`:
   - Lines 103-105 (state variables)
   - Lines 488-554 (handlers)
   - Line 2201 (button in modal)

2. Remove from `app/(tabs)/settings.tsx`:
   - Lines 88-106 (NFT button)

3. Keep infrastructure files for future:
   - `contracts/SubtextNFT.sol`
   - `app/utils/nftMinter.ts`
   - `alchemy-nft-minter.js`

---

## Quick Start Commands

### If you want to integrate NOW:

```bash
# Install wallet dependencies
npm install @walletconnect/react-native-dapp @walletconnect/web3-provider

# Create wallet service
touch app/services/walletService.ts

# Update cards tab with real implementation
# (See Phase 1.3 above)

# Test on Mumbai testnet
# Get test MATIC from faucet
# Test minting flow
```

### If you want to remove simulations:

```bash
# I can help remove the mock NFT UI
# Just say "remove NFT UI" and I'll clean it up
```

---

## Recommended Next Steps

1. **Decide**: Keep or remove NFT features?
2. **If keep**: Start with Phase 1 (wallet integration)
3. **If remove**: I'll clean up the simulated UI
4. **Testing**: Always test on Mumbai before mainnet
5. **Legal**: Consult lawyer about NFT regulations in your jurisdiction

---

## Support Resources

- **WalletConnect Docs**: https://docs.walletconnect.com/
- **Alchemy Polygon Guide**: https://docs.alchemy.com/docs/how-to-mint-an-nft-on-polygon
- **Polygon Mumbai Faucet**: https://faucet.polygon.technology/
- **OpenSea Testnet**: https://testnets.opensea.io/
- **Hardhat Polygon Deploy**: https://hardhat.org/tutorial/deploying-to-a-live-network

---

## Questions to Answer

Before proceeding with production deployment:

1. **Business Model**: Who pays gas fees?
2. **Scale**: How many NFTs do you expect to mint per month?
3. **Features**: Do you need marketplace integration (OpenSea)?
4. **Custody**: Custodial wallet (you manage) or non-custodial (user manages)?
5. **Mainnet Ready**: Is your smart contract audited?

---

**Status**: Infrastructure exists but needs wallet integration and real blockchain calls to be production-ready. Estimated effort: 1-2 weeks for basic integration, 1 month for production-grade implementation with proper testing and UX.
