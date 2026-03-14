/**
 * Script to check if cards in shared spreads have the correct sharing settings
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSharedCards() {
  console.log('Checking recently shared spreads and their cards...');
  
  try {
    // Get recently shared spreads (last 5)
    const { data: sharedSpreads, error: spreadError } = await supabase
      .from('spreads')
      .select('*')
      .not('shared_with_user_ids', 'is', null)
      .order('last_modified', { ascending: false })
      .limit(5);
    
    if (spreadError) throw spreadError;
    
    if (!sharedSpreads || sharedSpreads.length === 0) {
      console.log('No shared spreads found.');
      return;
    }
    
    console.log(`Found ${sharedSpreads.length} recently shared spreads.`);
    
    // For each shared spread, check its cards
    for (const spread of sharedSpreads) {
      console.log(`\nChecking Spread: "${spread.name}" (ID: ${spread.id})`);
      console.log(`Shared with user IDs: ${JSON.stringify(spread.shared_with_user_ids)}`);
      
      // Extract card IDs from the spread
      let cardIds = [];
      if (spread.draft_data && spread.draft_data.zoneCards) {
        const zoneCards = spread.draft_data.zoneCards;
        Object.values(zoneCards).forEach(zoneCardIds => {
          cardIds = [...cardIds, ...zoneCardIds];
        });
      }
      
      if (cardIds.length === 0) {
        console.log(`  No cards found in this spread.`);
        continue;
      }
      
      console.log(`  Found ${cardIds.length} cards in this spread.`);
      
      // Check each card's sharing settings
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, name, shared_with_user_ids, share_with_specific_friends')
        .in('id', cardIds);
      
      if (cardsError) {
        console.error(`  Error fetching cards: ${cardsError.message}`);
        continue;
      }
      
      if (!cards || cards.length === 0) {
        console.log(`  No cards found with the given IDs.`);
        continue;
      }
      
      // Check if each card is properly shared
      cards.forEach(card => {
        console.log(`  Card: "${card.name}" (ID: ${card.id})`);
        console.log(`    share_with_specific_friends: ${card.share_with_specific_friends}`);
        console.log(`    shared_with_user_ids: ${JSON.stringify(card.shared_with_user_ids)}`);
        
        // Compare with spread's shared_with_user_ids
        const spreadUserIds = spread.shared_with_user_ids || [];
        const cardUserIds = card.shared_with_user_ids || [];
        
        const allRecipientsIncluded = spreadUserIds.every(userId => 
          cardUserIds.includes(userId)
        );
        
        if (!card.share_with_specific_friends) {
          console.log(`    ❌ share_with_specific_friends is false!`);
        }
        
        if (!allRecipientsIncluded) {
          console.log(`    ❌ Not all spread recipients are included in card's shared_with_user_ids!`);
        } else if (card.share_with_specific_friends) {
          console.log(`    ✅ Card is correctly shared with all recipients`);
        }
      });
    }
    
    console.log('\nCheck completed.');
    
  } catch (error) {
    console.error('Error during check:', error);
  }
}

// Run the check
checkSharedCards()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
