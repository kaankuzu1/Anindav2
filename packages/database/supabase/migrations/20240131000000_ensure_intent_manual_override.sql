-- Ensure intent_manual_override column exists with default
ALTER TABLE replies
ADD COLUMN IF NOT EXISTS intent_manual_override BOOLEAN DEFAULT FALSE;

-- Add index for performance (only index TRUE values for efficiency)
CREATE INDEX IF NOT EXISTS idx_replies_intent_manual_override
ON replies(intent_manual_override)
WHERE intent_manual_override = true;

-- Add comment for documentation
COMMENT ON COLUMN replies.intent_manual_override IS 'Indicates if the intent was manually set by a user and should not be overwritten by AI batch operations';
