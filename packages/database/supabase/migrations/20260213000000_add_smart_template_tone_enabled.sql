-- Add smart_template_tone_enabled to sequences and sequence_variants
-- This controls whether tone adjustment is applied as a separate AI step
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS smart_template_tone_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sequence_variants ADD COLUMN IF NOT EXISTS smart_template_tone_enabled BOOLEAN DEFAULT FALSE;
