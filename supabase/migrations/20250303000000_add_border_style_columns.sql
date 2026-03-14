-- Add custom_border_styles column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS custom_border_styles TEXT[] DEFAULT '{}';

-- Add border_style column to cards table
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS border_style TEXT DEFAULT 'Classic';

-- Create index for border_style column for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_border_style ON cards(border_style);

-- Add comment to document the new columns
COMMENT ON COLUMN users.custom_border_styles IS 'Array of custom border style names created by the user';
COMMENT ON COLUMN cards.border_style IS 'Border style selected for the card (Classic, Modern, Vintage, etc.)';
