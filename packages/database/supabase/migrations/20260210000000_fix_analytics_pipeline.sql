-- Fix Analytics Pipeline
-- Addresses: missing email columns, retry_pending enum, and missing RPC functions
-- Bugs fixed: #1 (open/click never incremented), #2 (missing columns), #3 (missing enum),
--             #4 (missing campaign RPCs), #5 (no campaign sent increment), #12 (missing bounced_at)

-- 1. Add missing columns to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounce_type VARCHAR(20);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS soft_bounce_count INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- 2. Add retry_pending to email_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'retry_pending' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_status')) THEN
        ALTER TYPE email_status ADD VALUE 'retry_pending';
    END IF;
END
$$;

-- 3. RPC functions

-- Atomically increment email open_count and set opened_at on first open
CREATE OR REPLACE FUNCTION increment_email_open(p_email_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE emails
    SET open_count = COALESCE(open_count, 0) + 1,
        opened_at = COALESCE(opened_at, NOW())
    WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically increment email click_count and set clicked_at on first click
CREATE OR REPLACE FUNCTION increment_email_click(p_email_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE emails
    SET click_count = COALESCE(click_count, 0) + 1,
        clicked_at = COALESCE(clicked_at, NOW())
    WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically increment campaign opened_count
CREATE OR REPLACE FUNCTION increment_campaign_opens(campaign_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE campaigns
    SET opened_count = COALESCE(opened_count, 0) + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically increment campaign clicked_count
CREATE OR REPLACE FUNCTION increment_campaign_clicks(campaign_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE campaigns
    SET clicked_count = COALESCE(clicked_count, 0) + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically increment campaign bounced_count
CREATE OR REPLACE FUNCTION increment_campaign_bounces(campaign_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE campaigns
    SET bounced_count = COALESCE(bounced_count, 0) + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically increment campaign sent_count
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE campaigns
    SET sent_count = COALESCE(sent_count, 0) + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
