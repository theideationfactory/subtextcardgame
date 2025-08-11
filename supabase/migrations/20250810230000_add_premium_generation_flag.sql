-- Add is_premium_generation column to cards table
-- This flag indicates whether the card image was generated using the premium generation method

ALTER TABLE cards 
ADD COLUMN is_premium_generation BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN cards.is_premium_generation IS 'Flag indicating if card image was generated using premium generation method (clean artwork without text overlays)';

-- Create index for potential queries filtering by generation type
CREATE INDEX idx_cards_premium_generation ON cards(is_premium_generation);
