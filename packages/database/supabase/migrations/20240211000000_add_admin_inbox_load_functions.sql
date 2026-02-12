-- Migration: Add helper functions for admin inbox load management
-- These functions are used to atomically increment/decrement the current_load counter
-- when assignments are created or deleted.

-- Increment admin inbox current_load
CREATE OR REPLACE FUNCTION increment_admin_inbox_load(inbox_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_inboxes
  SET current_load = current_load + 1,
      updated_at = now()
  WHERE id = inbox_id;
END;
$$;

-- Decrement admin inbox current_load (ensuring it doesn't go below 0)
CREATE OR REPLACE FUNCTION decrement_admin_inbox_load(inbox_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_inboxes
  SET current_load = GREATEST(current_load - 1, 0),
      updated_at = now()
  WHERE id = inbox_id;
END;
$$;

-- Grant execute permissions to service_role
GRANT EXECUTE ON FUNCTION increment_admin_inbox_load(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_admin_inbox_load(UUID) TO service_role;
