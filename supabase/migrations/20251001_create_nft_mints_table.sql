-- Create table for tracking NFT mints
CREATE TABLE IF NOT EXISTS nft_mints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  transaction_hash TEXT NOT NULL,
  image_nft_hash TEXT,
  card_nft_hash TEXT,
  image_token_id INTEGER,
  card_token_id INTEGER,
  contract_address TEXT,
  wallet_address TEXT NOT NULL,
  network TEXT DEFAULT 'MATIC_AMOY', -- MATIC_AMOY (testnet), MATIC_MAINNET (production)
  status TEXT DEFAULT 'pending', -- pending, confirmed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_nft_mints_user_id ON nft_mints(user_id);
CREATE INDEX IF NOT EXISTS idx_nft_mints_card_id ON nft_mints(card_id);
CREATE INDEX IF NOT EXISTS idx_nft_mints_transaction_hash ON nft_mints(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_nft_mints_status ON nft_mints(status);

-- Enable Row Level Security
ALTER TABLE nft_mints ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own NFT mints" ON nft_mints;
DROP POLICY IF EXISTS "Users can insert their own NFT mints" ON nft_mints;
DROP POLICY IF EXISTS "Users can update their own NFT mints" ON nft_mints;

-- RLS Policies: Users can only see and manage their own NFT mints
CREATE POLICY "Users can view their own NFT mints"
  ON nft_mints
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own NFT mints"
  ON nft_mints
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own NFT mints"
  ON nft_mints
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_nft_mints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trg_update_nft_mints_updated_at ON nft_mints;
CREATE TRIGGER trg_update_nft_mints_updated_at
  BEFORE UPDATE ON nft_mints
  FOR EACH ROW
  EXECUTE FUNCTION update_nft_mints_updated_at();

-- Add comment for documentation
COMMENT ON TABLE nft_mints IS 'Tracks NFT minting transactions for Subtext cards';
COMMENT ON COLUMN nft_mints.transaction_hash IS 'Primary blockchain transaction hash';
COMMENT ON COLUMN nft_mints.image_nft_hash IS 'Transaction hash for the image NFT';
COMMENT ON COLUMN nft_mints.card_nft_hash IS 'Transaction hash for the card metadata NFT';
COMMENT ON COLUMN nft_mints.network IS 'Blockchain network: MATIC_AMOY (testnet) or MATIC_MAINNET (production). Note: MATIC_MUMBAI deprecated April 2024';
COMMENT ON COLUMN nft_mints.status IS 'Minting status: pending, confirmed, or failed';
