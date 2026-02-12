-- Migration: Add thread_depth column to warmup_interactions
-- This column tracks multi-level warmup threads (2-5 message conversations)

-- Add thread_depth column
ALTER TABLE warmup_interactions
ADD COLUMN IF NOT EXISTS thread_depth INTEGER DEFAULT 1;

-- Add index for thread-based queries
CREATE INDEX IF NOT EXISTS idx_warmup_interactions_thread
ON warmup_interactions(thread_id)
WHERE thread_id IS NOT NULL;

-- Add inbox throttle_percentage column for health-based throttling
ALTER TABLE inboxes
ADD COLUMN IF NOT EXISTS throttle_percentage INTEGER DEFAULT 100
CHECK (throttle_percentage >= 0 AND throttle_percentage <= 100);

-- Add daily_send_limit column to inboxes (for direct access without join)
ALTER TABLE inboxes
ADD COLUMN IF NOT EXISTS daily_send_limit INTEGER DEFAULT 50;

-- Update inbox_settings to sync with inbox daily_send_limit
CREATE OR REPLACE FUNCTION sync_inbox_daily_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync daily_send_limit from inbox_settings to inboxes table
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE inboxes
        SET daily_send_limit = NEW.daily_send_limit
        WHERE id = NEW.inbox_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists (drop first to ensure clean state)
DROP TRIGGER IF EXISTS sync_inbox_daily_limit_trigger ON inbox_settings;
CREATE TRIGGER sync_inbox_daily_limit_trigger
    AFTER INSERT OR UPDATE OF daily_send_limit ON inbox_settings
    FOR EACH ROW EXECUTE FUNCTION sync_inbox_daily_limit();
