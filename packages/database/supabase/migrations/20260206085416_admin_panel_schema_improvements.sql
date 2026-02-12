-- Migration: Admin Panel Schema Improvements
-- Description: Adds missing indexes, connection tracking columns, metrics table, and audit log for admin panel
-- Author: AI Agent
-- Date: 2026-02-06

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Add missing columns to admin_inboxes for connection tracking
ALTER TABLE admin_inboxes
ADD COLUMN IF NOT EXISTS connection_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS connection_check_result TEXT;

-- Add comment for column documentation
COMMENT ON COLUMN admin_inboxes.connection_checked_at IS 'Timestamp of the last connection check';
COMMENT ON COLUMN admin_inboxes.connection_check_result IS 'Result of the last connection check (success or error message)';

-- 2. Add index on admin_inboxes.status for filtering active/error inboxes
CREATE INDEX IF NOT EXISTS idx_admin_inboxes_status ON admin_inboxes(status);

-- Add partial index for active inboxes (common query pattern)
CREATE INDEX IF NOT EXISTS idx_admin_inboxes_active ON admin_inboxes(id) WHERE status = 'active';

-- Add index on email for lookups
CREATE INDEX IF NOT EXISTS idx_admin_inboxes_email ON admin_inboxes(email);

-- 3. Create admin_inbox_metrics table for historical stats
-- This table stores daily metrics per admin inbox for trend analysis
CREATE TABLE IF NOT EXISTS admin_inbox_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_inbox_id UUID NOT NULL REFERENCES admin_inboxes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  received_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER,
  avg_response_time_ms INTEGER,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_inbox_id, date)
);

-- Indexes for admin_inbox_metrics
CREATE INDEX IF NOT EXISTS idx_admin_inbox_metrics_inbox_id ON admin_inbox_metrics(admin_inbox_id);
CREATE INDEX IF NOT EXISTS idx_admin_inbox_metrics_date ON admin_inbox_metrics(date);
CREATE INDEX IF NOT EXISTS idx_admin_inbox_metrics_inbox_date ON admin_inbox_metrics(admin_inbox_id, date DESC);

-- Comments for documentation
COMMENT ON TABLE admin_inbox_metrics IS 'Daily metrics for admin inboxes, used for trend analysis and reporting';
COMMENT ON COLUMN admin_inbox_metrics.avg_response_time_ms IS 'Average email response time in milliseconds for the day';
COMMENT ON COLUMN admin_inbox_metrics.error_count IS 'Number of errors (send failures, connection issues) for the day';

-- RLS for admin_inbox_metrics (service_role only)
ALTER TABLE admin_inbox_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_inbox_metrics_service_full_access ON admin_inbox_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated_at trigger for admin_inbox_metrics
CREATE TRIGGER admin_inbox_metrics_updated_at
  BEFORE UPDATE ON admin_inbox_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_inboxes_updated_at();

-- 4. Create admin_audit_log table for tracking admin actions
-- This provides an audit trail of all admin operations
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user ON admin_audit_log(admin_user);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_date ON admin_audit_log(admin_user, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE admin_audit_log IS 'Audit trail of all admin panel actions for security and debugging';
COMMENT ON COLUMN admin_audit_log.action IS 'Action performed (e.g., create_inbox, delete_inbox, check_connection, login)';
COMMENT ON COLUMN admin_audit_log.entity_type IS 'Type of entity affected (e.g., admin_inbox, user, system)';
COMMENT ON COLUMN admin_audit_log.details IS 'Additional context about the action (before/after values, error messages, etc.)';

-- RLS for admin_audit_log (service_role only, no user access)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_service_full_access ON admin_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Add index on warmup_state.warmup_mode for filtering by mode
CREATE INDEX IF NOT EXISTS idx_warmup_state_warmup_mode ON warmup_state(warmup_mode);

-- Partial index for network warmup mode (used in admin queries)
CREATE INDEX IF NOT EXISTS idx_warmup_state_network_mode ON warmup_state(inbox_id) WHERE warmup_mode = 'network';

-- 6. Helper function to record audit log entries
CREATE OR REPLACE FUNCTION record_admin_audit(
  p_admin_user VARCHAR(255),
  p_action VARCHAR(100),
  p_entity_type VARCHAR(50),
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO admin_audit_log (
    admin_user,
    action,
    entity_type,
    entity_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_user,
    p_action,
    p_entity_type,
    p_entity_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION record_admin_audit IS 'Helper function to record admin audit log entries';

-- 7. Helper function to aggregate daily metrics for an admin inbox
CREATE OR REPLACE FUNCTION aggregate_admin_inbox_daily_metrics(
  p_admin_inbox_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent INTEGER;
  v_received INTEGER;
  v_replied INTEGER;
  v_health INTEGER;
BEGIN
  -- Get the current daily counters from admin_inboxes
  SELECT sent_today, received_today, health_score
  INTO v_sent, v_received, v_health
  FROM admin_inboxes
  WHERE id = p_admin_inbox_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Count replied interactions for today
  SELECT COUNT(*)
  INTO v_replied
  FROM admin_warmup_interactions
  WHERE admin_inbox_id = p_admin_inbox_id
    AND interaction_type = 'replied'
    AND created_at::date = p_date;

  -- Upsert the daily metrics
  INSERT INTO admin_inbox_metrics (
    admin_inbox_id,
    date,
    sent_count,
    received_count,
    replied_count,
    health_score
  ) VALUES (
    p_admin_inbox_id,
    p_date,
    v_sent,
    v_received,
    v_replied,
    v_health
  )
  ON CONFLICT (admin_inbox_id, date)
  DO UPDATE SET
    sent_count = EXCLUDED.sent_count,
    received_count = EXCLUDED.received_count,
    replied_count = EXCLUDED.replied_count,
    health_score = EXCLUDED.health_score,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION aggregate_admin_inbox_daily_metrics IS 'Aggregates and stores daily metrics for an admin inbox';

-- ============================================
-- DOWN MIGRATION (commented, for reference)
-- ============================================
-- DROP FUNCTION IF EXISTS aggregate_admin_inbox_daily_metrics(UUID, DATE);
-- DROP FUNCTION IF EXISTS record_admin_audit(VARCHAR, VARCHAR, VARCHAR, UUID, JSONB, INET, TEXT);
-- DROP INDEX IF EXISTS idx_warmup_state_network_mode;
-- DROP INDEX IF EXISTS idx_warmup_state_warmup_mode;
-- DROP POLICY IF EXISTS admin_audit_log_service_full_access ON admin_audit_log;
-- DROP TABLE IF EXISTS admin_audit_log;
-- DROP TRIGGER IF EXISTS admin_inbox_metrics_updated_at ON admin_inbox_metrics;
-- DROP POLICY IF EXISTS admin_inbox_metrics_service_full_access ON admin_inbox_metrics;
-- DROP TABLE IF EXISTS admin_inbox_metrics;
-- DROP INDEX IF EXISTS idx_admin_inboxes_email;
-- DROP INDEX IF EXISTS idx_admin_inboxes_active;
-- DROP INDEX IF EXISTS idx_admin_inboxes_status;
-- ALTER TABLE admin_inboxes DROP COLUMN IF EXISTS connection_check_result;
-- ALTER TABLE admin_inboxes DROP COLUMN IF EXISTS connection_checked_at;
