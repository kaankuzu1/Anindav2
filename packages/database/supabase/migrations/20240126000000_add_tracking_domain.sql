-- Migration: Add custom tracking domain support to teams table
-- Date: 2024-01-26

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
