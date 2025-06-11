/*
  # Create storage bucket for card images

  1. Changes
    - Create a new storage bucket for card images
    - Set up storage policies for authenticated users

  2. Security
    - Users can only upload/access their own card images
    - Images are stored in user-specific folders
    - Only allow image file types
*/

-- Create a new storage bucket for card images
INSERT INTO storage.buckets (id, name)
VALUES ('card_images', 'card_images')
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload images
CREATE POLICY "Users can upload their own card images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'card_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow users to read their own images
CREATE POLICY "Users can read their own card images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'card_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow users to update their own images
CREATE POLICY "Users can update their own card images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'card_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow users to delete their own images
CREATE POLICY "Users can delete their own card images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'card_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);