/*
  # Update card policies

  1. Changes
    - Add UPDATE policy to allow users to modify their own cards
    - Add DELETE policy to allow users to delete their own cards

  2. Security
    - Users can only update their own cards
    - Users can only delete their own cards
*/

-- Add UPDATE policy
CREATE POLICY "Users can update their own cards"
ON public.cards
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy
CREATE POLICY "Users can delete their own cards"
ON public.cards
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);