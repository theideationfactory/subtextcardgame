/*
  # Add RLS policy for viewing shared spreads
  
  1. Changes
    - Add policy to allow users to view spreads shared with them
    - This fixes the infinite recursion issue when cards reference shared spreads
    
  2. Security
    - Users can only view spreads that are explicitly shared with them
*/

-- Add policy for viewing shared spreads
CREATE POLICY "Users can view spreads shared with them" ON spreads
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    (share_with_specific_friends = true AND auth.uid() = ANY(shared_with_user_ids))
  );
