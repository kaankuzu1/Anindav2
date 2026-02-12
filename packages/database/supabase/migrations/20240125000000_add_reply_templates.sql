-- Migration: Add reply_templates table for quick reply functionality
-- Date: 2024-01-25

-- Create reply_templates table
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  intent_type VARCHAR(50),
  shortcut_number INTEGER CHECK (shortcut_number >= 1 AND shortcut_number <= 9),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_team_shortcut UNIQUE(team_id, shortcut_number)
);

-- Create indexes for performance
CREATE INDEX idx_reply_templates_team_id ON reply_templates(team_id);
CREATE INDEX idx_reply_templates_intent_type ON reply_templates(intent_type);

-- Enable Row Level Security
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Team members can view their team's templates
CREATE POLICY "Team members can view templates"
  ON reply_templates FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Team admins and owners can insert templates
CREATE POLICY "Team admins can insert templates"
  ON reply_templates FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policy: Team admins and owners can update templates
CREATE POLICY "Team admins can update templates"
  ON reply_templates FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policy: Team admins and owners can delete templates
CREATE POLICY "Team admins can delete templates"
  ON reply_templates FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_reply_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reply_templates_updated_at
  BEFORE UPDATE ON reply_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_templates_updated_at();

-- Comments for documentation
COMMENT ON TABLE reply_templates IS 'Quick reply templates for fast responses to leads';
COMMENT ON COLUMN reply_templates.shortcut_number IS 'Keyboard shortcut (Cmd/Ctrl + number) to quickly insert this template';
COMMENT ON COLUMN reply_templates.intent_type IS 'Default template for this reply intent (interested, question, etc.)';
