# Debug Draft Sharing Issue

## Problem
Recipients can see shared spreads but not the cards within those spreads.

## Root Causes Identified and Fixed

### 1. Array Containment Syntax in fetchCards Function
**Issue**: The `fetchCards` function in `contexts/AuthContext.tsx` was using incorrect PostgreSQL array containment syntax.

**Fix**: Changed from `shared_with_user_ids.cs.{${user.id}}` to `shared_with_user_ids.cs.{"${user.id}"}` (added quotes around UUID).

### 2. Missing Database Trigger Function
**Issue**: The database schema references a trigger `trg_propagate_spread_sharing` that calls `propagate_spread_sharing()` function, but this function was missing.

**Fix**: Created migration file `20250721081200_add_propagate_spread_sharing_function.sql` with the missing function.

### 3. Added Debug Logging
**Enhancement**: Added detailed logging to the `loadDraft` function in `spread.tsx` to help identify which cards are missing from the cardsById map.

## Testing Instructions

1. **Run the Database Migration**: Apply the new migration file in Supabase Dashboard:
   ```sql
   -- Execute the content of: supabase/migrations/20250721081200_add_propagate_spread_sharing_function.sql
   ```

2. **Test the Sharing Flow**:
   - User A creates a spread with cards
   - User A shares the spread with User B
   - User B should now see both the spread AND all cards within it

3. **Check Console Logs**:
   - Look for "Processing zone" and "Card not found" messages
   - Check "Available card IDs in cardMap" vs "Card IDs in shared draft zoneCards"

## Expected Behavior After Fix

When User B opens a shared spread from User A:
1. `fetchCards()` should return cards that have User B's ID in `shared_with_user_ids`
2. Cards should be found in the `cardsById` map
3. All zones should restore with the expected number of cards
4. No "Card not found" warnings should appear

## Key Files Modified

- `contexts/AuthContext.tsx` - Fixed array containment syntax
- `app/(tabs)/spread.tsx` - Added debug logging
- `supabase/migrations/20250721081200_add_propagate_spread_sharing_function.sql` - Created missing trigger function

## Database Schema Requirements

The fix assumes the following database structure exists:
- `cards` table has `shared_with_user_ids` UUID array column
- `cards` table has `share_with_specific_friends` boolean column
- `spreads` table has `shared_with_user_ids` UUID array column
- `spreads` table has `share_with_specific_friends` boolean column
- RLS policies allow viewing cards based on spread permissions (already exists)
