-- Fix Function Search Path Mutable security warnings
-- This migration adds SET search_path to all functions to prevent search_path hijacking attacks

-- Fix update_updated_at function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix update_lead_list_count function
CREATE OR REPLACE FUNCTION update_lead_list_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Fix get_user_team_ids function
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

-- Fix update_reply_templates_updated_at function
CREATE OR REPLACE FUNCTION update_reply_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix handle_new_user function (auth trigger for creating user records)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Add comment explaining the security fix
COMMENT ON FUNCTION update_updated_at() IS 'Trigger function to update updated_at timestamp. SECURITY DEFINER with fixed search_path to prevent search_path hijacking.';
COMMENT ON FUNCTION update_lead_list_count() IS 'Trigger function to maintain lead_count. SECURITY DEFINER with fixed search_path to prevent search_path hijacking.';
COMMENT ON FUNCTION get_user_team_ids() IS 'Helper function for RLS policies. SECURITY DEFINER with fixed search_path to prevent search_path hijacking.';
COMMENT ON FUNCTION update_reply_templates_updated_at() IS 'Trigger function to update reply_templates updated_at. SECURITY DEFINER with fixed search_path to prevent search_path hijacking.';
COMMENT ON FUNCTION handle_new_user() IS 'Auth trigger to create user record on signup. SECURITY DEFINER with fixed search_path to prevent search_path hijacking.';
