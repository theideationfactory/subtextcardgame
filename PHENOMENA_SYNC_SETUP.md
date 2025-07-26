# Custom Phenomena Types Cross-Device Sync Setup

## Overview
This update enables custom phenomena types created in the deck creation screen to sync across all devices when users sign in with the same account.

## Database Migration Required

### Step 1: Apply Database Migrations
1. Open your Supabase Dashboard
2. Navigate to SQL Editor
3. **First**, run: `supabase/migrations/20250726133400_fix_spreads_rls_recursion.sql`
   - This fixes an infinite recursion issue in spreads table RLS policies
4. **Then**, run: `supabase/migrations/20250726132800_add_custom_phenomena_to_users.sql`
   - This adds the custom phenomena types column to users table

### Step 2: Verify Migration
After running the migration, verify:
- The `users` table now has a `custom_phenomena_types` column
- Existing users have default phenomena types populated
- RLS policies are created for user access

## How It Works

### Previous Behavior (AsyncStorage)
- Custom phenomena types stored locally on each device
- Types didn't sync across devices
- Users lost customizations when switching devices

### New Behavior (Database Sync)
- Custom phenomena types stored in database per user
- Automatically syncs across all devices
- Existing AsyncStorage data migrates automatically
- Fallback to AsyncStorage if database fails

## Testing Steps

1. **Test Migration**: 
   - User with existing custom phenomena should see them after migration
   
2. **Test Cross-Device Sync**:
   - Device A: Create custom phenomena types
   - Device B: Sign in with same account
   - Verify: Custom types appear on Device B
   
3. **Test Real-Time Updates**:
   - Device A: Add/remove phenomena types
   - Device B: Refresh deck creation or card creation
   - Verify: Changes appear on Device B

## Files Modified

- `supabase/migrations/20250726133400_fix_spreads_rls_recursion.sql` - Fix RLS policy recursion
- `supabase/migrations/20250726132800_add_custom_phenomena_to_users.sql` - Database migration
- `app/(tabs)/deck-creation.tsx` - Database sync for deck creation
- `app/(tabs)/card-creation-new.tsx` - Database sync for card creation
- `app/(tabs)/index.tsx` - Database sync for main cards screen

## Fallback Behavior

If database operations fail:
1. System falls back to AsyncStorage
2. Data remains functional on current device
3. User can continue using the app normally
4. Sync will resume when database connectivity is restored

## Database Schema

```sql
-- New column added to users table
ALTER TABLE users 
ADD COLUMN custom_phenomena_types jsonb DEFAULT '["Intention", "Context", "Impact", "Accuracy", "Agenda", "Needs", "Emotion", "Role"]'::jsonb;
```

## RLS Policies

- Users can read their own custom phenomena types
- Users can update their own custom phenomena types
- Data is isolated per user account
