-- Complete fix for user sync issues
-- This migration addresses the missing trigger and syncs existing users

-- 1. First, sync any existing users that weren't synced
-- Temporarily disable RLS to allow the sync
ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;

INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', '') as full_name,
  COALESCE(au.raw_user_meta_data->>'avatar_url', '') as avatar_url,
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Re-enable RLS
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

-- 2. Create a policy that allows the trigger to insert users
CREATE POLICY "Allow trigger to insert users" ON "public"."users" 
  FOR INSERT WITH CHECK (true);

-- 3. Drop the trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";

-- 4. Create the trigger to sync future users
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA "auth" TO "postgres";
GRANT SELECT ON "auth"."users" TO "postgres";
