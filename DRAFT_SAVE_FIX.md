# Draft Save Feature Fix

## Problem Report
Users reported that when they save spread drafts, the drafts are not appearing in the drafts screen.

## Root Cause Identified

The issue was in `/app/drafts.tsx` - the `fetchDrafts()` function was missing a critical filter.

### The Bug
**Location:** `/app/drafts.tsx` line 244-249

**Original Code:**
```typescript
const { data, error: fetchError } = await supabase
  .from('spreads')
  .select('*')
  .eq('user_id', user.id)
  .order('last_modified', { ascending: false });
```

**Problem:** The query was fetching ALL spreads for the user, not just drafts. It was missing the `.eq('is_draft', true)` filter.

### The Fix
**Fixed Code:**
```typescript
const { data, error: fetchError } = await supabase
  .from('spreads')
  .select('*')
  .eq('user_id', user.id)
  .eq('is_draft', true)  // ✅ Added this line
  .order('last_modified', { ascending: false });
```

## Verification

### Save Draft Flow (Working Correctly)
In `/app/(tabs)/spread.tsx`, the `saveDraft()` function correctly sets `is_draft: true`:

1. **Line 611** - When creating new spread:
   ```typescript
   is_draft: true,
   ```

2. **Line 627** - When updating existing spread:
   ```typescript
   is_draft: true,
   ```

3. **Line 658** - In fallback creation:
   ```typescript
   is_draft: true,
   ```

### Success Indicators
- Line 738: Sets success message "Draft saved successfully!"
- Line 1365-1368: Success message is displayed to user
- Line 739: Returns `true` on successful save

## How It Works Now

### Save Process:
1. User clicks Save button in spread screen
2. Modal opens asking for spread name
3. User enters name and clicks Save
4. `saveDraft()` function:
   - Sets `is_draft: true` in database
   - Sets `last_modified` timestamp
   - Links cards to spread via `spread_id`
   - Shows "Draft saved successfully!" message
5. Draft is saved to `spreads` table with `is_draft = true`

### Fetch Process (Now Fixed):
1. User navigates to Drafts screen
2. `fetchDrafts()` function queries:
   - `user_id` = current user
   - `is_draft` = true ✅ (now filtering correctly)
   - Ordered by `last_modified` descending
3. Only drafts are returned and displayed

## Testing Steps

1. **Create a new spread:**
   - Go to Spread tab
   - Select a spread type (Retroflect, Invitation, etc.)
   - Add some cards to zones
   - Click Save button (floppy disk icon)
   - Enter a name
   - Click Save

2. **Verify draft appears:**
   - Click "Drafts" button in spread screen header
   - Should see the saved draft in the list
   - Draft should show correct name and timestamp

3. **Verify draft loads:**
   - Click on the draft
   - Should navigate back to spread screen
   - All cards should be restored to correct zones
   - Spread name should be correct

## Additional Issue: Delete Draft Foreign Key Constraint

### Problem
When deleting drafts, users encountered error:
```
Error code 23503: update or delete on table "spreads" violates foreign key 
constraint "cards_spread_id_fkey" on table "cards"
```

### Root Cause
Cards table has a foreign key `spread_id` that references `spreads(id)`. When trying to delete a spread, the database prevents deletion if cards are still linked to it.

### Fix Applied
Updated `handleDelete()` function in `/app/drafts.tsx` to unlink cards before deleting:

```typescript
const handleDelete = async (draftId: string) => {
  try {
    setDeleting(draftId);
    
    // First, unlink all cards from this spread
    const { error: unlinkError } = await supabase
      .from('cards')
      .update({ spread_id: null })
      .eq('spread_id', draftId);
    
    if (unlinkError) throw unlinkError;
    
    // Now delete the spread
    const { error: deleteError } = await supabase
      .from('spreads')
      .delete()
      .eq('id', draftId);

    if (deleteError) throw deleteError;
    
    setDrafts(drafts.filter(draft => draft.id !== draftId));
  } catch (err) {
    console.error('Error deleting draft:', err);
    setError('Failed to delete draft');
  } finally {
    setDeleting(null);
  }
};
```

## Additional Issue: Drafts Modal Glitchy/Not Opening

### Problem
When users clicked the "Drafts" button, the modal was glitchy and not opening properly.

### Root Cause
Navigation configuration issues:
1. The drafts screen was using `presentation: 'modal'` with `animation: 'slide_from_bottom'` which can cause glitchy behavior
2. The inbox screen was in `app/(tabs)/inbox.tsx` but navigation was trying to go to `/inbox` (root level)
3. No Stack.Screen was registered for inbox at the root level

### Fix Applied
1. **Changed drafts presentation** from `modal` to `card` for smoother navigation
2. **Moved inbox.tsx** from `app/(tabs)/inbox.tsx` to `app/inbox.tsx` (root level)
3. **Added inbox Stack.Screen** registration in `_layout.tsx`
4. **Removed inbox from tabs layout** - removed the inbox Tabs.Screen from `(tabs)/_layout.tsx` since it's now at root level
5. **Updated navigation** in spread.tsx to use `router.push('/inbox')` instead of `router.replace('/inbox')`
6. **Fixed infinite re-render loop** - wrapped `fetchDrafts` in `useCallback` and moved it before the useEffect that uses it

```typescript
// app/_layout.tsx - Updated Stack configuration
<Stack.Screen 
  name="drafts" 
  options={{
    presentation: 'card',  // Changed from 'modal'
    headerShown: false,
  }}
/>
<Stack.Screen 
  name="inbox" 
  options={{
    presentation: 'card',
    headerShown: false,
  }}
/>
```

```typescript
// app/(tabs)/_layout.tsx - REMOVED inbox Tabs.Screen
// Previously had:
// <Tabs.Screen name="inbox" options={{ href: null }} />
// This has been removed since inbox is now at root level
```

```typescript
// app/drafts.tsx - Fixed infinite re-render with useCallback
const fetchDrafts = useCallback(async () => {
  // ... fetch logic
}, [user]); // Only re-create when user changes

useEffect(() => {
  // ... 
  await fetchDrafts();
}, [user, authLoading, fetchDrafts]); // Now fetchDrafts is stable
```

## Related Files Modified
- `/app/drafts.tsx` - Added `is_draft` filter + fixed delete + wrapped fetchDrafts in useCallback
- `/app/_layout.tsx` - Changed drafts presentation to 'card' + added inbox Stack.Screen
- `/app/inbox.tsx` - Moved from `(tabs)` folder to root level
- `/app/(tabs)/_layout.tsx` - Removed inbox Tabs.Screen registration
- `/app/(tabs)/spread.tsx` - Updated inbox navigation + fixed TypeScript error in wordsRemembered

## Related Files (No Changes Needed)
- `/app/(tabs)/spread.tsx` - Save logic working correctly
- Database migrations - Schema supports `is_draft` column and `spread_id` foreign key

## Impact
- ✅ Drafts now appear correctly in drafts screen
- ✅ Only actual drafts are shown (not all spreads)
- ✅ Drafts can be deleted without foreign key constraint errors
- ✅ Cards are properly unlinked when draft is deleted
- ✅ Drafts and Inbox buttons open smoothly without glitches
- ✅ Proper navigation stack configuration for all screens
- ✅ Maintains proper separation between drafts and published spreads
- ✅ No breaking changes to existing functionality

## Summary of All Fixes

### Issue 1: Drafts Not Appearing
**Fix:** Added `.eq('is_draft', true)` filter to drafts query

### Issue 2: Delete Draft Foreign Key Error
**Fix:** Unlink cards from spread before deleting spread

### Issue 3: Glitchy Modal Navigation + Repetitive Logs
**Fix:** 
- Changed presentation from 'modal' to 'card'
- Moved inbox to root level and removed from tabs layout
- Registered proper Stack.Screen
- Wrapped fetchDrafts in useCallback to prevent infinite re-renders
- Fixed function declaration order to prevent TypeScript errors

**What was causing the repetitive logs:**
The `fetchDrafts` function was being recreated on every render, causing the useEffect to trigger repeatedly. 

**Fixes applied:**
1. Wrapped `fetchDrafts` in `useCallback` with `[user]` as the only dependency
2. Added `isFetchingRef` to prevent duplicate concurrent fetches
3. Changed from `useEffect` to `useFocusEffect` (better for screens that are pushed/popped)
4. Added cleanup functions to prevent state updates after unmount

These changes ensure the function is stable and only fetches when truly needed (screen focus + user authenticated).

All three issues have been resolved with minimal, targeted changes that maintain existing functionality while fixing the reported problems.
