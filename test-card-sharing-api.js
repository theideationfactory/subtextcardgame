require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const USER1_EMAIL = 'test1@example.com';
const USER1_PASSWORD = 'testpassword123';
const USER2_ID = '40d7028d-1396-476b-8bce-6eac2ebcab1c'; // ID of user to share with

async function testCardSharingApi() {
  console.log('Testing card sharing API implementation...\n');
  
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
    
    // Step 1: Create test cards
    console.log('\nCreating test cards...');
    
    const cardData = {
      name: 'Card for API Sharing Test',
      content: 'This is a test card for API sharing',
      user_id: authData.user.id
    };
    
    const { data: cardResult, error: cardError } = await supabase
      .from('cards')
      .insert(cardData)
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
    const { data: updatedCard, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardResult.id)
      .single();
      
    if (fetchError) {
      console.error('Error fetching updated card:', fetchError);
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
    
  } catch (err) {
    console.error('Unexpected error:', err);
  } finally {
    await supabase.auth.signOut();
    console.log('\nSigned out.');
  }
}

testCardSharingApi();
