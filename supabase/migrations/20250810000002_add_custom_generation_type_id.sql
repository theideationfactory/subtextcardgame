-- Add custom_generation_type_id column to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS custom_generation_type_id UUID REFERENCES custom_generation_types(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cards_custom_generation_type_id ON cards(custom_generation_type_id);

-- Add comment to document the purpose
COMMENT ON COLUMN cards.custom_generation_type_id IS 'References the custom generation type used to create this card, if applicable';
