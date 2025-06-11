/*
  # Update storage policies for card images

  1. Changes
    - Add policy to allow public read access to card images
    - Keep existing policies for authenticated user operations

  2. Security
    - Anyone can read card images
    - Only authenticated users can create/update/delete their own images
*/

-- Add policy to allow public read access to card images
CREATE POLICY "Allow public read access to card images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'card_images');

-- Update existing read policy to be more specific
DROP POLICY IF EXISTS "Users can read their own card images" ON storage.objects;

CREATE POLICY "Users can read their own card images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'card_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);