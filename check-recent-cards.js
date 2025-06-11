require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRecentCards() {
  console.log('Checking recently created cards...');
  
  try {
    // Get cards created in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentCards, error } = await supabase
      .from('cards')
      .select('id, user_id, spread_id, shared_with_user_ids, share_with_specific_friends, created_at')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching recent cards:', error);
      return;
    }
    
    console.log(`Found ${recentCards?.length || 0} cards created in the last hour:`);
    
    recentCards?.forEach(card => {
      console.log('\nCard:', card.id);
      console.log('  Created at:', card.created_at);
      console.log('  User ID:', card.user_id);
      console.log('  Spread ID:', card.spread_id);
      console.log('  Shared with:', card.shared_with_user_ids);
      console.log('  Share with specific friends:', card.share_with_specific_friends);
    });
    
    // Also check total cards with spread_id set
    const { data: cardsWithSpreadId, error: countError } = await supabase
      .from('cards')
      .select('id, spread_id')
      .not('spread_id', 'is', null);
      
    if (!countError) {
      console.log(`\nTotal cards with spread_id set: ${cardsWithSpreadId?.length || 0}`);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkRecentCards();
