require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use service role key if available, otherwise anon key
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function applySharedSpreadsPolicy() {
  console.log('Applying shared spreads policy...\n');
  
  try {
    // First, drop the existing policy if it exists
    const dropResult = await supabase.rpc('exec_sql', {
      sql: `DROP POLICY IF EXISTS "Users can view spreads shared with them" ON spreads;`
    });
    
    if (dropResult.error) {
      console.log('Note: Could not drop policy (might not exist):', dropResult.error.message);
    }
    
    // Create the new policy
    const createResult = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view spreads shared with them" ON spreads
          FOR SELECT
          TO authenticated
          USING (
            auth.uid() = user_id OR
            (share_with_specific_friends = true AND auth.uid() = ANY(shared_with_user_ids))
          );
      `
    });
    
    if (createResult.error) {
      console.error('Error creating policy:', createResult.error);
    } else {
      console.log('✓ Successfully created shared spreads policy');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

applySharedSpreadsPolicy();
