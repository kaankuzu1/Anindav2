-- Add email verification columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS email_verification_status VARCHAR(20) DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS email_risk_score INTEGER,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create index for efficient filtering by verification status
CREATE INDEX IF NOT EXISTS idx_leads_verification_status ON leads(email_verification_status);

-- Add comment for documentation
COMMENT ON COLUMN leads.email_verification_status IS 'Email verification status: unverified, verifying, valid, invalid, catch_all, risky, unknown';
COMMENT ON COLUMN leads.email_risk_score IS 'Risk score from 0-100, higher is riskier';
COMMENT ON COLUMN leads.email_verified_at IS 'Timestamp when email was last verified';
