-- Create simplified custom generation types table
CREATE TABLE IF NOT EXISTS custom_generation_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    theme TEXT NOT NULL,
    special_instructions TEXT,
    is_active BOOLEAN DEFAULT true,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_custom_generation_types_user_id ON custom_generation_types(user_id);
CREATE INDEX idx_custom_generation_types_active ON custom_generation_types(is_active);
CREATE INDEX idx_custom_generation_types_created_at ON custom_generation_types(created_at);

-- Enable Row Level Security
ALTER TABLE custom_generation_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own custom generation types
CREATE POLICY "Users can view own custom generation types" ON custom_generation_types
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own custom generation types
CREATE POLICY "Users can insert own custom generation types" ON custom_generation_types
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own custom generation types
CREATE POLICY "Users can update own custom generation types" ON custom_generation_types
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own custom generation types
CREATE POLICY "Users can delete own custom generation types" ON custom_generation_types
    FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_custom_generation_types_updated_at
    BEFORE UPDATE ON custom_generation_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add validation constraints
ALTER TABLE custom_generation_types 
    ADD CONSTRAINT check_name_not_empty CHECK (length(trim(name)) > 0),
    ADD CONSTRAINT check_theme_not_empty CHECK (length(trim(theme)) > 0);
