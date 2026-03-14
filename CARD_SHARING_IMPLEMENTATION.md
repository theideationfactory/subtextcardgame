# Card Sharing Implementation

This document outlines the changes made to implement targeted card sharing functionality in the Subtext Card Game app.

## Changes Made

### 1. Database Schema Updates

Added a new column to the `cards` table:
- `shared_with_user_ids`: UUID array that stores the IDs of users who have been granted access to a card through sharing

### 2. RLS Policy Updates

Created a new RLS policy that allows users to view cards that have been shared with them:
```sql
CREATE POLICY "Users can view cards shared with them"
  ON cards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(shared_with_user_ids));
```

### 3. Application Code Updates

Modified the `handleSendDraft` function in `app/drafts.tsx` to:
- Fetch the current `shared_with_user_ids` for all cards in a spread
- Update each card's `shared_with_user_ids` to include the selected friends
- Create a shared draft with the `shared_with_user_ids` field populated

## How It Works

1. When a user shares a spread with friends:
   - Instead of making cards public, we add the friend's user IDs to each card's `shared_with_user_ids` array
   - A new shared draft is created with the `shared_with_user_ids` field populated with the selected friends

2. When a friend views the shared spread:
   - They can see the cards because their user ID is in the `shared_with_user_ids` array
   - The RLS policy allows access based on this field

## Testing

1. Run the database migrations:
   ```bash
   supabase migration up
   ```

2. Test the sharing functionality:
   - Create a test card and spread
   - Share the spread with a friend
   - Verify that the friend can see the shared cards but other users cannot

3. Use the provided test script:
   ```bash
   node test-card-sharing.js
   ```

## Troubleshooting

If you encounter issues with card visibility:

1. Check that the `shared_with_user_ids` column was added correctly to the `cards` table
2. Verify that the RLS policy was created successfully
3. Ensure that the `handleSendDraft` function is correctly updating the `shared_with_user_ids` field
4. Check the browser console for any errors during the sharing process

## Next Steps

1. Consider adding a UI to show which cards have been shared and with whom
2. Implement functionality to revoke sharing access
3. Add analytics to track sharing activity
