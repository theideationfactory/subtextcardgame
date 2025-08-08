-- Add custom_detail_images column to users table
-- This stores per-phenomena per-option custom image URLs
-- Structure example:
-- {
--   "Intention": { "Request": "https://.../img1.jpg" },
--   "Role": { "Advisor": "https://.../img2.jpg" }
-- }

BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS custom_detail_images JSONB DEFAULT '{}';

-- GIN index to speed up JSONB lookups
CREATE INDEX IF NOT EXISTS idx_users_custom_detail_images ON users USING GIN (custom_detail_images);

COMMENT ON COLUMN users.custom_detail_images IS 'Stores custom images for detail options as nested JSON per phenomena type';

COMMIT;
