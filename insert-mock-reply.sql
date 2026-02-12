-- First, let's get your team_id and inbox_id (this will show you the values)
SELECT
  t.id as team_id,
  i.id as inbox_id,
  i.email as inbox_email
FROM teams t
JOIN inboxes i ON i.team_id = t.id
LIMIT 1;

-- Create first mock lead (John Doe)
INSERT INTO leads (
  id,
  team_id,
  email,
  first_name,
  last_name,
  company,
  title,
  status,
  created_at
)
SELECT
  gen_random_uuid(),
  t.id,
  'john.doe@example.com',
  'John',
  'Doe',
  'Example Corp',
  'VP of Sales',
  'replied',
  NOW()
FROM teams t
LIMIT 1
ON CONFLICT (team_id, email) DO NOTHING;

-- Create second mock lead (Sarah Johnson)
INSERT INTO leads (
  id,
  team_id,
  email,
  first_name,
  last_name,
  company,
  title,
  status,
  created_at
)
SELECT
  gen_random_uuid(),
  t.id,
  'sarah.johnson@techcorp.com',
  'Sarah',
  'Johnson',
  'TechCorp Inc',
  'CTO',
  'replied',
  NOW()
FROM teams t
LIMIT 1
ON CONFLICT (team_id, email) DO NOTHING;

-- Insert first mock reply (interested)
INSERT INTO replies (
  id,
  team_id,
  lead_id,
  inbox_id,
  from_email,
  from_name,
  subject,
  body_html,
  body_text,
  body_preview,
  intent,
  intent_confidence,
  intent_model,
  is_read,
  is_archived,
  received_at,
  created_at
)
SELECT
  gen_random_uuid(),
  t.id,
  l.id,
  i.id,
  'john.doe@example.com',
  'John Doe',
  'Re: Quick question about your solution',
  '<p>Hi there!</p><p>Thanks for reaching out. I''m definitely interested in learning more about your solution. Could we schedule a quick call this week to discuss?</p><p>Looking forward to hearing from you.</p><p>Best,<br>John</p>',
  'Hi there!\n\nThanks for reaching out. I''m definitely interested in learning more about your solution. Could we schedule a quick call this week to discuss?\n\nLooking forward to hearing from you.\n\nBest,\nJohn',
  'Hi there! Thanks for reaching out. I''m definitely interested in learning more about your solution...',
  'interested',
  0.95,
  'gpt-4o-mini',
  false,
  false,
  NOW() - INTERVAL '30 minutes',
  NOW()
FROM teams t
CROSS JOIN inboxes i
CROSS JOIN leads l
WHERE l.email = 'john.doe@example.com'
  AND i.team_id = t.id
LIMIT 1;

-- Insert second mock reply (question)
INSERT INTO replies (
  id,
  team_id,
  lead_id,
  inbox_id,
  from_email,
  from_name,
  subject,
  body_html,
  body_text,
  body_preview,
  intent,
  intent_confidence,
  intent_model,
  is_read,
  is_archived,
  received_at,
  created_at
)
SELECT
  gen_random_uuid(),
  t.id,
  l.id,
  i.id,
  'sarah.johnson@techcorp.com',
  'Sarah Johnson',
  'Re: Your outreach',
  '<p>Hi,</p><p>I received your email and have a few questions before we proceed:</p><ol><li>What''s your pricing model?</li><li>Do you offer a free trial?</li><li>What kind of support do you provide?</li></ol><p>Thanks,<br>Sarah</p>',
  'Hi,\n\nI received your email and have a few questions before we proceed:\n\n1. What''s your pricing model?\n2. Do you offer a free trial?\n3. What kind of support do you provide?\n\nThanks,\nSarah',
  'Hi, I received your email and have a few questions before we proceed...',
  'question',
  0.88,
  'gpt-4o-mini',
  false,
  false,
  NOW() - INTERVAL '1 hour',
  NOW()
FROM teams t
CROSS JOIN inboxes i
CROSS JOIN leads l
WHERE l.email = 'sarah.johnson@techcorp.com'
  AND i.team_id = t.id
LIMIT 1;

-- Verify the mock replies were created
SELECT
  r.id,
  r.from_email,
  r.from_name,
  r.subject,
  r.body_preview,
  r.intent,
  r.is_read,
  r.received_at
FROM replies r
ORDER BY r.received_at DESC
LIMIT 5;
