require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function listAllCards() {
  console.log('Listing all cards in the database...');
  
  try {
    // Get all cards
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, user_id, name, spread_id')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) {
      console.error('Error fetching cards:', error);
      return;
    }
    
    console.log(`Found ${cards?.length || 0} cards:`);
    
    cards?.forEach(card => {
      console.log(`\nCard: ${card.id}`);
      console.log(`  Name: ${card.name}`);
      console.log(`  Owner: ${card.user_id}`);
      console.log(`  Spread ID: ${card.spread_id}`);
    });
    
    // Group by user
    const cardsByUser = {};
    cards?.forEach(card => {
      if (!cardsByUser[card.user_id]) {
        cardsByUser[card.user_id] = [];
      }
      cardsByUser[card.user_id].push(card.id);
    });
    
    console.log('\n\nCards by user:');
    Object.entries(cardsByUser).forEach(([userId, cardIds]) => {
      console.log(`\nUser ${userId}: ${cardIds.length} cards`);
      console.log(`  Card IDs: ${cardIds.join(', ')}`);
    });
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

listAllCards();
