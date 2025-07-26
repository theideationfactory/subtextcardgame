-- Fix infinite recursion in spreads RLS policies
-- Date: 2025-07-26T13:34:00-05:00
-- Purpose: Resolve RLS policy conflicts causing infinite recursion

-- Drop all existing policies on spreads table to start fresh
DROP POLICY IF EXISTS "Users can view own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can insert own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can update own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can delete own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can view spreads shared with them" ON spreads;
DROP POLICY IF EXISTS "Users can read own spreads" ON spreads;
DROP POLICY IF EXISTS "Users can create spreads" ON spreads;

-- Enable RLS on spreads table
ALTER TABLE spreads ENABLE ROW LEVEL SECURITY;

-- Create unified policy for SELECT: Users can view their own spreads OR spreads shared with them
CREATE POLICY "Users can view own and shared spreads" ON spreads
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR
        (share_with_specific_friends = true AND auth.uid() = ANY(shared_with_user_ids))
    );

-- Create policy for INSERT: Users can only insert their own spreads
CREATE POLICY "Users can insert own spreads" ON spreads
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Create policy for UPDATE: Users can only update their own spreads
CREATE POLICY "Users can update own spreads" ON spreads
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create policy for DELETE: Users can only delete their own spreads
CREATE POLICY "Users can delete own spreads" ON spreads
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Ensure user_id column has default value for new records
ALTER TABLE spreads 
ALTER COLUMN user_id SET DEFAULT auth.uid();
