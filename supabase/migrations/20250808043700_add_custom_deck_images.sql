-- Add custom_deck_images column to users table
-- This will store custom images for phenomena deck covers

-- Add the column
ALTER TABLE users 
ADD COLUMN custom_deck_images JSONB DEFAULT '{}';

-- Add an index for better query performance
CREATE INDEX idx_users_custom_deck_images ON users USING GIN (custom_deck_images);

-- Add a comment to document the column
COMMENT ON COLUMN users.custom_deck_images IS 'Stores custom images for phenomena deck covers as key-value pairs where key is phenomena type and value is image URI';
