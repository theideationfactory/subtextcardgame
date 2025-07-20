-- Fix Background Gradient Default Issue
-- This removes the unwanted default purple gradient from all existing cards
-- Run this in the Supabase Dashboard SQL Editor

-- Step 1: Remove the default value from the column
ALTER TABLE cards 
ALTER COLUMN background_gradient DROP DEFAULT;

-- Step 2: Set all cards with the default purple gradient back to NULL
-- This ensures only cards where users explicitly selected a gradient will have one
UPDATE cards 
SET background_gradient = NULL 
WHERE background_gradient = '["#6366f1","#8b5cf6"]';

-- Step 3: Verify the fix
SELECT 
  COUNT(*) as total_cards,
  COUNT(background_gradient) as cards_with_gradients,
  COUNT(*) - COUNT(background_gradient) as cards_without_gradients
FROM cards;

-- Step 4: Show sample of remaining gradients (should only be user-selected ones)
SELECT DISTINCT background_gradient 
FROM cards 
WHERE background_gradient IS NOT NULL 
LIMIT 10;
