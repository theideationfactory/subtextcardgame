# NFT Minting - Quick Test Guide

## ✅ Setup Complete Checklist

- [x] Contract deployed to Amoy: `0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d`
- [x] `.env` updated with contract address
- [x] ABI file created at `app/services/abi/SubtextNFT.json`
- [x] NFT minter updated to capture token IDs
- [x] Database migration applied (nft_mints table with token_id columns)
- [x] UI integration complete in `app/(tabs)/index.tsx`

## 🧪 Test NFT Minting (5 Minutes)

### Step 1: Prepare Test Wallet
You already have a wallet with ~0.05 POL on Amoy. You'll need the private key for that wallet.

**Your test wallet private key:** (the one you used to deploy the contract)
```
0x968bf466de8bb4583825210774cbaaed54a401662a66f7485a0c3060f75e21b1
```

### Step 2: Restart Your App
The `.env` changes need to be picked up:

```bash
# Stop your dev server (Ctrl+C)
# Then restart:
npm start
# or
npx expo start
```

### Step 3: Mint Your First NFT

1. **Open the app** on your device/simulator
2. **Navigate to a card** you want to mint
3. **Double-tap the card** to open the actions modal
4. **Tap "Mint NFT"** button
5. **Enter your private key** when prompted:
   ```
   968bf466de8bb4583825210774cbaaed54a401662a66f7485a0c3060f75e21b1
   ```
   (No "0x" prefix needed - the app handles it)
6. **Tap "Connect"** - should show success with your wallet address
7. **Tap "Mint NFT"** in the confirmation dialog
8. **Wait ~30-60 seconds** for:
   - Image upload to IPFS
   - Metadata upload to IPFS
   - Blockchain transaction confirmation

### Step 4: Verify Success

**In the App:**
- Success alert shows: ✅
  - Card name
  - Token ID (e.g., "Token ID: 1")
  - Transaction hash (first 10 chars)
  
**On Polygonscan:**
1. Copy the transaction hash from the alert
2. Visit: `https://amoy.polygonscan.com/tx/[YOUR_TX_HASH]`
3. Verify:
   - Status: Success ✅
   - To: Your contract address
   - Logs show `CardMinted` event

**In Supabase:**
1. Go to Supabase Dashboard → Table Editor
2. Open `nft_mints` table
3. Should see new row with:
   - `card_id`
   - `transaction_hash`
   - `image_token_id` (e.g., 1)
   - `card_token_id` (e.g., 2)
   - `contract_address`
   - `wallet_address`
   - `network: MATIC_AMOY`
   - `status: confirmed`

---

## 🔍 What Happens During Minting

### 1. Image Upload (5-10 sec)
```
📤 Uploading card image to IPFS...
✅ ipfs://QmXXX...
```

### 2. Metadata Creation (5-10 sec)
```
📝 Creating metadata JSON...
📤 Uploading to IPFS...
✅ Image metadata: ipfs://QmYYY...
✅ Card metadata: ipfs://QmZZZ...
```

### 3. Blockchain Minting (20-30 sec)
```
🖼️ Minting image NFT...
📝 Sending transaction...
⏳ Waiting for confirmation...
✅ Token ID: 1

🎴 Minting card NFT...
📝 Sending transaction...
⏳ Waiting for confirmation...
✅ Token ID: 2
```

### 4. Database Recording
```
💾 Saving to Supabase...
✅ Mint record created
```

---

## 📊 Expected Results

### First Mint
- **Image Token ID:** 1
- **Card Token ID:** 2
- **Gas Cost:** ~0.01-0.03 POL
- **Total Time:** ~40-60 seconds

### Second Mint
- **Image Token ID:** 3
- **Card Token ID:** 4
- **Gas Cost:** ~0.01-0.03 POL

Token IDs increment sequentially for each NFT minted.

---

## 🐛 Troubleshooting

### Issue: "Wallet not connected"
**Solution:** Make sure you entered the private key and tapped "Connect" first.

### Issue: "Insufficient POL"
**Solution:** 
- Check balance on Amoy: https://amoy.polygonscan.com/address/[YOUR_WALLET]
- Get more from: https://www.alchemy.com/faucets/polygon-amoy

### Issue: "Transaction failed"
**Check:**
1. Correct network (Amoy, Chain ID 80002)
2. Enough POL for gas
3. Contract address is correct in `.env`
4. View error on Polygonscan

### Issue: "IPFS upload failed"
**Check:**
1. Pinata API keys are correct in `.env`
2. Card has a valid image URL
3. Internet connection is stable

### Issue: Token ID not showing
**Check:**
1. Transaction succeeded on Polygonscan
2. Look for `CardMinted` event in transaction logs
3. Check console logs for event extraction errors

---

## 🎯 Success Criteria

✅ **Minting works** - Transaction succeeds on blockchain  
✅ **Token ID captured** - Shows in success alert  
✅ **Database updated** - Row in `nft_mints` with token IDs  
✅ **IPFS working** - Metadata accessible via gateway  
✅ **Polygonscan shows** - NFT visible on explorer  

---

## 📱 View Your NFT

### On Polygonscan
```
https://amoy.polygonscan.com/token/0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d?a=[TOKEN_ID]
```

### Metadata URL
```
https://gateway.pinata.cloud/ipfs/[YOUR_CID]
```

### In MetaMask Mobile
1. Open MetaMask app
2. Switch to Polygon Amoy network
3. Go to NFTs tab
4. Tap "Import NFT"
5. Enter:
   - Address: `0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d`
   - Token ID: (from success alert)

---

## 🚀 Next Steps After Testing

### 1. Test Multiple Cards
- Mint 2-3 different cards
- Verify token IDs increment correctly
- Check all appear in Supabase

### 2. Verify IPFS Metadata
- Open metadata URL in browser
- Should show JSON with card data
- Image URL should load

### 3. Check Gas Costs
- Review transaction costs on Polygonscan
- Estimate mainnet costs (Amoy ≈ Mainnet)

### 4. Plan Production Wallet
- Replace private key input with WalletConnect
- See `app/services/walletService.ts` line 36
- Options: WalletConnect v2, MetaMask SDK, Rainbow Kit

### 5. Consider Mainnet
When ready:
- Deploy contract to Polygon mainnet
- Update `.env` with mainnet address
- Change `EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MAINNET`
- Get real MATIC for gas

---

## 📝 Test Log Template

```
Date: ___________
Card Name: ___________
Wallet: 0x___________

✅ Image uploaded to IPFS: ipfs://___________
✅ Metadata uploaded to IPFS: ipfs://___________
✅ Image NFT minted - Token ID: ___
✅ Card NFT minted - Token ID: ___
✅ Transaction: https://amoy.polygonscan.com/tx/___________
✅ Supabase record created: ___________
✅ Gas cost: ___ POL

Notes:
___________
```

---

## 🎉 You're Ready!

Everything is set up for NFT minting:
- Smart contract live on Amoy ✅
- App integrated with minting flow ✅
- Database tracking token IDs ✅
- IPFS metadata storage ✅

**Go mint your first Subtext card NFT!** 🚀
