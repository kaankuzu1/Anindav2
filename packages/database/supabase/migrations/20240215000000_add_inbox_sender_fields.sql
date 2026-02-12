-- Add sender information fields to inboxes table
ALTER TABLE inboxes
  ADD COLUMN IF NOT EXISTS sender_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sender_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sender_company VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sender_title VARCHAR(150),
  ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sender_website VARCHAR(300);
