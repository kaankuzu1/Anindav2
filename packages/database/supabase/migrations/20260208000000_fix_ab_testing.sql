-- Fix A/B Testing System
-- Addresses: missing columns, missing audit table, missing RPC function

-- 1. Add variant_name column (frontend sends this, schema only has variant_index)
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS variant_name VARCHAR(50);

-- 2. Add clicked_count (optimizer expects it, doesn't exist)
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0;

-- 3. Add winner metadata column
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS winner_declared_at TIMESTAMPTZ;

-- 4. Create ab_test_events audit table (replaces non-existent campaign_events)
CREATE TABLE IF NOT EXISTS ab_test_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    winner_variant_id UUID REFERENCES sequence_variants(id) ON DELETE SET NULL,
    metric VARCHAR(50),
    confidence DECIMAL(5,4),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_ab_test_events_campaign ON ab_test_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_emails_variant ON emails(variant_id) WHERE variant_id IS NOT NULL;

-- 6. RLS
ALTER TABLE ab_test_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ab_test_events' AND policyname = 'Team access via campaign'
    ) THEN
        CREATE POLICY "Team access via campaign" ON ab_test_events FOR ALL
            USING (team_id IN (SELECT get_user_team_ids()));
    END IF;
END
$$;

-- 7. RPC function for atomic variant stat increment
CREATE OR REPLACE FUNCTION increment_variant_stat(
    p_variant_id UUID,
    p_stat VARCHAR(20),
    p_amount INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'UPDATE sequence_variants SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
        p_stat || '_count', p_stat || '_count'
    ) USING p_amount, p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
