/**
 * Script to check the sharing status of a specific card
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Card IDs to check (from the logs)
const CARD_IDS = [
  "c4e38ecb-0f87-4c87-a758-10ecc97dfbe2",
  "eb3e4f6b-372d-4f83-8358-c2a611b5970f"
];

async function checkCardStatus() {
  console.log('Checking card sharing settings...\n');
  
  for (const cardId of CARD_IDS) {
    console.log(`Looking up card: ${cardId}`);
    
    try {
      // Fetch card details
      const { data, error } = await supabase
        .from('cards')
        .select(`
          id,
          name,
          description,
          user_id,
          is_public,
          is_shared_with_friends,
          share_with_specific_friends,
          shared_with_user_ids
        `)
        .eq('id', cardId);
        
      if (error) {
        console.error(`❌ Error fetching card ${cardId}:`, error.message);
        continue;
      }
      
      if (!data || data.length === 0) {
        console.error(`❌ Card ${cardId} not found`);
        continue;
      }
      
      // Use the first result
      const card = data[0];
      
      console.log(`\n✅ Card found: "${card.name}"`);
      console.log(`Description: ${card.description.substring(0, 50)}${card.description.length > 50 ? '...' : ''}`);
      console.log('Sharing settings:');
      console.log(`  - is_public: ${card.is_public}`);
      console.log(`  - is_shared_with_friends: ${card.is_shared_with_friends}`);
      console.log(`  - share_with_specific_friends: ${card.share_with_specific_friends}`);
      console.log(`  - shared_with_user_ids: ${JSON.stringify(card.shared_with_user_ids)}`);
      
      // Check if sharing settings are as expected
      if (card.share_with_specific_friends && card.shared_with_user_ids && card.shared_with_user_ids.length > 0) {
        console.log('✅ Success! Card has correct sharing settings.');
        console.log(`   Shared with ${card.shared_with_user_ids.length} users.\n`);
      } else if (!card.share_with_specific_friends) {
        console.log('❌ Issue: share_with_specific_friends is FALSE.\n');
      } else if (!card.shared_with_user_ids || card.shared_with_user_ids.length === 0) {
        console.log('❌ Issue: shared_with_user_ids is empty.\n');
      }
      
    } catch (err) {
      console.error(`Error checking card ${cardId}:`, err);
    }
  }
  
  console.log('\nCheck complete.');
}

// Run the check
checkCardStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
