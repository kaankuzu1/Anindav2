# Security Fixes for Supabase Warnings

## Overview

Your Supabase Security Advisor detected 6 warnings:
- 5 Function Search Path Mutable warnings
- 1 Leaked Password Protection Disabled warning

---

## Fix 1: Function Search Path Issues (CRITICAL)

### What's the problem?

PostgreSQL functions without a fixed `search_path` are vulnerable to search path hijacking attacks. An attacker could create a malicious function in a schema that gets executed instead of the intended one.

### Solution

A migration has been created at:
```
packages/database/supabase/migrations/20240127000000_fix_function_search_path.sql
```

This migration fixes all 5 functions by adding `SET search_path = public` and `SECURITY DEFINER`:
- ✅ `update_updated_at`
- ✅ `update_lead_list_count`
- ✅ `get_user_team_ids`
- ✅ `update_reply_templates_updated_at`
- ✅ `handle_new_user`

### How to apply

**Option 1: Via Supabase Dashboard (Recommended)**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `packages/database/supabase/migrations/20240127000000_fix_function_search_path.sql`
4. Copy the entire SQL content
5. Paste it into the SQL Editor
6. Click **Run**
7. Go back to Security Advisor and click **Refresh**

**Option 2: Via Supabase CLI**

```bash
# If you have Supabase CLI linked to your project
supabase db push

# This will apply all pending migrations
```

**Option 3: Manual Application**

If you prefer to manually add the migration to your existing database:

```bash
# Run the migration directly
pnpm db:push
```

---

## Fix 2: Leaked Password Protection (MEDIUM PRIORITY)

### What's the problem?

Supabase Auth can check user passwords against the HaveIBeenPwned database to prevent users from using compromised passwords. This is currently disabled.

### Solution

This is a **configuration setting**, not a database migration.

### How to enable

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Policies**
3. Scroll to **Security** section
4. Find **Leaked Password Protection**
5. Toggle it **ON**

**Note:** This will prevent users from using passwords that appear in known data breaches. Existing users won't be forced to change passwords, but new signups and password changes will be validated.

---

## Verification

After applying the fixes:

1. Go to **Advisors** → **Security Advisor**
2. Click **Refresh** or **Rerun Linter**
3. All warnings should be resolved

Expected result:
- ✅ 0 errors
- ✅ 0 warnings
- ✅ 0 suggestions

---

## Security Impact

### Before Fix:
- **Risk Level:** HIGH
- **Attack Vector:** Search path hijacking, SQL injection
- **Affected Functions:** All trigger functions and RLS helper functions

### After Fix:
- **Risk Level:** LOW
- **Mitigation:** Functions now run with fixed search path, preventing malicious schema injection
- **Best Practice:** All functions use `SECURITY DEFINER` with `SET search_path = public`

---

## Additional Security Recommendations

1. **Enable RLS on all tables** ✅ (Already done)
2. **Use parameterized queries** ✅ (TypeScript + Supabase client handles this)
3. **Rotate encryption keys periodically** ⚠️ (Manual process)
4. **Enable MFA for admin accounts** ⚠️ (Recommended for production)
5. **Regular security audits** ⚠️ (Use Security Advisor monthly)

---

## Questions?

If you encounter any issues applying these fixes:
- Check Supabase Dashboard → Logs for error messages
- Verify you have the necessary permissions (database owner/admin)
- Ensure no active transactions are blocking the migration
