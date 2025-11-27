-- Add image_description column to cards table to support persistent image descriptions

-- Add image description column
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS image_description TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN cards.image_description IS 'User-defined image description used for card generation and editing';

-- Add index for potential searching/filtering (optional)
CREATE INDEX IF NOT EXISTS idx_cards_image_description 
ON cards USING btree (image_description) TABLESPACE pg_default;
