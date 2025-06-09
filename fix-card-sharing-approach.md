# Fix for Card Sharing Issue

## Root Cause
The card IDs referenced in the spread's `zoneCards` don't exist in the database. When we create a shared spread, we copy the spread data but not the actual cards.

## Solution
Instead of trying to update non-existent cards, we need to:

1. **Fetch the original cards** from the original spread
2. **Create shared copies** of those cards with new IDs
3. **Update the shared spread's zoneCards** to reference the new card IDs
4. **Set the spread_id** on the new cards to link them to the shared spread

## Implementation Steps
1. Get card IDs from original spread
2. Fetch actual cards from database
3. Create copies of cards with sharing settings
4. Update shared spread's zoneCards with new card IDs
5. Set spread_id on new cards

This approach ensures:
- Cards exist in the database
- Cards are properly linked to the shared spread
- Sharing permissions are correctly set
- Each user gets their own copy of shared cards
