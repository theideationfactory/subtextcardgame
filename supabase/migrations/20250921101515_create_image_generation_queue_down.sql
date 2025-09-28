-- Down Migration: Remove image_generation_queue table and related infrastructure
-- This migration reverses the changes made in 20250921101515_create_image_generation_queue.sql

BEGIN;

-- Drop the trigger first (depends on function and table)
DROP TRIGGER IF EXISTS on_image_generation_queue_updated ON public.image_generation_queue;

-- Drop the function (no longer needed after trigger is removed)
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Revoke permissions (will be automatically revoked with table drop, but explicit for clarity)
REVOKE ALL ON public.image_generation_queue FROM authenticated;

-- Drop all indexes (will be automatically dropped with table, but explicit for clarity)
DROP INDEX IF EXISTS idx_image_generation_queue_user_id;
DROP INDEX IF EXISTS idx_image_generation_queue_user_status;
DROP INDEX IF EXISTS idx_image_generation_queue_status;
DROP INDEX IF EXISTS idx_image_generation_queue_created_at;

-- Drop all RLS policies (will be automatically dropped with table, but explicit for clarity)
DROP POLICY IF EXISTS "User select own" ON public.image_generation_queue;
DROP POLICY IF EXISTS "User insert own" ON public.image_generation_queue;
DROP POLICY IF EXISTS "User update own" ON public.image_generation_queue;

-- Drop the table (this will also drop all associated indexes, constraints, and policies)
DROP TABLE IF EXISTS public.image_generation_queue;

COMMIT;
