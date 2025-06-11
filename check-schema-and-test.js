require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const USER1_EMAIL = 'test1@example.com';
const USER1_PASSWORD = 'testpassword123';
const USER2_ID = '40d7028d-1396-476b-8bce-6eac2ebcab1c'; // ID of user to share with

async function checkSchemaAndTest() {
  console.log('Checking schema and testing card sharing...\n');
  
  try {
    // Sign in as test user
    console.log(`Signing in as ${USER1_EMAIL}...`);
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: USER1_EMAIL,
      password: USER1_PASSWORD
    });
    
    if (signInError || !authData.user) {
      console.error('Error signing in:', signInError);
      return;
    }
    
    console.log(`✓ Signed in as: ${authData.user.email} (${authData.user.id})`);
    
    // Step 1: Check existing cards to understand the schema
    console.log('\nChecking existing cards schema...');
    const { data: existingCards, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .limit(1);
      
    if (fetchError) {
      console.error('Error fetching cards:', fetchError);
      return;
    }
    
    if (existingCards && existingCards.length > 0) {
      const card = existingCards[0];
      console.log('Card schema fields:');
      Object.keys(card).forEach(key => {
        console.log(`- ${key}: ${typeof card[key]}`);
      });
      
      // Create a new card with the correct schema
      console.log('\nCreating new test card...');
      
      // Create new card with all required fields from the schema
      const newCardData = {
        name: 'Card for API Sharing Test',
        user_id: authData.user.id,
        description: 'Test card description',
        type: 'Character', // Required field
        role: 'Test',
        context: 'Testing shared card functionality',
        image_url: 'https://placehold.co/400x600', // Required field
        frame_color: '#FFFFFF',
        name_color: '#000000',
        type_color: '#333333',
        description_color: '#444444',
        context_color: '#555555',
        is_public: false,
        is_shared_with_friends: false,
        share_with_specific_friends: false
      };
      
      const { data: cardResult, error: cardError } = await supabase
        .from('cards')
        .insert(newCardData)
        .select()
        .single();
        
      if (cardError) {
        console.error('Error creating test card:', cardError);
        return;
      }
      
      console.log(`✓ Created card: ${cardResult.name} (${cardResult.id})`);
      
      // Step 2: Update card sharing info
      console.log('\nUpdating card sharing info...');
      
      const { error: shareError } = await supabase
        .from('cards')
        .update({
          shared_with_user_ids: [USER2_ID],
          share_with_specific_friends: true
        })
        .eq('id', cardResult.id);
        
      if (shareError) {
        console.error('Error updating card sharing:', shareError);
        return;
      }
      
      console.log('✓ Updated card sharing info');
      
      // Step 3: Verify the update was successful
      const { data: updatedCard, error: verifyError } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardResult.id)
        .single();
        
      if (verifyError) {
        console.error('Error fetching updated card:', verifyError);
        return;
      }
      
      console.log('\nVerification of card sharing:');
      console.log('Card ID:', updatedCard.id);
      console.log('Card Name:', updatedCard.name);
      console.log('Owner ID:', updatedCard.user_id);
      console.log('Shared With:', JSON.stringify(updatedCard.shared_with_user_ids));
      console.log('Share with Specific Friends:', updatedCard.share_with_specific_friends);
      
      // Check if sharing worked
      if (Array.isArray(updatedCard.shared_with_user_ids) && 
          updatedCard.shared_with_user_ids.includes(USER2_ID)) {
        console.log('\n✓ SUCCESS: Card sharing API is working correctly!');
      } else {
        console.log('\n❌ FAILURE: Card sharing API is not working correctly');
      }
    } else {
      console.log('No existing cards found to determine schema.');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  } finally {
    await supabase.auth.signOut();
    console.log('\nSigned out.');
  }
}

checkSchemaAndTest();
