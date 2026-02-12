-- ================================================
-- Migration 1: Reply Templates
-- ================================================

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

-- ================================================
-- Migration 2: Tracking Domain & Future Features
-- ================================================

-- Add tracking domain columns to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tracking_domain VARCHAR(255);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tracking_domain_verified BOOLEAN DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tracking_domain_verified_at TIMESTAMPTZ;

-- Create index for tracking domain lookups
CREATE INDEX IF NOT EXISTS idx_teams_tracking_domain ON teams(tracking_domain) WHERE tracking_domain IS NOT NULL;

-- Add external warmup integration columns (Phase 2.3 prep)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS warmup_mode VARCHAR(50) DEFAULT 'internal';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS warmup_inbox_api_key_encrypted TEXT;

-- Add Apollo integration columns (Phase 3 prep)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS apollo_api_key_encrypted TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS apollo_credits_remaining INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS apollo_credits_updated_at TIMESTAMPTZ;

-- Add calendar integration columns (Phase 4 prep)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS calendar_api_key_encrypted TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS calendar_scheduling_url TEXT;

-- Comments for documentation
COMMENT ON COLUMN teams.tracking_domain IS 'Custom domain for tracking pixels and links (e.g., track.company.com)';
COMMENT ON COLUMN teams.tracking_domain_verified IS 'Whether the CNAME record has been verified';
COMMENT ON COLUMN teams.tracking_domain_verified_at IS 'When the tracking domain was verified';
COMMENT ON COLUMN teams.warmup_mode IS 'Warmup mode: internal (default) or external (Warmup Inbox API)';
COMMENT ON COLUMN teams.warmup_inbox_api_key_encrypted IS 'Encrypted API key for Warmup Inbox external service';
COMMENT ON COLUMN teams.apollo_api_key_encrypted IS 'Encrypted Apollo.io API key for email finding';
COMMENT ON COLUMN teams.apollo_credits_remaining IS 'Remaining Apollo API credits';
COMMENT ON COLUMN teams.calendar_provider IS 'Calendar integration provider: calendly, cal_com, google_calendar';
COMMENT ON COLUMN teams.calendar_scheduling_url IS 'URL to scheduling page for meeting booking';
