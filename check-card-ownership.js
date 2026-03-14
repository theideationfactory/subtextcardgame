require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCardOwnership() {
  console.log('Checking card ownership...');
  
  const cardId = '2b67cd42-1039-40ac-93d4-404ed671b042';
  const userId = 'a0b60b23-9678-46cd-8a20-10370bfdf411';
  
  try {
    // Check if card exists and who owns it
    const { data: card, error } = await supabase
      .from('cards')
      .select('id, user_id, name, shared_with_user_ids, share_with_specific_friends, spread_id')
      .eq('id', cardId)
      .single();
      
    if (error) {
      console.error('Error fetching card:', error);
      return;
    }
    
    if (!card) {
      console.log('Card not found!');
      return;
    }
    
    console.log('Card found:');
    console.log('  ID:', card.id);
    console.log('  Owner:', card.user_id);
    console.log('  Name:', card.name);
    console.log('  Shared with:', card.shared_with_user_ids);
    console.log('  Share with specific friends:', card.share_with_specific_friends);
    console.log('  Spread ID:', card.spread_id);
    console.log('');
    console.log('Current user:', userId);
    console.log('User owns card:', card.user_id === userId);
    
    // Also check what cards the user owns
    const { data: userCards, error: userCardsError } = await supabase
      .from('cards')
      .select('id, name')
      .eq('user_id', userId)
      .limit(5);
      
    if (!userCardsError) {
      console.log('\nSample cards owned by user:');
      userCards?.forEach(c => console.log(`  - ${c.id}: ${c.name}`));
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkCardOwnership();
