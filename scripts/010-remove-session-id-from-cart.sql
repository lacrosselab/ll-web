-- Migration: Remove session_id from cart_items table
-- This migrates to a pure user_id-based cart system

-- First, let's see what we're working with
-- (This is just for reference, we'll drop the old constraints)

-- Drop the old unique constraint that includes session_id
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_session_id_product_id_athlete_id_key;

-- Drop the old index on session_id
DROP INDEX IF EXISTS idx_cart_items_session_id;

-- Make session_id nullable (in case there's existing data)
ALTER TABLE public.cart_items ALTER COLUMN session_id DROP NOT NULL;

-- Add new unique constraint based on user_id only
-- This prevents duplicate items for the same user/athlete/product combination
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_user_id_product_id_athlete_id_key 
  UNIQUE(user_id, product_id, athlete_id);

-- Create new index for better performance on user_id queries
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- Optional: Clean up any existing data with null session_id
-- (This is safe to run even if there's no null data)
UPDATE public.cart_items SET session_id = NULL WHERE session_id IS NOT NULL;

-- Note: We're keeping the session_id column for now in case of rollback needs
-- You can drop it later with: ALTER TABLE public.cart_items DROP COLUMN session_id;
