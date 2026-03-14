# 🚨 Migration to Polygon Amoy Testnet

## What Happened?

**Mumbai testnet was deprecated by Polygon in April 2024.** That's why you got the error:
```
missing response... url="https://polygon-mumbai.g.alchemy.com/v2/..."
```

Polygon replaced Mumbai with **Amoy testnet** as their new testing environment.

---

## ✅ What I Fixed (Already Done)

1. **Updated `.env`**: Changed `MATIC_MUMBAI` → `MATIC_AMOY`
2. **Updated WalletService**: Added Amoy network support with chain ID 80002
3. **Updated index.tsx**: Now connects to Amoy testnet
4. **Updated database migration**: Uses `MATIC_AMOY` as default
5. **Updated PolygonScan links**: Points to `amoy.polygonscan.com`

---

## 📋 What You Need to Do

### **Step 1: Add Amoy Network to MetaMask** ⏳

1. **Open MetaMask** (browser extension or mobile app)
2. **Add Amoy Network** with these settings:
   ```
   Network Name: Polygon Amoy Testnet
   RPC URL: https://rpc-amoy.polygon.technology/
   Chain ID: 80002
   Currency Symbol: MATIC
   Block Explorer: https://amoy.polygonscan.com
   ```

**How to Add:**
- **Desktop**: Click network dropdown → "Add Network" → "Add a network manually"
- **Mobile**: Settings → Networks → Add Network → Fill in details

---

### **Step 2: Get Test MATIC from Amoy Faucet** ⏳

Your Mumbai MATIC won't work on Amoy. Get new testnet funds:

1. **Go to Polygon Faucet**: https://faucet.polygon.technology/
2. **Select "Polygon Amoy"** (not Mumbai!)
3. **Paste your wallet address** (same address as before)
4. **Request MATIC**
5. **Wait ~1 minute** for funds to arrive

**Alternative Faucets:**
- https://www.alchemy.com/faucets/polygon-amoy
- https://www.allthatnode.com/faucet/polygon.dsrv

---

### **Step 3: Deploy Smart Contract on Amoy** ⏳

Your existing contract is on Mumbai and won't work on Amoy. You need to:

**Option A: Use Existing Contract (If Already Deployed on Amoy)**
- If you have a contract on Amoy, update `.env`:
  ```
  EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourAmoyContractAddress
  ```

**Option B: Deploy New Contract**

1. **Update Hardhat/Truffle config** to use Amoy:
   ```javascript
   amoy: {
     url: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
     chainId: 80002,
     accounts: [DEPLOYER_PRIVATE_KEY]
   }
   ```

2. **Deploy contract:**
   ```bash
   npx hardhat run scripts/deploy.js --network amoy
   ```

3. **Update `.env`** with new contract address

**Smart Contract File:** `contracts/SubtextNFT.sol` (already exists)

---

### **Step 4: Get New Private Key for Amoy Wallet** ⏳

Your existing private key works, but you need funds on Amoy:

1. **Use same MetaMask account** (no need to create new one)
2. **Switch to Polygon Amoy** network in MetaMask
3. **Get test MATIC** from Step 2
4. **Export private key** (same process as before):
   - Settings → Security & Privacy → Show Private Key
   - Enter password → Copy

---

### **Step 5: Test NFT Minting Again** ⏳

Now try minting:

1. **Run your app**
2. **Double-tap a card**
3. **Tap "Mint as NFT" → "Test Mode"**
4. **Paste your private key**
5. **Tap "Mint NFT"**

Expected logs:
```
✅ Connected to amoy network
📍 Wallet address: 0x...
🎴 Starting NFT minting for card: Supply
📤 Uploading to IPFS...
✅ Uploaded to IPFS: ipfs://...
🖼️ Minting image NFT...
📝 Sending transaction to contract: 0x...
⏳ Transaction sent, waiting for confirmation...
✅ NFT minted successfully!
```

---

## 🔍 Verification Checklist

After minting, verify everything worked:

- [ ] **Transaction on Amoy PolygonScan**: https://amoy.polygonscan.com/tx/[TX_HASH]
- [ ] **NFT in wallet**: MetaMask → Amoy network → NFTs tab
- [ ] **Database record**: Check `nft_mints` table in Supabase
- [ ] **IPFS content**: View on https://gateway.pinata.cloud/ipfs/[HASH]

---

## 📊 Network Comparison

| Feature | Mumbai (Deprecated) | Amoy (New) |
|---------|-------------------|------------|
| **Status** | ❌ Shutdown | ✅ Active |
| **Chain ID** | 80001 | 80002 |
| **RPC URL** | polygon-mumbai.g.alchemy.com | polygon-amoy.g.alchemy.com |
| **Explorer** | mumbai.polygonscan.com | amoy.polygonscan.com |
| **Faucet** | ❌ Not working | ✅ faucet.polygon.technology |

---

## 🚨 Common Issues

### Issue: "Still getting Mumbai errors"
**Fix:**
- Make sure `.env` has `EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_AMOY`
- Restart your app after changing `.env`
- Clear app cache if needed

### Issue: "Insufficient funds"
**Fix:**
- Make sure you're on **Amoy** network in MetaMask
- Get test MATIC from Amoy faucet (not Mumbai)
- Check balance on Amoy: https://amoy.polygonscan.com/address/[YOUR_ADDRESS]

### Issue: "Contract not found"
**Fix:**
- Your Mumbai contract address won't work on Amoy
- Deploy new contract on Amoy or use existing Amoy contract
- Update `.env` with correct Amoy contract address

### Issue: "Transaction fails"
**Fix:**
- Verify contract is deployed on Amoy
- Check you have enough test MATIC for gas
- Verify wallet is connected to Amoy network (chain ID 80002)

---

## 📝 Updated Configuration Summary

**Environment Variables (`.env`):**
```bash
EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_AMOY  # Changed from MATIC_MUMBAI
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0x...     # Update with Amoy contract
```

**Network Details:**
- **Chain ID**: 80002 (was 80001)
- **RPC**: https://polygon-amoy.g.alchemy.com/v2/[API_KEY]
- **Explorer**: https://amoy.polygonscan.com

---

## 🎯 Quick Start (TL;DR)

1. **Add Amoy to MetaMask** (Chain ID: 80002)
2. **Get test MATIC** from https://faucet.polygon.technology/
3. **Deploy contract on Amoy** (or update address in `.env`)
4. **Test minting** - should work now!

---

## 📚 Resources

- **Polygon Amoy Docs**: https://docs.polygon.technology/tools/wallets/metamask/add-polygon-network/
- **Amoy Faucet**: https://faucet.polygon.technology/
- **Amoy Explorer**: https://amoy.polygonscan.com/
- **Alchemy Amoy Guide**: https://docs.alchemy.com/docs/how-to-add-polygon-amoy-to-metamask

---

## ✅ Migration Complete

Once you complete these steps, your NFT minting will work perfectly on the new Amoy testnet!

**Need help?** Check the console logs for detailed error messages.
