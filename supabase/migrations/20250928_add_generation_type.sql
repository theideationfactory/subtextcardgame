-- Add generation_type column to support enhanced card generation
BEGIN;

ALTER TABLE public.image_generation_queue 
ADD COLUMN generation_type text DEFAULT 'standard' CHECK (generation_type IN ('standard', 'enhanced'));

-- Create index for generation type queries
CREATE INDEX idx_image_generation_queue_generation_type ON public.image_generation_queue(generation_type);

COMMIT;
