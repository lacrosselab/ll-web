-- =====================================================
-- Fix RLS Policies for Cart and Payment Functionality
-- =====================================================

-- 1. Fix the payment_athletes policy that's causing 406 errors
-- Drop the existing restrictive policy (if it exists)
DROP POLICY IF EXISTS "Users can view own payment athletes" ON payment_athletes;

-- Create a new policy that allows users to check purchase history for their own athletes
CREATE POLICY "Users can view payment athletes for own athletes" ON payment_athletes
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM athletes 
    WHERE athletes.id = payment_athletes.athlete_id 
    AND athletes.user_id = auth.uid()
  )
);

-- 2. Ensure cart_items policy allows proper access
-- Drop and recreate to ensure it's correct
DROP POLICY IF EXISTS "Users can manage own cart items" ON cart_items;

CREATE POLICY "Users can manage own cart items" ON cart_items
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Ensure all necessary tables have RLS enabled
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

-- 4. Verify the policies are working by checking they exist
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('cart_items', 'payment_athletes', 'products', 'athletes')
ORDER BY tablename, policyname;
