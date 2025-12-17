-- Rebrand: Update admin policies to support both @thelacrosselab.com and @experimentlacrosse.com domains
-- This migration updates the is_admin_user() function and all admin RLS policies to accept both email domains

-- Update the is_admin_user() function to check both domains
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.email ~~ '%@thelacrosselab.com'::text
      OR auth.users.email ~~ '%@experimentlacrosse.com'::text
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update payments table policies
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.email LIKE '%@thelacrosselab.com'
        OR users.email LIKE '%@experimentlacrosse.com'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can insert payments" ON payments;
CREATE POLICY "Admins can insert payments" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.email LIKE '%@thelacrosselab.com'
        OR users.email LIKE '%@experimentlacrosse.com'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update payments" ON payments;
CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.email LIKE '%@thelacrosselab.com'
        OR users.email LIKE '%@experimentlacrosse.com'
      )
    )
  );

-- Update payment_athletes table policies
DROP POLICY IF EXISTS "Admins can insert payment athletes" ON payment_athletes;
CREATE POLICY "Admins can insert payment athletes" ON payment_athletes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.email LIKE '%@thelacrosselab.com'
        OR users.email LIKE '%@experimentlacrosse.com'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update payment athletes" ON payment_athletes;
CREATE POLICY "Admins can update payment athletes" ON payment_athletes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.email LIKE '%@thelacrosselab.com'
        OR users.email LIKE '%@experimentlacrosse.com'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can view all payment athletes" ON payment_athletes;
CREATE POLICY "Admins can view all payment athletes" ON payment_athletes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (
        users.email ~~ '%@thelacrosselab.com'::text
        OR users.email ~~ '%@experimentlacrosse.com'::text
      )
    )
  );

-- Update product_sessions table policies
DROP POLICY IF EXISTS "Admins can manage all product_sessions" ON product_sessions;
CREATE POLICY "Admins can manage all product_sessions"
  ON product_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (
        users.email ~~ '%@thelacrosselab.com'::text
        OR users.email ~~ '%@experimentlacrosse.com'::text
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (
        users.email ~~ '%@thelacrosselab.com'::text
        OR users.email ~~ '%@experimentlacrosse.com'::text
      )
    )
  );

-- Update products table policies
DROP POLICY IF EXISTS "Admins can manage all products" ON products;
CREATE POLICY "Admins can manage all products" ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (
        users.email ~~ '%@thelacrosselab.com'::text
        OR users.email ~~ '%@experimentlacrosse.com'::text
      )
    )
  );

-- Update athletes table policies
DROP POLICY IF EXISTS "Admins can view all athletes" ON athletes;
CREATE POLICY "Admins can view all athletes" ON athletes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (
        users.email ~~ '%@thelacrosselab.com'::text
        OR users.email ~~ '%@experimentlacrosse.com'::text
      )
    )
  );

-- Update users table policy
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users" ON "public"."users"
  FOR SELECT
  USING (is_admin_user());
