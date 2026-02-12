-- Fix: handle_new_user() trigger now creates team + team_members on signup
-- Without this, get_user_team_ids() returns empty and all RLS policies block data access

-- ============================================
-- Step 1: Backfill teams for existing users
-- ============================================

DO $$
DECLARE
    r RECORD;
    new_team_id UUID;
    email_prefix TEXT;
    team_slug TEXT;
    team_name TEXT;
BEGIN
    FOR r IN
        SELECT u.id, u.email, u.full_name
        FROM public.users u
        WHERE NOT EXISTS (
            SELECT 1 FROM public.team_members tm WHERE tm.user_id = u.id
        )
    LOOP
        -- Generate slug from email prefix + random suffix
        email_prefix := split_part(r.email, '@', 1);
        team_slug := email_prefix || '-' || substr(gen_random_uuid()::text, 1, 8);

        -- Team name from full_name, fallback to email
        team_name := COALESCE(NULLIF(r.full_name, ''), r.email);

        -- Create team
        INSERT INTO public.teams (id, name, slug)
        VALUES (gen_random_uuid(), team_name, team_slug)
        RETURNING id INTO new_team_id;

        -- Create team membership as owner
        INSERT INTO public.team_members (team_id, user_id, role)
        VALUES (new_team_id, r.id, 'owner');

        RAISE NOTICE 'Created team for user %', r.email;
    END LOOP;
END;
$$;

-- ============================================
-- Step 2: Update handle_new_user() trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_team_id UUID;
    email_prefix TEXT;
    team_slug TEXT;
    team_name TEXT;
BEGIN
    -- 1. Create user record (existing behavior)
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create team for the new user (if they don't already have one)
    IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = NEW.id) THEN
        email_prefix := split_part(NEW.email, '@', 1);
        team_slug := email_prefix || '-' || substr(gen_random_uuid()::text, 1, 8);
        team_name := COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            NEW.email
        );

        INSERT INTO public.teams (id, name, slug)
        VALUES (gen_random_uuid(), team_name, team_slug)
        RETURNING id INTO new_team_id;

        -- 3. Add user as team owner
        INSERT INTO public.team_members (team_id, user_id, role)
        VALUES (new_team_id, NEW.id, 'owner')
        ON CONFLICT (team_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION handle_new_user() IS 'Auth trigger to create user record, team, and team_members on signup. SECURITY DEFINER with fixed search_path.';
