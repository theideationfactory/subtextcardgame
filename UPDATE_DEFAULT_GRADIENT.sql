-- Update the default value for background_gradient column to use black gradient
-- Run this in the Supabase Dashboard SQL Editor

-- Update the column default value
ALTER TABLE cards 
ALTER COLUMN background_gradient SET DEFAULT '["#1a1a1a","#000000"]';

-- Optionally, update existing cards that have the old default purple gradient to the new black default
-- (This will only affect cards that were created with the old default, not cards where users explicitly chose purple)
UPDATE cards 
SET background_gradient = '["#1a1a1a","#000000"]'
WHERE background_gradient = '["#6366f1","#8b5cf6"]';

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'cards' AND column_name = 'background_gradient';
