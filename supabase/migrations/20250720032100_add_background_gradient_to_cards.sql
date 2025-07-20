-- Add background_gradient column to cards table
-- This will store the gradient colors as a JSON string

ALTER TABLE cards 
ADD COLUMN background_gradient TEXT DEFAULT '["#6366f1","#8b5cf6"]';

-- Add a comment to document the column
COMMENT ON COLUMN cards.background_gradient IS 'JSON string containing gradient colors array for card background';

-- Create a B-tree index for potential future queries on background gradient
CREATE INDEX idx_cards_background_gradient ON cards (background_gradient);
