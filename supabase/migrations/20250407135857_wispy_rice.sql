/*
  # Add draft functionality to spreads

  1. Changes
    - Add is_draft column to spreads table
    - Add last_modified column for sorting drafts
    - Add draft_data column to store incomplete spread data
    - Update existing policies to handle drafts

  2. Security
    - Maintain existing RLS policies
    - Add specific policies for draft handling
*/

-- Add new columns to spreads table
ALTER TABLE spreads
ADD COLUMN is_draft boolean DEFAULT true,
ADD COLUMN last_modified timestamptz DEFAULT now(),
ADD COLUMN draft_data jsonb;

-- Create function to automatically update last_modified
CREATE OR REPLACE FUNCTION update_spread_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_modified on any change
CREATE TRIGGER update_spread_modified
    BEFORE UPDATE ON spreads
    FOR EACH ROW
    EXECUTE FUNCTION update_spread_last_modified();

-- Update existing spreads to not be drafts
UPDATE spreads 
SET is_draft = false 
WHERE zones IS NOT NULL AND zones != '[]'::jsonb;

-- Add index for faster draft queries
CREATE INDEX idx_spreads_is_draft ON spreads(is_draft);
CREATE INDEX idx_spreads_last_modified ON spreads(last_modified);

-- Update the spreads policies to handle drafts
DROP POLICY IF EXISTS "Users can read own spreads" ON spreads;
CREATE POLICY "Users can read own spreads"
  ON spreads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create spreads"
  ON spreads;
CREATE POLICY "Users can create spreads"
  ON spreads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own spreads"
  ON spreads;
CREATE POLICY "Users can update own spreads"
  ON spreads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own spreads"
  ON spreads;
CREATE POLICY "Users can delete own spreads"
  ON spreads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);