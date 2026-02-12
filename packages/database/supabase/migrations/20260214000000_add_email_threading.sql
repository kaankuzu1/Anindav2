-- Add sequence_step column (campaign scheduler already inserts it, but column was missing)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sequence_step INTEGER;

-- Add threading columns to emails table for campaign follow-up threading
ALTER TABLE emails ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(500);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS references_header TEXT;

-- Index for looking up previous step emails when building threading data
CREATE INDEX IF NOT EXISTS idx_emails_campaign_lead_step
  ON emails(campaign_id, lead_id, sequence_step)
  WHERE campaign_id IS NOT NULL AND sequence_step IS NOT NULL;
