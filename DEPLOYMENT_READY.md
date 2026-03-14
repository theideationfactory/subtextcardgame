# ✅ Deployment Setup Complete!

## 🎉 What I've Created for You

Based on 2025 best practices for Polygon Amoy deployment, I've set up:

### **Files Created:**
1. ✅ `hardhat.config.js` - Hardhat configuration for Amoy & Mainnet
2. ✅ `scripts/deploy.js` - Professional deployment script with detailed logging
3. ✅ `docs/DEPLOY_AMOY_2025.md` - Complete step-by-step deployment guide
4. ✅ Updated `package.json` - Added deployment commands
5. ✅ Updated `.env` - Added deployment variables (need your keys)

### **Configuration Details:**
- **Network:** Polygon Amoy (Chain ID: 80002)
- **RPC:** https://rpc-amoy.polygon.technology
- **Solidity Version:** 0.8.20 (matches your contract)
- **Explorer:** https://amoy.polygonscan.com/

---

## 🚀 Quick Start (What YOU Need to Do)

### **1. Install Dependencies** (5 minutes)
```bash
npm install --save-dev hardhat @openzeppelin/contracts @nomicfoundation/hardhat-toolbox @nomiclabs/hardhat-ethers @nomiclabs/hardhat-etherscan dotenv
```

### **2. Get Keys** (10 minutes)
- **Private Key:** From MetaMask test wallet → `.env` (DEPLOYER_PRIVATE_KEY)
- **PolygonScan API Key:** From https://polygonscan.com/myapikey → `.env` (POLYGONSCAN_API_KEY)

### **3. Get Test MATIC** (2 minutes)
- Visit: https://faucet.polygon.technology/
- Request test MATIC for your deployer wallet

### **4. Deploy** (2 minutes)
```bash
npm run deploy:amoy
```

### **5. Update .env** (1 minute)
```bash
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourNewContractAddress
```

### **6. Verify** (1 minute)
```bash
npm run verify:amoy YOUR_CONTRACT_ADDRESS
```

**Total Time: ~20 minutes** ⏱️

---

## 📖 Detailed Instructions

For step-by-step instructions with screenshots and troubleshooting:

👉 **Read:** `docs/DEPLOY_AMOY_2025.md`

---

## 🎯 What Happens When You Deploy?

1. **Compilation:** Your SubtextNFT.sol gets compiled
2. **Deployment:** Contract deployed to Amoy blockchain
3. **Confirmation:** Transaction confirmed (5 blocks)
4. **Output:** You get new contract address
5. **Verification:** Source code published to PolygonScan
6. **Integration:** Update .env, restart app, test minting!

---

## 📊 Files Structure

```
subtextcardgame-inbox/
├── hardhat.config.js          ← Hardhat configuration
├── scripts/
│   └── deploy.js              ← Deployment script
├── contracts/
│   └── SubtextNFT.sol         ← Your NFT contract
├── docs/
│   ├── DEPLOY_AMOY_2025.md    ← Detailed guide
│   └── AMOY_TESTNET_MIGRATION_GUIDE.md
├── .env                       ← Add your keys here
└── package.json               ← Updated with deploy commands
```

---

## 🔑 Required Environment Variables

Update your `.env` file with:

```bash
# Already set (from before)
EXPO_PUBLIC_ALCHEMY_API_KEY=z4GhJrV7w-x06DA-RH69EKuIZrhtgHgr
EXPO_PUBLIC_PINATA_API_KEY=fd7efc0e9bf58c4fca92
EXPO_PUBLIC_PINATA_SECRET_KEY=cf7a87f8cfb9f7b78fafd342fbfd821428c10d03a90c0a054790195d6924f9de

# Need to update (old Mumbai address)
EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourNewAmoyContractAddress

# Need to add (for deployment)
DEPLOYER_PRIVATE_KEY=YourTestWalletPrivateKey
POLYGONSCAN_API_KEY=YourPolygonScanAPIKey
```

---

## 🛠️ NPM Commands Available

```bash
# Deploy to Amoy testnet
npm run deploy:amoy

# Deploy to Polygon mainnet (when ready)
npm run deploy:mainnet

# Verify contract on Amoy
npm run verify:amoy CONTRACT_ADDRESS

# Compile contract
npm run compile:contract

# Run contract tests
npm run test:contract
```

---

## ⚠️ Important Notes

### **Security:**
- ✅ Never commit `.env` to Git
- ✅ Use separate test wallet for deployment
- ✅ Never use real funds on testnet
- ✅ Private keys should never be shared

### **Testing:**
- ✅ Test thoroughly on Amoy before mainnet
- ✅ Verify contract code on PolygonScan
- ✅ Complete at least 5 test mints
- ✅ Check NFTs appear in wallet

### **Production:**
- ⚠️ Audit smart contract before mainnet
- ⚠️ Test all functions on Amoy first
- ⚠️ Have real MATIC ready for gas
- ⚠️ Update all environment variables

---

## 📞 Next Steps

**Ready to deploy?**

1. Read `docs/DEPLOY_AMOY_2025.md` (comprehensive guide)
2. Follow the 6 quick start steps above
3. Test your first NFT mint!

**Questions?**
- Check troubleshooting section in the deployment guide
- Verify all prerequisites are met
- Review error messages carefully

---

## 🎓 What You'll Learn

By deploying this contract, you'll learn:
- ✅ Hardhat development workflow
- ✅ Smart contract deployment process
- ✅ Blockchain networks (testnet vs mainnet)
- ✅ Contract verification on block explorers
- ✅ Gas fees and transaction management
- ✅ NFT smart contract interaction

---

## 🎉 Ready When You Are!

Everything is set up and ready to go. Just follow the Quick Start steps above, and you'll have your SubtextNFT contract deployed on Polygon Amoy in about 20 minutes!

**Good luck! 🚀**
