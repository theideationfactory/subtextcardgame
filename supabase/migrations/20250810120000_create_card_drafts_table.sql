-- Create card_drafts table for saving card creation drafts
CREATE TABLE IF NOT EXISTS card_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_description TEXT,
    type TEXT NOT NULL,
    role TEXT,
    context TEXT,
    image_url TEXT,
    format TEXT DEFAULT 'fullBleed',
    background_gradient TEXT,
    border_style TEXT DEFAULT 'Classic',
    border_color TEXT DEFAULT '#808080',
    visibility TEXT[] DEFAULT ARRAY['personal'],
    is_uploaded_image BOOLEAN DEFAULT FALSE,
    draft_type TEXT DEFAULT 'card',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_card_drafts_user_id ON card_drafts(user_id);
CREATE INDEX idx_card_drafts_last_modified ON card_drafts(last_modified DESC);
CREATE INDEX idx_card_drafts_draft_type ON card_drafts(draft_type);

-- Enable Row Level Security
ALTER TABLE card_drafts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own drafts
CREATE POLICY "Users can view own card drafts" ON card_drafts
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own drafts
CREATE POLICY "Users can insert own card drafts" ON card_drafts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own drafts
CREATE POLICY "Users can update own card drafts" ON card_drafts
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own drafts
CREATE POLICY "Users can delete own card drafts" ON card_drafts
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update last_modified
CREATE OR REPLACE FUNCTION update_card_draft_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_card_draft_last_modified
    BEFORE UPDATE ON card_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_card_draft_last_modified();
