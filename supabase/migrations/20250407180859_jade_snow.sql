/*
  # Fix spreads table draft data structure

  1. Changes
    - Add proper JSON validation for draft_data column
    - Update trigger function to handle JSON data properly
    - Add index for faster draft type queries

  2. Security
    - Maintain existing RLS policies
*/

-- Add check constraint for draft_data structure
ALTER TABLE spreads
ADD CONSTRAINT spreads_draft_data_check
CHECK (
  (NOT is_draft) OR
  (
    is_draft AND
    draft_data ? 'type' AND
    draft_data ? 'zoneCards' AND
    jsonb_typeof(draft_data->'type') = 'string' AND
    jsonb_typeof(draft_data->'zoneCards') = 'object'
  )
);

-- Create index for draft type queries
CREATE INDEX idx_spreads_draft_type ON spreads ((draft_data->>'type')) WHERE is_draft = true;

-- Update trigger function to validate draft data
CREATE OR REPLACE FUNCTION update_spread_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_draft AND (
    NEW.draft_data IS NULL OR
    NOT (
      NEW.draft_data ? 'type' AND
      NEW.draft_data ? 'zoneCards' AND
      jsonb_typeof(NEW.draft_data->'type') = 'string' AND
      jsonb_typeof(NEW.draft_data->'zoneCards') = 'object'
    )
  ) THEN
    RAISE EXCEPTION 'Invalid draft data structure';
  END IF;
  
  NEW.last_modified = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;