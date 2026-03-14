require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use service role key to bypass RLS for import
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function importTestCards() {
  console.log('Importing test cards...\n');
  
  // Sample cards from the CSV - focusing on the ones referenced in spreads
  const testCards = [
    {
      id: 'ae6573f1-d851-448d-b1de-5e3bbc2bd91c',
      name: 'Test',
      description: 'Test',
      type: 'TBD',
      role: 'TBD',
      context: 'TBD',
      image_url: 'https://xhdkegkrmyixuxdvcqqu.supabase.co/storage/v1/object/public/card_images/40d7028d-1396-476b-8bce-6eac2ebcab1c/1748966036101-test.png',
      user_id: '40d7028d-1396-476b-8bce-6eac2ebcab1c',
      frame_width: 8,
      frame_color: '#808080',
      name_color: '#FFFFFF',
      type_color: '#FFFFFF',
      description_color: '#FFFFFF',
      context_color: '#CCCCCC',
      collection_id: '4db66cb0-e16b-430c-8d4e-dde7346122c2',
      is_public: false,
      is_shared_with_friends: false,
      share_with_specific_friends: true,
      shared_with_user_ids: [],
      spread_id: null
    },
    {
      id: 'e8ca2672-1801-4d87-9339-f74ea0ff7749',
      name: 'Emotional Deflection',
      description: '',
      type: 'TBD',
      role: 'TBD',
      context: 'TBD',
      image_url: 'https://xhdkegkrmyixuxdvcqqu.supabase.co/storage/v1/object/public/card_images/40d7028d-1396-476b-8bce-6eac2ebcab1c/1748668028118-emotional-deflection.png',
      user_id: '40d7028d-1396-476b-8bce-6eac2ebcab1c',
      frame_width: 8,
      frame_color: '#808080',
      name_color: '#FFFFFF',
      type_color: '#FFFFFF',
      description_color: '#FFFFFF',
      context_color: '#CCCCCC',
      collection_id: '4db66cb0-e16b-430c-8d4e-dde7346122c2',
      is_public: false,
      is_shared_with_friends: true,
      share_with_specific_friends: false,
      shared_with_user_ids: [],
      spread_id: null
    },
    {
      id: 'e8e72a03-c657-43a7-b3c1-3e7d8c18a714',
      name: 'Anger',
      description: 'Fierce focused protective obstinate emotional energy',
      type: 'Card',
      role: 'General',
      context: 'Fantasy',
      image_url: 'https://xhdkegkrmyixuxdvcqqu.supabase.co/storage/v1/object/public/card_images/40d7028d-1396-476b-8bce-6eac2ebcab1c/1748631643241-anger.png',
      user_id: '40d7028d-1396-476b-8bce-6eac2ebcab1c',
      frame_width: 8,
      frame_color: '#808080',
      name_color: '#FFFFFF',
      type_color: '#FFFFFF',
      description_color: '#FFFFFF',
      context_color: '#CCCCCC',
      collection_id: '0e607240-a662-4a0e-b395-5305ceca35d5',
      is_public: false,
      is_shared_with_friends: false,
      share_with_specific_friends: false,
      shared_with_user_ids: [],
      spread_id: null
    },
    {
      id: '2b67cd42-1039-40ac-93d4-404ed671b042',
      name: 'Double Standard',
      description: 'Inconsistently applying a principle for accountability or access.',
      type: 'Card',
      role: 'General',
      context: 'Fantasy',
      image_url: 'https://xhdkegkrmyixuxdvcqqu.supabase.co/storage/v1/object/public/card_images/40d7028d-1396-476b-8bce-6eac2ebcab1c/1748630876456-double-standard.png',
      user_id: '40d7028d-1396-476b-8bce-6eac2ebcab1c',
      frame_width: 8,
      frame_color: '#808080',
      name_color: '#FFFFFF',
      type_color: '#FFFFFF',
      description_color: '#FFFFFF',
      context_color: '#CCCCCC',
      collection_id: '6829c712-4895-4d48-b508-661eebf2a71d',
      is_public: true,
      is_shared_with_friends: false,
      share_with_specific_friends: false,
      shared_with_user_ids: [],
      spread_id: null
    },
    {
      id: '8e4e94a2-15b2-4186-a38b-d7c2b243f75d',
      name: 'Test',
      description: 'A measurement of how well implemented something is according to a goal or ideal',
      type: 'Percept',
      role: 'Judge',
      context: 'Art',
      image_url: 'https://xhdkegkrmyixuxdvcqqu.supabase.co/storage/v1/object/public/card_images/a0b60b23-9678-46cd-8a20-10370bfdf411/1747198041451-test.png',
      user_id: 'a0b60b23-9678-46cd-8a20-10370bfdf411',
      frame_width: 8,
      frame_color: '#808080',
      name_color: '#FFFFFF',
      type_color: '#FFFFFF',
      description_color: '#FFFFFF',
      context_color: '#CCCCCC',
      collection_id: '1156941d-a939-40c2-99d1-ca97158d975f',
      is_public: true,
      is_shared_with_friends: false,
      share_with_specific_friends: false,
      shared_with_user_ids: [],
      spread_id: null
    }
  ];
  
  try {
    // Insert cards
    for (const card of testCards) {
      const { data, error } = await supabase
        .from('cards')
        .upsert(card, { onConflict: 'id' })
        .select();
        
      if (error) {
        console.error(`Error inserting card ${card.id}:`, error);
      } else {
        console.log(`✓ Imported card: ${card.name} (${card.id})`);
      }
    }
    
    // Verify import
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

importTestCards();
