/*
  # Add text color customization columns

  1. Changes
    - Add columns for text color customization
    - Set default colors for each text element
    - Update existing cards with default values

  2. Details
    - name_color: Color for the card name
    - type_color: Color for the card type text
    - description_color: Color for the card description
    - context_color: Color for the context/flavor text
*/

ALTER TABLE cards
ADD COLUMN name_color text DEFAULT '#FFFFFF',
ADD COLUMN type_color text DEFAULT '#FFFFFF',
ADD COLUMN description_color text DEFAULT '#FFFFFF',
ADD COLUMN context_color text DEFAULT '#CCCCCC';

-- Update existing cards to use the default values
UPDATE cards SET 
  name_color = '#FFFFFF',
  type_color = '#FFFFFF',
  description_color = '#FFFFFF',
  context_color = '#CCCCCC'
WHERE name_color IS NULL 
   OR type_color IS NULL 
   OR description_color IS NULL 
   OR context_color IS NULL;

-- Make the columns non-nullable after setting defaults
ALTER TABLE cards 
  ALTER COLUMN name_color SET NOT NULL,
  ALTER COLUMN type_color SET NOT NULL,
  ALTER COLUMN description_color SET NOT NULL,
  ALTER COLUMN context_color SET NOT NULL;