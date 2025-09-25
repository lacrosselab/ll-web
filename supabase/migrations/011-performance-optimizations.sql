-- Performance Optimizations for Supabase
-- Fixes RLS policy performance issues and adds missing indexes
-- Only targets tables that actually exist

-- ==============================================
-- 1. FIX RLS POLICY PERFORMANCE ISSUES
-- ==============================================

-- Drop existing policies that use auth.uid() directly
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;

-- Only drop subscription policies if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
        DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
        DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
    END IF;
END $$;

-- Recreate policies with optimized auth.uid() calls using subqueries
-- This prevents auth.uid() from being called for each row

-- Users table policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id = (SELECT auth.uid()));

-- Payments table policies  
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own payments" ON public.payments
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- Subscriptions table policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
          FOR SELECT USING (user_id = (SELECT auth.uid()));

        CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
          FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

        CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
          FOR UPDATE USING (user_id = (SELECT auth.uid()));
    END IF;
END $$;

-- ==============================================
-- 2. ADD MISSING COVERING INDEXES
-- ==============================================

-- Add covering index for cart_items athlete_id foreign key
-- This will improve JOIN performance when querying cart items with athlete data
CREATE INDEX IF NOT EXISTS idx_cart_items_athlete_id_covering 
ON public.cart_items(athlete_id) 
INCLUDE (id, user_id, product_id, quantity, created_at, updated_at);

-- Add covering index for payment_athletes product_id foreign key  
-- This will improve JOIN performance when querying payment data with product info
CREATE INDEX IF NOT EXISTS idx_payment_athletes_product_id_covering
ON public.payment_athletes(product_id)
INCLUDE (id, payment_id, athlete_id, created_at);

-- ==============================================
-- 3. ADDITIONAL PERFORMANCE INDEXES
-- ==============================================

-- Index for cart_items queries by user_id (already exists but ensure it's optimized)
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id_optimized 
ON public.cart_items(user_id, created_at DESC);

-- Index for payment_athletes queries by payment_id
CREATE INDEX IF NOT EXISTS idx_payment_athletes_payment_id
ON public.payment_athletes(payment_id);

-- Index for athletes queries by user_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_athletes_user_id
ON public.athletes(user_id, created_at DESC);

-- Index for payments queries by user_id (if not exists)  
CREATE INDEX IF NOT EXISTS idx_payments_user_id
ON public.payments(user_id, created_at DESC);

-- ==============================================
-- 4. ANALYZE TABLES FOR QUERY OPTIMIZER
-- ==============================================

-- Update table statistics for better query planning
ANALYZE public.users;
ANALYZE public.payments;
ANALYZE public.cart_items;
ANALYZE public.payment_athletes;
ANALYZE public.athletes;
ANALYZE public.products;

-- Only analyze subscriptions if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        ANALYZE public.subscriptions;
    END IF;
END $$;

-- ==============================================
-- 5. VERIFY OPTIMIZATIONS
-- ==============================================

-- Check that policies are using subqueries
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND (qual LIKE '%SELECT auth.uid()%' OR qual LIKE '%auth.uid()%')
ORDER BY tablename, policyname;

-- Check that indexes were created
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (indexname LIKE '%covering%' OR indexname LIKE '%optimized%')
ORDER BY tablename, indexname;
