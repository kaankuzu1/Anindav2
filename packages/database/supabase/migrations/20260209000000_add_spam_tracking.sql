-- Add spam counter to inboxes table (campaign spam complaints)
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS spam_complaints_total INTEGER DEFAULT 0;

-- Add spam counters to warmup_state table (warmup spam folder detection)
ALTER TABLE warmup_state ADD COLUMN IF NOT EXISTS spam_today INTEGER DEFAULT 0;
ALTER TABLE warmup_state ADD COLUMN IF NOT EXISTS spam_total INTEGER DEFAULT 0;

-- RPC function to atomically increment inbox spam counter
CREATE OR REPLACE FUNCTION increment_inbox_spam(p_inbox_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE inboxes SET spam_complaints_total = spam_complaints_total + 1 WHERE id = p_inbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
