require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testSharingFix() {
  console.log('Testing card sharing fix...\n');
  
  try {
    // Get a recent shared spread
    const { data: sharedSpreads, error: spreadError } = await supabase
      .from('spreads')
      .select('*')
      .not('shared_with_user_ids', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (spreadError) {
      console.error('Error fetching shared spreads:', spreadError);
      return;
    }
    
    console.log(`Found ${sharedSpreads?.length || 0} shared spreads\n`);
    
    for (const spread of sharedSpreads || []) {
      console.log(`\nSpread: ${spread.id}`);
      console.log(`  Name: ${spread.name}`);
      console.log(`  Owner: ${spread.user_id}`);
      console.log(`  Shared with: ${JSON.stringify(spread.shared_with_user_ids)}`);
      console.log(`  Created: ${spread.created_at}`);
      
      if (spread.draft_data?.zoneCards) {
        const zoneCards = spread.draft_data.zoneCards;
        const allCardIds = Object.values(zoneCards).flat();
        console.log(`  Total cards in zones: ${allCardIds.length}`);
        
        // Check if these cards exist
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select('id, name, user_id, spread_id, shared_with_user_ids')
          .in('id', allCardIds);
          
        if (cardsError) {
          console.error('  Error fetching cards:', cardsError);
        } else {
          console.log(`  Found ${cards?.length || 0} of ${allCardIds.length} cards in database`);
          
          // Check spread_id linkage
          const cardsWithSpreadId = cards?.filter(c => c.spread_id === spread.id) || [];
          console.log(`  Cards linked to this spread: ${cardsWithSpreadId.length}`);
          
          // Show card details
          cards?.forEach(card => {
            console.log(`\n    Card ${card.id}:`);
            console.log(`      Name: ${card.name}`);
            console.log(`      Owner: ${card.user_id}`);
            console.log(`      Spread ID: ${card.spread_id}`);
            console.log(`      Shared with: ${JSON.stringify(card.shared_with_user_ids)}`);
          });
          
          // Show missing cards
          const foundCardIds = new Set(cards?.map(c => c.id) || []);
          const missingCardIds = allCardIds.filter(id => !foundCardIds.has(id));
          if (missingCardIds.length > 0) {
            console.log(`\n  Missing cards: ${missingCardIds.join(', ')}`);
          }
        }
      }
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testSharingFix();
