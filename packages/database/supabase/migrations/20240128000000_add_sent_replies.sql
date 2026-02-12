-- Migration: Add sent_replies table for tracking outbound replies
-- Created: 2024-01-28

-- Create sent_replies table
CREATE TABLE IF NOT EXISTS sent_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reply_id UUID NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Email content
  subject VARCHAR(500),
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Threading headers
  message_id VARCHAR(500),
  in_reply_to VARCHAR(500),
  thread_id VARCHAR(500),
  references_header TEXT,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'bounced')),
  error_message TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_sent_replies_team_id ON sent_replies(team_id);
CREATE INDEX idx_sent_replies_reply_id ON sent_replies(reply_id);
CREATE INDEX idx_sent_replies_lead_id ON sent_replies(lead_id);
CREATE INDEX idx_sent_replies_inbox_id ON sent_replies(inbox_id);
CREATE INDEX idx_sent_replies_thread_id ON sent_replies(thread_id);
CREATE INDEX idx_sent_replies_sent_at ON sent_replies(sent_at DESC);

-- Add RLS policies
ALTER TABLE sent_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see sent_replies from their team
CREATE POLICY "Users can view sent_replies from their team" ON sent_replies
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert sent_replies for their team
CREATE POLICY "Users can insert sent_replies for their team" ON sent_replies
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update sent_replies for their team
CREATE POLICY "Users can update sent_replies for their team" ON sent_replies
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_sent_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sent_replies_updated_at
  BEFORE UPDATE ON sent_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_sent_replies_updated_at();

-- Grant permissions for service role (used by API)
GRANT ALL ON sent_replies TO service_role;

-- Add comment
COMMENT ON TABLE sent_replies IS 'Tracks outbound replies sent in response to incoming emails';
