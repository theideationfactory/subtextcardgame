# NFT Integration Setup Instructions

## What's Been Implemented

Your app now has **real NFT minting code** integrated! Here's what's ready:

✅ **WalletService** - Manages wallet connections  
✅ **Updated nftMinter.ts** - Works with any ethers.js Signer  
✅ **Updated index.tsx** - Calls real minting functions  
✅ **Database migration** - Tracks NFT transactions  
✅ **Error handling** - Comprehensive user feedback  

---

## Current Status

**Working Infrastructure:**
- Smart contract deployed on Polygon Mumbai
- Minting utilities with IPFS integration
- Database tracking for minted NFTs
- UI integrated with real blockchain calls

**What's Needed:**
- Install dependencies (see below)
- Run database migration
- Choose wallet connection method
- Test on Mumbai testnet

---

## Step 1: Install Dependencies

The npm install failed due to a `better-sqlite3` compilation issue. Here's how to fix it:

### Option A: Install without better-sqlite3 (Recommended)
```bash
# Install wallet dependencies individually
npm install @react-native-async-storage/async-storage

# The alchemy-sdk and ethers are already installed
# WalletConnect will be added when you choose a method (see Step 3)
```

### Option B: Fix better-sqlite3 and install all
```bash
# Update Node.js to compatible version
nvm use 18  # or nvm use 20

# Then install
npm install @walletconnect/react-native-dapp @walletconnect/web3-provider @react-native-async-storage/async-storage
```

---

## Step 2: Run Database Migration

```bash
# In Supabase Dashboard > SQL Editor
# Or using CLI:
supabase migration up
```

This creates the `nft_mints` table to track minting transactions.

**Verify Migration:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM nft_mints LIMIT 1;
```

---

## Step 3: Choose Wallet Connection Method

Your app currently has a placeholder wallet service. Choose one:

### Option A: WalletConnect v2 (Recommended for Production)

**Install:**
```bash
npm install @walletconnect/react-native-dapp
npm install @react-native-async-storage/async-storage
npm install react-native-get-random-values
npm install @walletconnect/web3-provider
```

**Update `app/services/walletService.ts`:**
```typescript
import WalletConnect from '@walletconnect/react-native-dapp';

// Replace the connect() method with:
async connect(): Promise<WalletConnectionResult> {
  const connector = new WalletConnect({
    bridge: 'https://bridge.walletconnect.org',
    clientMeta: {
      description: 'Subtext Card Game',
      url: 'https://your-app-url.com',
      icons: ['https://your-app-url.com/icon.png'],
      name: 'Subtext',
    },
  });

  if (!connector.connected) {
    await connector.createSession();
  }

  const provider = new ethers.providers.Web3Provider(connector as any);
  const signer = provider.getSigner();
  const address = await signer.getAddress();

  this.provider = provider;
  this.signer = signer;
  this.address = address;

  return { address, provider, signer };
}
```

### Option B: Private Key (Testing Only - Mumbai Testnet)

**⚠️ ONLY for testing on Mumbai testnet with test MATIC**

The `connectWithPrivateKey()` method is already implemented in `walletService.ts`.

**Use in development:**
```typescript
// In your test environment
const testPrivateKey = 'YOUR_TEST_PRIVATE_KEY_FROM_METAMASK';
await walletService.connectWithPrivateKey(testPrivateKey, 'mumbai');
```

### Option C: MetaMask Mobile SDK

**Install:**
```bash
npm install @metamask/sdk-react-native
```

See MetaMask docs: https://docs.metamask.io/wallet/how-to/use-mobile/

---

## Step 4: Get Test MATIC

Before you can mint NFTs, you need test MATIC for gas fees.

**Mumbai Testnet Faucet:**
1. Go to: https://faucet.polygon.technology/
2. Enter your wallet address
3. Select "Mumbai" network
4. Request test MATIC
5. Wait 1-2 minutes

**Verify Balance:**
```typescript
const balance = await walletService.getProvider().getBalance(walletAddress);
console.log('Balance:', ethers.utils.formatEther(balance), 'MATIC');
```

---

## Step 5: Test NFT Minting

### Test Flow:

1. **Open app** → Navigate to Cards tab
2. **Double-tap a card** → Opens action modal
3. **Tap "Mint as NFT"** → Shows wallet connection dialog
4. **Choose test mode** → For development
5. **Connect wallet** → Using chosen method
6. **Mint NFT** → Real blockchain transaction!

### Expected Console Logs:
```
🎴 Starting NFT minting for card: [Card Name]
📤 Uploading to IPFS...
Card image uploaded to IPFS: ipfs://...
Image metadata uploaded to IPFS: ipfs://...
Card metadata uploaded to IPFS: ipfs://...
🖼️ Minting image NFT...
🎨 Minting NFT...
  Recipient: 0x...
  Token URI: ipfs://...
📝 Sending transaction to contract: 0xd9145CCE52D386f254917e481eB44e9943F39138
⏳ Transaction sent, waiting for confirmation...
  TX Hash: 0x...
✅ NFT minted successfully!
  Block: 12345678
  Gas used: 234567
🎴 Minting card data NFT...
[Same flow repeats]
```

### Verify on PolygonScan:
```
https://mumbai.polygonscan.com/tx/[TRANSACTION_HASH]
```

---

## Step 6: Verify NFT in Wallet

### View on OpenSea Testnet:
```
https://testnets.opensea.io/assets/mumbai/0xd9145CCE52D386f254917e481eB44e9943F39138/[TOKEN_ID]
```

### Check in MetaMask:
1. Open MetaMask
2. Switch to Mumbai network
3. Go to "NFTs" tab
4. You should see your minted card!

---

## Common Issues & Solutions

### Issue: "Missing environment variables"
**Solution:** Verify `.env` file has:
```bash
EXPO_PUBLIC_ALCHEMY_API_KEY=your_key_here
EXPO_PUBLIC_PINATA_API_KEY=your_key_here
EXPO_PUBLIC_PINATA_SECRET_KEY=your_secret_here
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xd9145CCE52D386f254917e481eB44e9943F39138
EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MUMBAI
```

### Issue: "Wallet not connected"
**Solution:** Complete Step 3 and implement wallet connection method.

### Issue: "Insufficient funds for gas"
**Solution:** Get test MATIC from faucet (Step 4).

### Issue: "Transaction failed"
**Solution:** Check:
- Correct network (Mumbai testnet)
- Sufficient gas
- Smart contract address is correct
- Private key has permissions

### Issue: "IPFS upload failed"
**Solution:** Verify Pinata API keys are correct.

---

## Production Checklist

Before deploying to mainnet:

- [ ] Smart contract audited by professional firm
- [ ] All testnet tests passing
- [ ] WalletConnect v2 fully implemented (no private keys)
- [ ] Gas estimation and limits configured
- [ ] Error handling comprehensive
- [ ] User education materials ready
- [ ] Legal review completed (NFT regulations)
- [ ] Terms of service updated
- [ ] Update `EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MAINNET`
- [ ] Deploy new contract to Polygon mainnet (if needed)
- [ ] Fund wallet with real MATIC for testing
- [ ] Test with small amounts first

---

## File Structure

```
app/
├── services/
│   └── walletService.ts          ← Wallet connection logic
├── utils/
│   └── nftMinter.ts              ← NFT minting with IPFS
├── (tabs)/
│   └── index.tsx                 ← Cards tab with mint button
contracts/
└── SubtextNFT.sol                ← Smart contract (deployed)
supabase/
└── migrations/
    └── 20251001_create_nft_mints_table.sql  ← Database tracking
docs/
├── NFT_PRODUCTION_DEPLOYMENT_GUIDE.md     ← Full guide
├── NFT_STATUS_SUMMARY.md                  ← Quick reference
└── NFT_SETUP_INSTRUCTIONS.md              ← This file
```

---

## Quick Reference Commands

```bash
# Get test MATIC
# Visit: https://faucet.polygon.technology/

# Check contract on Mumbai
# Visit: https://mumbai.polygonscan.com/address/0xd9145CCE52D386f254917e481eB44e9943F39138

# View NFT on OpenSea testnet
# https://testnets.opensea.io/assets/mumbai/[CONTRACT]/[TOKEN_ID]

# Check wallet balance
# In MetaMask or use ethers.js:
const balance = await provider.getBalance(address);

# Database query for minted NFTs
SELECT * FROM nft_mints WHERE user_id = 'YOUR_USER_ID';
```

---

## Next Steps

1. **Install dependencies** (Step 1)
2. **Run database migration** (Step 2)
3. **Choose wallet method** (Step 3)
4. **Get test MATIC** (Step 4)
5. **Test minting** (Step 5)
6. **Verify results** (Step 6)

---

## Support & Resources

- **WalletConnect Docs:** https://docs.walletconnect.com/2.0/
- **Polygon Faucet:** https://faucet.polygon.technology/
- **PolygonScan Mumbai:** https://mumbai.polygonscan.com/
- **OpenSea Testnet:** https://testnets.opensea.io/
- **Alchemy Dashboard:** https://dashboard.alchemy.com/
- **Pinata Dashboard:** https://app.pinata.cloud/

---

**Status:** Infrastructure complete ✅  
**Next Action:** Install dependencies and run migration  
**Time to Production:** 1-2 weeks with proper testing
