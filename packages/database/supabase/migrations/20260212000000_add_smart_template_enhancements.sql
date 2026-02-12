-- Smart Campaign Enhancements: language toggle + creator notes
-- Optional language matching (default TRUE for backward compat)
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS smart_template_language_match BOOLEAN DEFAULT TRUE;
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS smart_template_language_match BOOLEAN DEFAULT TRUE;

-- Creator notes for AI context
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS smart_template_notes TEXT;
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS smart_template_notes TEXT;
