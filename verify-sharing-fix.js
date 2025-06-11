require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function verifySharingFix() {
  console.log('Verifying card sharing fix...\n');
  
  try {
    // Sign in as test user
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test1@example.com',
      password: 'testpassword123'
    });
    
    if (signInError || !authData.user) {
      console.error('Error signing in:', signInError);
      return;
    }
    
    console.log(`Signed in as: ${authData.user.email} (${authData.user.id})\n`);
    
    // Check existing cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', authData.user.id);
      
    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
    } else {
      console.log(`Found ${cards?.length || 0} cards owned by user`);
      cards?.forEach(card => {
        console.log(`  - ${card.name} (${card.id})`);
        console.log(`    Spread ID: ${card.spread_id || 'NULL'}`);
        console.log(`    Shared with: ${JSON.stringify(card.shared_with_user_ids)}`);
      });
    }
    
    // Check spreads
    console.log('\nChecking spreads...');
    const { data: spreads, error: spreadsError } = await supabase
      .from('spreads')
      .select('*')
      .eq('user_id', authData.user.id);
      
    if (spreadsError) {
      console.error('Error fetching spreads:', spreadsError);
    } else {
      console.log(`Found ${spreads?.length || 0} spreads owned by user`);
      spreads?.forEach(spread => {
        console.log(`  - ${spread.name} (${spread.id})`);
        console.log(`    Shared with: ${JSON.stringify(spread.shared_with_user_ids)}`);
        if (spread.draft_data?.zoneCards) {
          const cardCount = Object.values(spread.draft_data.zoneCards).flat().length;
          console.log(`    Cards in zones: ${cardCount}`);
        }
      });
    }
    
    // Test the sharing logic manually
    console.log('\n--- Testing Sharing Logic ---');
    
    if (cards && cards.length > 0 && spreads && spreads.length > 0) {
      const testCard = cards[0];
      const testSpread = spreads[0];
      
      console.log(`\nSimulating sharing of spread "${testSpread.name}"`);
      console.log(`Card to duplicate: "${testCard.name}" (${testCard.id})`);
      
      // Simulate the sharing logic from handleSendDraft
      const testUserId = '40d7028d-1396-476b-8bce-6eac2ebcab1c'; // Another user ID
      
      // Check if card is owned by current user
      if (testCard.user_id === authData.user.id) {
        console.log('✓ Card is owned by current user - would be duplicated');
        
        // Test creating a duplicate
        const newCard = {
          ...testCard,
          id: undefined,
          shared_with_user_ids: [testUserId],
          share_with_specific_friends: true,
          spread_id: 'test-spread-id'
        };
        
        console.log('\nNew card would have:');
        console.log(`  - New ID (auto-generated)`);
        console.log(`  - shared_with_user_ids: ${JSON.stringify(newCard.shared_with_user_ids)}`);
        console.log(`  - share_with_specific_friends: ${newCard.share_with_specific_friends}`);
        console.log(`  - spread_id: ${newCard.spread_id}`);
      } else {
        console.log('✗ Card not owned by current user - would keep original ID');
      }
    }
    
    await supabase.auth.signOut();
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

verifySharingFix();
