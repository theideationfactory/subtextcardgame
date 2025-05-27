/*
  # Update spreads table with draft functionality

  1. Changes
    - Add columns for draft functionality if they don't exist
    - Create trigger for last_modified updates
    - Add indexes for better performance
    - Update policies for draft management

  2. Security
    - Maintain existing RLS policies
    - Add safe column checks
*/

-- Safely add new columns if they don't exist
DO $$ 
BEGIN
  -- Add is_draft column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'spreads' 
    AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE spreads
    ADD COLUMN is_draft boolean DEFAULT true;
  END IF;

  -- Add last_modified column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'spreads' 
    AND column_name = 'last_modified'
  ) THEN
    ALTER TABLE spreads
    ADD COLUMN last_modified timestamptz DEFAULT now();
  END IF;

  -- Add draft_data column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'spreads' 
    AND column_name = 'draft_data'
  ) THEN
    ALTER TABLE spreads
    ADD COLUMN draft_data jsonb;
  END IF;
END $$;

-- Create or replace function to automatically update last_modified
CREATE OR REPLACE FUNCTION update_spread_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'update_spread_modified'
  ) THEN
    CREATE TRIGGER update_spread_modified
      BEFORE UPDATE ON spreads
      FOR EACH ROW
      EXECUTE FUNCTION update_spread_last_modified();
  END IF;
END $$;

-- Update existing spreads to not be drafts
UPDATE spreads 
SET is_draft = false 
WHERE zones IS NOT NULL AND zones != '[]'::jsonb;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'spreads' 
    AND indexname = 'idx_spreads_is_draft'
  ) THEN
    CREATE INDEX idx_spreads_is_draft ON spreads(is_draft);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'spreads' 
    AND indexname = 'idx_spreads_last_modified'
  ) THEN
    CREATE INDEX idx_spreads_last_modified ON spreads(last_modified);
  END IF;
END $$;

-- Update the spreads policies
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