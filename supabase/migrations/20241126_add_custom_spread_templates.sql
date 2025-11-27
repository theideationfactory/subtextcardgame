-- Create table for storing custom spread templates
CREATE TABLE IF NOT EXISTS custom_spread_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  zones JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_custom_spread_templates_user_id ON custom_spread_templates(user_id);
CREATE INDEX idx_custom_spread_templates_is_public ON custom_spread_templates(is_public);
CREATE INDEX idx_custom_spread_templates_created_at ON custom_spread_templates(created_at);

-- Add RLS policies
ALTER TABLE custom_spread_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view own custom spread templates" ON custom_spread_templates
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view public templates
CREATE POLICY "Users can view public custom spread templates" ON custom_spread_templates
  FOR SELECT USING (is_public = true);

-- Users can insert their own templates
CREATE POLICY "Users can create custom spread templates" ON custom_spread_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own custom spread templates" ON custom_spread_templates
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own custom spread templates" ON custom_spread_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_spread_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_custom_spread_templates_updated_at
  BEFORE UPDATE ON custom_spread_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_spread_templates_updated_at();

-- Add comment to table
COMMENT ON TABLE custom_spread_templates IS 'Stores user-created custom spread templates that can be reused';

-- Add comments to columns
COMMENT ON COLUMN custom_spread_templates.zones IS 'JSONB array containing zone configuration: [{"id": "uuid", "name": "zone_name", "title": "Zone Title", "description": "Zone description", "color": "#hexcolor", "icon": "IconName"}]';
COMMENT ON COLUMN custom_spread_templates.is_public IS 'Whether this template can be viewed and used by other users';
