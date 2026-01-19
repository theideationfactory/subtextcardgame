-- Fix image generation queue access for guest/anonymous users
-- This allows anonymous authenticated users to access their own queue entries

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "User select own" ON public.image_generation_queue;
DROP POLICY IF EXISTS "User insert own" ON public.image_generation_queue;
DROP POLICY IF EXISTS "User update own" ON public.image_generation_queue;
DROP POLICY IF EXISTS "User delete own" ON public.image_generation_queue;

-- Recreate policies with anon role included
-- SELECT policy: Allow users to read their own queue entries
CREATE POLICY "Users can select own queue entries"
ON public.image_generation_queue FOR SELECT
USING (auth.uid() = user_id);

-- INSERT policy: Allow users to create their own queue entries
CREATE POLICY "Users can insert own queue entries"
ON public.image_generation_queue FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: Allow users to update their own queue entries
CREATE POLICY "Users can update own queue entries"
ON public.image_generation_queue FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Allow users to delete their own queue entries
CREATE POLICY "Users can delete own queue entries"
ON public.image_generation_queue FOR DELETE
USING (auth.uid() = user_id);

-- Grant permissions to both authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_queue TO authenticated, anon;

-- Also ensure cards table allows anonymous users to save cards
-- Check if we need to update cards table policies
DO $$
BEGIN
  -- Add policy for anonymous users to insert cards if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cards' 
    AND policyname = 'Users can insert own cards'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert their own cards" ON public.cards;
    CREATE POLICY "Users can insert own cards"
    ON public.cards FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Add policy for anonymous users to select their own cards
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cards' 
    AND policyname = 'Users can select own cards'
  ) THEN
    DROP POLICY IF EXISTS "Users can select their own cards" ON public.cards;
    CREATE POLICY "Users can select own cards"
    ON public.cards FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure collections table allows anonymous users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collections' 
    AND policyname = 'Users can insert own collections'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert their own collections" ON public.collections;
    CREATE POLICY "Users can insert own collections"
    ON public.collections FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collections' 
    AND policyname = 'Users can select own collections'
  ) THEN
    DROP POLICY IF EXISTS "Users can select their own collections" ON public.collections;
    CREATE POLICY "Users can select own collections"
    ON public.collections FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Grant table permissions to both authenticated and anon
GRANT SELECT, INSERT ON public.cards TO authenticated, anon;
GRANT SELECT, INSERT ON public.collections TO authenticated, anon;

COMMIT;
