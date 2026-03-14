require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function debugCardIds() {
  console.log('Debugging card IDs in spreads vs actual cards...');
  
  try {
    // Get the shared spread
    const { data: spreads, error: spreadsError } = await supabase
      .from('spreads')
      .select('*')
      .ilike('name', '%shared%')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (spreadsError) {
      console.error('Error fetching spreads:', spreadsError);
      return;
    }
    
    if (spreads.length === 0) {
      console.log('No shared spreads found.');
      return;
    }
    
    const spread = spreads[0];
    console.log('Found spread:', spread.name, 'ID:', spread.id);
    console.log('Draft data:', JSON.stringify(spread.draft_data, null, 2));
    
    // Extract card IDs from zoneCards
    let cardIds = [];
    if (spread.draft_data && spread.draft_data.zoneCards) {
      cardIds = Object.values(spread.draft_data.zoneCards).flat();
      console.log('Card IDs in spread:', cardIds);
    }
    
    if (cardIds.length === 0) {
      console.log('No card IDs found in spread.');
      return;
    }
    
    // Check if these cards exist in the database
    console.log('\nChecking if cards exist in database...');
    for (const cardId of cardIds) {
      const { data: cards, error: cardError } = await supabase
        .from('cards')
        .select('id, user_id, shared_with_user_ids, share_with_specific_friends, spread_id')
        .eq('id', cardId);
        
      if (cardError) {
        console.log(`❌ Card ${cardId}: ERROR - ${cardError.message}`);
      } else if (cards && cards.length > 0) {
        const card = cards[0];
        console.log(`✅ Card ${cardId}: EXISTS`);
        console.log(`   Owner: ${card.user_id}`);
        console.log(`   Shared with: ${JSON.stringify(card.shared_with_user_ids)}`);
        console.log(`   Share with specific friends: ${card.share_with_specific_friends}`);
        console.log(`   Spread ID: ${card.spread_id}`);
      } else {
        console.log(`❌ Card ${cardId}: NOT FOUND`);
      }
    }
    
    // Also check what cards DO exist
    console.log('\nChecking what cards exist in the database...');
    const { data: allCards, error: allCardsError } = await supabase
      .from('cards')
      .select('id, user_id')
      .limit(10);
      
    if (allCardsError) {
      console.error('Error fetching all cards:', allCardsError);
    } else {
      console.log('Sample cards in database:');
      allCards.forEach(card => {
        console.log(`  Card ${card.id} owned by ${card.user_id}`);
      });
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugCardIds();
