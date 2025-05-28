# Fix for "Row Level Security Policy" Error

If you're seeing the error: `"new row violates row-level security policy for table \"spreads\""`, follow these steps:

## Quick Fix

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Run the following migrations in order:

### Migration 1: Fix RLS Policies
Copy and paste the contents of `supabase/migrations/20250528021300_fix_spreads_rls_policies.sql`

### Migration 2: Check Table Structure  
Copy and paste the contents of `supabase/migrations/20250528021301_check_spreads_table_structure.sql`

## What This Fixes

The error occurs because Supabase's Row Level Security (RLS) policies are preventing authenticated users from creating new spreads. The migrations:

1. **Set up proper RLS policies** that allow users to:
   - View their own spreads
   - Create new spreads with their user_id
   - Update their own spreads
   - Delete their own spreads

2. **Ensure proper table structure**:
   - Adds missing columns if needed (is_draft, last_modified)
   - Sets up proper defaults for user_id
   - Creates indexes for better performance
   - Sets up auto-update trigger for last_modified

## Alternative: Temporary Disable RLS (NOT RECOMMENDED for production)

If you need a quick temporary fix for development:

```sql
-- TEMPORARY: Disable RLS on spreads table
ALTER TABLE spreads DISABLE ROW LEVEL SECURITY;
```

⚠️ **WARNING**: Only use this for development. Always use proper RLS policies in production.

## Verification

After running the migrations, test by:
1. Creating a new spread
2. Saving it as a draft
3. Loading it from the drafts screen

The error should now be resolved.
