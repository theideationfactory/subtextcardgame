# 🚀 Deploy SubtextNFT to Polygon Amoy (2025 Guide)

**Status:** ✅ **Setup Complete - Ready to Deploy**

---

## 📋 Prerequisites Checklist

Before deploying, ensure you have:

- [x] Hardhat config created (`hardhat.config.js`)
- [x] Deployment script created (`scripts/deploy.js`)
- [x] Package.json updated with deployment commands
- [ ] Hardhat dependencies installed
- [ ] Private key added to `.env`
- [ ] PolygonScan API key added to `.env`
- [ ] Test MATIC in deployer wallet

---

## 🎯 Quick Deploy (TL;DR)

```bash
# 1. Install dependencies
npm install

# 2. Update .env with your private key and API keys

# 3. Get test MATIC
# Visit: https://faucet.polygon.technology/

# 4. Deploy
npm run deploy:amoy

# 5. Update .env with new contract address

# 6. Verify on PolygonScan
npm run verify:amoy YOUR_CONTRACT_ADDRESS
```

---

## 📖 Detailed Step-by-Step Guide

### **Step 1: Install All Dependencies**

Run this command to install Hardhat and required packages:

```bash
npm install --save-dev hardhat @openzeppelin/contracts @nomicfoundation/hardhat-toolbox @nomiclabs/hardhat-ethers @nomiclabs/hardhat-etherscan dotenv
```

**What this installs:**
- `hardhat` - Ethereum development environment
- `@openzeppelin/contracts` - Your contract uses OpenZeppelin's ERC721
- `@nomicfoundation/hardhat-toolbox` - Hardhat plugins bundle
- `@nomiclabs/hardhat-ethers` - Ethers.js integration
- `@nomiclabs/hardhat-etherscan` - Contract verification
- `dotenv` - Environment variable management

---

### **Step 2: Get Your Private Key**

⚠️ **IMPORTANT: Only use a TEST WALLET for testnet deployment!**

**From MetaMask:**
1. Open MetaMask
2. Switch to your **Amoy test account** (not your main account!)
3. Click account menu → "Account details"
4. Click "Show private key"
5. Enter password
6. Copy the private key

**Security Notes:**
- ⚠️ **Never share your private key**
- ⚠️ **Never commit it to Git**
- ⚠️ Use a separate wallet for deployment
- ⚠️ Only use test MATIC on this wallet

---

### **Step 3: Get PolygonScan API Key**

**Why needed?** To verify your contract on PolygonScan (makes it viewable/trustworthy)

1. Go to: https://polygonscan.com/register
2. Create a free account
3. Go to: https://polygonscan.com/myapikey
4. Click "Add" → Create new API key
5. Copy the API key

**Note:** Same API key works for both testnet and mainnet PolygonScan.

---

### **Step 4: Update .env File**

Open `.env` and replace these values:

```bash
# Replace YOUR_PRIVATE_KEY_HERE with your actual private key
DEPLOYER_PRIVATE_KEY=abc123def456...  # Your private key (64 characters, no 0x)

# Replace YOUR_POLYGONSCAN_API_KEY_HERE with your API key
POLYGONSCAN_API_KEY=ABC123DEF456...  # Your PolygonScan API key
```

**⚠️ Security Checklist:**
- [ ] `.env` is in your `.gitignore` file
- [ ] Never commit `.env` to version control
- [ ] Private key is from a TEST wallet only
- [ ] Wallet has no real funds

---

### **Step 5: Get Test MATIC**

Your deployer wallet needs MATIC to pay for gas fees.

**Get test MATIC:**
1. Copy your wallet address from MetaMask
2. Visit: https://faucet.polygon.technology/
3. Select **"Polygon Amoy"** (not Mumbai!)
4. Paste your address
5. Click "Submit"
6. Wait 1-2 minutes

**Verify you received it:**
- Check MetaMask (switch to Amoy network)
- Should show ~0.5 test MATIC
- Or check: `https://amoy.polygonscan.com/address/YOUR_ADDRESS`

**Need more?** Alternative faucets:
- https://www.alchemy.com/faucets/polygon-amoy
- https://www.allthatnode.com/faucet/polygon.dsrv

---

### **Step 6: Compile Contract**

Test that your contract compiles without errors:

```bash
npm run compile:contract
```

**Expected output:**
```
Compiled 1 Solidity file successfully (evm target: paris).
```

**If errors occur:**
- Check that OpenZeppelin is installed
- Verify Solidity version matches (0.8.20)
- Read error messages carefully

---

### **Step 7: Deploy to Amoy**

Now deploy your contract:

```bash
npm run deploy:amoy
```

**Expected output:**
```
🚀 Starting deployment to Polygon Amoy testnet...

📍 Deploying with account: 0xb196D30a9EcFE72F91DF9e0B8ad7b2E3d8d065a0
💰 Account balance: 0.5 MATIC

📝 Deploying SubtextNFT contract...
✅ SubtextNFT deployed to: 0xABCDEF1234567890...
🔗 View on PolygonScan: https://amoy.polygonscan.com/address/0xABCDEF1234567890...

⏳ Waiting for block confirmations...
✅ Confirmed!

📋 Deployment Summary:
{
  "network": "polygon_amoy",
  "contractAddress": "0xABCDEF1234567890...",
  "deployer": "0xb196D30a9EcFE72F91DF9e0B8ad7b2E3d8d065a0",
  "transactionHash": "0x123abc...",
  "blockNumber": 12345678
}

🎉 Deployment complete!

📌 Next steps:
1. Update your .env file:
   EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xABCDEF1234567890...

2. Verify contract on PolygonScan:
   npx hardhat verify --network polygon_amoy 0xABCDEF1234567890...
```

**⚠️ If deployment fails:**
- Check you have test MATIC
- Verify private key is correct (64 characters, no spaces)
- Ensure you're connected to Amoy (check network in hardhat.config.js)
- Check error message for specific issue

---

### **Step 8: Update .env with New Contract Address**

**CRITICAL:** Update your `.env` with the newly deployed contract address:

```bash
# Replace the old Mumbai address with your new Amoy address
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourNewContractAddressFromDeployment
```

**Example:**
```bash
# Before
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xd9145CCE52D386f254917e481eB44e9943F39138

# After (use YOUR actual address from deployment)
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xABCDEF1234567890ABCDEF1234567890ABCDEF12
```

---

### **Step 9: Verify Contract on PolygonScan**

Make your contract code publicly viewable and trustworthy:

```bash
npm run verify:amoy YOUR_CONTRACT_ADDRESS
```

**Or manually:**
```bash
npx hardhat verify --network polygon_amoy 0xYourContractAddress
```

**Expected output:**
```
Successfully submitted source code for contract
contracts/SubtextNFT.sol:SubtextNFT at 0xYourContractAddress
for verification on the block explorer. Waiting for verification result...

Successfully verified contract SubtextNFT on Etherscan.
https://amoy.polygonscan.com/address/0xYourContractAddress#code
```

**Benefits of verification:**
- Users can see your source code
- Builds trust
- Enables direct contract interaction on PolygonScan
- Shows your contract is legitimate

---

### **Step 10: Test NFT Minting**

Now test the complete flow:

1. **Restart your app** (to load new contract address)
2. **Double-tap a card** → "Mint as NFT"
3. **Connect test wallet** (same wallet you deployed with)
4. **Mint NFT**
5. **Check transaction** on PolygonScan
6. **View NFT** in MetaMask

**Verify success:**
- [ ] Transaction appears on: `https://amoy.polygonscan.com/tx/YOUR_TX_HASH`
- [ ] NFT shows in MetaMask (may take 5-10 minutes)
- [ ] Database has record in `nft_mints` table
- [ ] App shows success message

---

## 🔍 Troubleshooting

### Error: "Insufficient funds"
**Solution:** Get more test MATIC from faucet

### Error: "Invalid private key"
**Solution:** 
- Remove "0x" prefix if present
- Ensure key is 64 characters
- No spaces or line breaks

### Error: "Contract already deployed"
**Solution:** 
- You can redeploy (will get new address)
- Or use existing address

### Error: "Network not available"
**Solution:**
- Check internet connection
- Verify Amoy RPC URL in hardhat.config.js
- Try alternative RPC: `https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY`

### Verification fails
**Solution:**
- Wait 1-2 minutes after deployment
- Ensure contract address is correct
- Check PolygonScan API key is valid
- Try manual verification on PolygonScan website

---

## 📊 Cost Estimate

**Deployment costs (test MATIC):**
- Contract deployment: ~0.01-0.03 MATIC
- Contract verification: FREE
- Each NFT mint: ~0.001-0.003 MATIC

**Total needed:** ~0.5 MATIC (what faucet gives you)

---

## 🎉 Success Checklist

After deployment, you should have:

- [ ] Contract deployed to Amoy
- [ ] Contract address updated in `.env`
- [ ] Contract verified on PolygonScan
- [ ] Successful test mint completed
- [ ] NFT visible in wallet
- [ ] Transaction on PolygonScan
- [ ] Database record created

---

## 🔒 Security Best Practices

**DO:**
- ✅ Use separate test wallet for deployment
- ✅ Keep private keys in `.env` (gitignored)
- ✅ Test thoroughly on Amoy before mainnet
- ✅ Verify contract on PolygonScan

**DON'T:**
- ❌ Commit `.env` to Git
- ❌ Share your private keys
- ❌ Use your main wallet for testing
- ❌ Skip verification step

---

## 🚀 Next Steps

**For Production (Mainnet):**

1. **Audit smart contract** (hire professional if handling real value)
2. **Thorough testing** on Amoy (mint, transfer, etc.)
3. **Update configuration:**
   ```bash
   EXPO_PUBLIC_BLOCKCHAIN_NETWORK=MATIC_MAINNET
   ```
4. **Deploy to mainnet:**
   ```bash
   npm run deploy:mainnet
   ```
5. **Get real MATIC** for gas fees
6. **Verify on mainnet PolygonScan**
7. **Update production .env**

---

## 📚 Useful Links

- **Amoy Faucet:** https://faucet.polygon.technology/
- **Amoy PolygonScan:** https://amoy.polygonscan.com/
- **PolygonScan API Keys:** https://polygonscan.com/myapikey
- **Polygon Docs:** https://docs.polygon.technology/
- **Hardhat Docs:** https://hardhat.org/docs
- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts/

---

## 🆘 Need Help?

**Common commands:**
```bash
# Compile contract
npm run compile:contract

# Deploy to Amoy
npm run deploy:amoy

# Verify contract
npm run verify:amoy CONTRACT_ADDRESS

# Check Hardhat version
npx hardhat --version

# Clean build artifacts
npx hardhat clean
```

**Check deployment status:**
```bash
# View your contract on PolygonScan
https://amoy.polygonscan.com/address/YOUR_CONTRACT_ADDRESS

# View transaction
https://amoy.polygonscan.com/tx/YOUR_TX_HASH

# Check wallet balance
https://amoy.polygonscan.com/address/YOUR_WALLET_ADDRESS
```

---

## ✅ You're Ready!

Everything is set up. Just follow the steps above to deploy your contract to Polygon Amoy testnet. Good luck! 🚀
