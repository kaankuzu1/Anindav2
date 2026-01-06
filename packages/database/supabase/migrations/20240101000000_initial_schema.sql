-- Cold Email Platform - Initial Schema
-- Run this migration in Supabase SQL Editor

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE inbox_provider AS ENUM ('google', 'microsoft', 'smtp');
CREATE TYPE inbox_status AS ENUM ('active', 'paused', 'error', 'warming_up', 'banned');
CREATE TYPE warmup_phase AS ENUM ('ramping', 'maintaining', 'paused', 'completed');
CREATE TYPE lead_status AS ENUM (
    'pending', 'in_sequence', 'contacted', 'replied', 'interested',
    'not_interested', 'meeting_booked', 'bounced', 'soft_bounced',
    'unsubscribed', 'spam_reported', 'sequence_complete'
);
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived');
CREATE TYPE email_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
CREATE TYPE reply_intent AS ENUM (
    'interested', 'meeting_request', 'question', 'not_interested',
    'unsubscribe', 'out_of_office', 'auto_reply', 'bounce', 'neutral'
);
CREATE TYPE event_type AS ENUM (
    'queued', 'sent', 'delivered', 'deferred', 'bounced',
    'soft_bounced', 'opened', 'clicked', 'unsubscribed', 'spam_reported'
);

-- ============================================
-- TEAMS
-- ============================================

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    daily_email_limit INTEGER DEFAULT 500,
    max_inboxes INTEGER DEFAULT 5,
    max_campaigns INTEGER DEFAULT 5,
    max_team_members INTEGER DEFAULT 3,
    physical_address TEXT,
    company_name VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_slug ON teams(slug);

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    timezone VARCHAR(100) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "browser": true}',
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- TEAM MEMBERS
-- ============================================

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- ============================================
-- DOMAINS
-- ============================================

CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    spf_valid BOOLEAN DEFAULT FALSE,
    spf_record TEXT,
    dkim_valid BOOLEAN DEFAULT FALSE,
    dkim_selector VARCHAR(100),
    dkim_record TEXT,
    dmarc_valid BOOLEAN DEFAULT FALSE,
    dmarc_policy VARCHAR(50),
    dmarc_record TEXT,
    health_score INTEGER DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
    last_checked_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, domain)
);

CREATE INDEX idx_domains_team ON domains(team_id);

-- ============================================
-- INBOXES
-- ============================================

CREATE TABLE inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    provider inbox_provider NOT NULL,
    status inbox_status DEFAULT 'active',
    status_reason TEXT,
    paused_at TIMESTAMPTZ,
    oauth_access_token TEXT,
    oauth_refresh_token TEXT,
    oauth_expires_at TIMESTAMPTZ,
    oauth_scope TEXT,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_username VARCHAR(255),
    smtp_password TEXT,
    imap_host VARCHAR(255),
    imap_port INTEGER,
    health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    bounce_rate_7d DECIMAL(5,4) DEFAULT 0,
    open_rate_7d DECIMAL(5,4) DEFAULT 0,
    reply_rate_7d DECIMAL(5,4) DEFAULT 0,
    sent_today INTEGER DEFAULT 0,
    sent_this_week INTEGER DEFAULT 0,
    sent_total INTEGER DEFAULT 0,
    circuit_state VARCHAR(20) DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half-open')),
    circuit_failure_count INTEGER DEFAULT 0,
    circuit_last_failure_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    last_reply_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_inboxes_email ON inboxes(email);
CREATE INDEX idx_inboxes_team ON inboxes(team_id);
CREATE INDEX idx_inboxes_status ON inboxes(status);

-- ============================================
-- INBOX SETTINGS
-- ============================================

CREATE TABLE inbox_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID UNIQUE NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    daily_send_limit INTEGER DEFAULT 50 CHECK (daily_send_limit > 0 AND daily_send_limit <= 500),
    hourly_limit INTEGER DEFAULT 10,
    min_delay_seconds INTEGER DEFAULT 60,
    max_delay_seconds INTEGER DEFAULT 300,
    send_window_start TIME DEFAULT '09:00',
    send_window_end TIME DEFAULT '17:00',
    send_window_timezone VARCHAR(100) DEFAULT 'America/New_York',
    send_days VARCHAR(50)[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri'],
    weekends_enabled BOOLEAN DEFAULT FALSE,
    esp_matching_enabled BOOLEAN DEFAULT TRUE,
    auto_throttle_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WARMUP STATE
-- ============================================

CREATE TABLE warmup_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID UNIQUE NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    phase warmup_phase DEFAULT 'ramping',
    started_at TIMESTAMPTZ,
    current_day INTEGER DEFAULT 0,
    ramp_speed VARCHAR(20) DEFAULT 'normal' CHECK (ramp_speed IN ('slow', 'normal', 'fast')),
    target_daily_volume INTEGER DEFAULT 40,
    reply_rate_target DECIMAL(3,2) DEFAULT 0.70,
    sent_today INTEGER DEFAULT 0,
    received_today INTEGER DEFAULT 0,
    replied_today INTEGER DEFAULT 0,
    sent_total INTEGER DEFAULT 0,
    received_total INTEGER DEFAULT 0,
    replied_total INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warmup_state_enabled ON warmup_state(enabled) WHERE enabled = TRUE;

-- ============================================
-- WARMUP INTERACTIONS
-- ============================================

CREATE TABLE warmup_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    to_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('sent', 'received', 'replied', 'opened', 'starred')),
    message_id VARCHAR(255),
    thread_id VARCHAR(255),
    subject VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warmup_interactions_from ON warmup_interactions(from_inbox_id);
CREATE INDEX idx_warmup_interactions_to ON warmup_interactions(to_inbox_id);
CREATE INDEX idx_warmup_interactions_date ON warmup_interactions(created_at);

-- ============================================
-- LEAD LISTS
-- ============================================

CREATE TABLE lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lead_count INTEGER DEFAULT 0,
    source VARCHAR(100),
    imported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_lists_team ON lead_lists(team_id);

-- ============================================
-- LEADS
-- ============================================

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    lead_list_id UUID REFERENCES lead_lists(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url TEXT,
    website TEXT,
    status lead_status DEFAULT 'pending',
    reply_intent VARCHAR(50),
    timezone VARCHAR(100),
    country VARCHAR(100),
    city VARCHAR(100),
    custom_fields JSONB DEFAULT '{}',
    unsubscribe_token VARCHAR(100) UNIQUE DEFAULT gen_random_uuid()::text,
    consent_type VARCHAR(50),
    consent_source TEXT,
    current_campaign_id UUID,
    current_step INTEGER,
    next_send_at TIMESTAMPTZ,
    first_contacted_at TIMESTAMPTZ,
    last_contacted_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, email)
);

CREATE INDEX idx_leads_team ON leads(team_id);
CREATE INDEX idx_leads_list ON leads(lead_list_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_next_send ON leads(next_send_at) WHERE next_send_at IS NOT NULL;
CREATE INDEX idx_leads_unsubscribe_token ON leads(unsubscribe_token);

-- ============================================
-- SUPPRESSION LIST
-- ============================================

CREATE TABLE suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, email)
);

CREATE INDEX idx_suppression_email ON suppression_list(email);

-- ============================================
-- CAMPAIGNS
-- ============================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    lead_list_id UUID REFERENCES lead_lists(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status campaign_status DEFAULT 'draft',
    settings JSONB DEFAULT '{
        "timezone": "America/New_York",
        "send_days": ["mon", "tue", "wed", "thu", "fri"],
        "stop_on_reply": true,
        "stop_on_bounce": true,
        "track_opens": true,
        "track_clicks": false,
        "esp_matching": true,
        "min_health_score": 70
    }',
    lead_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_team ON campaigns(team_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Add foreign key to leads after campaigns exists
ALTER TABLE leads ADD CONSTRAINT fk_leads_campaign
    FOREIGN KEY (current_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- ============================================
-- CAMPAIGN INBOXES
-- ============================================

CREATE TABLE campaign_inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, inbox_id)
);

CREATE INDEX idx_campaign_inboxes_campaign ON campaign_inboxes(campaign_id);
CREATE INDEX idx_campaign_inboxes_inbox ON campaign_inboxes(inbox_id);

-- ============================================
-- SEQUENCES
-- ============================================

CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number > 0),
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    conditions JSONB DEFAULT '[{"type": "no_reply", "action": "continue"}]',
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, step_number)
);

CREATE INDEX idx_sequences_campaign ON sequences(campaign_id);

-- ============================================
-- SEQUENCE VARIANTS
-- ============================================

CREATE TABLE sequence_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    variant_index INTEGER NOT NULL CHECK (variant_index >= 0),
    weight INTEGER DEFAULT 50 CHECK (weight > 0 AND weight <= 100),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sequence_id, variant_index)
);

-- ============================================
-- EMAILS
-- ============================================

CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES sequence_variants(id) ON DELETE SET NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    message_id VARCHAR(255),
    thread_id VARCHAR(255),
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    body_text TEXT,
    status email_status DEFAULT 'queued',
    error_message TEXT,
    open_tracked BOOLEAN DEFAULT FALSE,
    click_tracked BOOLEAN DEFAULT FALSE,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_team ON emails(team_id);
CREATE INDEX idx_emails_campaign ON emails(campaign_id);
CREATE INDEX idx_emails_lead ON emails(lead_id);
CREATE INDEX idx_emails_inbox ON emails(inbox_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_scheduled ON emails(scheduled_at) WHERE status = 'queued';

-- ============================================
-- EMAIL EVENTS
-- ============================================

CREATE TABLE email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    event_type event_type NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_email ON email_events(email_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created ON email_events(created_at);

-- ============================================
-- REPLIES
-- ============================================

CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    message_id VARCHAR(255),
    thread_id VARCHAR(255),
    in_reply_to VARCHAR(255),
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    subject VARCHAR(500),
    body_html TEXT,
    body_text TEXT,
    body_preview VARCHAR(500),
    intent reply_intent,
    intent_confidence DECIMAL(3,2),
    intent_model VARCHAR(50),
    intent_manual_override BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_replies_team ON replies(team_id);
CREATE INDEX idx_replies_lead ON replies(lead_id);
CREATE INDEX idx_replies_inbox ON replies(inbox_id);
CREATE INDEX idx_replies_campaign ON replies(campaign_id);
CREATE INDEX idx_replies_intent ON replies(intent);
CREATE INDEX idx_replies_unread ON replies(is_read, team_id) WHERE is_read = FALSE;

-- ============================================
-- WEBHOOKS
-- ============================================

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events VARCHAR(100)[] NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_team ON webhooks(team_id);
CREATE INDEX idx_webhooks_active ON webhooks(active) WHERE active = TRUE;

-- ============================================
-- DAILY STATS
-- ============================================

CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,
    delivery_rate DECIMAL(5,4),
    open_rate DECIMAL(5,4),
    click_rate DECIMAL(5,4),
    reply_rate DECIMAL(5,4),
    bounce_rate DECIMAL(5,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, date)
);

CREATE INDEX idx_daily_stats_team_date ON daily_stats(team_id, date);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_inboxes_updated_at BEFORE UPDATE ON inboxes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_inbox_settings_updated_at BEFORE UPDATE ON inbox_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_warmup_state_updated_at BEFORE UPDATE ON warmup_state FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_lead_lists_updated_at BEFORE UPDATE ON lead_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON daily_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Lead list count trigger
CREATE OR REPLACE FUNCTION update_lead_list_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.lead_list_id IS NOT NULL THEN
        UPDATE lead_lists SET lead_count = lead_count + 1 WHERE id = NEW.lead_list_id;
    ELSIF TG_OP = 'DELETE' AND OLD.lead_list_id IS NOT NULL THEN
        UPDATE lead_lists SET lead_count = lead_count - 1 WHERE id = OLD.lead_list_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.lead_list_id IS DISTINCT FROM NEW.lead_list_id THEN
            IF OLD.lead_list_id IS NOT NULL THEN
                UPDATE lead_lists SET lead_count = lead_count - 1 WHERE id = OLD.lead_list_id;
            END IF;
            IF NEW.lead_list_id IS NOT NULL THEN
                UPDATE lead_lists SET lead_count = lead_count + 1 WHERE id = NEW.lead_list_id;
            END IF;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lead_list_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_lead_list_count();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warmup_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE warmup_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Users can view themselves
CREATE POLICY "Users can view themselves" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update themselves" ON users FOR UPDATE USING (id = auth.uid());

-- Team members access (helper function)
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID AS $$
    SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Teams
CREATE POLICY "Team members can view their teams" ON teams FOR SELECT
    USING (id IN (SELECT get_user_team_ids()));

-- Team members
CREATE POLICY "Team members can view team members" ON team_members FOR SELECT
    USING (team_id IN (SELECT get_user_team_ids()));

-- Apply similar policies to other tables
CREATE POLICY "Team access" ON domains FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON inboxes FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON lead_lists FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON leads FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON campaigns FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON emails FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON replies FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON webhooks FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON daily_stats FOR ALL USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team access" ON suppression_list FOR ALL USING (team_id IN (SELECT get_user_team_ids()));

-- Inbox settings via inbox
CREATE POLICY "Team access via inbox" ON inbox_settings FOR ALL
    USING (inbox_id IN (SELECT id FROM inboxes WHERE team_id IN (SELECT get_user_team_ids())));

-- Warmup state via inbox
CREATE POLICY "Team access via inbox" ON warmup_state FOR ALL
    USING (inbox_id IN (SELECT id FROM inboxes WHERE team_id IN (SELECT get_user_team_ids())));

-- Campaign inboxes via campaign
CREATE POLICY "Team access via campaign" ON campaign_inboxes FOR ALL
    USING (campaign_id IN (SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())));

-- Sequences via campaign
CREATE POLICY "Team access via campaign" ON sequences FOR ALL
    USING (campaign_id IN (SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())));

-- Sequence variants via sequence
CREATE POLICY "Team access via sequence" ON sequence_variants FOR ALL
    USING (sequence_id IN (SELECT id FROM sequences WHERE campaign_id IN (SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids()))));

-- Email events via email
CREATE POLICY "Team access via email" ON email_events FOR ALL
    USING (email_id IN (SELECT id FROM emails WHERE team_id IN (SELECT get_user_team_ids())));

-- Warmup interactions (both inboxes must be accessible)
CREATE POLICY "Team access via inboxes" ON warmup_interactions FOR ALL
    USING (
        from_inbox_id IN (SELECT id FROM inboxes WHERE team_id IN (SELECT get_user_team_ids()))
        OR to_inbox_id IN (SELECT id FROM inboxes WHERE team_id IN (SELECT get_user_team_ids()))
    );
