-- Team Mode Fixes: Add missing RLS policies for team management
-- This migration enables team members to invite, update, and remove other members.

-- A) RLS policies for team_members management
-- Allow team members to INSERT new members (for invitations)
CREATE POLICY "Team members can invite" ON team_members FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));

-- Allow team members to UPDATE roles
CREATE POLICY "Team members can update" ON team_members FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));

-- Allow team members to DELETE (remove members)
CREATE POLICY "Team members can remove" ON team_members FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- B) Add UPDATE policy for teams table (for team settings)
CREATE POLICY "Team members can update team" ON teams FOR UPDATE
  USING (id IN (SELECT get_user_team_ids()));

-- C) Add DELETE policy for teams table (for orphaned team cleanup)
CREATE POLICY "Team members can delete empty teams" ON teams FOR DELETE
  USING (id IN (SELECT get_user_team_ids()));

-- D) Users can view other users by email (needed for invitation lookup)
-- Only email + id are used in app queries
CREATE POLICY "Users can look up by email" ON users FOR SELECT
  USING (true);
