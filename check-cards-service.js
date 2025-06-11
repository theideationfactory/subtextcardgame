require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCardsService() {
  console.log('Checking cards with service role (bypassing RLS)...\n');
  
  const cardIdsToCheck = [
    'ae6573f1-d851-448d-b1de-5e3bbc2bd91c',
    'e8ca2672-1801-4d87-9339-f74ea0ff7749',
    'e8e72a03-c657-43a7-b3c1-3e7d8c18a714',
    '2b67cd42-1039-40ac-93d4-404ed671b042'
  ];
  
  try {
    // Check each card
    for (const cardId of cardIdsToCheck) {
      const { data: card, error } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .single();
        
      if (error) {
        console.log(`Card ${cardId}: NOT FOUND`);
        console.log(`  Error: ${error.message}`);
      } else {
        console.log(`Card ${cardId}: FOUND`);
        console.log(`  Name: ${card.name}`);
        console.log(`  Owner: ${card.user_id}`);
        console.log(`  Spread ID: ${card.spread_id}`);
        console.log(`  Shared with: ${JSON.stringify(card.shared_with_user_ids)}`);
        console.log(`  Share with specific friends: ${card.share_with_specific_friends}`);
      }
      console.log('');
    }
    
    // Also check total card count
    const { count, error: countError } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
      
    if (!countError) {
      console.log(`\nTotal cards in database: ${count}`);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkCardsService();
