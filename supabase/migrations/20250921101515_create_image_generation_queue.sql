-- Migration: Create image_generation_queue table for background image processing
-- This migration creates the infrastructure for queued, asynchronous image generation
-- Follows Supabase best practices for security, performance, and maintainability

BEGIN;

-- Create the image_generation_queue table with bigint identity PK (Supabase standard)
CREATE TABLE public.image_generation_queue (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  image_url text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT check_valid_status CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

-- Enable Row Level Security
ALTER TABLE public.image_generation_queue ENABLE ROW LEVEL SECURITY;

-- Create performance indexes
-- Single-column index on FK for join performance
CREATE INDEX idx_image_generation_queue_user_id ON public.image_generation_queue(user_id);
-- Composite index for user-specific status queries
CREATE INDEX idx_image_generation_queue_user_status ON public.image_generation_queue(user_id, status);
-- Status index for admin/system queries
CREATE INDEX idx_image_generation_queue_status ON public.image_generation_queue(status);
-- Created_at index for cleanup and ordering
CREATE INDEX idx_image_generation_queue_created_at ON public.image_generation_queue(created_at);

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.image_generation_queue TO authenticated;

-- Create RLS policies with explicit role targeting and proper UPDATE policy
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

-- Create secure function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY INVOKER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW; 
END;
$$;

-- Create trigger to call the function
CREATE TRIGGER on_image_generation_queue_updated
BEFORE UPDATE ON public.image_generation_queue
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

COMMIT;
