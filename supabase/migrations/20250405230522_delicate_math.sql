/*
  # Add frame customization fields to cards table

  1. Changes
    - Add frame_width column for custom border width
    - Add frame_color column for custom border color
    - Set default values for backwards compatibility

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE cards
ADD COLUMN frame_width integer DEFAULT 8,
ADD COLUMN frame_color text DEFAULT '#FFD700';

-- Update existing cards to use the default values
UPDATE cards SET 
  frame_width = 8,
  frame_color = '#FFD700'
WHERE frame_width IS NULL OR frame_color IS NULL;

-- Make the columns non-nullable after setting defaults
ALTER TABLE cards 
  ALTER COLUMN frame_width SET NOT NULL,
  ALTER COLUMN frame_color SET NOT NULL;