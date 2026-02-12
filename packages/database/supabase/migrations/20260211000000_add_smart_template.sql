-- Smart Template: AI-personalized email generation per lead
-- sequences table: smart template toggle + tone for main step
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS smart_template_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS smart_template_tone VARCHAR(30) DEFAULT 'professional';

-- sequence_variants table: independent toggle + tone per variant
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS smart_template_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS smart_template_tone VARCHAR(30) DEFAULT 'professional';

-- leads table: free-text analysis notes for AI personalization
ALTER TABLE leads ADD COLUMN IF NOT EXISTS analysis_notes TEXT;

-- emails table: track which emails were AI-personalized
ALTER TABLE emails ADD COLUMN IF NOT EXISTS smart_template_personalized BOOLEAN DEFAULT FALSE;
