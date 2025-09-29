-- Add missing admin RLS policies for users and payments tables
-- This allows admins to view all user profiles and payment details

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all users" ON "public"."users";
DROP POLICY IF EXISTS "Admins can view all payments" ON "public"."payments";

-- For users table, check if current user is admin by checking their email directly from auth.uid()
-- Use a function to avoid recursion
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email ~~ '%@thelacrosselab.com'::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- For users table, use the function to avoid recursion
CREATE POLICY "Admins can view all users" ON "public"."users" FOR SELECT USING (is_admin_user());

-- For payments table, use the same function
CREATE POLICY "Admins can view all payments" ON "public"."payments" FOR SELECT USING (is_admin_user());
