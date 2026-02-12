-- Migration: Add warmup dual modes (pool/network) and admin infrastructure
-- This adds support for Network warmup mode where platform-managed admin inboxes
-- communicate with user inboxes, alongside the existing Pool mode.

-- 1. Add warmup_mode column to warmup_state
ALTER TABLE warmup_state
ADD COLUMN IF NOT EXISTS warmup_mode VARCHAR(20) NOT NULL DEFAULT 'pool';

-- 2. Create admin_inboxes table
CREATE TABLE IF NOT EXISTS admin_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft', 'smtp')),
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMPTZ,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_secure BOOLEAN DEFAULT false,
  smtp_user VARCHAR(255),
  smtp_pass TEXT,
  from_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  status_reason TEXT,
  health_score INTEGER NOT NULL DEFAULT 100,
  max_capacity INTEGER NOT NULL DEFAULT 20,
  current_load INTEGER NOT NULL DEFAULT 0,
  sent_today INTEGER NOT NULL DEFAULT 0,
  received_today INTEGER NOT NULL DEFAULT 0,
  sent_total INTEGER NOT NULL DEFAULT 0,
  received_total INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create admin_inbox_assignments table
CREATE TABLE IF NOT EXISTS admin_inbox_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  admin_inbox_id UUID NOT NULL REFERENCES admin_inboxes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(inbox_id, admin_inbox_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_inbox_assignments_inbox_id ON admin_inbox_assignments(inbox_id);
CREATE INDEX IF NOT EXISTS idx_admin_inbox_assignments_admin_inbox_id ON admin_inbox_assignments(admin_inbox_id);

-- 4. Create admin_warmup_interactions table
CREATE TABLE IF NOT EXISTS admin_warmup_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  admin_inbox_id UUID NOT NULL REFERENCES admin_inboxes(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('user_to_admin', 'admin_to_user')),
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('sent', 'received', 'replied')),
  message_id TEXT,
  thread_id TEXT,
  thread_depth INTEGER DEFAULT 1,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_warmup_interactions_user_inbox ON admin_warmup_interactions(user_inbox_id);
CREATE INDEX IF NOT EXISTS idx_admin_warmup_interactions_admin_inbox ON admin_warmup_interactions(admin_inbox_id);
CREATE INDEX IF NOT EXISTS idx_admin_warmup_interactions_created_at ON admin_warmup_interactions(created_at);

-- 5. RLS policies

-- Admin inboxes: service_role has full access, users have no direct access
ALTER TABLE admin_inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_inboxes_service_full_access ON admin_inboxes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin inbox assignments: service_role full access, users can see their own
ALTER TABLE admin_inbox_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_inbox_assignments_service_full ON admin_inbox_assignments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY admin_inbox_assignments_user_select ON admin_inbox_assignments
  FOR SELECT
  USING (
    inbox_id IN (
      SELECT i.id FROM inboxes i
      JOIN team_members tm ON i.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Admin warmup interactions: service_role full access, users can see their own
ALTER TABLE admin_warmup_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_warmup_interactions_service_full ON admin_warmup_interactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY admin_warmup_interactions_user_select ON admin_warmup_interactions
  FOR SELECT
  USING (
    user_inbox_id IN (
      SELECT i.id FROM inboxes i
      JOIN team_members tm ON i.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- 6. Helper function: reset admin inbox daily counters
CREATE OR REPLACE FUNCTION reset_admin_inbox_daily_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_inboxes
  SET sent_today = 0,
      received_today = 0,
      updated_at = now()
  WHERE status = 'active';
END;
$$;

-- 7. Updated_at trigger for admin_inboxes
CREATE OR REPLACE FUNCTION update_admin_inboxes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER admin_inboxes_updated_at
  BEFORE UPDATE ON admin_inboxes
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_inboxes_updated_at();
