-- Add new columns for server-side NFT minting
-- These columns store IPFS URIs for better tracking

-- Add metadata_uri column to store the IPFS URI of the NFT metadata
ALTER TABLE nft_mints 
ADD COLUMN IF NOT EXISTS metadata_uri TEXT;

-- Add image_ipfs_uri column to store the IPFS URI of the card image
ALTER TABLE nft_mints 
ADD COLUMN IF NOT EXISTS image_ipfs_uri TEXT;

-- Add policy to allow service role to insert (for Edge Function)
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS,
-- but we add this policy for completeness
DROP POLICY IF EXISTS "Service role can insert NFT mints" ON nft_mints;
CREATE POLICY "Service role can insert NFT mints"
  ON nft_mints
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comments for new columns
COMMENT ON COLUMN nft_mints.metadata_uri IS 'IPFS URI for the NFT metadata JSON';
COMMENT ON COLUMN nft_mints.image_ipfs_uri IS 'IPFS URI for the card image';
