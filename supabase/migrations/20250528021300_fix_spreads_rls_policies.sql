-- Fix RLS policies for spreads table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can insert own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can update own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can delete own spreads" ON spreads;

-- Enable RLS on spreads table
ALTER TABLE spreads ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own spreads
CREATE POLICY "Users can view own spreads" ON spreads
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy: Users can insert their own spreads
CREATE POLICY "Users can insert own spreads" ON spreads
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own spreads
CREATE POLICY "Users can update own spreads" ON spreads
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own spreads
CREATE POLICY "Users can delete own spreads" ON spreads
    FOR DELETE
    USING (auth.uid() = user_id);

-- Also ensure the user_id column has a default value if not already set
-- This helps when inserting new records
ALTER TABLE spreads 
ALTER COLUMN user_id SET DEFAULT auth.uid();
