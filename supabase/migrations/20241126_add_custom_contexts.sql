-- Add custom_contexts column to users table to support dynamic contexts in card creation

-- Add custom contexts column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS custom_contexts JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN users.custom_contexts IS 'User-defined custom context options for card creation';

-- Add GIN index for efficient JSON operations (if not already exists)
CREATE INDEX IF NOT EXISTS idx_users_custom_contexts 
ON users USING GIN (custom_contexts);
