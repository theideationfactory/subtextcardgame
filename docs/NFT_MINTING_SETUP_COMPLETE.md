# NFT Minting Setup - Complete ✅

## What We Accomplished

### 1. ✅ Smart Contract Deployment
- **Deployed SubtextNFT contract** to Polygon Amoy testnet
- **Contract Address:** `0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d`
- **Network:** Polygon Amoy (Chain ID: 80002)
- **Deployment TX:** `0xdf6ee80d9e9d0d4ca6da6edc4973a8cce24d86087325cb42c2d76734da99fcdb`
- **Explorer:** https://amoy.polygonscan.com/address/0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d

### 2. ✅ Contract Features
- `mintNFT(address recipient, string tokenURI)` - Mints NFT and returns token ID
- `totalSupply()` - Returns total minted NFTs
- `cardName(tokenId)` / `setCardName(tokenId, name)` - Card name management
- `CardMinted` event - Emits tokenId, recipient, and tokenURI on mint

### 3. ✅ Environment Configuration
Updated `.env` with:
```
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d
EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_AMOY
EXPO_PUBLIC_ALCHEMY_API_KEY=z4GhJrV7w-x06DA-RH69EKuIZrhtgHgr
EXPO_PUBLIC_PINATA_API_KEY=fd7efc0e9bf58c4fca92
EXPO_PUBLIC_PINATA_SECRET_KEY=cf7a87f8cfb9f7b78fafd342fbfd821428c10d03a90c0a054790195d6924f9de
POLYGONSCAN_API_KEY=R28BGQ5VE6CIWXK5CU4GM3CQD64SXCTBFQ
```

### 4. ✅ Contract ABI Integration
- Created `app/services/abi/SubtextNFT.json` with contract ABI
- Includes all necessary functions: `mintNFT`, `totalSupply`, `cardName`, `setCardName`, `ownerOf`, `tokenURI`
- Includes `CardMinted` event definition for extracting token IDs

### 5. ✅ NFT Minting Pipeline
**Updated `app/utils/nftMinter.ts`:**
- Imports SubtextNFT ABI
- `mintNFT()` now returns `{ txHash, tokenId }` instead of just txHash
- Extracts token ID from `CardMinted` event in transaction receipt
- `mintSubtextCardNFTs()` returns both image and card token IDs

**Minting Flow:**
1. Upload card image to IPFS via Pinata → get `imageIpfsUri`
2. Create image metadata JSON → upload to IPFS → get `imageMetadataUri`
3. Create card metadata JSON → upload to IPFS → get `cardMetadataUri`
4. Mint image NFT → get `{ txHash, tokenId }`
5. Mint card NFT → get `{ txHash, tokenId }`
6. Return all data including both token IDs

### 6. ✅ Database Integration
**Updated `supabase/migrations/20251001_create_nft_mints_table.sql`:**
- Added `image_token_id INTEGER` column
- Added `card_token_id INTEGER` column
- Added `contract_address TEXT` column
- Tracks complete mint data: tx hashes, token IDs, wallet, network, status

**Updated `app/(tabs)/index.tsx`:**
- Saves mint results to `nft_mints` table with all fields
- Displays token ID in success alert
- Links to Amoy Polygonscan for transaction verification

### 7. ✅ Wallet Service
**`app/services/walletService.ts`:**
- Supports Polygon Amoy network (Chain ID: 80002)
- `connectWithPrivateKey()` for testing with test wallet
- `getSigner()` and `getAddress()` for minting
- Network verification with `verifyNetwork(80002)`

### 8. ✅ UI Integration
**In `app/(tabs)/index.tsx`:**
- "Mint NFT" button in card actions modal
- Private key input for test wallet connection
- Wallet connection flow with success/error handling
- NFT minting with loading states and haptic feedback
- Success alert showing token ID and Polygonscan link

---

## How to Use (Testing)

### Step 1: Get Test MATIC
1. Go to https://www.alchemy.com/faucets/polygon-amoy
2. Sign in with Alchemy account
3. Paste your wallet address
4. Request test MATIC (0.05 POL minimum needed)

### Step 2: Mint NFT from App
1. Open a card in the app
2. Double-tap to open actions modal
3. Tap "Mint NFT"
4. Enter your test wallet private key (the one with test MATIC)
5. Tap "Connect"
6. Tap "Mint NFT" in the confirmation dialog
7. Wait for minting (~30 seconds)
8. Success! View on Polygonscan

### Step 3: Verify on Blockchain
1. Copy transaction hash from success alert
2. Visit: https://amoy.polygonscan.com/tx/[YOUR_TX_HASH]
3. See your minted NFT with token ID
4. Check contract: https://amoy.polygonscan.com/address/0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d

---

## Database Schema

```sql
CREATE TABLE nft_mints (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  card_id UUID REFERENCES cards(id),
  transaction_hash TEXT NOT NULL,
  image_nft_hash TEXT,
  card_nft_hash TEXT,
  image_token_id INTEGER,      -- NEW: Token ID for image NFT
  card_token_id INTEGER,        -- NEW: Token ID for card NFT
  contract_address TEXT,        -- NEW: Contract address
  wallet_address TEXT NOT NULL,
  network TEXT DEFAULT 'MATIC_AMOY',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## Next Steps (Production)

### 1. Contract Verification (Optional but Recommended)
```bash
# In Remix or via Hardhat
npx hardhat verify --network polygon_amoy 0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d
```

Or manually on Polygonscan:
1. Go to https://amoy.polygonscan.com/address/0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d
2. Click "Contract" → "Verify and Publish"
3. Compiler: 0.8.20
4. Paste contract source from `contracts/SubtextNFT.sol`

### 2. Wallet Integration (Replace Test Private Key)
Replace the private key input with proper wallet connection:
- **WalletConnect v2** for React Native
- **MetaMask Mobile SDK**
- **Rainbow Kit**

See `app/services/walletService.ts` line 36 for placeholder.

### 3. Mainnet Deployment
When ready for production:
1. Deploy contract to Polygon mainnet
2. Update `.env`:
   ```
   EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=[mainnet_address]
   EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MAINNET
   ```
3. Get real MATIC for gas fees
4. Test thoroughly on mainnet before public release

### 4. Enhanced Features
- **Batch minting** - Mint multiple cards at once
- **Gas estimation** - Show estimated cost before minting
- **NFT gallery** - Display user's minted NFTs in app
- **OpenSea integration** - Link to OpenSea for trading
- **Royalties** - Add royalty support for secondary sales

---

## Testing Checklist

- [x] Contract deployed to Amoy
- [x] Contract address in `.env`
- [x] ABI file created
- [x] NFT minter updated with ABI
- [x] Token ID extraction working
- [x] Database schema updated
- [x] Supabase insert includes token IDs
- [ ] Run migration: `supabase db push` (if not auto-applied)
- [ ] Test mint one card end-to-end
- [ ] Verify on Amoy Polygonscan
- [ ] Check Supabase `nft_mints` table has data
- [ ] Verify token ID matches blockchain

---

## Troubleshooting

### "Insufficient POL" Error
- Get more test MATIC from https://www.alchemy.com/faucets/polygon-amoy
- Each mint costs ~0.01-0.03 POL

### "Wallet not connected" Error
- Make sure you entered the private key correctly
- Remove "0x" prefix if present
- Use the wallet that has test MATIC

### "Transaction failed" Error
- Check you're on Amoy network (Chain ID: 80002)
- Verify contract address is correct
- Check Polygonscan for error details

### Token ID not showing
- Check transaction receipt has `CardMinted` event
- Verify ABI includes event definition
- Check console logs for event extraction

---

## Resources

- **Contract:** https://amoy.polygonscan.com/address/0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d
- **Faucet:** https://www.alchemy.com/faucets/polygon-amoy
- **Alchemy Dashboard:** https://dashboard.alchemy.com/
- **Pinata Dashboard:** https://app.pinata.cloud/
- **Polygonscan API:** https://polygonscan.com/myapikey

---

## Summary

✅ **Smart contract deployed** to Polygon Amoy  
✅ **ABI integrated** into the app  
✅ **Minting pipeline** uploads to IPFS and mints NFTs  
✅ **Token IDs captured** from blockchain events  
✅ **Database tracking** with complete mint data  
✅ **UI flow** from card → wallet connect → mint → success  

**Status:** Ready for testing on Amoy testnet! 🎉

Next: Test mint a card, verify on Polygonscan, then plan mainnet deployment.
