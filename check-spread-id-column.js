require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSpreadIdColumn() {
  console.log('Checking if spread_id column exists in cards table...');
  
  try {
    // Try to query the spread_id column
    const { data, error } = await supabase
      .from('cards')
      .select('id, spread_id')
      .limit(5);
      
    if (error) {
      console.error('Error querying spread_id column:', error);
      if (error.message.includes('column "spread_id" does not exist')) {
        console.log('❌ The spread_id column does not exist in the cards table.');
        console.log('You need to apply the migration: 20250609221500_add_spread_id_to_cards.sql');
      }
    } else {
      console.log('✅ The spread_id column exists in the cards table.');
      console.log('Sample data:', data);
      
      // Check how many cards have spread_id set
      const { data: cardsWithSpreadId, error: countError } = await supabase
        .from('cards')
        .select('id, spread_id')
        .not('spread_id', 'is', null);
        
      if (countError) {
        console.error('Error counting cards with spread_id:', countError);
      } else {
        console.log(`Found ${cardsWithSpreadId.length} cards with spread_id set.`);
        cardsWithSpreadId.forEach(card => {
          console.log(`  Card ${card.id}: spread_id = ${card.spread_id}`);
        });
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkSpreadIdColumn();
