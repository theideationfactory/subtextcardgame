# Server-Side NFT Minting Setup

## Overview

The Subtext app uses a **custodial minting** model where all NFTs are minted through a single app-owned wallet. This creates a definitive, unified collection for all Subtext cards on the blockchain.

## Benefits

- **Zero friction for users**: No wallet setup, no gas fees, no crypto knowledge needed
- **Definitive provenance**: Every Subtext card has the same creator address = verifiable authenticity
- **Consistent metadata**: App controls the minting format and quality
- **Central tracking**: One place to see all minted cards
- **Brand identity**: "Official Subtext Collection" on OpenSea

---

## Required Supabase Secrets

You need to configure these secrets in your Supabase Dashboard:

**Navigate to:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `APP_WALLET_PRIVATE_KEY` | Private key for the app's minting wallet (WITHOUT 0x prefix) | `968bf466de8bb4583825210774cbaaed54a401662a66f7485a0c3060f75e21b1` |
| `NFT_CONTRACT_ADDRESS` | Deployed SubtextNFT contract address | `0x53f23561863c3b3f8e7a4ac1e104f2ff19498e7d` |
| `ALCHEMY_API_KEY` | Alchemy API key for blockchain RPC | `your-alchemy-api-key` |
| `PINATA_API_KEY` | Pinata API key for IPFS uploads | `your-pinata-api-key` |
| `PINATA_SECRET_KEY` | Pinata secret key for IPFS uploads | `your-pinata-secret-key` |
| `BLOCKCHAIN_NETWORK` | Network to use: `amoy` (testnet) or `mainnet` | `amoy` |

### Setting Up Secrets

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Add each secret listed above

---

## App Wallet Setup

### Creating a New Wallet (if needed)

```javascript
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

### Funding the Wallet

**For Amoy Testnet:**
1. Get test POL from: https://www.alchemy.com/faucets/polygon-amoy
2. Need ~0.05 POL to start minting

**For Polygon Mainnet:**
1. Purchase MATIC/POL on an exchange
2. Transfer to your app wallet address
3. Recommend starting with 10-20 MATIC ($5-10)

---

## User Experience

### Before (Client-Side Minting)
1. User taps "Mint NFT"
2. Prompted to enter private key
3. Wallet connects
4. User confirms transaction
5. Waits for blockchain confirmation
6. NFT appears in user's wallet

### After (Server-Side Minting)
1. User taps "Mint NFT"
2. Confirmation dialog: "Mint to official Subtext collection?"
3. Server mints NFT (30-60 seconds)
4. Success message with user's email and token ID
5. Links to view on Polygonscan/OpenSea

---

## Technical Architecture

```
User taps "Mint NFT"
       ↓
Confirmation Alert
       ↓
supabase.functions.invoke('mint-nft')
       ↓
Edge Function (holds private key securely)
       ↓
1. Fetch card data from database
2. Download card image
3. Upload to IPFS via Pinata
4. Create & upload NFT metadata
5. Mint NFT on Polygon blockchain
6. Save record to nft_mints table
       ↓
Return success with token ID, URLs
       ↓
Show success message with user's email
```

---

## Database Table: nft_mints

The Edge Function saves mint records to this table:

```sql
CREATE TABLE IF NOT EXISTS nft_mints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  card_id UUID REFERENCES cards(id),
  transaction_hash TEXT,
  image_nft_hash TEXT,
  card_nft_hash TEXT,
  image_token_id INTEGER,
  card_token_id INTEGER,
  contract_address TEXT,
  wallet_address TEXT,
  network TEXT,
  status TEXT DEFAULT 'pending',
  metadata_uri TEXT,
  image_ipfs_uri TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Deploying the Edge Function

```bash
# From project root
supabase functions deploy mint-nft
```

---

## Cost Analysis

**Per NFT Mint:**
- IPFS Storage (Pinata): ~$0.001 (free tier covers most usage)
- Gas Fees (Polygon): ~$0.01-0.05

**Monthly Estimates:**
- 100 mints: ~$1-5
- 1,000 mints: ~$10-50
- 10,000 mints: ~$100-500

---

## Security Considerations

✅ **Implemented:**
- Private key stored as Supabase secret (never in client code)
- Server-side minting only
- User authentication required
- Card ownership verified before minting
- Duplicate mint prevention

⚠️ **For Production:**
- Rate limiting (prevent abuse)
- Monitoring and alerting
- Wallet balance monitoring
- Legal terms of service

---

## Troubleshooting

### "APP_WALLET_PRIVATE_KEY not configured"
Add the secret in Supabase Dashboard → Project Settings → Edge Functions → Secrets

### "Insufficient funds"
Fund the app wallet with POL/MATIC:
- Amoy: https://www.alchemy.com/faucets/polygon-amoy
- Mainnet: Transfer MATIC from exchange

### "Card not found"
Ensure the card exists and belongs to the requesting user

### "Already minted"
Each card can only be minted once. The function checks for existing mints.

---

## Files

- **Edge Function:** `supabase/functions/mint-nft/index.ts`
- **Client Code:** `app/(tabs)/index.tsx` - `handleMintNFT` and `mintCardAsNFT`
- **Contract ABI:** `app/services/abi/SubtextNFT.json`
- **Contract Source:** `contracts/SubtextNFT.sol`

---

## Next Steps

1. ✅ Add Supabase secrets (see table above)
2. ✅ Deploy Edge Function: `supabase functions deploy mint-nft`
3. ✅ Fund app wallet with POL
4. ✅ Test minting a card
5. ✅ Verify on Polygonscan
