-- Check and fix spreads table structure
-- This migration ensures all necessary columns exist and have proper defaults

-- Add is_draft column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'spreads' 
        AND column_name = 'is_draft'
    ) THEN
        ALTER TABLE spreads ADD COLUMN is_draft BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add last_modified column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'spreads' 
        AND column_name = 'last_modified'
    ) THEN
        ALTER TABLE spreads ADD COLUMN last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create an update trigger for last_modified
DROP TRIGGER IF EXISTS update_spreads_last_modified ON spreads;

CREATE OR REPLACE FUNCTION update_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_spreads_last_modified 
    BEFORE UPDATE ON spreads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_last_modified_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_spreads_user_id ON spreads(user_id);
CREATE INDEX IF NOT EXISTS idx_spreads_last_modified ON spreads(last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_spreads_is_draft ON spreads(is_draft);
