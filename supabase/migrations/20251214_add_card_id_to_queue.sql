-- Add card_id column to image_generation_queue for tracking created cards
ALTER TABLE public.image_generation_queue 
ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL;

-- Add index for card_id lookups
CREATE INDEX IF NOT EXISTS idx_image_generation_queue_card_id 
ON public.image_generation_queue(card_id);

-- Add DELETE policy so users can delete their own queue items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'image_generation_queue' 
    AND policyname = 'User delete own'
  ) THEN
    CREATE POLICY "User delete own"
    ON public.image_generation_queue FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- Grant DELETE permission
GRANT DELETE ON public.image_generation_queue TO authenticated;
