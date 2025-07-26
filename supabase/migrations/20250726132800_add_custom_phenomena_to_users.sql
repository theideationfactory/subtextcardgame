-- Migration: Add custom phenomena types to users table
-- Date: 2025-07-26T13:28:00-05:00
-- Purpose: Store custom phenomena types in the database for cross-device sync

-- Add custom_phenomena_types column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS custom_phenomena_types jsonb DEFAULT '["Intention", "Context", "Impact", "Accuracy", "Agenda", "Needs", "Emotion", "Role"]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN users.custom_phenomena_types IS 'Array of custom phenomena types created by the user for card creation';

-- Create index for performance when querying custom phenomena types
CREATE INDEX IF NOT EXISTS idx_users_custom_phenomena_types ON users USING gin (custom_phenomena_types);

-- Update existing users to have the default phenomena types if they don't have any
UPDATE users 
SET custom_phenomena_types = '["Intention", "Context", "Impact", "Accuracy", "Agenda", "Needs", "Emotion", "Role"]'::jsonb
WHERE custom_phenomena_types IS NULL;

-- Note: RLS policies for users table should already exist from previous migrations
-- If needed, these policies can be added separately:
-- CREATE POLICY "Users can update their own custom phenomena types" ON users FOR UPDATE TO authenticated USING (auth.uid() = id);
-- CREATE POLICY "Users can read their own custom phenomena types" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
