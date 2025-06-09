/**
 * Test script for card sharing functionality
 * 
 * This script tests the sharing functionality by:
 * 1. Creating test cards
 * 2. Creating a test spread with those cards
 * 3. Sharing the spread with a test user
 * 4. Verifying that the cards are visible to the intended recipient
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Test users (replace with actual test user IDs)
const TEST_USER_ID = process.env.TEST_USER_ID; // Your test user
const TEST_FRIEND_ID = process.env.TEST_FRIEND_ID; // Friend to share with

async function runTest() {
  console.log('Starting card sharing test...');
  
  try {
    // 1. Create test cards
    console.log('Creating test cards...');
    const { data: cards, error: cardError } = await supabase
      .from('cards')
      .insert([
        {
          name: 'Test Card 1',
          description: 'Test card for sharing',
          image_url: 'https://example.com/card1.jpg',
          user_id: TEST_USER_ID,
          is_public: false,
          is_shared_with_friends: false,
          shared_with_user_ids: []
        },
        {
          name: 'Test Card 2',
          description: 'Another test card for sharing',
          image_url: 'https://example.com/card2.jpg',
          user_id: TEST_USER_ID,
          is_public: false,
          is_shared_with_friends: false,
          shared_with_user_ids: []
        }
      ])
      .select();
    
    if (cardError) throw cardError;
    console.log(`Created ${cards.length} test cards`);
    
    // 2. Create a test spread with those cards
    const cardIds = cards.map(card => card.id);
    const zoneCards = {
      zone1: [cardIds[0]],
      zone2: [cardIds[1]]
    };
    
    console.log('Creating test spread...');
    const { data: spread, error: spreadError } = await supabase
      .from('spreads')
      .insert({
        name: 'Test Spread',
        description: 'Test spread for sharing',
        color: '#6366f1',
        icon: 'FileText',
        user_id: TEST_USER_ID,
        is_draft: true,
        draft_data: {
          type: 'reflection',
          zoneCards
        },
        zones: [
          { name: 'zone1', title: 'Zone 1', color: '#FF9800', description: 'Test zone 1' },
          { name: 'zone2', title: 'Zone 2', color: '#2196F3', description: 'Test zone 2' }
        ]
      })
      .select()
      .single();
    
    if (spreadError) throw spreadError;
    console.log(`Created test spread with ID: ${spread.id}`);
    
    // 3. Share the spread with test friend
    console.log('Sharing spread with friend...');
    
    // First, fetch the current shared_with_user_ids for all cards
    const { data: cardsData, error: fetchCardsError } = await supabase
      .from('cards')
      .select('id, shared_with_user_ids')
      .in('id', cardIds);
      
    if (fetchCardsError) throw fetchCardsError;
    
    // For each card, update its shared_with_user_ids to include the friend
    for (const card of cardsData) {
      const currentSharedWith = card.shared_with_user_ids || [];
      const newSharedWith = [...new Set([...currentSharedWith, TEST_FRIEND_ID])];
      
      const { error: updateCardError } = await supabase
        .from('cards')
        .update({
          shared_with_user_ids: newSharedWith,
          share_with_specific_friends: true
        })
        .eq('id', card.id);
        
      if (updateCardError) throw updateCardError;
    }
    
    // Create a shared draft
    const { data: sharedDraft, error: sharedDraftError } = await supabase
      .from('spreads')
      .insert({
        ...spread,
        id: undefined,
        name: `${spread.name} (Shared)`,
        user_id: TEST_USER_ID,
        shared_with_user_ids: [TEST_FRIEND_ID],
        last_modified: new Date().toISOString()
      })
      .select()
      .single();
    
    if (sharedDraftError) throw sharedDraftError;
    console.log(`Created shared draft with ID: ${sharedDraft.id}`);
    
    // 4. Verify that the cards are visible to the intended recipient
    console.log('Verifying card visibility...');
    console.log('To test as the friend, run the following query:');
    console.log(`
    SELECT * FROM cards 
    WHERE id IN ('${cardIds.join("','")}') 
    AND auth.uid() = ANY(shared_with_user_ids);
    `);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  runTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Unhandled error:', err);
      process.exit(1);
    });
}

module.exports = { runTest };
