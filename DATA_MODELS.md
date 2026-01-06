# Data Models

## Supabase/PostgreSQL Schema

This document defines all database schemas for the cold email platform, optimized for Supabase with Row Level Security (RLS).

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   teams     │───────│   users     │       │   domains   │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                     │
       │                     │                     │
       ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   inboxes   │───────│  inbox_     │───────│   warmup_   │
│             │       │  settings   │       │   state     │
└─────────────┘       └─────────────┘       └─────────────┘
       │                                           │
       │                                           │
       ▼                                           ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  campaigns  │───────│  sequences  │       │  warmup_    │
│             │       │             │       │  interactions│
└─────────────┘       └─────────────┘       └─────────────┘
       │
       │
       ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ lead_lists  │───────│   leads     │───────│   events    │
└─────────────┘       └─────────────┘       └─────────────┘
                             │
                             │
                             ▼
                      ┌─────────────┐       ┌─────────────┐
                      │   emails    │───────│   replies   │
                      └─────────────┘       └─────────────┘
```

---

## 1. Core Tables

### 1.1 Teams

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,

    -- Billing
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),

    -- Limits (based on plan)
    daily_email_limit INTEGER DEFAULT 500,
    max_inboxes INTEGER DEFAULT 5,
    max_campaigns INTEGER DEFAULT 5,
    max_team_members INTEGER DEFAULT 3,

    -- Compliance
    physical_address TEXT,
    company_name VARCHAR(255),

    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_stripe_customer ON teams(stripe_customer_id);

-- RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team"
    ON teams FOR SELECT
    USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can update their team"
    ON teams FOR UPDATE
    USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin'));
```

### 1.2 Users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,

    -- Preferences
    timezone VARCHAR(100) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "browser": true}',

    -- Metadata
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view themselves"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update themselves"
    ON users FOR UPDATE
    USING (id = auth.uid());
```

### 1.3 Team Members

```sql
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

    -- Invitation
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(team_id, user_id)
);

-- Indexes
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their team members"
    ON team_members FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
```

---

## 2. Email Infrastructure Tables

### 2.1 Domains

```sql
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,

    -- DNS Records
    spf_valid BOOLEAN DEFAULT FALSE,
    spf_record TEXT,
    dkim_valid BOOLEAN DEFAULT FALSE,
    dkim_selector VARCHAR(100),
    dkim_record TEXT,
    dmarc_valid BOOLEAN DEFAULT FALSE,
    dmarc_policy VARCHAR(50),
    dmarc_record TEXT,

    -- Health
    health_score INTEGER DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
    last_checked_at TIMESTAMPTZ,

    -- Metadata
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(team_id, domain)
);

-- Indexes
CREATE INDEX idx_domains_team ON domains(team_id);
CREATE INDEX idx_domains_domain ON domains(domain);

-- RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their domains"
    ON domains FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
```

### 2.2 Inboxes

```sql
CREATE TYPE inbox_provider AS ENUM ('google', 'microsoft', 'smtp');
CREATE TYPE inbox_status AS ENUM ('active', 'paused', 'error', 'warming_up', 'banned');

CREATE TABLE inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,

    -- Email info
    email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    provider inbox_provider NOT NULL,

    -- Status
    status inbox_status DEFAULT 'active',
    status_reason TEXT,
    paused_at TIMESTAMPTZ,

    -- OAuth (encrypted)
    oauth_access_token TEXT,  -- Encrypted
    oauth_refresh_token TEXT, -- Encrypted
    oauth_expires_at TIMESTAMPTZ,
    oauth_scope TEXT,

    -- SMTP/IMAP (for non-OAuth)
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_username VARCHAR(255),
    smtp_password TEXT,  -- Encrypted
    imap_host VARCHAR(255),
    imap_port INTEGER,

    -- Health metrics
    health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    bounce_rate_7d DECIMAL(5,4) DEFAULT 0,
    open_rate_7d DECIMAL(5,4) DEFAULT 0,
    reply_rate_7d DECIMAL(5,4) DEFAULT 0,

    -- Counters (updated by workers)
    sent_today INTEGER DEFAULT 0,
    sent_this_week INTEGER DEFAULT 0,
    sent_total INTEGER DEFAULT 0,

    -- Circuit breaker
    circuit_state VARCHAR(20) DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half-open')),
    circuit_failure_count INTEGER DEFAULT 0,
    circuit_last_failure_at TIMESTAMPTZ,

    -- Metadata
    last_sent_at TIMESTAMPTZ,
    last_reply_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_inboxes_email ON inboxes(email);
CREATE INDEX idx_inboxes_team ON inboxes(team_id);
CREATE INDEX idx_inboxes_status ON inboxes(status);
CREATE INDEX idx_inboxes_provider ON inboxes(provider);

-- RLS
ALTER TABLE inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their inboxes"
    ON inboxes FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can manage inboxes"
    ON inboxes FOR ALL
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
```

### 2.3 Inbox Settings

```sql
CREATE TABLE inbox_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID UNIQUE NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,

    -- Sending limits
    daily_send_limit INTEGER DEFAULT 50 CHECK (daily_send_limit > 0 AND daily_send_limit <= 500),
    hourly_limit INTEGER DEFAULT 10,

    -- Timing
    min_delay_seconds INTEGER DEFAULT 60,
    max_delay_seconds INTEGER DEFAULT 300,

    -- Send window
    send_window_start TIME DEFAULT '09:00',
    send_window_end TIME DEFAULT '17:00',
    send_window_timezone VARCHAR(100) DEFAULT 'America/New_York',
    send_days VARCHAR(50)[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri'],
    weekends_enabled BOOLEAN DEFAULT FALSE,

    -- Advanced
    esp_matching_enabled BOOLEAN DEFAULT TRUE,
    auto_throttle_enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inbox_settings_inbox ON inbox_settings(inbox_id);
```

---

## 3. Warm-up Tables

### 3.1 Warmup State

```sql
CREATE TYPE warmup_phase AS ENUM ('ramping', 'maintaining', 'paused', 'completed');

CREATE TABLE warmup_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID UNIQUE NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,

    -- Status
    enabled BOOLEAN DEFAULT FALSE,
    phase warmup_phase DEFAULT 'ramping',

    -- Progress
    started_at TIMESTAMPTZ,
    current_day INTEGER DEFAULT 0,

    -- Settings
    ramp_speed VARCHAR(20) DEFAULT 'normal' CHECK (ramp_speed IN ('slow', 'normal', 'fast')),
    target_daily_volume INTEGER DEFAULT 40,
    reply_rate_target DECIMAL(3,2) DEFAULT 0.70,

    -- Today's metrics
    sent_today INTEGER DEFAULT 0,
    received_today INTEGER DEFAULT 0,
    replied_today INTEGER DEFAULT 0,

    -- Totals
    sent_total INTEGER DEFAULT 0,
    received_total INTEGER DEFAULT 0,
    replied_total INTEGER DEFAULT 0,

    -- Metadata
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_warmup_state_inbox ON warmup_state(inbox_id);
CREATE INDEX idx_warmup_state_enabled ON warmup_state(enabled) WHERE enabled = TRUE;
```

### 3.2 Warmup Interactions

```sql
CREATE TYPE warmup_interaction_type AS ENUM ('sent', 'received', 'replied', 'opened', 'starred');

CREATE TABLE warmup_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    to_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,

    -- Interaction details
    interaction_type warmup_interaction_type NOT NULL,
    message_id VARCHAR(255),  -- Email message ID
    thread_id VARCHAR(255),

    -- Content (for warm-up analysis)
    subject VARCHAR(500),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_warmup_interactions_from ON warmup_interactions(from_inbox_id);
CREATE INDEX idx_warmup_interactions_to ON warmup_interactions(to_inbox_id);
CREATE INDEX idx_warmup_interactions_date ON warmup_interactions(created_at);

-- Partition by month for large datasets
-- CREATE TABLE warmup_interactions_y2024m01 PARTITION OF warmup_interactions
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

## 4. Lead Tables

### 4.1 Lead Lists

```sql
CREATE TABLE lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Stats
    lead_count INTEGER DEFAULT 0,

    -- Import metadata
    source VARCHAR(100),  -- 'csv', 'api', 'manual', 'integration'
    imported_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lead_lists_team ON lead_lists(team_id);

-- RLS
ALTER TABLE lead_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their lead lists"
    ON lead_lists FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
```

### 4.2 Leads

```sql
CREATE TYPE lead_status AS ENUM (
    'pending',          -- Not yet contacted
    'in_sequence',      -- Currently in a campaign sequence
    'contacted',        -- Manually marked as contacted
    'replied',          -- Replied to campaign
    'interested',       -- Replied with positive intent
    'not_interested',   -- Replied with negative intent
    'meeting_booked',   -- Meeting scheduled
    'bounced',          -- Hard bounce
    'soft_bounced',     -- Soft bounce
    'unsubscribed',     -- Unsubscribed
    'spam_reported',    -- Marked as spam
    'sequence_complete' -- Completed all steps without reply
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    lead_list_id UUID REFERENCES lead_lists(id) ON DELETE SET NULL,

    -- Contact info
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url TEXT,
    website TEXT,

    -- Status
    status lead_status DEFAULT 'pending',
    reply_intent VARCHAR(50),  -- Detailed intent from NLP

    -- Location
    timezone VARCHAR(100),
    country VARCHAR(100),
    city VARCHAR(100),

    -- Custom fields (flexible schema)
    custom_fields JSONB DEFAULT '{}',

    -- Compliance
    unsubscribe_token VARCHAR(100) UNIQUE DEFAULT gen_random_uuid()::text,
    consent_type VARCHAR(50),  -- 'explicit', 'implicit', 'none'
    consent_source TEXT,

    -- Campaign tracking
    current_campaign_id UUID,
    current_step INTEGER,
    next_send_at TIMESTAMPTZ,

    -- Timestamps
    first_contacted_at TIMESTAMPTZ,
    last_contacted_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(team_id, email)
);

-- Indexes
CREATE INDEX idx_leads_team ON leads(team_id);
CREATE INDEX idx_leads_list ON leads(lead_list_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_campaign ON leads(current_campaign_id) WHERE current_campaign_id IS NOT NULL;
CREATE INDEX idx_leads_next_send ON leads(next_send_at) WHERE next_send_at IS NOT NULL;
CREATE INDEX idx_leads_unsubscribe_token ON leads(unsubscribe_token);

-- Full text search
CREATE INDEX idx_leads_search ON leads USING GIN (
    to_tsvector('english', coalesce(first_name, '') || ' ' ||
                           coalesce(last_name, '') || ' ' ||
                           coalesce(company, '') || ' ' ||
                           email)
);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their leads"
    ON leads FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
```

### 4.3 Suppression List

```sql
CREATE TABLE suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,  -- NULL = global

    email VARCHAR(255) NOT NULL,
    reason VARCHAR(100) NOT NULL,  -- 'hard_bounce', 'spam_complaint', 'unsubscribe', 'manual'

    -- Metadata
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(team_id, email)
);

-- Indexes
CREATE INDEX idx_suppression_email ON suppression_list(email);
CREATE INDEX idx_suppression_team ON suppression_list(team_id);
```

---

## 5. Campaign Tables

### 5.1 Campaigns

```sql
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived');

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    lead_list_id UUID REFERENCES lead_lists(id) ON DELETE SET NULL,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status campaign_status DEFAULT 'draft',

    -- Settings
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

    -- Stats (denormalized for fast queries)
    lead_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,

    -- Scheduling
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaigns_team ON campaigns(team_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_lead_list ON campaigns(lead_list_id);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their campaigns"
    ON campaigns FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
```

### 5.2 Campaign Inboxes (Junction)

```sql
CREATE TABLE campaign_inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,

    -- Per-inbox campaign stats
    sent_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(campaign_id, inbox_id)
);

-- Indexes
CREATE INDEX idx_campaign_inboxes_campaign ON campaign_inboxes(campaign_id);
CREATE INDEX idx_campaign_inboxes_inbox ON campaign_inboxes(inbox_id);
```

### 5.3 Sequences

```sql
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Step info
    step_number INTEGER NOT NULL CHECK (step_number > 0),

    -- Timing
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,

    -- Content
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,

    -- Conditions (JSONB for flexibility)
    conditions JSONB DEFAULT '[{"type": "no_reply", "action": "continue"}]',

    -- Stats
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(campaign_id, step_number)
);

-- Indexes
CREATE INDEX idx_sequences_campaign ON sequences(campaign_id);
```

### 5.4 Sequence Variants (A/B Testing)

```sql
CREATE TABLE sequence_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

    -- Variant info
    variant_index INTEGER NOT NULL CHECK (variant_index >= 0),
    weight INTEGER DEFAULT 50 CHECK (weight > 0 AND weight <= 100),

    -- Content
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,

    -- Stats
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,

    -- A/B test results
    is_winner BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(sequence_id, variant_index)
);

-- Indexes
CREATE INDEX idx_sequence_variants_sequence ON sequence_variants(sequence_id);
```

---

## 6. Email & Event Tables

### 6.1 Emails

```sql
CREATE TYPE email_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');

CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Relationships
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES sequence_variants(id) ON DELETE SET NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,

    -- Email details
    message_id VARCHAR(255),  -- From email provider
    thread_id VARCHAR(255),

    -- Content (stored for reference)
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    body_text TEXT,

    -- Status
    status email_status DEFAULT 'queued',
    error_message TEXT,

    -- Tracking
    open_tracked BOOLEAN DEFAULT FALSE,
    click_tracked BOOLEAN DEFAULT FALSE,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,

    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_emails_team ON emails(team_id);
CREATE INDEX idx_emails_campaign ON emails(campaign_id);
CREATE INDEX idx_emails_lead ON emails(lead_id);
CREATE INDEX idx_emails_inbox ON emails(inbox_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_scheduled ON emails(scheduled_at) WHERE status = 'queued';
CREATE INDEX idx_emails_sent_at ON emails(sent_at);

-- Partition by month for large datasets
-- Consider partitioning by sent_at for tables with millions of rows
```

### 6.2 Email Events

```sql
CREATE TYPE event_type AS ENUM (
    'queued',
    'sent',
    'delivered',
    'deferred',
    'bounced',
    'soft_bounced',
    'opened',
    'clicked',
    'unsubscribed',
    'spam_reported'
);

CREATE TABLE email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- Event details
    event_type event_type NOT NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    -- For opens: {"user_agent": "...", "ip": "...", "country": "..."}
    -- For clicks: {"url": "...", "user_agent": "...", "ip": "..."}
    -- For bounces: {"bounce_type": "hard", "reason": "..."}

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_events_team ON email_events(team_id);
CREATE INDEX idx_email_events_email ON email_events(email_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created ON email_events(created_at);

-- Partition by month
-- CREATE TABLE email_events_y2024m01 PARTITION OF email_events
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 6.3 Replies

```sql
CREATE TYPE reply_intent AS ENUM (
    'interested',
    'meeting_request',
    'question',
    'not_interested',
    'unsubscribe',
    'out_of_office',
    'auto_reply',
    'bounce',
    'neutral'
);

CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Relationships
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,  -- Original email
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    -- Email details
    message_id VARCHAR(255),
    thread_id VARCHAR(255),
    in_reply_to VARCHAR(255),  -- Original message ID

    -- Content
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    subject VARCHAR(500),
    body_html TEXT,
    body_text TEXT,
    body_preview VARCHAR(500),  -- First 500 chars stripped

    -- Classification
    intent reply_intent,
    intent_confidence DECIMAL(3,2),  -- 0.00 - 1.00
    intent_model VARCHAR(50),  -- 'rule_based', 'gpt-3.5', etc.
    intent_manual_override BOOLEAN DEFAULT FALSE,

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_replies_team ON replies(team_id);
CREATE INDEX idx_replies_lead ON replies(lead_id);
CREATE INDEX idx_replies_inbox ON replies(inbox_id);
CREATE INDEX idx_replies_campaign ON replies(campaign_id);
CREATE INDEX idx_replies_intent ON replies(intent);
CREATE INDEX idx_replies_unread ON replies(is_read, team_id) WHERE is_read = FALSE;
CREATE INDEX idx_replies_received ON replies(received_at);

-- RLS
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their replies"
    ON replies FOR SELECT
    USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
```

---

## 7. Integration Tables

### 7.1 Webhooks

```sql
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    url TEXT NOT NULL,
    secret VARCHAR(255),

    -- Events to trigger on
    events VARCHAR(100)[] NOT NULL,

    -- Status
    active BOOLEAN DEFAULT TRUE,

    -- Stats
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_team ON webhooks(team_id);
CREATE INDEX idx_webhooks_active ON webhooks(active) WHERE active = TRUE;
```

### 7.2 Webhook Logs

```sql
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

    -- Request
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,

    -- Response
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,

    -- Status
    success BOOLEAN,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at);

-- Auto-cleanup (keep 30 days)
-- pg_cron job or application-level cleanup
```

---

## 8. Analytics Tables (Denormalized)

### 8.1 Daily Stats

```sql
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Date
    date DATE NOT NULL,

    -- Aggregate stats
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,

    -- Rates (pre-calculated)
    delivery_rate DECIMAL(5,4),
    open_rate DECIMAL(5,4),
    click_rate DECIMAL(5,4),
    reply_rate DECIMAL(5,4),
    bounce_rate DECIMAL(5,4),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(team_id, date)
);

-- Indexes
CREATE INDEX idx_daily_stats_team_date ON daily_stats(team_id, date);
```

### 8.2 Inbox Daily Stats

```sql
CREATE TABLE inbox_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,

    date DATE NOT NULL,

    -- Campaign sends
    campaign_sent INTEGER DEFAULT 0,
    campaign_delivered INTEGER DEFAULT 0,
    campaign_bounced INTEGER DEFAULT 0,

    -- Warmup
    warmup_sent INTEGER DEFAULT 0,
    warmup_received INTEGER DEFAULT 0,
    warmup_replied INTEGER DEFAULT 0,

    -- Health metrics
    health_score INTEGER,

    UNIQUE(inbox_id, date)
);

-- Indexes
CREATE INDEX idx_inbox_daily_stats_inbox_date ON inbox_daily_stats(inbox_id, date);
```

---

## 9. Queue Tables (BullMQ-compatible)

### 9.1 Job Queue (Optional - if using Postgres queues)

```sql
-- Note: BullMQ uses Redis. This is only needed if you want
-- Postgres-based queues as a fallback or for visibility.

CREATE TYPE job_status AS ENUM ('waiting', 'active', 'completed', 'failed', 'delayed');

CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(100) NOT NULL,

    -- Job info
    job_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,

    -- Status
    status job_status DEFAULT 'waiting',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,

    -- Timing
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error tracking
    last_error TEXT,

    -- Priority (lower = higher priority)
    priority INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_queue_status ON job_queue(queue_name, status, scheduled_at)
    WHERE status IN ('waiting', 'delayed');
CREATE INDEX idx_job_queue_scheduled ON job_queue(scheduled_at)
    WHERE status = 'delayed';
```

---

## 10. Functions & Triggers

### 10.1 Update Timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ... repeat for other tables
```

### 10.2 Update Lead List Count

```sql
CREATE OR REPLACE FUNCTION update_lead_list_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE lead_lists SET lead_count = lead_count + 1 WHERE id = NEW.lead_list_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE lead_lists SET lead_count = lead_count - 1 WHERE id = OLD.lead_list_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.lead_list_id != NEW.lead_list_id THEN
        UPDATE lead_lists SET lead_count = lead_count - 1 WHERE id = OLD.lead_list_id;
        UPDATE lead_lists SET lead_count = lead_count + 1 WHERE id = NEW.lead_list_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lead_list_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_lead_list_count();
```

### 10.3 Reset Daily Counters

```sql
-- Run daily via pg_cron
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void AS $$
BEGIN
    -- Reset inbox daily counters
    UPDATE inboxes SET sent_today = 0;

    -- Reset warmup daily counters
    UPDATE warmup_state SET
        sent_today = 0,
        received_today = 0,
        replied_today = 0;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available)
-- SELECT cron.schedule('reset-daily-counters', '0 0 * * *', 'SELECT reset_daily_counters()');
```

---

## 11. Migrations

### Initial Migration Order

1. `001_create_teams.sql`
2. `002_create_users.sql`
3. `003_create_team_members.sql`
4. `004_create_domains.sql`
5. `005_create_inboxes.sql`
6. `006_create_inbox_settings.sql`
7. `007_create_warmup_tables.sql`
8. `008_create_lead_tables.sql`
9. `009_create_campaign_tables.sql`
10. `010_create_email_tables.sql`
11. `011_create_reply_tables.sql`
12. `012_create_webhook_tables.sql`
13. `013_create_analytics_tables.sql`
14. `014_create_functions_triggers.sql`
15. `015_create_rls_policies.sql`

### Supabase CLI Commands

```bash
# Generate types from database
supabase gen types typescript --project-id your-project-id > src/types/database.ts

# Run migrations
supabase db push

# Reset database (development only)
supabase db reset
```

---

## 12. Indexes Summary

### Critical Indexes for Performance

| Table | Column(s) | Type | Purpose |
|-------|-----------|------|---------|
| leads | (team_id, email) | UNIQUE | Deduplication |
| leads | (next_send_at) | BTREE | Queue processing |
| leads | (status) | BTREE | Filtering |
| emails | (scheduled_at) | BTREE | Queue processing |
| emails | (message_id) | BTREE | Reply matching |
| replies | (is_read, team_id) | PARTIAL | Unread count |
| warmup_state | (enabled) | PARTIAL | Active warmups |
| inbox_settings | (inbox_id) | UNIQUE | Fast lookup |

### Partial Indexes

```sql
-- Only index queued emails
CREATE INDEX idx_emails_queued ON emails(scheduled_at)
    WHERE status = 'queued';

-- Only index unread replies
CREATE INDEX idx_replies_unread ON replies(team_id, received_at)
    WHERE is_read = FALSE;

-- Only index active warmups
CREATE INDEX idx_warmup_active ON warmup_state(inbox_id)
    WHERE enabled = TRUE;
```
