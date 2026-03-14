require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// User IDs for testing
const USER1_EMAIL = 'test1@example.com';
const USER1_PASSWORD = 'testpassword123';
const USER2_ID = '40d7028d-1396-476b-8bce-6eac2ebcab1c'; // ID of user to share with

async function testDirectSharing() {
  console.log('Testing direct card sharing implementation...\n');
  
  try {
    // Sign in as test user
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: USER1_EMAIL,
      password: USER1_PASSWORD
    });
    
    if (signInError || !authData.user) {
      console.error('Error signing in:', signInError);
      return;
    }
    
    console.log(`Signed in as: ${authData.user.email} (${authData.user.id})\n`);
    
    // Step 1: Create a test spread
    console.log('Creating a test spread...');
    const spreadData = {
      name: 'Test Spread for Direct Sharing',
      color: '#6366f1',
      icon: 'FileText',
      is_draft: true,
      user_id: authData.user.id,
      last_modified: new Date().toISOString(),
      draft_data: {
        zoneCards: {} // Will populate once we create cards
      },
      zones: ['zone1', 'zone2'],
      description: 'Test spread for verifying direct sharing'
    };
    
    const { data: spreadResult, error: spreadError } = await supabase
      .from('spreads')
      .insert(spreadData)
      .select()
      .single();
      
    if (spreadError) {
      console.error('Error creating spread:', spreadError);
      return;
    }
    
    console.log(`Created spread: ${spreadResult.name} (${spreadResult.id})`);
    
    // Step 2: Create a couple of test cards owned by current user
    console.log('\nCreating test cards...');
    const cards = [
      {
        name: 'User Owned Card 1',
        content: 'This card is owned by the current user',
        user_id: authData.user.id,
        spread_id: spreadResult.id
      },
      {
        name: 'User Owned Card 2',
        content: 'This card is owned by the current user too',
        user_id: authData.user.id,
        spread_id: spreadResult.id
      }
    ];
    
    const { data: cardsResult, error: cardsError } = await supabase
      .from('cards')
      .insert(cards)
      .select();
      
    if (cardsError) {
      console.error('Error creating cards:', cardsError);
      return;
    }
    
    console.log(`Created ${cardsResult.length} cards`);
    cardsResult.forEach(card => {
      console.log(`  - ${card.name} (${card.id})`);
    });
    
    // Step 3: Update the spread's zoneCards to include these new cards
    const zoneCards = {
      zone1: [cardsResult[0].id],
      zone2: [cardsResult[1].id]
    };
    
    console.log('\nUpdating spread with zoneCards:', zoneCards);
    
    const { error: updateError } = await supabase
      .from('spreads')
      .update({
        draft_data: {
          ...spreadResult.draft_data,
          zoneCards
        }
      })
      .eq('id', spreadResult.id);
      
    if (updateError) {
      console.error('Error updating spread with zoneCards:', updateError);
      return;
    }
    
    // Step 4: Simulate direct sharing
    console.log('\nSimulating direct sharing with user:', USER2_ID);
    
    // 4.1: Update spread shared_with_user_ids
    const { error: shareSpreadError } = await supabase
      .from('spreads')
      .update({
        shared_with_user_ids: [USER2_ID],
        share_with_specific_friends: true
      })
      .eq('id', spreadResult.id);
      
    if (shareSpreadError) {
      console.error('Error sharing spread:', shareSpreadError);
      return;
    }
    
    console.log('✓ Updated spread sharing information');
    
    // 4.2: Update card shared_with_user_ids
    for (const card of cardsResult) {
      const { error: shareCardError } = await supabase
        .from('cards')
        .update({
          shared_with_user_ids: [USER2_ID],
          share_with_specific_friends: true
        })
        .eq('id', card.id);
        
      if (shareCardError) {
        console.error(`Error sharing card ${card.id}:`, shareCardError);
      } else {
        console.log(`✓ Updated sharing for card: ${card.name}`);
      }
    }
    
    // Step 5: Verify the sharing was successful
    console.log('\nVerifying final state:');
    
    const { data: finalSpread, error: finalSpreadError } = await supabase
      .from('spreads')
      .select('*, user:user_id(email)')
      .eq('id', spreadResult.id)
      .single();
      
    if (finalSpreadError) {
      console.error('Error fetching final spread state:', finalSpreadError);
      return;
    }
    
    console.log('Final spread state:');
    console.log(`Name: ${finalSpread.name}`);
    console.log(`Owner: ${finalSpread.user?.email} (${finalSpread.user_id})`);
    console.log(`Shared with: ${JSON.stringify(finalSpread.shared_with_user_ids)}`);
    
    const { data: finalCards, error: finalCardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('spread_id', spreadResult.id);
      
    if (finalCardsError) {
      console.error('Error fetching final cards state:', finalCardsError);
      return;
    }
    
    console.log('\nFinal cards state:');
    finalCards.forEach(card => {
      console.log(`- ${card.name} (${card.id})`);
      console.log(`  Spread ID: ${card.spread_id}`);
      console.log(`  Owner: ${card.user_id}`);
      console.log(`  Shared with: ${JSON.stringify(card.shared_with_user_ids)}`);
    });
    
    console.log('\nDirect sharing test completed successfully!');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  } finally {
    // Sign out
    await supabase.auth.signOut();
    console.log('Signed out.');
  }
}

testDirectSharing();
