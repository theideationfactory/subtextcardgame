require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create client with anon key
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestScenario() {
  console.log('Creating test scenario for card sharing...\n');
  
  try {
    // First, sign in as a test user
    const email = 'test1@example.com';
    const password = 'testpassword123';
    
    // Try to sign in first
    let { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    // If sign in fails, try to create the user
    if (signInError) {
      console.log('Creating new test user...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (signUpError) {
        console.error('Error creating user:', signUpError);
        return;
      }
      
      authData = signUpData;
    }
    
    if (!authData.user) {
      console.error('No user data available');
      return;
    }
    
    console.log(`Signed in as: ${authData.user.email} (${authData.user.id})`);
    
    // Create some test cards for this user
    const testCards = [
      {
        name: 'Test Card 1',
        description: 'This is a test card for sharing',
        type: 'Test',
        role: 'General',
        context: 'Testing',
        image_url: 'https://via.placeholder.com/300',
        user_id: authData.user.id,
        is_public: false,
        is_shared_with_friends: false,
        share_with_specific_friends: false,
        shared_with_user_ids: []
      },
      {
        name: 'Test Card 2',
        description: 'Another test card',
        type: 'Test',
        role: 'General',
        context: 'Testing',
        image_url: 'https://via.placeholder.com/300',
        user_id: authData.user.id,
        is_public: false,
        is_shared_with_friends: false,
        share_with_specific_friends: false,
        shared_with_user_ids: []
      },
      {
        name: 'Public Test Card',
        description: 'This card is public',
        type: 'Test',
        role: 'General',
        context: 'Testing',
        image_url: 'https://via.placeholder.com/300',
        user_id: authData.user.id,
        is_public: true,
        is_shared_with_friends: false,
        share_with_specific_friends: false,
        shared_with_user_ids: []
      }
    ];
    
    const createdCardIds = [];
    
    for (const card of testCards) {
      const { data, error } = await supabase
        .from('cards')
        .insert(card)
        .select()
        .single();
        
      if (error) {
        console.error(`Error creating card ${card.name}:`, error);
      } else {
        console.log(`✓ Created card: ${data.name} (${data.id})`);
        createdCardIds.push(data.id);
      }
    }
    
    // Create a test spread with these cards
    if (createdCardIds.length > 0) {
      const testSpread = {
        name: 'Test Spread for Sharing',
        description: 'A test spread to verify card sharing functionality',
        color: '#FF6B6B',
        icon: '🎯',
        user_id: authData.user.id,
        zones: {}, // Legacy zones field (required by schema)
        is_draft: true,
        draft_data: {
          type: 'test',
          zoneCards: {
            'zone1': [createdCardIds[0]],
            'zone2': createdCardIds.slice(1)
          }
        },
        share_with_specific_friends: false,
        shared_with_user_ids: []
      };
      
      const { data: spreadData, error: spreadError } = await supabase
        .from('spreads')
        .insert(testSpread)
        .select()
        .single();
        
      if (spreadError) {
        console.error('Error creating spread:', spreadError);
      } else {
        console.log(`\n✓ Created test spread: ${spreadData.name} (${spreadData.id})`);
        console.log('  Zone cards:', JSON.stringify(spreadData.draft_data.zoneCards, null, 2));
      }
    }
    
    // Sign out
    await supabase.auth.signOut();
    console.log('\nTest scenario created successfully!');
    console.log('You can now test sharing this spread in the app.');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createTestScenario();
