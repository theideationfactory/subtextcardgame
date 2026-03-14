-- Add generation_type column to cards table to track which generation method was used
-- Values: 'legacy', 'premium', 'classic', 'modern_parchment', 'custom'

ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS generation_type text DEFAULT 'premium';

-- Create index for queries filtering by generation type
CREATE INDEX IF NOT EXISTS idx_cards_generation_type ON public.cards(generation_type);

COMMENT ON COLUMN public.cards.generation_type IS 'The generation type used to create this card: legacy, premium, classic, modern_parchment, or custom';
