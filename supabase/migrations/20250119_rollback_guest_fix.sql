-- Rollback the guest user fix that broke database access
-- This restores the original policies

BEGIN;

-- Restore image_generation_queue policies to original state
DROP POLICY IF EXISTS "Users can select own queue entries" ON public.image_generation_queue;
DROP POLICY IF EXISTS "Users can insert own queue entries" ON public.image_generation_queue;
DROP POLICY IF EXISTS "Users can update own queue entries" ON public.image_generation_queue;
DROP POLICY IF EXISTS "Users can delete own queue entries" ON public.image_generation_queue;

CREATE POLICY "User select own" 
ON public.image_generation_queue FOR SELECT 
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "User insert own"
ON public.image_generation_queue FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "User update own" 
ON public.image_generation_queue FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Revoke the broad permissions we added
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.image_generation_queue FROM anon;

-- Don't touch cards and collections policies - they might have been working fine
-- Just ensure basic authenticated access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_queue TO authenticated;

COMMIT;
