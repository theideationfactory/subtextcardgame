-- Migration: Add custom detail options for phenomena types
-- Date: 2025-08-03T04:29:50-05:00
-- Purpose: Allow users to create custom detail options for each phenomena type

-- Add custom_detail_options column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS custom_detail_options jsonb DEFAULT '{}'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN users.custom_detail_options IS 'Object mapping phenomena types to arrays of custom detail options created by the user';

-- Create index for performance when querying custom detail options
CREATE INDEX IF NOT EXISTS idx_users_custom_detail_options ON users USING gin (custom_detail_options);

-- Update existing users to have empty custom detail options if they don't have any
UPDATE users 
SET custom_detail_options = '{}'::jsonb
WHERE custom_detail_options IS NULL;

-- Example of the JSON structure:
-- {
--   "Intention": ["Custom Option 1", "Custom Option 2"],
--   "Context": ["My Context Option"],
--   "Role": []
-- }

-- Note: RLS policies for users table should already exist from previous migrations
-- Custom detail options will be read/updated through existing user policies
